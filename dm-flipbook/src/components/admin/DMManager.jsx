import React, { useState, useEffect, useRef } from 'react';
import './DMManager.css';

const API = '/api/admin/catalog';

const EMPTY_FORM = { id: '', title: '', subtitle: '', order: '' };

function apiFetch(url, opts = {}) {
  return fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
}

/* ── 預覽 Modal ── */
function PreviewModal({ dmId, onClose }) {
  const [pages, setPages]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [lightbox, setLightbox]   = useState(null);

  useEffect(() => {
    fetch(`/api/dm/${dmId}/pages`)
      .then(r => r.json())
      .then(files => {
        setPages(Array.isArray(files) ? files : []);
        setLoading(false);
      })
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
        {!loading && pages.length === 0 && (
          <p className="preview-status">尚無圖片</p>
        )}

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
          <img
            src={imgSrc(pages[lightbox])}
            alt={pages[lightbox]}
            onClick={e => e.stopPropagation()}
          />
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
  const [catalog, setCatalog]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [editingId, setEditingId]     = useState(null);
  const [showForm, setShowForm]       = useState(false);
  const [uploading, setUploading]     = useState(null);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [managingBtns, setManagingBtns]   = useState(null); // dm id
  const [btnList, setBtnList]             = useState([]);
  const [btnForm, setBtnForm]             = useState({ page: '', url: '' });
  const [editingBtnIdx, setEditingBtnIdx] = useState(null);
  const [showBtnForm, setShowBtnForm]     = useState(false);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [isDragOver, setIsDragOver]   = useState(false);
  const [previewing, setPreviewing]   = useState(null);
  const [msg, setMsg]                 = useState(null);
  const fileInputRef                  = useRef();
  const dragItemRef                   = useRef(null);
  const dragOverRef                   = useRef(null);

  /* 管理縮圖 URL 的生命週期 */
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
    setForm({ id: dm.id, title: dm.title, subtitle: dm.subtitle || '', order: dm.order });
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

  const openUpload = (id) => {
    setUploading(id);
    setUploadFiles([]);
  };

  /* ── 嵌入按鈕管理 ── */
  const openBtns = (dm) => {
    setManagingBtns(dm.id);
    setBtnList(dm.button ? [...dm.button] : []);
    setShowBtnForm(false);
    setEditingBtnIdx(null);
  };

  const closeBtns = () => { setManagingBtns(null); setShowBtnForm(false); };

  const openAddBtn = () => {
    setBtnForm({ page: '', url: '' });
    setEditingBtnIdx(null);
    setShowBtnForm(true);
  };

  const openEditBtn = (i) => {
    setBtnForm({ page: String(btnList[i].page), url: btnList[i].url });
    setEditingBtnIdx(i);
    setShowBtnForm(true);
  };

  const deleteBtn = (i) => setBtnList(list => list.filter((_, idx) => idx !== i));

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
    const res  = await apiFetch(`${API}/${managingBtns}`, {
      method: 'PUT',
      body: JSON.stringify({ button: btnList }),
    });
    const data = await res.json();
    if (!res.ok) return showMsg(data.error || '儲存失敗', 'err');
    showMsg('已儲存');
    closeBtns();
    load();
  };

  const addFiles = (files) => {
    const images = files.filter(f => f.type.startsWith('image/'));
    if (images.length) setUploadFiles(prev => [...prev, ...images]);
  };

  const handleUpload = async () => {
    if (!uploadFiles.length) return;
    const fd = new FormData();
    /* 依排序結果重新命名，確保後端排序與拖曳順序一致 */
    uploadFiles.forEach((f, i) => {
      const ext = f.name.split('.').pop().toLowerCase();
      const renamed = new File([f], `${String(i + 1).padStart(3, '0')}.${ext}`, { type: f.type });
      fd.append('images', renamed);
    });
    const res  = await fetch(`${API}/${uploading}/upload`, { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) return showMsg(data.error || '上傳失敗', 'err');
    showMsg(`已上傳 ${data.files?.length ?? 0} 張圖片`);
    setUploading(null);
    setUploadFiles([]);
  };

  /* 拖曳排序結束，重新排列 uploadFiles */
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

  const sortedCatalog = [...catalog].sort((a, b) => a.order - b.order);

  return (
    <div className="dm-manager">
      <div className="dm-manager-header">
        <h1 className="dm-manager-title">DM 管理</h1>
        <button className="btn btn-primary" onClick={openNew}>＋ 新增 DM</button>
      </div>

      {msg && <div className={`dm-msg dm-msg--${msg.type}`}>{msg.text}</div>}

      {/* ── 新增/編輯表單 ── */}
      {showForm && (
        <div className="dm-form-card">
          <div className="dm-form-title">{editingId ? `編輯：${editingId}` : '新增 DM'}</div>
          <form className="dm-form" onSubmit={handleSubmit}>
            <label>
              ID（唯一，建立後不可改）
              <input
                value={form.id}
                onChange={e => setForm(f => ({ ...f, id: e.target.value }))}
                placeholder="例：dm-5"
                disabled={!!editingId}
                required
              />
            </label>
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
          <div className="dm-form-title">上傳圖片：{uploading}</div>

          {/* Drop Zone */}
          <div
            className={`upload-dropzone${isDragOver ? ' upload-dropzone--over' : ''}`}
            onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={e => {
              e.preventDefault();
              setIsDragOver(false);
              addFiles(Array.from(e.dataTransfer.files));
            }}
            onClick={() => fileInputRef.current.click()}
          >
            <span className="upload-dropzone-icon">+</span>
            <span className="upload-dropzone-text">拖曳圖片到此，或點擊選擇檔案</span>
            <span className="upload-dropzone-sub">支援 JPG、PNG、WebP，可多選</span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={e => { addFiles(Array.from(e.target.files)); e.target.value = ''; }}
          />

          {/* 已選擇的檔案列表（可拖曳排序）*/}
          {uploadFiles.length > 0 && (
            <div className="upload-file-list">
              <div className="upload-file-list-header">
                <span>{uploadFiles.length} 個檔案・拖曳可調整頁序</span>
                <button className="upload-clear-btn" onClick={() => setUploadFiles([])}>全部清除</button>
              </div>
              {uploadFiles.map((file, i) => (
                <div
                  key={`${file.name}-${i}`}
                  className="upload-file-item"
                  draggable
                  onDragStart={() => { dragItemRef.current = i; }}
                  onDragEnter={() => { dragOverRef.current = i; }}
                  onDragEnd={handleReorderEnd}
                  onDragOver={e => e.preventDefault()}
                >
                  <span className="upload-file-handle">⠿</span>
                  <img src={previewUrls[i]} alt={file.name} className="upload-file-thumb" />
                  <span className="upload-file-name">{file.name}</span>
                  <span className="upload-file-size">{(file.size / 1024).toFixed(0)} KB</span>
                  <span className="upload-file-order">#{i + 1}</span>
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

      {/* ── 嵌入按鈕管理 ── */}
      {managingBtns && (
        <div className="dm-form-card">
          <div className="dm-form-title">嵌入按鈕管理：{managingBtns}</div>

          {/* 新增/編輯表單 */}
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

          {/* 按鈕列表 */}
          {btnList.length === 0 && !showBtnForm && (
            <p className="dm-upload-hint">尚無嵌入按鈕</p>
          )}
          {btnList.length > 0 && (
            <table className="dm-table btn-table">
              <thead>
                <tr>
                  <th>頁碼</th>
                  <th>連結 URL</th>
                  <th>操作</th>
                </tr>
              </thead>
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

      {/* ── DM 列表 ── */}
      {loading ? (
        <p className="dm-loading">載入中…</p>
      ) : (
        <table className="dm-table">
          <thead>
            <tr>
              <th>排序</th>
              <th>ID</th>
              <th>標題</th>
              <th>副標題</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {sortedCatalog.map(dm => (
              <tr key={dm.id}>
                <td>{dm.order}</td>
                <td><code>{dm.id}</code></td>
                <td>{dm.title}</td>
                <td>{dm.subtitle}</td>
                <td className="dm-table-actions">
                  <button className="btn btn-sm btn-blue" onClick={() => setPreviewing(dm.id)}>預覽</button>
                  <button className="btn btn-sm" onClick={() => openUpload(dm.id)}>上傳圖片</button>
                  <button className="btn btn-sm" onClick={() => openBtns(dm)}>嵌入按鈕</button>
                  <button className="btn btn-sm" onClick={() => openEdit(dm)}>編輯</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(dm.id)}>刪除</button>
                </td>
              </tr>
            ))}
            {sortedCatalog.length === 0 && (
              <tr><td colSpan={5} className="dm-empty">尚無資料</td></tr>
            )}
          </tbody>
        </table>
      )}

      {/* ── 預覽 Modal ── */}
      {previewing && (
        <PreviewModal dmId={previewing} onClose={() => setPreviewing(null)} />
      )}
    </div>
  );
}
