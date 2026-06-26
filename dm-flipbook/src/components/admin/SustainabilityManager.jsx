import React, { useState, useEffect, useRef } from 'react';
import './FloorGuideManager.css';

export default function SustainabilityManager() {
  const [currentUrl, setCurrentUrl] = useState('');
  const [uploading, setUploading]   = useState(false);
  const [msg, setMsg]               = useState(null);
  const showMsg = (text, type = 'ok') => { setMsg({ text, type }); setTimeout(() => setMsg(null), 3000); };
  const inputRef = useRef(null);

  useEffect(() => {
    fetch('/api/admin/sustainability')
      .then(r => r.ok ? r.json() : {})
      .then(d => setCurrentUrl(d.url || ''))
      .catch(() => {});
  }, []);

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append('pdf', file);
    try {
      const res  = await fetch('/api/admin/sustainability/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (data.success) {
        setCurrentUrl(data.url);
        showMsg('上傳成功');
      } else {
        showMsg(data.error || '上傳失敗', 'err');
      }
    } catch {
      showMsg('上傳失敗', 'err');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleDelete() {
    if (!confirm('確定要刪除永續報告書？')) return;
    try {
      const res = await fetch('/api/admin/sustainability', { method: 'DELETE' });
      if ((await res.json()).success) {
        setCurrentUrl('');
        showMsg('已刪除');
      }
    } catch {
      showMsg('刪除失敗', 'err');
    }
  }

  return (
    <div style={{ padding: '32px', maxWidth: '600px' }}>
      <h2 style={{ marginBottom: '24px', fontSize: '20px', fontWeight: '700' }}>永續報告書管理</h2>

      <div style={{ marginBottom: '24px', padding: '16px', background: '#f5f5f5', borderRadius: '8px' }}>
        <p style={{ fontSize: '14px', color: '#555', marginBottom: '8px' }}>目前檔案</p>
        {currentUrl ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <a href={currentUrl} target="_blank" rel="noreferrer"
               style={{ fontSize: '14px', color: '#0066cc', wordBreak: 'break-all' }}>
              {currentUrl}
            </a>
            <button onClick={handleDelete}
              style={{ flexShrink: 0, padding: '4px 12px', background: '#dc3545', color: '#fff',
                       border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>
              刪除
            </button>
          </div>
        ) : (
          <p style={{ fontSize: '14px', color: '#999' }}>尚未上傳</p>
        )}
      </div>

      <div>
        <p style={{ fontSize: '14px', color: '#555', marginBottom: '8px' }}>上傳新版 PDF（舊版將被取代）</p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          onChange={handleUpload}
          disabled={uploading}
          style={{ fontSize: '14px' }}
        />
        {uploading && <p style={{ marginTop: '8px', fontSize: '13px', color: '#555' }}>上傳中…</p>}
      </div>

      {msg && <div className="admin-popup-overlay"><div className={`admin-popup admin-popup--${msg.type}`}>{msg.text}</div></div>}
    </div>
  );
}
