import os

import boto3

_polly = boto3.client("polly", region_name=os.environ.get("AWS_REGION"))

# Amazon Polly 目前只有一種中文語音 Zhiyu（語言代碼 cmn-CN，非 zh-TW），
# 能正確唸繁體中文文字，但口音是大陸腔——Polly 沒有台灣腔選項。
VOICE_ID = "Zhiyu"


def synthesize(text: str) -> bytes:
    response = _polly.synthesize_speech(
        Text=text,
        VoiceId=VOICE_ID,
        Engine="neural",
        OutputFormat="mp3",
    )
    return response["AudioStream"].read()
