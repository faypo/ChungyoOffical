import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../../utils/apiFetch';

const API = '/api/admin/home-promo';

function ImageSlot({ label, file, slot, onUploaded }) {
  const inputRef = useRef();
  const [ts, setTs] = useState(() => Date.now());
  const endpoint = slot === 'hero' ? `${API}/upload-hero` : `${API}/upload-card/${slot}`;
  const imgSrc   = file ? `/api/images/home-promo-pic/${file}?t=${ts}` : null;

  const upload = async (f) => {
    const fd = new FormData();
    fd.append('image', f);
    const r = await apiFetch(endpoint, { method: 'POST', body: fd });
    const d = await r.json();
    if (d.file) {
      setTs(Date.now());
      onUploaded(d.file);
    }
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{label}</div>
      {imgSrc && (
        <img src={imgSrc} alt={label} style={{ width: '100%', maxWidth: 320, borderRadius: 6, display: 'block', marginBottom: 8 }} />
      )}
      <button onClick={() => inputRef.current.click()} style={btnStyle}>
        {imgSrc ? '更換圖片' : '上傳圖片'}
      </button>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => { if (e.target.files[0]) upload(e.target.files[0]); }} />
    </div>
  );
}

const btnStyle = {
  padding: '7px 18px', background: '#444', color: '#fff',
  border: 'none', borderRadius: 5, fontSize: 13, cursor: 'pointer',
};

const inputStyle = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px',
  border: '1px solid #ddd', borderRadius: 5, fontSize: 13, marginBottom: 12,
};

export default function HomePromoManager() {
  const [data,    setData]    = useState(null);
  const [saved,   setSaved]   = useState(false);

  useEffect(() => {
    apiFetch(API).then(r => r.json()).then(setData).catch(() => {});
  }, []);

  if (!data) return <p>載入中…</p>;

  const save = (patch) => {
    const next = { ...data, ...patch };
    setData(next);
    apiFetch(API, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    }).then(() => { setSaved(true); setTimeout(() => setSaved(false), 1500); });
  };

  const setCardUrl = (slot, url) => {
    const cards = data.cards.map(c => c.slot === slot ? { ...c, url } : c);
    setData(d => ({ ...d, cards }));
  };

  const saveCardUrl = (slot) => {
    apiFetch(API, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cards: [{ slot, url: data.cards.find(c => c.slot === slot)?.url ?? '' }] }),
    });
  };

  return (
    <div style={{ maxWidth: 680 }}>
      <h2 style={{ marginBottom: 24 }}>首頁推廣區管理</h2>

      <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>區塊標題</label>
      <input value={data.title} style={inputStyle}
        onChange={e => setData(d => ({ ...d, title: e.target.value }))}
        onBlur={() => save({ title: data.title })} />

      <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #eee' }} />

      <ImageSlot label="大圖（Hero）" file={data.heroFile} slot="hero"
        onUploaded={file => setData(d => ({ ...d, heroFile: file }))} />
      <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>大圖連結網址</label>
      <input value={data.heroUrl} style={inputStyle} placeholder="https://..."
        onChange={e => setData(d => ({ ...d, heroUrl: e.target.value }))}
        onBlur={() => save({ heroUrl: data.heroUrl })} />

      <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #eee' }} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <div>
          <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>左欄標籤文字</label>
          <input value={data.leftLabel} style={inputStyle}
            onChange={e => setData(d => ({ ...d, leftLabel: e.target.value }))}
            onBlur={() => save({ leftLabel: data.leftLabel })} />
        </div>
        <div>
          <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>右欄標籤文字</label>
          <input value={data.rightLabel} style={inputStyle}
            onChange={e => setData(d => ({ ...d, rightLabel: e.target.value }))}
            onBlur={() => save({ rightLabel: data.rightLabel })} />
        </div>
      </div>

      <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #eee' }} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {data.cards.map(card => (
          <div key={card.slot} style={{ padding: 14, border: '1px solid #eee', borderRadius: 8 }}>
            <ImageSlot label={`圖卡 ${card.slot}`} file={card.file} slot={card.slot}
              onUploaded={file => setData(d => ({
                ...d, cards: d.cards.map(c => c.slot === card.slot ? { ...c, file } : c)
              }))} />
            <label style={{ fontWeight: 600, display: 'block', marginBottom: 6, fontSize: 12 }}>連結網址</label>
            <input value={card.url} style={{ ...inputStyle, marginBottom: 0 }} placeholder="https://..."
              onChange={e => setCardUrl(card.slot, e.target.value)}
              onBlur={() => saveCardUrl(card.slot)} />
          </div>
        ))}
      </div>

      {saved && (
        <div style={{ marginTop: 16, color: '#4caf50', fontWeight: 600 }}>已儲存 ✓</div>
      )}
    </div>
  );
}
