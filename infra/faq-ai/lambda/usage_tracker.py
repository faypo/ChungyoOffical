"""AWS 服務用量成本估算。

金額為概估（USD，依 ap-northeast-1 東京區域公開定價換算，2026-08 查詢），僅供
後台「AWS 用量統計」頁面內部監控參考，不是實際帳單金額。以下項目不在估算
範圍內：Bedrock Knowledge Base 索引儲存空間（依資料量計月租）、Lambda /
API Gateway 執行成本（用量遠低於門檻，可忽略不計）。

定價來源（如未來 AWS 調整定價，直接改這裡的常數即可，呼叫端不需要動）：
- Bedrock Claude Haiku 4.5（東京跨區推論，比 global 貴約 10%）：
  input US$1.10 / 1M tokens、output US$5.50 / 1M tokens
- Bedrock Knowledge Base 標準 Retrieve API：US$1.00 / 1000 次
- Titan Text Embeddings V2（知識庫同步索引用）：US$0.02 / 1M tokens
- Amazon Transcribe Streaming 標準轉錄：US$0.01 / 分鐘，最低 15 秒
- Amazon Polly Neural TTS：US$16.00 / 1M 字元
"""

BEDROCK_CONVERSE_INPUT_PER_1K  = 0.0011
BEDROCK_CONVERSE_OUTPUT_PER_1K = 0.0055
BEDROCK_RETRIEVE_PER_CALL      = 0.001
TITAN_EMBED_PER_1K_TOKENS      = 0.00002
TRANSCRIBE_PER_MINUTE          = 0.01
TRANSCRIBE_MIN_SECONDS         = 15
POLLY_NEURAL_PER_CHAR          = 16.0 / 1_000_000

CATEGORY_AI_CHAT      = "AI 對話"
CATEGORY_KB_QUERY     = "知識庫查詢"
CATEGORY_KB_SYNC      = "知識庫同步"
CATEGORY_TRANSCRIBE   = "語音辨識"
CATEGORY_POLLY        = "語音合成"


def _entry(service: str, category: str, cost_usd: float, quantity, unit: str) -> dict:
    return {
        "service":  service,
        "category": category,
        "costUsd":  round(cost_usd, 8),
        "quantity": quantity,
        "unit":     unit,
    }


def bedrock_converse_cost(input_tokens: int, output_tokens: int) -> dict:
    cost = (
        input_tokens  / 1000 * BEDROCK_CONVERSE_INPUT_PER_1K
        + output_tokens / 1000 * BEDROCK_CONVERSE_OUTPUT_PER_1K
    )
    return _entry("bedrock_converse", CATEGORY_AI_CHAT, cost, input_tokens + output_tokens, "tokens")


def bedrock_retrieve_cost() -> dict:
    return _entry("bedrock_retrieve", CATEGORY_KB_QUERY, BEDROCK_RETRIEVE_PER_CALL, 1, "次")


def bedrock_embed_cost(char_count: int) -> dict:
    # 中文字元與 token 無固定換算比例，粗估約 1.5 字元 / token（略保守，成本估算
    # 偏高於實際不偏低）。同步時傳入的是「這次同步的全部文件」字元數，但 Bedrock
    # ingestion job 實際只會重新 embed 有異動的檔案，因此這是估算上限，不是實際值。
    approx_tokens = max(1, round(char_count / 1.5))
    cost = approx_tokens / 1000 * TITAN_EMBED_PER_1K_TOKENS
    return _entry("bedrock_embed", CATEGORY_KB_SYNC, cost, approx_tokens, "tokens(估)")


def transcribe_cost(duration_seconds: float) -> dict:
    billed_seconds = max(TRANSCRIBE_MIN_SECONDS, duration_seconds)
    cost = billed_seconds / 60 * TRANSCRIBE_PER_MINUTE
    return _entry("transcribe", CATEGORY_TRANSCRIBE, cost, round(billed_seconds, 1), "秒")


def polly_cost(char_count: int) -> dict:
    cost = char_count * POLLY_NEURAL_PER_CHAR
    return _entry("polly", CATEGORY_POLLY, cost, char_count, "字元")
