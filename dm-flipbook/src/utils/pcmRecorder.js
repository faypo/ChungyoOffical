// 用 ScriptProcessorNode 直接擷取麥克風音訊為 mono 16-bit PCM，取樣率固定 16kHz。
// 刻意避開 MediaRecorder 產生的 webm/opus 容器，因為 Amazon Transcribe Streaming
// 不接受該格式，需要原始 PCM。
const TARGET_SAMPLE_RATE = 16000;
const BUFFER_SIZE = 4096;

export class PcmRecorder {
  constructor() {
    this.audioContext = null;
    this.processor = null;
    this.source = null;
    this.stream = null;
    this.chunks = [];
    this.inputSampleRate = TARGET_SAMPLE_RATE;
  }

  async start() {
    this.chunks = [];
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.audioContext = new AudioContext();
    this.inputSampleRate = this.audioContext.sampleRate;
    this.source = this.audioContext.createMediaStreamSource(this.stream);
    this.processor = this.audioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);

    this.processor.onaudioprocess = (event) => {
      this.chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
    };

    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  /** @returns {{ pcm: Uint8Array, sampleRate: number }} */
  stop() {
    this.processor?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach(track => track.stop());
    void this.audioContext?.close();

    const merged = mergeChunks(this.chunks);
    const resampled = resample(merged, this.inputSampleRate, TARGET_SAMPLE_RATE);
    const pcm = floatTo16BitPcm(resampled);

    this.audioContext = null;
    this.processor = null;
    this.source = null;
    this.stream = null;
    this.chunks = [];

    return { pcm, sampleRate: TARGET_SAMPLE_RATE };
  }
}

function mergeChunks(chunks) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

// 最近鄰降採樣，語音辨識用途已足夠。
function resample(input, inputRate, outputRate) {
  if (inputRate === outputRate) return input;
  const ratio = inputRate / outputRate;
  const outputLength = Math.floor(input.length / ratio);
  const output = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i++) {
    output[i] = input[Math.floor(i * ratio)];
  }
  return output;
}

function floatTo16BitPcm(input) {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(buffer);
}
