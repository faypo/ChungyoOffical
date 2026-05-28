import React, { useState, useEffect, useRef, useCallback } from 'react';
import HotspotEditor from './HotspotEditor';
import './FloorGuideManager.css';
import './ActivityManager.css';

const API = '/api/admin/gallery';

function extractYouTubeId(input = '') {
  const m = input.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{11}$/.test(input.trim())) return input.trim();
  return null;
}

export default function GalleryManager() {
  const [content, setContent]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [msg, setMsg]             = useState(null);
  const [ytInput, setYtInput]     = useState('');
  const [showYt, setShowYt]       = useState(false);
  const [uploading, setUploading] = useState(false);
  const [hotspotIdx, setHotspotIdx] = useState(null);

  const dragSrc = useRef(null);
  const fileRef = useRef();

  const showMsgFn = (text, type = 'ok') => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 3000);
  };

  const load = async () => {
    try {
      const r = await fetch(API);
      const d = await r.json();
      setContent(d.content ?? []);
    } catch {
      showMsgFn('無法連線到後端', 'err');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch(API, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    setSaving(false);
    const d = await res.json();
    if (!res.ok) return showMsgFn(d.error || '儲存失敗', 'err');
    showMsgFn('已儲存');
  };

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    const fd = new FormData();
    files.forEach(f => fd.append('images', f));
    const res = await fetch(`${API}/upload`, { method: 'POST', body: fd });
    const d = await res.json();
    setUploading(false);
    if (!res.ok) return showMsgFn(d.error || '上傳失敗', 'err');
    const newItems = (d.files ?? []).map(file => ({ type: 'image', file, hotspots: [] }));
    setContent(prev => [...prev, ...newItems]);
    e.target.value = '';
  };

  const handleAddYt = () => {
    const vid = extractYouTubeId(ytInput);
    if (!vid) return showMsgFn('無法解析 YouTube 連結', 'err');
    setContent(prev => [...prev, { type: 'youtube', videoId: vid }]);
    setYtInput('');
    setShowYt(false);
  };

  const handleDeleteItem = useCallback(async (idx) => {
    const item = content[idx];
    if (item.type === 'image') {
      await fetch(`${API}/image/${item.file}`, { method: 'DELETE' });
    }
    setContent(prev => prev.filter((_, i) => i !== idx));
    setHotspotIdx(null);
  }, [content]);

  const handleHotspotSave = useCallback((hotspots) => {
    setContent(prev => prev.map((item, i) =>
      i === hotspotIdx ? { ...item, hotspots } : item
    ));
    setHotspotIdx(null);
  }, [hotspotIdx]);

  const handleDragStart = (i) => { dragSrc.current = i; };
  const handleDragOver  = (e) => { e.preventDefault(); };
  const handleDrop = (e, targetIdx) => {
    e.preventDefault();
    const src = dragSrc.current;
    if (src === null || src === targetIdx) return;
    setContent(prev => {
      const next = [...prev];
      const [moved] = next.splice(src, 1);
      next.splice(targetIdx, 0, moved);
      return next;
    });
    dragSrc.current = null;
  };
  const handleDragEnd = () => { dragSrc.current = null; };

  if (loading) return <p className="fg-loading">載入中…</p>;

  if (hotspotIdx !== null) {
    const item = content[hotspotIdx];
    const imgSrc = `/api/images/gallery-pic/${item.file}`;
    return (
      <div className="fg-manager">
        <div className="fg-manager-header">
          <h1 className="fg-manager-title">熱區編輯 — {item.file}</h1>
        </div>
        <HotspotEditor
          imgSrc={imgSrc}
          initialHotspots={item.hotspots ?? []}
          onSave={handleHotspotSave}
          onCancel={() => setHotspotIdx(null)}
        />
      </div>
    );
  }

  return (
    <div className="fg-manager">
      <div className="fg-manager-header">
        <h1 className="fg-manager-title">時尚藝廊管理</h1>
      </div>

      {msg && <div className="admin-popup-overlay"><div className={`admin-popup admin-popup--${msg.type}`}>{msg.text}</div></div>}

      <div className="fg-section">
        <div className="fg-section-header">
          <span className="fg-section-title">頁面內容（拖曳可排序）</span>
          <div className="am-add-btns">
            <button
              className="fg-btn fg-btn-ghost"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? '上傳中…' : '＋ 上傳圖片'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={handleUpload} />
            <button className="fg-btn fg-btn-ghost" onClick={() => setShowYt(v => !v)}>
              ＋ YouTube
            </button>
          </div>
        </div>

        {showYt && (
          <div className="am-yt-row">
            <input
              className="fg-info-input"
              placeholder="YouTube 網址或影片 ID"
              value={ytInput}
              onChange={e => setYtInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddYt()}
            />
            <button className="fg-btn fg-btn-primary fg-btn-sm" onClick={handleAddYt}>加入</button>
            <button className="fg-btn fg-btn-ghost fg-btn-sm" onClick={() => setShowYt(false)}>取消</button>
          </div>
        )}

        {content.length === 0 ? (
          <div className="fg-empty">尚無內容，請上傳圖片或加入 YouTube</div>
        ) : (
          <div className="am-list">
            {content.map((item, i) => (
              <div
                key={i}
                className="am-item"
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={handleDragOver}
                onDrop={e => handleDrop(e, i)}
                onDragEnd={handleDragEnd}
              >
                <span className="am-drag-handle">⠿</span>

                {item.type === 'image' ? (
                  <>
                    <img
                      src={`/api/images/gallery-pic/${item.file}`}
                      alt={item.file}
                      className="am-thumb"
                    />
                    <span className="am-label">{item.file}</span>
                    <button
                      className="fg-btn fg-btn-ghost fg-btn-sm"
                      onClick={() => setHotspotIdx(i)}
                    >
                      熱區 {(item.hotspots?.length ?? 0) > 0 ? `(${item.hotspots.length})` : ''}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="am-yt-badge">YT</div>
                    <span className="am-label">{item.videoId}</span>
                  </>
                )}

                <button
                  className="fg-btn fg-btn-danger fg-btn-sm am-del"
                  onClick={() => handleDeleteItem(i)}
                >
                  刪除
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="wm-actions">
        <button className="fg-btn fg-btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? '儲存中…' : '儲存'}
        </button>
      </div>
    </div>
  );
}
