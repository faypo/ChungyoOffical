import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AnswerText } from '../utils/faqAnswer';
import './FaqWidget.css';

const GREETING     = '您好，請問有什麼事可以為您服務的嗎？';
const DEFAULT_FALLBACK = '抱歉，我暫時無法回答這個問題。\n您可以透過以下方式獲得協助：\n• [意見回饋](/CustomerFeedback)\n• 洽詢現場客服人員';
const MIN_SCORE    = 1; // 低於此分數視為無法回答

export default function FaqWidget({ standalone = false }) {
  const [open, setOpen]       = useState(standalone);
  const [msgs, setMsgs]       = useState([]);
  const [searchQ, setSearchQ] = useState('');
  const [busy, setBusy]       = useState(false);
  const [contextIds, setContextIds] = useState([]);
  const [fallback,   setFallback]   = useState(DEFAULT_FALLBACK);
  const endRef = useRef(null);

  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(cfg => { if (cfg.faq_fallback_message) setFallback(cfg.faq_fallback_message); })
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

  async function handleSearch(e) {
    e.preventDefault();
    const q = searchQ.trim();
    if (!q || busy) return;

    setMsgs(prev => [...prev, { from: 'user', text: q, options: null }]);
    setSearchQ('');
    setBusy(true);
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
        {!standalone && (
          <button className="faq-close-btn" onClick={() => setOpen(false)} aria-label="關閉">✕</button>
        )}
      </div>

      <div className="faq-messages">
        {msgs.map((msg, i) => (
          <div key={i} className={`faq-msg faq-msg--${msg.from}`}>
            {msg.from === 'bot' && <div className="faq-avatar-sm">YY</div>}
            <div className="faq-msg-body">
              {msg.text && (
                <div className="faq-bubble">
                  <AnswerText text={msg.text} />
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
        <input
          type="text"
          className="faq-search-input"
          placeholder="請輸入問題…"
          value={searchQ}
          onChange={e => setSearchQ(e.target.value)}
        />
        <button type="submit" className="faq-search-btn" disabled={busy || !searchQ.trim()}>
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
        onClick={() => setOpen(v => !v)}
        aria-label="智能客服 YOYO"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12zM7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z"/>
        </svg>
      </button>
    </div>
  );
}
