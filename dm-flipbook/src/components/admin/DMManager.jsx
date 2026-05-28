import React, { useState, useEffect, useRef } from 'react';
import HotspotEditor from './HotspotEditor';
import './FloorGuideManager.css';
import './DMManager.css';

const API = '/api/admin/catalog';

const EMPTY_FORM = { title: '', subtitle: '', order: '', type: 'double', startDate: '', endDate: '', url: '' };

const TYPE_LABEL = { double: '雙頁', single: '單頁', strip: '長條', url: 'URL' };

function apiFetch(url, opts = {}) {
  return fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
}

/* ── 預覽 Modal ── */
function PreviewModal({ dmId, onClose }) {
  const [pages, setPages]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    fetch(`/api/dm/${dmId}/pages`)
      .then(r => r.json())
      .then(files => { setPages(Array.isArray(files) ? files : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [dmId]);

  const imgSrc = (file) => `/api/images/dm-pic/${dmId}/${file}`;

  return (
    <div className="preview-backdrop" onClick={onClose}>
      <div className="preview-modal" onClick={e => e.stopPropagation()}>
        <div className="preview-modal-header">
          <span>{dmId} 預覽（共 {pages.length} 頁）</span>
          <button className="preview-close" onClick={onClose}>✕</button>
        </div>

        {loading && <p className="preview-status">載入中…</p>}
        {!loading && pages.length === 0 && <p className="preview-status">尚無圖片</p>}

        {!loading && pages.length > 0 && (
          <div className="preview-grid">
            {pages.map((file, i) => (
              <div key={file} className="preview-thumb" onClick={() => setLightbox(i)}>
                <img src={imgSrc(file)} alt={file} loading="lazy" />
                <span className="preview-thumb-name">{file}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {lightbox !== null && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <button
            className="lightbox-nav lightbox-prev"
            onClick={e => { e.stopPropagation(); setLightbox(i => Math.max(0, i - 1)); }}
            disabled={lightbox === 0}
          >‹</button>
          <img src={imgSrc(pages[lightbox])} alt={pages[lightbox]} onClick={e => e.stopPropagation()} />
          <button
            className="lightbox-nav lightbox-next"
            onClick={e => { e.stopPropagation(); setLightbox(i => Math.min(pages.length - 1, i + 1)); }}
            disabled={lightbox === pages.length - 1}
          >›</button>
          <span className="lightbox-counter">{lightbox + 1} / {pages.length}</span>
        </div>
      )}
    </div>
  );
}

export default function DMManager() {
  const [catalog, setCatalog]             = useState([]);
  const [loading, setLoading]             = useState(true);
  const [form, setForm]                   = useState(EMPTY_FORM);
  const [editingId, setEditingId]         = useState(null);
  const [showForm, setShowForm]           = useState(false);
  const [uploading, setUploading]         = useState(null);
  const [uploadFiles, setUploadFiles]     = useState([]);
  const [managingBtns, setManagingBtns]   = useState(null);
  const [btnList, setBtnList]             = useState([]);
  const [btnForm, setBtnForm]             = useState({ page: '', url: '' });
  const [editingBtnIdx, setEditingBtnIdx] = useState(null);
  const [showBtnForm, setShowBtnForm]     = useState(false);
  const [editingHotspots, setEditingHotspots] = useState(null); // { id, hotspots }
  const [coverDmId, setCoverDmId]         = useState(null);  // strip 封面管理
  const [coverFile, setCoverFile]         = useState(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState(null);
  const [previewUrls, setPreviewUrls]     = useState([]);
  const [isDragOver, setIsDragOver]       = useState(false);
  const [previewing, setPreviewing]       = useState(null);
  const [msg, setMsg]                     = useState(null);
  const [existingPages, setExistingPages]         = useState([]);
  const [existingPagesDirty, setExistingPagesDirty] = useState(false);
  const fileInputRef          = useRef();
  const coverInputRef         = useRef();
  const dragItemRef           = useRef(null);
  const dragOverRef           = useRef(null);
  const dragExistingItemRef   = useRef(null);

  useEffect(() => {
    const urls = uploadFiles.map(f => URL.createObjectURL(f));
    setPreviewUrls(urls);
    return () => urls.forEach(url => URL.revokeObjectURL(url));
  }, [uploadFiles]);

  const load = () => {
    setLoading(true);
    fetch(API)
      .then(r => r.json())
      .then(d => { setCatalog(d); setLoading(false); })
      .catch(() => { showMsg('無法連線到後端', 'err'); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const showMsg = (text, type = 'ok') => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 3000);
  };

  const openNew = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (dm) => {
    setForm({
      title:     dm.title,
      subtitle:  dm.subtitle  || '',
      order:     dm.order,
      type:      dm.type      || 'double',
      startDate: dm.startDate || '',
      endDate:   dm.endDate   || '',
      url:       dm.url       || '',
    });
    setEditingId(dm.id);
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditingId(null); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const body = { ...form, order: Number(form.order) || undefined };
    const res = editingId
      ? await apiFetch(`${API}/${editingId}`, { method: 'PUT',  body: JSON.stringify(body) })
      : await apiFetch(API,                   { method: 'POST', body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) return showMsg(data.error || '操作失敗', 'err');
    showMsg(editingId ? '已更新' : '已新增');
    closeForm();
    load();
  };

  const handleDelete = async (id) => {
    if (!window.confirm(`確定要刪除 ${id}？此操作將同時刪除所有圖片，無法復原。`)) return;
    const res  = await apiFetch(`${API}/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) return showMsg(data.error || '刪除失敗', 'err');
    showMsg('已刪除');
    load();
  };

  const openUpload = async (id) => {
    setUploading(id);
    setUploadFiles([]);
    setExistingPages([]);
    setExistingPagesDirty(false);
    try {
      const r = await fetch(`/api/dm/${id}/pages`);
      const files = await r.json();
      setExistingPages(Array.isArray(files) ? files : []);
    } catch {}
  };

  /* ── 嵌入按鈕（double / single 用）── */
  const openBtns = (dm) => {
    setManagingBtns(dm.id);
    setBtnList(dm.button ? [...dm.button] : []);
    setShowBtnForm(false);
    setEditingBtnIdx(null);
  };
  const closeBtns = () => { setManagingBtns(null); setShowBtnForm(false); };

  const openAddBtn  = () => { setBtnForm({ page: '', url: '' }); setEditingBtnIdx(null); setShowBtnForm(true); };
  const openEditBtn = (i) => { setBtnForm({ page: String(btnList[i].page), url: btnList[i].url }); setEditingBtnIdx(i); setShowBtnForm(true); };
  const deleteBtn   = (i) => setBtnList(list => list.filter((_, idx) => idx !== i));

  const saveBtnForm = () => {
    const page = Number(btnForm.page);
    if (!page || !btnForm.url.trim()) return showMsg('頁碼與連結為必填', 'err');
    const entry = { page, url: btnForm.url.trim() };
    setBtnList(list => {
      const next = [...list];
      if (editingBtnIdx !== null) next[editingBtnIdx] = entry;
      else next.push(entry);
      return next.sort((a, b) => a.page - b.page);
    });
    setShowBtnForm(false);
    setEditingBtnIdx(null);
  };

  const handleSaveBtns = async () => {
    const res  = await apiFetch(`${API}/${managingBtns}`, { method: 'PUT', body: JSON.stringify({ button: btnList }) });
    const data = await res.json();
    if (!res.ok) return showMsg(data.error || '儲存失敗', 'err');
    showMsg('已儲存');
    closeBtns();
    load();
  };

  /* ── 熱區管理（strip 用）── */
  const openHotspots = (dm) => {
    setEditingHotspots({ id: dm.id, hotspots: dm.hotspots || [] });
  };

  /* ── 封面管理（strip 用）── */
  const openCover = (dm) => {
    if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
    setCoverDmId(dm.id);
    setCoverFile(null);
    setCoverPreviewUrl(null);
  };
  const closeCover = () => {
    if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
    setCoverDmId(null);
    setCoverFile(null);
    setCoverPreviewUrl(null);
  };
  const handleCoverFileChange = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
    setCoverFile(file);
    setCoverPreviewUrl(URL.createObjectURL(file));
  };
  const handleCoverUpload = async () => {
    if (!coverFile) return;
    const fd = new FormData();
    fd.append('cover', coverFile);
    const res  = await fetch(`${API}/${coverDmId}/cover`, { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) return showMsg(data.error || '上傳失敗', 'err');
    showMsg('封面已更新');
    closeCover();
    load();
  };
  const handleCoverDelete = async () => {
    if (!window.confirm('確定要刪除封面圖片？')) return;
    const res  = await fetch(`${API}/${coverDmId}/cover`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) return showMsg(data.error || '刪除失敗', 'err');
    showMsg('封面已刪除');
    closeCover();
    load();
  };

  const handleSaveHotspots = async (spots) => {
    const res  = await apiFetch(`${API}/${editingHotspots.id}`, { method: 'PUT', body: JSON.stringify({ hotspots: spots }) });
    const data = await res.json();
    if (!res.ok) return showMsg(data.error || '儲存失敗', 'err');
    showMsg('熱區已儲存');
    setEditingHotspots(null);
    load();
  };

  /* ── 上傳圖片 ── */
  const isStrip = uploading ? (catalog.find(d => d.id === uploading)?.type === 'strip') : false;

  const addFiles = (files) => {
    const images = files.filter(f => f.type.startsWith('image/'));
    if (!images.length) return;
    if (isStrip) setUploadFiles([images[0]]); // 長條版型只取第一張
    else setUploadFiles(prev => [...prev, ...images]);
  };

  const handleUpload = async () => {
    if (!uploadFiles.length) return;
    const fd = new FormData();
    const maxExisting = isStrip ? 0 : existingPages.reduce((max, f) => {
      const n = parseInt(f, 10);
      return isNaN(n) ? max : Math.max(max, n);
    }, 0);
    uploadFiles.forEach((f, i) => {
      const ext     = f.name.split('.').pop().toLowerCase();
      const renamed = new File([f], `${String(maxExisting + i + 1).padStart(3, '0')}.${ext}`, { type: f.type });
      fd.append('images', renamed);
    });
    try {
      const res  = await fetch(`${API}/${uploading}/upload`, { method: 'POST', body: fd });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch {
        console.error('上傳回應非 JSON：', text.slice(0, 200));
        return showMsg('伺服器回應格式錯誤，請查看 console', 'err');
      }
      if (!res.ok) return showMsg(data.error || '上傳失敗', 'err');
      showMsg(`已上傳 ${data.files?.length ?? 0} 張圖片`);
      setUploadFiles([]);
      // 重新載入現有圖片列表
      try {
        const r = await fetch(`/api/dm/${uploading}/pages`);
        const files = await r.json();
        setExistingPages(Array.isArray(files) ? files : []);
        setExistingPagesDirty(false);
      } catch {}
    } catch (err) {
      console.error('上傳失敗：', err);
      showMsg(`上傳失敗：${err.message}`, 'err');
    }
  };

  const handleReorderEnd = () => {
    const from = dragItemRef.current;
    const to   = dragOverRef.current;
    dragItemRef.current = null;
    dragOverRef.current = null;
    if (from === null || to === null || from === to) return;
    setUploadFiles(prev => {
      const copy = [...prev];
      const [moved] = copy.splice(from, 1);
      copy.splice(to, 0, moved);
      return copy;
    });
  };


  const handleSaveOrder = async () => {
    const res  = await apiFetch(`${API}/${uploading}/pages/order`, {
      method: 'PUT',
      body: JSON.stringify({ order: existingPages }),
    });
    const data = await res.json();
    if (!res.ok) return showMsg(data.error || '儲存失敗', 'err');
    showMsg('排序已儲存');
    setExistingPagesDirty(false);
  };

  const handleDeleteExistingImage = async (file) => {
    if (!window.confirm(`確定刪除圖片「${file}」？`)) return;
    const res  = await fetch(`${API}/${uploading}/images/${file}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) return showMsg(data.error || '刪除失敗', 'err');
    setExistingPages(prev => prev.filter(f => f !== file));
    setExistingPagesDirty(false);
    showMsg('已刪除');
  };

  const sortedCatalog = [...catalog].sort((a, b) => a.order - b.order);

  return (
    <div className="dm-manager">
      <div className="dm-manager-header">
        <h1 className="dm-manager-title">DM 管理</h1>
        <button className="btn btn-primary" onClick={openNew}>＋ 新增 DM</button>
      </div>

      {msg && <div className="admin-popup-overlay"><div className={`admin-popup admin-popup--${msg.type}`}>{msg.text}</div></div>}

      {/* ── 新增/編輯表單 ── */}
      {showForm && (
        <div className="dm-form-card">
          <div className="dm-form-title">{editingId ? `編輯：${editingId}` : '新增 DM'}</div>
          <form className="dm-form" onSubmit={handleSubmit}>
            {editingId && (
              <div className="dm-id-hint">ID：<code>{editingId}</code></div>
            )}
            <label>
              標題
              <input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="例：中友周年慶"
                required
              />
            </label>
            <label>
              副標題
              <input
                value={form.subtitle}
                onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))}
                placeholder="例：檔期時間：2026/5/1～5/31"
              />
            </label>
            <label>
              排序
              <input
                type="number"
                value={form.order}
                onChange={e => setForm(f => ({ ...f, order: e.target.value }))}
                placeholder="數字越小越前面"
              />
            </label>
            <label>
              版型{editingId && <span className="dm-field-locked">（建立後不可更改）</span>}
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="dm-form-select"
                disabled={!!editingId}
              >
                <option value="double">雙頁</option>
                <option value="single">單頁</option>
                <option value="strip">長條</option>
                <option value="url">URL</option>
              </select>
            </label>
            {form.type === 'url' && (
              <label>
                導向 URL
                <input
                  value={form.url}
                  onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                  placeholder="https://..."
                  required={form.type === 'url'}
                />
              </label>
            )}
            <div className="dm-form-date-row">
              <label>
                開始日期
                <input
                  type="date"
                  value={form.startDate}
                  onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                />
              </label>
              <label>
                結束日期
                <input
                  type="date"
                  value={form.endDate}
                  onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                />
              </label>
            </div>
            <div className="dm-form-actions">
              <button type="submit" className="btn btn-primary">儲存</button>
              <button type="button" className="btn btn-ghost" onClick={closeForm}>取消</button>
            </div>
          </form>
        </div>
      )}

      {/* ── 上傳圖片 ── */}
      {uploading && (
        <div className="dm-form-card">
          <div className="dm-form-title">
            上傳圖片：{uploading}
            {isStrip && <span className="dm-type-badge dm-type-badge--strip">長條版型（限 1 張）</span>}
          </div>

          <div
            className={`upload-dropzone${isDragOver ? ' upload-dropzone--over' : ''}`}
            onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={e => { e.preventDefault(); setIsDragOver(false); addFiles(Array.from(e.dataTransfer.files)); }}
            onClick={() => fileInputRef.current.click()}
          >
            <span className="upload-dropzone-icon">+</span>
            <span className="upload-dropzone-text">拖曳圖片到此，或點擊選擇檔案</span>
            <span className="upload-dropzone-sub">
              {isStrip ? '長條版型只需上傳 1 張圖' : '支援 JPG、PNG、WebP，可多選'}
            </span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple={!isStrip}
            style={{ display: 'none' }}
            onChange={e => { addFiles(Array.from(e.target.files)); e.target.value = ''; }}
          />

          {/* ── 現有圖片 ── */}
          {existingPages.length > 0 && (
            <div className="upload-file-list">
              <div className="upload-file-list-header">
                <span>現有圖片（{existingPages.length} 張）{!isStrip && '・拖曳可調整順序'}</span>
                {existingPagesDirty && (
                  <button className="btn btn-primary btn-sm" onClick={handleSaveOrder}>儲存排序</button>
                )}
              </div>
              {existingPages.map((file, i) => (
                <div
                  key={file}
                  className="upload-file-item"
                  draggable={!isStrip}
                  onDragStart={() => { if (!isStrip) dragExistingItemRef.current = i; }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault();
                    if (isStrip) return;
                    const from = dragExistingItemRef.current;
                    dragExistingItemRef.current = null;
                    if (from === null || from === i) return;
                    setExistingPages(prev => {
                      const copy = [...prev];
                      const [moved] = copy.splice(from, 1);
                      copy.splice(i, 0, moved);
                      return copy;
                    });
                    setExistingPagesDirty(true);
                  }}
                >
                  {!isStrip && <span className="upload-file-handle">⠿</span>}
                  <img
                    src={`/api/images/dm-pic/${uploading}/${file}`}
                    alt={file}
                    className="upload-file-thumb"
                  />
                  <span className="upload-file-name">{file}</span>
                  {!isStrip && <span className="upload-file-order">#{i + 1}</span>}
                  <button
                    className="upload-file-remove"
                    onClick={() => handleDeleteExistingImage(file)}
                  >✕</button>
                </div>
              ))}
            </div>
          )}

          {uploadFiles.length > 0 && (
            <div className="upload-file-list">
              <div className="upload-file-list-header">
                <span>待上傳：{uploadFiles.length} 個檔案{!isStrip && '・拖曳可調整頁序'}</span>
                <button className="upload-clear-btn" onClick={() => setUploadFiles([])}>全部清除</button>
              </div>
              {uploadFiles.map((file, i) => (
                <div
                  key={`${file.name}-${i}`}
                  className="upload-file-item"
                  draggable={!isStrip}
                  onDragStart={() => { if (!isStrip) dragItemRef.current = i; }}
                  onDragEnter={() => { if (!isStrip) dragOverRef.current = i; }}
                  onDragEnd={!isStrip ? handleReorderEnd : undefined}
                  onDragOver={e => e.preventDefault()}
                >
                  {!isStrip && <span className="upload-file-handle">⠿</span>}
                  <img src={previewUrls[i]} alt={file.name} className="upload-file-thumb" />
                  <span className="upload-file-name">{file.name}</span>
                  <span className="upload-file-size">{(file.size / 1024).toFixed(0)} KB</span>
                  {!isStrip && <span className="upload-file-order">#{i + 1}</span>}
                  <button
                    className="upload-file-remove"
                    onClick={() => setUploadFiles(f => f.filter((_, idx) => idx !== i))}
                  >✕</button>
                </div>
              ))}
            </div>
          )}

          <div className="dm-form-actions">
            <button className="btn btn-primary" onClick={handleUpload} disabled={!uploadFiles.length}>
              {uploadFiles.length > 0 ? `上傳（${uploadFiles.length}）` : '上傳'}
            </button>
            <button className="btn btn-ghost" onClick={() => { setUploading(null); setUploadFiles([]); }}>取消</button>
          </div>
        </div>
      )}

      {/* ── 嵌入按鈕管理（double / single）── */}
      {managingBtns && (
        <div className="dm-form-card">
          <div className="dm-form-title">嵌入按鈕管理：{managingBtns}</div>

          {showBtnForm && (
            <div className="btn-form">
              <input
                className="btn-form-input"
                type="number"
                min="1"
                value={btnForm.page}
                onChange={e => setBtnForm(f => ({ ...f, page: e.target.value }))}
                placeholder="頁碼"
              />
              <input
                className="btn-form-input btn-form-url"
                value={btnForm.url}
                onChange={e => setBtnForm(f => ({ ...f, url: e.target.value }))}
                placeholder="https://..."
              />
              <button className="btn btn-primary btn-sm" onClick={saveBtnForm}>確認</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowBtnForm(false)}>取消</button>
            </div>
          )}

          {btnList.length === 0 && !showBtnForm && <p className="dm-upload-hint">尚無嵌入按鈕</p>}
          {btnList.length > 0 && (
            <table className="dm-table btn-table">
              <thead><tr><th>頁碼</th><th>連結 URL</th><th>操作</th></tr></thead>
              <tbody>
                {btnList.map((b, i) => (
                  <tr key={i}>
                    <td>{b.page}</td>
                    <td className="btn-url-cell">{b.url}</td>
                    <td className="dm-table-actions">
                      <button className="btn btn-sm" onClick={() => openEditBtn(i)}>編輯</button>
                      <button className="btn btn-sm btn-danger" onClick={() => deleteBtn(i)}>刪除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="dm-form-actions">
            <button className="btn btn-primary" onClick={handleSaveBtns}>儲存</button>
            <button className="btn btn-ghost" onClick={openAddBtn}>＋ 新增按鈕</button>
            <button className="btn btn-ghost" onClick={closeBtns}>取消</button>
          </div>
        </div>
      )}

      {/* ── 熱區管理（strip）── */}
      {editingHotspots && (
        <div className="dm-form-card">
          <div className="dm-form-title">熱區管理：{editingHotspots.id}</div>
          <HotspotEditor
            dmId={editingHotspots.id}
            initialHotspots={editingHotspots.hotspots}
            onSave={handleSaveHotspots}
            onCancel={() => setEditingHotspots(null)}
          />
        </div>
      )}

      {/* ── 封面設定（strip）── */}
      {coverDmId && (() => {
        const dm = catalog.find(d => d.id === coverDmId);
        const existingCover = dm?.cover
          ? `/api/images/dm-pic/${coverDmId}/${dm.cover}`
          : null;
        return (
          <div key={coverDmId} className="dm-form-card">
            <div className="dm-form-title">封面設定：{coverDmId}</div>

            {existingCover && !coverFile && (
              <div className="cover-current">
                <p className="cover-current-label">目前封面</p>
                <img src={existingCover} alt="目前封面" className="cover-current-img" />
                <button className="btn btn-sm btn-danger" onClick={handleCoverDelete}>刪除封面</button>
              </div>
            )}

            <div
              className="upload-dropzone"
              onClick={() => coverInputRef.current.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); handleCoverFileChange(e.dataTransfer.files[0]); }}
            >
              <span className="upload-dropzone-icon">+</span>
              <span className="upload-dropzone-text">
                {coverFile ? '已選擇，可重新選擇' : existingCover ? '上傳新封面以取代' : '拖曳或點擊選擇封面圖片'}
              </span>
              <span className="upload-dropzone-sub">支援 JPG、PNG、WebP</span>
            </div>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={e => { handleCoverFileChange(e.target.files[0]); e.target.value = ''; }}
            />

            {coverPreviewUrl && (
              <div className="cover-preview">
                <p className="cover-current-label">預覽</p>
                <img src={coverPreviewUrl} alt="預覽" className="cover-current-img" />
              </div>
            )}

            <div className="dm-form-actions">
              <button className="btn btn-primary" onClick={handleCoverUpload} disabled={!coverFile}>上傳</button>
              <button className="btn btn-ghost" onClick={closeCover}>取消</button>
            </div>
          </div>
        );
      })()}

      {/* ── DM 列表 ── */}
      {loading ? (
        <p className="dm-loading">載入中…</p>
      ) : (
        <table className="dm-table">
          <thead>
            <tr>
              <th>排序</th>
              <th>ID</th>
              <th>版型</th>
              <th>標題</th>
              <th>副標題</th>
              <th>展示期間</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {sortedCatalog.map(dm => (
              <tr key={dm.id}>
                <td>{dm.order}</td>
                <td><code>{dm.id}</code></td>
                <td>
                  <span className={`dm-type-badge dm-type-badge--${dm.type || 'double'}`}>
                    {TYPE_LABEL[dm.type] || '双頁'}
                  </span>
                </td>
                <td>{dm.title}</td>
                <td>{dm.subtitle}</td>
                <td className="dm-date-cell">
                  {dm.startDate || dm.endDate
                    ? <>{dm.startDate || '—'}<br />{dm.endDate ? `~ ${dm.endDate}` : ''}</>
                    : <span className="dm-date-none">不限</span>
                  }
                </td>
                <td className="dm-table-actions">
                  {dm.type === 'url' ? (
                    <>
                      <button className="btn btn-sm btn-blue" onClick={() => openCover(dm)}>封面設定</button>
                    </>
                  ) : (
                    <>
                      <button className="btn btn-sm btn-blue" onClick={() => setPreviewing(dm.id)}>預覽</button>
                      <button className="btn btn-sm" onClick={() => openUpload(dm.id)}>上傳圖片</button>
                      {dm.type === 'strip' ? (
                        <>
                          <button className="btn btn-sm btn-blue" onClick={() => openHotspots(dm)}>熱區管理</button>
                          <button className="btn btn-sm btn-blue" onClick={() => openCover(dm)}>封面設定</button>
                        </>
                      ) : (
                        <button className="btn btn-sm" onClick={() => openBtns(dm)}>嵌入按鈕</button>
                      )}
                    </>
                  )}
                  <button className="btn btn-sm" onClick={() => openEdit(dm)}>編輯</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(dm.id)}>刪除</button>
                </td>
              </tr>
            ))}
            {sortedCatalog.length === 0 && (
              <tr><td colSpan={6} className="dm-empty">尚無資料</td></tr>
            )}
          </tbody>
        </table>
      )}

      {previewing && <PreviewModal dmId={previewing} onClose={() => setPreviewing(null)} />}
    </div>
  );
}
