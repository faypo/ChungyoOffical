import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnswerText } from '../utils/faqAnswer';
import { PcmRecorder } from '../utils/pcmRecorder';
import { playBase64Audio } from '../utils/audioPlayer';
import { useLayout } from '../context/LayoutContext';
import './FaqWidget.css';

const GREETING     = '您好，請問有什麼事可以為您服務的嗎？';
const DEFAULT_FALLBACK = '抱歉，我暫時無法回答這個問題。\n您可以透過以下方式獲得協助：\n• [意見回饋](/CustomerFeedback)\n• 洽詢現場客服人員';
const MIN_SCORE    = 1; // 低於此分數視為無法回答
const MAX_AI_HISTORY = 6; // AI 對話記憶保留最近幾則（使用者/AI 各算一則）

export default function FaqWidget({ standalone = false }) {
  const navigate = useNavigate();
  const { isMobile } = useLayout();
  const [open, setOpen]       = useState(standalone);
  const [msgs, setMsgs]       = useState([]);
  const [searchQ, setSearchQ] = useState('');
  const [busy, setBusy]       = useState(false);
  const [contextIds, setContextIds] = useState([]);
  const [fallback,   setFallback]   = useState(DEFAULT_FALLBACK);
  const [aiEnabled,  setAiEnabled]  = useState(false);
  const [recording,  setRecording]  = useState(false);
  const [aiHistory,  setAiHistory]  = useState([]); // [{role:'user'|'assistant', text}]
  const endRef = useRef(null);
  const recorderRef = useRef(null);

  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(cfg => {
        if (cfg.faq_fallback_message) setFallback(cfg.faq_fallback_message);
        setAiEnabled(cfg.faq_ai_enabled === '1');
      })
      .catch(() => {});
  }, []);

  // 加入語境：保留最近 3 個，用於搜尋加權
  const addContext = (id) =>
    setContextIds(prev => [id, ...prev.filter(x => x !== id)].slice(0, 3));

  const initChat = useCallback(() => {
    setMsgs([{ from: 'bot', text: GREETING, options: null }]);
  }, []);

  useEffect(() => {
    if (open && msgs.length === 0) initChat();
  }, [open, msgs.length, initChat]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, busy]);

  async function handleOption(opt) {
    if (opt.id === '__home__') {
      setMsgs([]);
      setAiHistory([]);
      initChat();
      return;
    }

    setMsgs(prev => [...prev, { from: 'user', text: opt.label, options: null }]);
    addContext(opt.id);
    setBusy(true);
    try {
      const res  = await fetch(`/api/faq/${opt.id}`);
      const data = await res.json();
      const kids = data.children ?? [];
      setMsgs(prev => [...prev, {
        from: 'bot',
        text: data.answer || null,
        options: kids.length > 0 ? kids.map(c => ({ id: c.id, label: c.question })) : null,
      }]);
    } catch {
      setMsgs(prev => [...prev, { from: 'bot', text: '發生錯誤，請稍後再試。', options: null }]);
    }
    setBusy(false);
  }

  // 推一則含語音的 bot 回覆，抵達時自動播放一次，並記進 AI 對話歷史。
  // answered === false 時代表 AI 答不出來，記錄進「待補充問題」讓後台可以迭代知識庫。
  function pushAiReply(replyText, audioBase64, mimeType, answered, queryText) {
    setMsgs(prev => [...prev, {
      from: 'bot', text: replyText, options: null,
      audio: audioBase64 ? { audioBase64, mimeType } : null,
    }]);
    setAiHistory(prev => [...prev, { role: 'assistant', text: replyText }].slice(-MAX_AI_HISTORY));
    if (audioBase64) playBase64Audio(audioBase64, mimeType);
    if (answered === false && queryText) {
      fetch('/api/faq/unanswered', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryText }),
      }).catch(() => {});
    }
  }

  // 停止錄音並送出辨識，手動點擊麥克風按鈕、或錄音端偵測到「講完話後靜音 1 秒」
  // 自動觸發，都會呼叫這裡。
  async function stopAndSendRecording() {
    if (!recorderRef.current) return;
    setRecording(false);
    const { pcm, sampleRate } = recorderRef.current.stop();
    recorderRef.current = null;
    if (pcm.length === 0) return;

    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('audio', new Blob([pcm], { type: 'application/octet-stream' }), 'audio.pcm');
      fd.append('sampleRate', String(sampleRate));
      fd.append('history', JSON.stringify(aiHistory));
      const res  = await fetch('/api/faq/ai/voice', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '語音辨識失敗');
      const userText = data.transcript || '（語音輸入）';
      setMsgs(prev => [...prev, { from: 'user', text: userText, options: null }]);
      setAiHistory(prev => [...prev, { role: 'user', text: userText }].slice(-MAX_AI_HISTORY));
      pushAiReply(data.replyText, data.audioBase64, data.mimeType, data.answered, userText);
    } catch {
      setMsgs(prev => [...prev, { from: 'bot', text: '聽不清楚或發生錯誤，請再試一次。', options: null }]);
    }
    setBusy(false);
  }

  async function handleMicClick() {
    if (busy) return;

    if (!recording) {
      try {
        recorderRef.current = new PcmRecorder();
        await recorderRef.current.start(stopAndSendRecording);
        setRecording(true);
      } catch {
        recorderRef.current = null;
        setMsgs(prev => [...prev, { from: 'bot', text: '無法取得麥克風權限，請檢查瀏覽器設定。', options: null }]);
      }
      return;
    }

    await stopAndSendRecording();
  }

  async function handleSearch(e) {
    e.preventDefault();
    const q = searchQ.trim();
    if (!q || busy) return;

    setMsgs(prev => [...prev, { from: 'user', text: q, options: null }]);
    setSearchQ('');
    setBusy(true);

    if (aiEnabled) {
      try {
        const res  = await fetch('/api/faq/ai/text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ q, history: aiHistory }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'AI 回覆失敗');
        setAiHistory(prev => [...prev, { role: 'user', text: q }].slice(-MAX_AI_HISTORY));
        pushAiReply(data.replyText, data.audioBase64, data.mimeType, data.answered, q);
      } catch {
        setMsgs(prev => [...prev, { from: 'bot', text: '發生錯誤，請稍後再試。', options: null }]);
      }
      setBusy(false);
      return;
    }

    try {
      const ctx = contextIds.length > 0 ? `&context=${contextIds.join(',')}` : '';
      const res = await fetch(`/api/faq/search?q=${encodeURIComponent(q)}${ctx}`);
      const results = await res.json();
      if (results.length === 0 || results[0].score < MIN_SCORE) {
        setMsgs(prev => [...prev, { from: 'bot', text: fallback, options: null }]);
        fetch('/api/faq/unanswered', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q }),
        }).catch(() => {});
      } else {
        const top = results[0];
        if (top.type === 'counter') {
          // 櫃位位置查詢：答案已在搜尋結果中，不需再 fetch 節點
          setMsgs(prev => [...prev, { from: 'bot', text: top.answer, options: null }]);
        } else {
          addContext(top.id);
          // 取完整節點（含後續問題子節點）
          const nodeRes = await fetch(`/api/faq/${top.id}`);
          const node    = await nodeRes.json();
          const kids    = node.children ?? [];
          setMsgs(prev => [...prev, {
            from:    'bot',
            text:    node.answer || null,
            options: kids.length > 0 ? kids.map(c => ({ id: c.id, label: c.question })) : null,
          }]);
        }
      }
    } catch {
      setMsgs(prev => [...prev, { from: 'bot', text: '搜尋時發生錯誤，請稍後再試。', options: null }]);
    }
    setBusy(false);
  }

  const dialog = (
    <div className={`faq-dialog${standalone ? ' faq-dialog--standalone' : ''}`}>
      <div className="faq-dialog-header">
        <div className="faq-dialog-header-left">
          <div className="faq-avatar-lg">YY</div>
          <div>
            <div className="faq-dialog-title">智能客服 YOYO</div>
            <div className="faq-dialog-subtitle">線上為您服務</div>
          </div>
        </div>
        <button
          className="faq-close-btn"
          onClick={() => (standalone ? navigate(-1) : setOpen(false))}
          aria-label="關閉"
        >
          ✕
        </button>
      </div>

      <div className="faq-messages">
        {msgs.map((msg, i) => (
          <div key={i} className={`faq-msg faq-msg--${msg.from}`}>
            {msg.from === 'bot' && <div className="faq-avatar-sm">YY</div>}
            <div className="faq-msg-body">
              {msg.text && (
                <div className="faq-bubble">
                  <AnswerText text={msg.text} />
                  {msg.audio && (
                    <button
                      type="button"
                      className="faq-audio-btn"
                      onClick={() => playBase64Audio(msg.audio.audioBase64, msg.audio.mimeType)}
                      aria-label="播放語音"
                    >
                      🔊 播放語音
                    </button>
                  )}
                </div>
              )}
              {msg.options && msg.options.length > 0 && (
                <div className="faq-options">
                  {msg.options.map((opt, j) => (
                    <button
                      key={j}
                      className={`faq-opt-btn${opt.id === '__home__' ? ' faq-opt-btn--home' : ''}`}
                      onClick={() => handleOption(opt)}
                      disabled={busy}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {busy && (
          <div className="faq-msg faq-msg--bot">
            <div className="faq-avatar-sm">YY</div>
            <div className="faq-typing">
              <span /><span /><span />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form className="faq-search-bar" onSubmit={handleSearch}>
        {aiEnabled && (
          <button
            type="button"
            className={`faq-mic-btn${recording ? ' faq-mic-btn--recording' : ''}`}
            onClick={handleMicClick}
            disabled={busy && !recording}
            aria-label={recording ? '停止錄音並送出' : '語音輸入'}
          >
            {recording ? '⏹' : '🎤'}
          </button>
        )}
        <input
          type="text"
          className="faq-search-input"
          placeholder={recording ? '聆聽中…' : '請輸入問題…'}
          value={searchQ}
          onChange={e => setSearchQ(e.target.value)}
          disabled={recording}
        />
        <button type="submit" className="faq-search-btn" disabled={busy || recording || !searchQ.trim()}>
          送出
        </button>
      </form>
    </div>
  );

  if (standalone) return dialog;

  return (
    <div className="faq-widget">
      {open && dialog}
      <button
        className={`faq-fab${open ? ' faq-fab--open' : ''}`}
        onClick={() => (isMobile ? navigate('/faq') : setOpen(v => !v))}
        aria-label="智能客服 YOYO"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12zM7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z"/>
        </svg>
      </button>
    </div>
  );
}
