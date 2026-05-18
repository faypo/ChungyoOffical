import React, { useState, useEffect } from 'react';

export default function HomeFBManager() {
  const [src, setSrc]       = useState('');
  const [saved, setSaved]   = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/home-fb')
      .then(r => r.json())
      .then(d => { setSrc(d.src ?? ''); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const save = () => {
    fetch('/api/admin/home-fb', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ src }),
    }).then(() => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  };

  if (loading) return <p>載入中…</p>;

  return (
    <div style={{ maxWidth: 700 }}>
      <h2 style={{ marginBottom: 24 }}>FB 社群設定</h2>

      <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>
        Facebook 嵌入 src 網址
      </label>
      <p style={{ fontSize: 13, color: '#888', marginBottom: 12 }}>
        至 Facebook 貼文 → 分享 → 嵌入 → 複製 iframe 中的 src 網址貼入此處
      </p>
      <textarea
        value={src}
        onChange={e => setSrc(e.target.value)}
        rows={5}
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: '10px 12px', fontSize: 13,
          border: '1px solid #ddd', borderRadius: 6,
          fontFamily: 'monospace', resize: 'vertical',
        }}
        placeholder="https://www.facebook.com/plugins/post.php?href=..."
      />

      {src && (
        <div style={{ marginTop: 20 }}>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>預覽</p>
          <iframe
            src={src}
            style={{ border: 'none', overflow: 'hidden', display: 'block' }}
            width="500"
            height="400"
            scrolling="no"
            frameBorder="0"
            allowFullScreen
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
            title="FB preview"
          />
        </div>
      )}

      <button
        onClick={save}
        style={{
          marginTop: 20, padding: '10px 28px',
          background: saved ? '#4caf50' : '#333',
          color: '#fff', border: 'none', borderRadius: 6,
          fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}
      >
        {saved ? '已儲存 ✓' : '儲存'}
      </button>
    </div>
  );
}
