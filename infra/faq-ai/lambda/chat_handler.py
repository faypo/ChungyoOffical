import base64
import json
import logging
import os

from bedrock_client import retrieve_and_generate, to_speech_friendly
from polly_client import synthesize
from transcribe_client import transcribe_pcm_sync

logger = logging.getLogger()
logger.setLevel(logging.INFO)

API_SHARED_SECRET = os.environ["API_SHARED_SECRET"]


def handler(event, context):
    headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
    if headers.get("x-api-key") != API_SHARED_SECRET:
        return _response(401, {"error": "unauthorized"})

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _response(400, {"error": "invalid json body"})

    text = (body.get("text") or "").strip()
    audio_b64 = body.get("audioBase64")
    sample_rate = int(body.get("sampleRate") or 16000)
    history = body.get("history") if isinstance(body.get("history"), list) else []

    transcript = None
    try:
        if not text and audio_b64:
            pcm_bytes = base64.b64decode(audio_b64)
            transcript = transcribe_pcm_sync(pcm_bytes, sample_rate)
            if not transcript:
                return _response(422, {"error": "no speech detected"})
            text = transcript

        if not text:
            return _response(400, {"error": "text or audioBase64 is required"})

        gen = retrieve_and_generate(text, history=history)
        reply_text = gen["text"]
        audio_mp3 = synthesize(to_speech_friendly(reply_text))

        payload = {
            "replyText": reply_text,
            "answered": gen["answered"],
            "audioBase64": base64.b64encode(audio_mp3).decode("ascii"),
            "mimeType": "audio/mpeg",
        }
        if transcript is not None:
            payload["transcript"] = transcript
        return _response(200, payload)

    except Exception:
        logger.exception("faq chat handler failed")
        return _response(500, {"error": "internal error"})


def _response(status_code, payload):
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(payload, ensure_ascii=False),
    }
