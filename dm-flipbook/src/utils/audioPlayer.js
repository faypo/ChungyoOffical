// base64 mp3 → Blob → <audio> 播放。單次 HTTP JSON 回應，不需要處理分段訊息重組。
// 同一時間只允許一個語音在播放，避免自動播放跟手動點播放疊在一起互蓋。
let currentAudio = null;

export function playBase64Audio(base64, mimeType = 'audio/mpeg') {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
  const audio = new Audio(url);
  currentAudio = audio;
  const cleanup = () => {
    URL.revokeObjectURL(url);
    if (currentAudio === audio) currentAudio = null;
  };
  audio.addEventListener('ended', cleanup);
  audio.addEventListener('pause', cleanup);
  void audio.play().catch(err => console.error('playback failed', err));
  return audio;
}
