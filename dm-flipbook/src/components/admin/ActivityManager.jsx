import React, { useState, useEffect, useRef, useCallback } from 'react';
import HotspotEditor from './HotspotEditor';
import './FloorGuideManager.css';
import './ActivityManager.css';

const API = '/api/admin/activity';

function apiFetch(url, opts = {}) {
  return fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
}

function extractYouTubeId(input = '') {
  const m = input.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{11}$/.test(input.trim())) return input.trim();
  return null;
}

export default function ActivityManager() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [activeId, setActiveId]     = useState(null);
  const [msg, setMsg]               = useState(null);
  const [saving, setSaving]         = useState(false);
  const [showAdd, setShowAdd]       = useState(false);
  const [newTitle, setNewTitle]     = useState('');

  const [editTitle,   setEditTitle]   = useState('');
  const [editContent, setEditContent] = useState([]);

  const [ytInput, setYtInput] = useState('');
  const [showYt, setShowYt]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  // 熱區編輯：editContent 裡的 index
  const [hotspotIdx, setHotspotIdx] = useState(null);

  // 拖曳
  const dragSrc = useRef(null);

  const showMsgFn = (text, type = 'ok') => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 3000);
  };

  const load = async () => {
    try {
      const r = await fetch(API);
      const d = await r.json();
      setActivities(d.activities ?? []);
      setActiveId(prev => {
        const found = d.activities?.find(a => a.id === prev);
        return found ? prev : (d.activities?.[0]?.id ?? null);
      });
    } catch {
      showMsgFn('無法連線到後端', 'err');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const act = activities.find(a => a.id === activeId);
    if (!act) return;
    setEditTitle(act.title ?? '');
    setEditContent(JSON.parse(JSON.stringify(act.content ?? [])));
    setHotspotIdx(null);
  }, [activeId, activities]);

  const activeActivity = activities.find(a => a.id === activeId);

  /* ── 新增活動頁 ── */
  const handleAdd = async () => {
    if (!newTitle.trim()) return showMsgFn('名稱為必填', 'err');
    const res = await apiFetch(API, { method: 'POST', body: JSON.stringify({ title: newTitle }) });
    const d = await res.json();
    if (!res.ok) return showMsgFn(d.error || '新增失敗', 'err');
    showMsgFn('已新增');
    setNewTitle('');
    setShowAdd(false);
    load();
  };

  /* ── 刪除活動頁 ── */
  const handleDelete = async (id) => {
    const act = activities.find(a => a.id === id);
    if (!window.confirm(`確定刪除「${act?.title}」？`)) return;
    const res = await apiFetch(`${API}/${id}`, { method: 'DELETE' });
    const d = await res.json();
    if (!res.ok) return showMsgFn(d.error || '刪除失敗', 'err');
    showMsgFn('已刪除');
    if (activeId === id) setActiveId(null);
    load();
  };

  /* ── 儲存 ── */
  const handleSave = async () => {
    if (!editTitle.trim()) return showMsgFn('名稱為必填', 'err');
    setSaving(true);
    const res = await apiFetch(`${API}/${activeId}`, {
      method: 'PUT',
      body: JSON.stringify({ title: editTitle, content: editContent }),
    });
    setSaving(false);
    const d = await res.json();
    if (!res.ok) return showMsgFn(d.error || '儲存失敗', 'err');
    showMsgFn('已儲存');
    load();
  };

  /* ── 上傳圖片 ── */
  const handleUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    const fd = new FormData();
    files.forEach(f => fd.append('images', f));
    const res = await fetch(`${API}/${activeId}/upload`, { method: 'POST', body: fd });
    const d = await res.json();
    setUploading(false);
    if (!res.ok) return showMsgFn(d.error || '上傳失敗', 'err');
    const newItems = (d.files ?? []).map(file => ({ type: 'image', file, hotspots: [] }));
    setEditContent(prev => [...prev, ...newItems]);
    e.target.value = '';
  };

  /* ── 新增 YouTube ── */
  const handleAddYt = () => {
    const vid = extractYouTubeId(ytInput);
    if (!vid) return showMsgFn('無法解析 YouTube 連結', 'err');
    setEditContent(prev => [...prev, { type: 'youtube', videoId: vid }]);
    setYtInput('');
    setShowYt(false);
  };

  /* ── 刪除 item ── */
  const handleDeleteItem = useCallback(async (idx) => {
    const item = editContent[idx];
    if (item.type === 'image') {
      await fetch(`${API}/${activeId}/image/${item.file}`, { method: 'DELETE' });
    }
    setEditContent(prev => prev.filter((_, i) => i !== idx));
    setHotspotIdx(null);
  }, [editContent, activeId]);

  /* ── 熱區儲存 ── */
  const handleHotspotSave = useCallback((hotspots) => {
    setEditContent(prev => prev.map((item, i) =>
      i === hotspotIdx ? { ...item, hotspots } : item
    ));
    setHotspotIdx(null);
  }, [hotspotIdx]);

  /* ── 拖曳排序（只在 drop 時重排，避免非同步問題）── */
  const handleDragStart = (i) => { dragSrc.current = i; };
  const handleDragOver  = (e) => { e.preventDefault(); };
  const handleDrop = (e, targetIdx) => {
    e.preventDefault();
    const src = dragSrc.current;
    if (src === null || src === targetIdx) return;
    setEditContent(prev => {
      const next = [...prev];
      const [moved] = next.splice(src, 1);
      next.splice(targetIdx, 0, moved);
      return next;
    });
    dragSrc.current = null;
  };
  const handleDragEnd = () => { dragSrc.current = null; };

  if (loading) return <p className="fg-loading">載入中…</p>;

  /* ── 熱區編輯模式 ── */
  if (hotspotIdx !== null && activeActivity) {
    const item = editContent[hotspotIdx];
    const imgSrc = `/api/images/activity-pic/${activeId}/${item.file}`;
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
        <h1 className="fg-manager-title">活動頁管理</h1>
      </div>

      {msg && <div className={`fg-msg fg-msg--${msg.type}`}>{msg.text}</div>}

      {/* ── 活動頁列表 ── */}
      <div className="fg-section">
        <div className="fg-section-header">
          <span className="fg-section-title">活動頁列表</span>
          <button className="fg-btn fg-btn-ghost fg-btn-sm" onClick={() => setShowAdd(v => !v)}>
            ＋ 新增活動頁
          </button>
        </div>

        {showAdd && (
          <div className="fg-info-card">
            <div className="fg-info-card-title">新增活動頁</div>
            <div className="food-addcat-row">
              <input
                className="fg-info-input"
                placeholder="活動頁名稱"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />
              <button className="fg-btn fg-btn-primary fg-btn-sm" onClick={handleAdd}>確認</button>
              <button className="fg-btn fg-btn-ghost fg-btn-sm" onClick={() => setShowAdd(false)}>取消</button>
            </div>
          </div>
        )}

        {activities.length === 0 && !showAdd && (
          <div className="fg-empty">尚無活動頁，請點「＋ 新增活動頁」</div>
        )}

        {activities.length > 0 && (
          <table className="fg-table">
            <thead>
              <tr>
                <th>名稱</th>
                <th>前台網址</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {activities.map(a => (
                <tr key={a.id} className={activeId === a.id ? 'fg-tr-active' : ''}>
                  <td>{a.title}</td>
                  <td><code>/activity/{a.id}</code></td>
                  <td className="fg-table-actions">
                    <button
                      className={`fg-btn fg-btn-sm ${activeId === a.id ? 'fg-btn-primary' : 'fg-btn-ghost'}`}
                      onClick={() => { setActiveId(a.id); setShowAdd(false); }}
                    >
                      {activeId === a.id ? '編輯中' : '編輯'}
                    </button>
                    <button
                      className="fg-btn fg-btn-danger fg-btn-sm"
                      onClick={() => handleDelete(a.id)}
                    >
                      刪除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {activeActivity && (
        <div className="wm-editor">
          {/* ── 基本資訊 ── */}
          <div className="fg-info-card">
            <div className="fg-info-card-title">活動頁資訊</div>
            <label className="wm-meta-label">
              名稱 *
              <input className="fg-info-input" value={editTitle} onChange={e => setEditTitle(e.target.value)} />
            </label>
            <div className="am-url-hint">
              前台網址：<code>/activity/{activeId}</code>
            </div>
          </div>

          {/* ── 內容編輯 ── */}
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

            {editContent.length === 0 ? (
              <div className="fg-empty">尚無內容，請上傳圖片或加入 YouTube</div>
            ) : (
              <div className="am-list">
                {editContent.map((item, i) => (
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
                          src={`/api/images/activity-pic/${activeId}/${item.file}`}
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

          {/* ── 操作按鈕 ── */}
          <div className="wm-actions">
            <button className="fg-btn fg-btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? '儲存中…' : '儲存'}
            </button>
            <button className="fg-btn fg-btn-danger" onClick={() => handleDelete(activeId)}>刪除活動頁</button>
          </div>
        </div>
      )}
    </div>
  );
}
