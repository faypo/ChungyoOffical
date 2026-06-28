import React, { useState, useEffect, useRef } from 'react';
import './FloorGuideManager.css';
import { apiFetch } from '../../utils/apiFetch';

const API = '/api/admin/service';
const TABS = [
  { key: 'service',  label: '貼心服務' },
  { key: 'traffic',  label: '交通資訊' },
  { key: 'parking',  label: '停車資訊' },
  { key: 'gift',     label: '電子禮券' },
];

export default function ServiceManager() {
  const [images, setImages]       = useState({});
  const [uploading, setUploading] = useState(null); // key of uploading item
  const [msg, setMsg]             = useState(null);
  const fileRefs = useRef({});

  const showMsg = (text, type = 'ok') => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 3000);
  };

  const load = () => {
    apiFetch(API)
      .then(r => r.json())
      .then(setImages)
      .catch(() => showMsg('無法載入', 'err'));
  };

  useEffect(() => { load(); }, []);

  const handleUpload = async (key, file) => {
    if (!file) return;
    setUploading(key);
    const fd = new FormData();
    fd.append('image', file);
    try {
      const res = await apiFetch(`${API}/${key}/upload`, { method: 'POST', body: fd });
      const d   = await res.json();
      if (!res.ok) return showMsg(d.error || '上傳失敗', 'err');
      setImages(prev => ({ ...prev, [key]: d.url + '?t=' + Date.now() }));
      showMsg('已更新');
    } catch {
      showMsg('上傳失敗', 'err');
    } finally {
      setUploading(null);
      if (fileRefs.current[key]) fileRefs.current[key].value = '';
    }
  };

  return (
    <div className="fg-manager">
      <div className="fg-manager-header">
        <h1 className="fg-manager-title">貼心服務管理</h1>
      </div>

      {msg && <div className="admin-popup-overlay"><div className={`admin-popup admin-popup--${msg.type}`}>{msg.text}</div></div>}

      <div className="fg-section">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', padding: '4px 0' }}>
          {TABS.map(({ key, label }) => (
            <div key={key} style={{ border: '1px solid #e5e5e5', borderRadius: '10px', overflow: 'hidden', background: '#fff' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', fontWeight: 600, fontSize: '14px' }}>
                {label}
              </div>
              <div style={{ background: '#f7f7f7', minHeight: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {images[key]
                  ? <img src={images[key]} alt={label} style={{ maxWidth: '100%', maxHeight: '200px', display: 'block' }} />
                  : <span style={{ color: '#bbb', fontSize: '13px' }}>尚未上傳</span>
                }
              </div>
              <div style={{ padding: '12px 16px' }}>
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  ref={el => fileRefs.current[key] = el}
                  onChange={e => handleUpload(key, e.target.files?.[0])}
                />
                <button
                  className="fg-btn fg-btn-primary fg-btn-sm"
                  style={{ width: '100%' }}
                  disabled={uploading === key}
                  onClick={() => fileRefs.current[key]?.click()}
                >
                  {uploading === key ? '上傳中…' : '更換圖片'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
