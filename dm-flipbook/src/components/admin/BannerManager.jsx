import React, { useState, useEffect, useRef, useCallback } from 'react';
import './ActivityManager.css';
import './BannerManager.css';

const API = '/api/admin/banner';

const isFileDrag = (e) => e.dataTransfer?.types?.includes('Files');

export default function BannerManager() {
  const [banners,     setBanners]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [msg,         setMsg]         = useState(null);
  const [uploading,   setUploading]   = useState(false);
  const [urls,        setUrls]        = useState({});
  const [startDates,  setStartDates]  = useState({});
  const [endDates,    setEndDates]    = useState({});
  const [dropActive,  setDropActive]  = useState(false);

  const fileRef    = useRef();
  const dragSrc    = useRef(null);
  const dragCounter = useRef(0); // 追蹤 dragenter/dragleave 次數，避免子元素觸發閃爍

  const showMsg = (text, type = 'ok') => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 3000);
  };

  const load = async () => {
    try {
      const r = await fetch(API);
      const d = await r.json();
      const list = d.banners ?? [];
      setBanners(list);
      setUrls(Object.fromEntries(list.map(b => [b.id, b.url ?? ''])));
      setStartDates(Object.fromEntries(list.map(b => [b.id, b.startDate ?? ''])));
      setEndDates(Object.fromEntries(list.map(b => [b.id, b.endDate ?? ''])));
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
    let successCount = 0;
    for (const file of images) {
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch(`${API}/upload`, { method: 'POST', body: fd });
      if (res.ok) successCount++;
    }
    setUploading(false);
    showMsg(successCount > 1 ? `已上傳 ${successCount} 張 Banner` : '已新增 Banner');
    load();
  }, []);

  const handleFileInput = (e) => {
    if (e.target.files?.length) uploadFiles(e.target.files);
    e.target.value = '';
  };

  /* ── 拖放區事件（檔案拖曳，非排序拖曳）── */
  const onZoneDragEnter = (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    dragCounter.current++;
    setDropActive(true);
  };
  const onZoneDragOver = (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
  };
  const onZoneDragLeave = (e) => {
    if (!isFileDrag(e)) return;
    dragCounter.current--;
    if (dragCounter.current === 0) setDropActive(false);
  };
  const onZoneDrop = (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    dragCounter.current = 0;
    setDropActive(false);
    uploadFiles(e.dataTransfer.files);
  };

  /* ── 欄位自動儲存（overrides 用來傳剛剛 onChange 的值，避免 React batching 讀到舊 state）── */
  const handleFieldSave = async (id, overrides = {}) => {
    const res = await fetch(`${API}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url:       overrides.url       ?? urls[id]       ?? '',
        startDate: overrides.startDate ?? startDates[id] ?? '',
        endDate:   overrides.endDate   ?? endDates[id]   ?? '',
      }),
    });
    const d = await res.json();
    if (!res.ok) showMsg(d.error || '儲存失敗', 'err');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('確定刪除此 Banner？')) return;
    const res = await fetch(`${API}/${id}`, { method: 'DELETE' });
    const d   = await res.json();
    if (!res.ok) return showMsg(d.error || '刪除失敗', 'err');
    showMsg('已刪除');
    load();
  };

  /* ── 拖曳排序（Banner 元件間）── */
  const handleDragStart = (i) => { dragSrc.current = i; };
  const handleItemDragOver = (e) => {
    if (isFileDrag(e)) return; // 不攔截檔案拖曳
    e.preventDefault();
  };
  const handleDrop = async (e, targetIdx) => {
    if (isFileDrag(e)) return; // 檔案拖進來交給 zone 處理
    e.preventDefault();
    const src = dragSrc.current;
    if (src === null || src === targetIdx) return;
    const next = [...banners];
    const [moved] = next.splice(src, 1);
    next.splice(targetIdx, 0, moved);
    setBanners(next);
    dragSrc.current = null;
    const res = await fetch(`${API}/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: next.map(b => b.id) }),
    });
    if (!res.ok) showMsg('排序儲存失敗', 'err');
    else showMsg('排序已更新');
  };
  const handleDragEnd = () => { dragSrc.current = null; };

  if (loading) return <p className="fg-loading">載入中…</p>;

  return (
    <div className="fg-manager">
      <div className="fg-manager-header">
        <h1 className="fg-manager-title">首頁 Banner 管理</h1>
      </div>

      {msg && <div className="admin-popup-overlay"><div className={`admin-popup admin-popup--${msg.type}`}>{msg.text}</div></div>}

      {/* ── 拖放上傳區 ── */}
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

      {/* ── Banner 列表 ── */}
      <div className="fg-section">
        <div className="fg-section-header">
          <span className="fg-section-title">Banner 列表（拖曳可排序）</span>
        </div>

        {banners.length === 0 ? (
          <div className="fg-empty">尚無 Banner，請從上方拖入或點擊上傳</div>
        ) : (
          <div className="am-list">
            {banners.map((b, i) => (
              <div
                key={b.id}
                className="bm-item"
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={handleItemDragOver}
                onDrop={e => handleDrop(e, i)}
                onDragEnd={handleDragEnd}
              >
                <span className="am-drag-handle">⠿</span>
                <img
                  src={`/api/images/banner-pic/${b.file}`}
                  alt={b.file}
                  className="bm-thumb"
                />
                <div className="bm-fields">
                  <input
                    className="fg-info-input"
                    placeholder="連結網址（選填，空白表示不跳轉）"
                    value={urls[b.id] ?? ''}
                    onChange={e => setUrls(prev => ({ ...prev, [b.id]: e.target.value }))}
                    onBlur={() => handleFieldSave(b.id)}
                  />
                  <div className="bm-date-row">
                    <label className="bm-date-label">
                      開始日期
                      <input
                        type="date"
                        className="fg-info-input"
                        value={startDates[b.id] ?? ''}
                        onChange={e => {
                          const val = e.target.value;
                          setStartDates(prev => ({ ...prev, [b.id]: val }));
                          handleFieldSave(b.id, { startDate: val });
                        }}
                      />
                    </label>
                    <label className="bm-date-label">
                      結束日期
                      <input
                        type="date"
                        className="fg-info-input"
                        value={endDates[b.id] ?? ''}
                        onChange={e => {
                          const val = e.target.value;
                          setEndDates(prev => ({ ...prev, [b.id]: val }));
                          handleFieldSave(b.id, { endDate: val });
                        }}
                      />
                    </label>
                  </div>
                </div>
                <button
                  className="fg-btn fg-btn-danger fg-btn-sm"
                  onClick={() => handleDelete(b.id)}
                >
                  刪除
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
