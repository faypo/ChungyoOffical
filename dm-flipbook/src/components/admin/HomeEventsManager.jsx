import React, { useState, useEffect, useRef, useCallback } from 'react';
import './ActivityManager.css';
import './HomeEventsManager.css';
import { apiFetch } from '../../utils/apiFetch';

const isDragHandle = { current: false };

const API = '/api/admin/home-event';

const isFileDrag = (e) => e.dataTransfer?.types?.includes('Files');

export default function HomeEventsManager() {
  const [events,    setEvents]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [msg,       setMsg]       = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const [fields, setFields] = useState({}); // { [id]: { url, startDate, endDate } }

  const fileRef        = useRef();
  const dragSrc        = useRef(null);
  const dragCounter    = useRef(0);
  const isDragHandleRef = useRef(false);
  const replaceFileRef  = useRef();
  const replacingIdRef  = useRef(null);

  const showMsg = (text, type = 'ok') => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 3000);
  };

  const load = async () => {
    try {
      const r = await apiFetch(API);
      const d = await r.json();
      const list = d.events ?? [];
      setEvents(list);
      setFields(Object.fromEntries(list.map(e => [e.id, {
        url:       e.url       ?? '',
        startDate: e.startDate ?? '',
        endDate:   e.endDate   ?? '',
      }])));
    } catch {
      showMsg('無法連線到後端', 'err');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  /* ── 上傳多張圖片 ── */
  const uploadFiles = useCallback(async (files) => {
    const images = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (!images.length) return showMsg('請選擇圖片檔案', 'err');
    setUploading(true);
    let count = 0;
    for (const file of images) {
      const fd = new FormData();
      fd.append('image', file);
      const res = await apiFetch(`${API}/upload`, { method: 'POST', body: fd });
      if (res.ok) count++;
    }
    setUploading(false);
    showMsg(count > 1 ? `已上傳 ${count} 張卡片` : '已新增卡片');
    load();
  }, []);

  const handleFileInput = (e) => {
    if (e.target.files?.length) uploadFiles(e.target.files);
    e.target.value = '';
  };

  /* ── 拖放區 ── */
  const onZoneDragEnter = (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    dragCounter.current++;
    setDropActive(true);
  };
  const onZoneDragOver  = (e) => { if (!isFileDrag(e)) return; e.preventDefault(); };
  const onZoneDragLeave = (e) => {
    if (!isFileDrag(e)) return;
    if (--dragCounter.current === 0) setDropActive(false);
  };
  const onZoneDrop = (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    dragCounter.current = 0;
    setDropActive(false);
    uploadFiles(e.dataTransfer.files);
  };

  /* ── 欄位變更 ── */
  const setField = (id, key, val) =>
    setFields(prev => ({ ...prev, [id]: { ...prev[id], [key]: val } }));

  const handleBlur = async (id) => {
    const f = fields[id];
    if (!f) return;
    const res = await apiFetch(`${API}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: f.url, startDate: f.startDate, endDate: f.endDate }),
    });
    if (!res.ok) showMsg('儲存失敗', 'err');
  };

  const triggerReplace = (id) => {
    replacingIdRef.current = id;
    replaceFileRef.current?.click();
  };

  const handleReplaceImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !replacingIdRef.current) return;
    const id = replacingIdRef.current;
    replacingIdRef.current = null;
    const fd = new FormData();
    fd.append('image', file);
    const res = await apiFetch(`${API}/${id}/replace`, { method: 'POST', body: fd });
    if (!res.ok) return showMsg('換圖失敗', 'err');
    showMsg('已換圖');
    load();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('確定刪除此活動卡片？')) return;
    const res = await apiFetch(`${API}/${id}`, { method: 'DELETE' });
    if (!res.ok) return showMsg('刪除失敗', 'err');
    showMsg('已刪除');
    load();
  };

  /* ── 拖曳排序 ── */
  const handleDragStart  = (i) => { dragSrc.current = i; };
  const handleItemDragOver = (e) => { if (!isFileDrag(e)) e.preventDefault(); };
  const handleDrop = async (e, targetIdx) => {
    if (isFileDrag(e)) return;
    e.preventDefault();
    const src = dragSrc.current;
    if (src === null || src === targetIdx) return;
    const next = [...events];
    const [moved] = next.splice(src, 1);
    next.splice(targetIdx, 0, moved);
    setEvents(next);
    dragSrc.current = null;
    const res = await apiFetch(`${API}/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: next.map(e => e.id) }),
    });
    if (!res.ok) showMsg('排序儲存失敗', 'err');
    else showMsg('排序已更新');
  };
  const handleDragEnd = () => { dragSrc.current = null; };

  if (loading) return <p className="fg-loading">載入中…</p>;

  return (
    <div className="fg-manager">
      <div className="fg-manager-header">
        <h1 className="fg-manager-title">首頁活動訊息管理</h1>
      </div>

      {msg && <div className="admin-popup-overlay"><div className={`admin-popup admin-popup--${msg.type}`}>{msg.text}</div></div>}

      {/* 拖放上傳區 */}
      <div
        className={`bm-dropzone${dropActive ? ' bm-dropzone--active' : ''}`}
        onClick={() => fileRef.current?.click()}
        onDragEnter={onZoneDragEnter}
        onDragOver={onZoneDragOver}
        onDragLeave={onZoneDragLeave}
        onDrop={onZoneDrop}
      >
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={handleFileInput} />
        {uploading ? (
          <span className="bm-dropzone-text">上傳中…</span>
        ) : dropActive ? (
          <span className="bm-dropzone-text bm-dropzone-text--active">放開以上傳</span>
        ) : (
          <span className="bm-dropzone-text">
            拖曳圖片至此，或 <u>點擊選擇</u>（支援同時拖入多張）
          </span>
        )}
      </div>

      <input ref={replaceFileRef} type="file" accept="image/*" hidden onChange={handleReplaceImage} />

      {/* 卡片列表 */}
      <div className="fg-section">
        <div className="fg-section-header">
          <span className="fg-section-title">活動卡片列表（拖曳可排序）</span>
        </div>

        {events.length === 0 ? (
          <div className="fg-empty">尚無活動卡片，請從上方拖入或點擊上傳</div>
        ) : (
          <div className="am-list">
            {events.map((ev, i) => {
              const f = fields[ev.id] ?? {};
              return (
                <div
                  key={ev.id}
                  className="hem-item"
                  draggable
                  onDragStart={e => {
                    if (!isDragHandleRef.current) { e.preventDefault(); return; }
                    handleDragStart(i);
                  }}
                  onDragEnd={() => { isDragHandleRef.current = false; handleDragEnd(); }}
                  onDragOver={handleItemDragOver}
                  onDrop={e => handleDrop(e, i)}
                >
                  <span
                    className="am-drag-handle"
                    onMouseDown={() => { isDragHandleRef.current = true; }}
                    onMouseUp={() => { isDragHandleRef.current = false; }}
                  >⠿</span>
                  <img
                    src={`/api/images/home-event-pic/${ev.file}`}
                    alt={ev.file}
                    className="bm-thumb"
                  />
                  <div className="hem-fields">
                    <input
                      className="fg-info-input"
                      placeholder="連結網址（選填）"
                      value={f.url ?? ''}
                      onChange={e => setField(ev.id, 'url', e.target.value)}
                      onBlur={() => handleBlur(ev.id)}
                    />
                    <div className="hem-dates">
                      <label className="hem-date-label">
                        開始
                        <input
                          type="datetime-local"
                          className="fg-info-input hem-date-input"
                          value={f.startDate ?? ''}
                          onChange={e => setField(ev.id, 'startDate', e.target.value)}
                          onBlur={() => handleBlur(ev.id)}
                        />
                      </label>
                      <label className="hem-date-label">
                        結束
                        <input
                          type="datetime-local"
                          className="fg-info-input hem-date-input"
                          value={f.endDate ?? ''}
                          onChange={e => setField(ev.id, 'endDate', e.target.value)}
                          onBlur={() => handleBlur(ev.id)}
                        />
                      </label>
                    </div>
                  </div>
                  <div className="hem-actions">
                    <button
                      className="fg-btn fg-btn-ghost fg-btn-sm"
                      onClick={() => triggerReplace(ev.id)}
                    >
                      換圖
                    </button>
                    <button
                      className="fg-btn fg-btn-danger fg-btn-sm"
                      onClick={() => handleDelete(ev.id)}
                    >
                      刪除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
