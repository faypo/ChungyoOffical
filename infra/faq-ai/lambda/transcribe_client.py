import asyncio
import os

from amazon_transcribe.client import TranscribeStreamingClient
from amazon_transcribe.handlers import TranscriptResultStreamHandler
from amazon_transcribe.model import TranscriptEvent

CHUNK_SIZE = 8 * 1024
LANGUAGE_CODE = "zh-TW"


class _TranscriptCollector(TranscriptResultStreamHandler):
    def __init__(self, output_stream):
        super().__init__(output_stream)
        self.final_parts = []

    async def handle_transcript_event(self, transcript_event: TranscriptEvent):
        for result in transcript_event.transcript.results:
            if result.is_partial:
                continue
            for alt in result.alternatives:
                if alt.transcript:
                    self.final_parts.append(alt.transcript)


async def transcribe_pcm(pcm_bytes: bytes, sample_rate: int) -> str:
    """餵一整段 16-bit LE PCM 音訊給 Transcribe Streaming，回傳串接後的最終逐字稿。
    整段 buffer 一次寫入（而非即時麥克風串流），以便在單次 Lambda 呼叫內完成。"""
    client = TranscribeStreamingClient(region=os.environ["AWS_REGION"])
    stream = await client.start_stream_transcription(
        language_code=LANGUAGE_CODE,
        media_sample_rate_hz=sample_rate,
        media_encoding="pcm",
    )

    async def write_chunks():
        for i in range(0, len(pcm_bytes), CHUNK_SIZE):
            await stream.input_stream.send_audio_event(audio_chunk=pcm_bytes[i : i + CHUNK_SIZE])
        await stream.input_stream.end_stream()

    collector = _TranscriptCollector(stream.output_stream)
    await asyncio.gather(write_chunks(), collector.handle_events())
    return " ".join(collector.final_parts).strip()


def transcribe_pcm_sync(pcm_bytes: bytes, sample_rate: int) -> str:
    return asyncio.run(transcribe_pcm(pcm_bytes, sample_rate))
