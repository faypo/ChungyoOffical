import json
import logging
import os

import boto3
from botocore.exceptions import ClientError

import usage_tracker

logger = logging.getLogger()
logger.setLevel(logging.INFO)

_s3 = boto3.client("s3", region_name=os.environ.get("AWS_REGION"))
_bedrock_agent = boto3.client("bedrock-agent", region_name=os.environ.get("AWS_REGION"))

API_SHARED_SECRET = os.environ["API_SHARED_SECRET"]
BUCKET = os.environ.get("FAQ_KB_S3_BUCKET", "")
PREFIX = os.environ.get("FAQ_KB_S3_PREFIX", "faq-kb/")
KNOWLEDGE_BASE_ID = os.environ.get("BEDROCK_KB_ID", "")
DATA_SOURCE_ID = os.environ.get("BEDROCK_DATA_SOURCE_ID", "")


def handler(event, context):
    headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
    if headers.get("x-api-key") != API_SHARED_SECRET:
        return _response(401, {"error": "unauthorized"})

    if not BUCKET:
        return _response(500, {"error": "FAQ_KB_S3_BUCKET 未設定"})

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _response(400, {"error": "invalid json body"})

    documents = body.get("documents")
    if not isinstance(documents, list):
        return _response(400, {"error": "documents 必須是陣列"})

    try:
        uploaded, deleted = _sync_documents(documents)
    except Exception:
        logger.exception("faq sync handler failed (S3 sync)")
        return _response(500, {"error": "internal error"})

    # S3 內容已經同步好了，接下來只是「觸發重新索引」。同一個 data source
    # 同時間只能跑一個索引工作，短時間內連續觸發（例如一次刪改上傳很多筆）
    # 常會撞到前一個還在跑的工作——這不是真的失敗，S3 內容已經是最新的，
    # 正在跑的那個索引工作之後也會處理到（或下次同步再觸發一次即可）。
    ingestion_job = None
    ingestion_note = None
    usage = []
    if KNOWLEDGE_BASE_ID and DATA_SOURCE_ID:
        try:
            job = _bedrock_agent.start_ingestion_job(
                knowledgeBaseId=KNOWLEDGE_BASE_ID,
                dataSourceId=DATA_SOURCE_ID,
            )
            ingestion_job = {
                "ingestionJobId": job["ingestionJob"]["ingestionJobId"],
                "status": job["ingestionJob"]["status"],
            }
            # 索引工作真的被觸發時才計費估算（ConflictException 代表沒有真的觸發，
            # 前一個索引工作還在跑）。用「這次同步的全部文件」字元數估算，是估算
            # 上限，Bedrock 實際只會重新 embed 有異動的檔案。
            total_chars = sum(len(doc.get("text") or "") for doc in documents)
            usage.append(usage_tracker.bedrock_embed_cost(total_chars))
        except ClientError as e:
            if e.response.get("Error", {}).get("Code") == "ConflictException":
                ingestion_note = "已有索引工作正在進行中，S3 內容已同步，稍後請再按一次同步以觸發重新索引"
            else:
                logger.exception("faq sync handler failed (start ingestion job)")
                return _response(500, {"error": "internal error"})

    return _response(
        200,
        {
            "uploaded": uploaded,
            "deleted": deleted,
            "ingestionJob": ingestion_job,
            "ingestionNote": ingestion_note,
            "usage": usage,
        },
    )


def _sync_documents(documents):
    """把 documents（[{id, text}]）整份覆蓋同步到 S3 的 PREFIX 底下，
    刪除 PREFIX 下已不在這次 documents 清單中的舊檔案。
    id 由呼叫端自行決定命名空間前綴（例如 faq-5、counter-12），避免不同資料
    來源的 id 互相撞名。"""
    desired_keys = set()
    for doc in documents:
        doc_id = str(doc.get("id"))
        text = doc.get("text") or ""
        key = f"{PREFIX}{doc_id}.txt"
        desired_keys.add(key)
        _s3.put_object(Bucket=BUCKET, Key=key, Body=text.encode("utf-8"), ContentType="text/plain; charset=utf-8")

    existing_keys = set()
    paginator = _s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=BUCKET, Prefix=PREFIX):
        for obj in page.get("Contents", []):
            existing_keys.add(obj["Key"])

    stale_keys = existing_keys - desired_keys
    if stale_keys:
        _s3.delete_objects(
            Bucket=BUCKET,
            Delete={"Objects": [{"Key": k} for k in stale_keys]},
        )

    return len(desired_keys), len(stale_keys)


def _response(status_code, payload):
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(payload, ensure_ascii=False),
    }
