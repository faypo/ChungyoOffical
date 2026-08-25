// 純 fetch 包裝，呼叫 infra/faq-ai 部署出來的 API Gateway。
// 不含任何 AWS SDK / AWS 憑證——所有 AWS 服務呼叫都在 Lambda 端完成。
'use strict';

function baseUrl() {
  const url = process.env.FAQ_AI_API_URL;
  if (!url) throw new Error('FAQ_AI_API_URL 未設定，請參考 docs/faq-ai-voice-setup.md');
  return url.replace(/\/$/, '');
}

async function callFaqAi(path, body) {
  const secret = process.env.FAQ_AI_API_SECRET;
  if (!secret) throw new Error('FAQ_AI_API_SECRET 未設定，請參考 docs/faq-ai-voice-setup.md');

  const res = await fetch(`${baseUrl()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': secret },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `FAQ AI 服務回應錯誤（${res.status}）`);
    err.status = res.status;
    throw err;
  }
  return data;
}

/**
 * @param {{ text?: string, audioBase64?: string, sampleRate?: number, history?: Array<{role: 'user'|'assistant', text: string}> }} input
 * @returns {Promise<{ transcript?: string, replyText: string, audioBase64: string, mimeType: string }>}
 */
function askFaqAi(input) {
  return callFaqAi('/chat', input);
}

/**
 * @param {Array<{ id: string|number, text: string }>} documents
 */
function syncFaqKnowledgeBase(documents) {
  return callFaqAi('/sync', { documents });
}

module.exports = { askFaqAi, syncFaqKnowledgeBase };
