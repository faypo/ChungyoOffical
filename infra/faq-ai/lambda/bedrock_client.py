import os
import re
from datetime import datetime, timedelta, timezone

import boto3

import usage_tracker

_bedrock_agent_runtime = boto3.client("bedrock-agent-runtime", region_name=os.environ.get("AWS_REGION"))
_bedrock_runtime       = boto3.client("bedrock-runtime",       region_name=os.environ.get("AWS_REGION"))

KNOWLEDGE_BASE_ID = os.environ.get("BEDROCK_KB_ID", "")
MODEL_ARN         = os.environ.get("BEDROCK_MODEL_ARN", "")

TAIWAN_TZ = timezone(timedelta(hours=8))
_WEEKDAY_ZH = ["一", "二", "三", "四", "五", "六", "日"]


def _today_taiwan_str() -> str:
    now = datetime.now(TAIWAN_TZ)
    return f"{now.strftime('%Y-%m-%d')}（星期{_WEEKDAY_ZH[now.weekday()]}）"


# 回答會同時被當作文字氣泡顯示、也會被 Polly 唸出來。文字版允許用「•」條列多個
# 項目（例如列出多個停車場），但仍禁止 markdown 連結語法（唸出來會很怪）；
# 語音版另外用 to_speech_friendly() 把條列符號轉成口語化的頓號句子。
#
# 知識庫裡的文件可能標示「有效期間」（同步時寫入，不會隨日期自動從知識庫移除，
# 要等下次手動同步才會真的清掉）。這裡要求 AI 每次回答都根據使用者訊息開頭附上
# 的「今天的日期」動態比對，過期或尚未開始的內容一律視為不存在，藉此不用每天
# 排程重新同步也能讓日期正確生效。
SYSTEM_PROMPT = """你是中友百貨的客服助理。請只根據下方「檢索到的內容」回答問題，
但回答時**不要提到「根據檢索到的內容」「根據資料庫」「根據我們的資訊」之類的
字眼**，也不要說「我無法確認」這種生硬的技術性用語，直接像一位熟悉店內狀況、
親切自然的客服人員一樣回答，就好像你本來就知道這些資訊。
使用繁體中文、口語化、簡潔、有溫度。如果答案包含多個項目（例如多個地點、多個
選項），可以每項一行、每行開頭用「• 」條列；否則直接用 1-3 句話回答。
不要使用任何 markdown 語法，包括連結語法（例如 [文字](網址)）、粗體/斜體
（例如 **文字**、*文字*）、標題（#）等，也不要輸出原始網址。純文字加上「• 」
條列即可，不需要其他格式標記。

檢索到的內容裡，若某段標示了「有效期間：YYYY-MM-DD 至 YYYY-MM-DD」，請比對訊息
開頭提供的「今天的日期」：如果今天不在該區間內（還沒開始，或已經過期），這段
內容視為目前不存在，絕對不能拿來回答，也不要跟使用者提起這段已過期/未生效的
資訊。標示「長期有效」或沒有標示有效期間的內容則不受此限制。

如果使用者問的是今天日期、星期幾，請直接使用訊息開頭提供的「今天的日期」回答，
不需要比對檢索到的內容、也不算「無法回答」。但天氣、即時路況、即時新聞等系統
沒有連接的即時外部資訊，你並不知道實際狀況，請照下面的規則誠實回答無法提供，
不要憑空猜測（尤其天氣，猜錯會誤導使用者，比誠實說不知道更糟）。

如果檢索到的內容（扣除掉已過期/未生效的部分後）不足以回答，請在回覆的最開頭加上
[NO_MATCH] 這個標記（後面緊接著自然的回覆文字，不要換行、不要有空格），例如：
[NO_MATCH]不好意思，這個問題我目前沒有相關資訊，建議您直接洽詢現場客服人員。
只有在真的無法回答時才加這個標記，能正常回答的問題絕對不要加。誠實回答，
不要憑空編造答案。"""

NO_MATCH_MARKER = "[NO_MATCH]"
TOP_K = 5
MAX_HISTORY_TURNS = 6  # 最近幾則歷史訊息（使用者/AI 各算一則），避免 token 用量無限成長

_MARKDOWN_EMPHASIS_RE = re.compile(r"[*_]{1,3}(.+?)[*_]{1,3}")


def _strip_markdown_emphasis(text: str) -> str:
    """防呆：即使模型沒完全照指示，也把殘留的 **粗體**/*斜體* 語法去掉，只留文字內容。"""
    return _MARKDOWN_EMPHASIS_RE.sub(r"\1", text)


def to_speech_friendly(text: str) -> str:
    """把條列格式的文字轉成適合語音朗讀的句子（去除項目符號，換行改頓號）。"""
    lines = [re.sub(r"^[•\-*]\s*", "", ln.strip()) for ln in text.split("\n") if ln.strip()]
    return "、".join(lines) if len(lines) > 1 else (lines[0] if lines else text)


def _retrieve_context(query_text: str) -> tuple[str, dict]:
    # 受管知識庫（Managed Knowledge Base）目前不支援 RetrieveAndGenerate，
    # 改用 Retrieve 拿檢索片段，自己組 prompt 呼叫 Converse 生成答案。
    response = _bedrock_agent_runtime.retrieve(
        knowledgeBaseId=KNOWLEDGE_BASE_ID,
        retrievalQuery={"text": query_text},
        # 受管知識庫（Managed Knowledge Base）要用 managedSearchConfiguration，
        # 不是傳統 KB 用的 vectorSearchConfiguration。需要 boto3 >= 1.43。
        retrievalConfiguration={"managedSearchConfiguration": {"numberOfResults": TOP_K}},
    )
    chunks = [
        r["content"]["text"]
        for r in response.get("retrievalResults", [])
        if r.get("content", {}).get("text")
    ]
    return "\n---\n".join(chunks), usage_tracker.bedrock_retrieve_cost()


def retrieve_and_generate(query_text: str, history: list | None = None) -> dict:
    if not KNOWLEDGE_BASE_ID or not MODEL_ARN:
        raise RuntimeError("BEDROCK_KB_ID / BEDROCK_MODEL_ARN 尚未設定")

    context, retrieve_usage = _retrieve_context(query_text)
    user_message = (
        f"今天的日期：{_today_taiwan_str()}\n"
        f"檢索到的內容：\n{context or '（無相關內容）'}\n\n使用者問題：{query_text}"
    )

    # 歷史訊息只帶原始對話文字（不重新附加檢索內容），只有這次的提問會附上
    # 最新檢索到的內容，讓 AI 能理解「那營業時間呢」這種依賴前文的追問。
    messages = []
    for turn in (history or [])[-MAX_HISTORY_TURNS:]:
        role = turn.get("role") if isinstance(turn, dict) else None
        turn_text = turn.get("text") if isinstance(turn, dict) else None
        if role in ("user", "assistant") and turn_text:
            messages.append({"role": role, "content": [{"text": turn_text}]})
    messages.append({"role": "user", "content": [{"text": user_message}]})

    response = _bedrock_runtime.converse(
        modelId=MODEL_ARN,
        system=[{"text": SYSTEM_PROMPT}],
        messages=messages,
        inferenceConfig={"maxTokens": 300, "temperature": 0.3},
    )
    raw_text = response["output"]["message"]["content"][0]["text"].strip()
    token_usage = response.get("usage", {}) or {}
    converse_usage = usage_tracker.bedrock_converse_cost(
        token_usage.get("inputTokens", 0), token_usage.get("outputTokens", 0)
    )

    answered = True
    if raw_text.startswith(NO_MATCH_MARKER):
        answered = False
        raw_text = raw_text[len(NO_MATCH_MARKER):].lstrip()

    return {
        "text":     _strip_markdown_emphasis(raw_text),
        "answered": answered,
        "usage":    [retrieve_usage, converse_usage],
    }
