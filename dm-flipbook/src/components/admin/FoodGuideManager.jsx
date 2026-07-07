import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../../utils/apiFetch';
import './FloorGuideManager.css';
import './FoodGuideManager.css';

const API = '/api/admin/food-guide';
const SECTIONS = [
  { key: 'theme',     label: '主題餐廳' },
  { key: 'foodcourt', label: '美食街' },
];
const EMPTY_FORM = { name: '', building: '', floor: '', description: '', phone: '', image: '' };

const resolveImg = (img) =>
  !img ? null
  : (img.startsWith('/') || img.startsWith('http')) ? img
  : `/api/images/food-pic/${img}`;

export default function FoodGuideManager() {
  const [data, setData]               = useState(null);
  const [loading, setLoading]         = useState(true);
  const [activeCat, setActiveCat]     = useState('');
  const [activeSection, setSection]   = useState('theme');
  const [labelEdit, setLabelEdit]     = useState('');
  const [form, setForm]               = useState(EMPTY_FORM);
  const [editingIdx, setEditingIdx]   = useState(null);
  const [showForm, setShowForm]       = useState(false);
  const [showAddCat, setShowAddCat]   = useState(false);
  const [newCat, setNewCat]           = useState({ id: '', label: '' });
  const [imgUploading, setImgUploading] = useState(false);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [msg, setMsg]                 = useState(null);
  const imgInputRef  = useRef();
  const dragItemRef  = useRef(null);
  const dragOverRef  = useRef(null);

  const load = () =>
    apiFetch(API).then(r => r.json()).then(d => {
      setData(d);
      setActiveCat(prev => {
        const firstId = d.categories?.[0]?.id ?? '';
        return d.categories?.find(c => c.id === prev) ? prev : firstId;
      });
      setLoading(false);
    }).catch(() => { showMsgFn('無法連線到後端', 'err'); setLoading(false); });

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!data || !activeCat) return;
    const cat = data.categories.find(c => c.id === activeCat);
    setLabelEdit(cat?.label ?? '');
  }, [activeCat, data]);

  const showMsgFn = (text, type = 'ok') => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 3000);
  };

  const restaurants = data?.restaurants?.[activeCat]?.[activeSection] ?? [];

  /* ── Category ── */
  const handleSaveLabel = async () => {
    const res  = await apiFetch(`${API}/categories/${activeCat}`, { method: 'PUT', body: JSON.stringify({ label: labelEdit }) });
    const json = await res.json();
    if (!res.ok) return showMsgFn(json.error || '儲存失敗', 'err');
    showMsgFn('分類名稱已更新');
    load();
  };

  const handleDeleteCat = async () => {
    const cat = data.categories.find(c => c.id === activeCat);
    if (!window.confirm(`確定要刪除分類「${cat?.label}」及其所有餐廳？`)) return;
    const res  = await apiFetch(`${API}/categories/${activeCat}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) return showMsgFn(json.error || '刪除失敗', 'err');
    showMsgFn('已刪除分類');
    load();
  };

  const handleAddCat = async () => {
    if (!newCat.id.trim() || !newCat.label.trim()) return showMsgFn('ID 與名稱為必填', 'err');
    const res  = await apiFetch(`${API}/categories`, { method: 'POST', body: JSON.stringify(newCat) });
    const json = await res.json();
    if (!res.ok) return showMsgFn(json.error || '新增失敗', 'err');
    showMsgFn('已新增分類');
    setShowAddCat(false);
    setNewCat({ id: '', label: '' });
    load();
  };

  /* ── Restaurant CRUD ── */
  const openAdd = () => { setForm(EMPTY_FORM); setEditingIdx(null); setShowForm(true); };
  const openEdit = (idx) => {
    const r = restaurants[idx];
    setForm({ name: r.name, building: r.building, floor: r.floor, description: r.description, phone: r.phone, image: r.image });
    setEditingIdx(idx);
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditingIdx(null); };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return showMsgFn('餐廳名稱為必填', 'err');
    const url    = editingIdx !== null
      ? `${API}/${activeCat}/${activeSection}/${editingIdx}`
      : `${API}/${activeCat}/${activeSection}`;
    const method = editingIdx !== null ? 'PUT' : 'POST';
    const res    = await apiFetch(url, { method, body: JSON.stringify(form) });
    const json   = await res.json();
    if (!res.ok) return showMsgFn(json.error || '操作失敗', 'err');
    showMsgFn(editingIdx !== null ? '已更新' : '已新增');
    closeForm();
    load();
  };

  const handleDelete = async (idx) => {
    if (!window.confirm(`確定要刪除「${restaurants[idx]?.name}」？`)) return;
    const res  = await apiFetch(`${API}/${activeCat}/${activeSection}/${idx}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) return showMsgFn(json.error || '刪除失敗', 'err');
    showMsgFn('已刪除');
    load();
  };

  /* ── Image upload ── */
  const handleImgUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    setImgUploading(true);
    const fd = new FormData();
    fd.append('image', file);
    const res  = await apiFetch(`${API}/image`, { method: 'POST', body: fd });
    const json = await res.json();
    setImgUploading(false);
    if (!res.ok) return showMsgFn(json.error || '上傳失敗', 'err');
    setForm(f => ({ ...f, image: json.path }));
  };

  /* ── Drag reorder ── */
  const handleReorderEnd = async () => {
    const from = dragItemRef.current;
    const to   = dragOverRef.current;
    dragItemRef.current = null;
    dragOverRef.current = null;
    setDragOverIdx(null);
    if (from === null || to === null || from === to) return;

    const reordered = [...restaurants];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);

    setData(prev => ({
      ...prev,
      restaurants: {
        ...prev.restaurants,
        [activeCat]: { ...prev.restaurants[activeCat], [activeSection]: reordered },
      },
    }));

    const res = await apiFetch(`${API}/${activeCat}/${activeSection}`, {
      method: 'PUT',
      body: JSON.stringify(reordered),
    });
    if (!res.ok) { showMsgFn('排序儲存失敗', 'err'); load(); }
  };

  if (loading) return <p className="fg-loading">載入中…</p>;

  return (
    <div className="fg-manager">
      <div className="fg-manager-header">
        <h1 className="fg-manager-title">美食導覽管理</h1>
      </div>

      {msg && <div className="admin-popup-overlay"><div className={`admin-popup admin-popup--${msg.type}`}>{msg.text}</div></div>}

      {/* ── 分類 tabs ── */}
      <div className="food-cat-tabs-row">
        <div className="food-cat-tabs">
          {data.categories.map(c => (
            <button
              key={c.id}
              className={`fg-building-tab${activeCat === c.id ? ' active' : ''}`}
              onClick={() => { setActiveCat(c.id); setShowForm(false); setShowAddCat(false); }}
            >
              {c.label}
            </button>
          ))}
        </div>
        <button
          className="fg-btn fg-btn-ghost fg-btn-sm"
          onClick={() => { setShowAddCat(v => !v); setShowForm(false); }}
        >
          ＋ 新增分類
        </button>
      </div>

      {/* ── 新增分類表單 ── */}
      {showAddCat && (
        <div className="fg-info-card">
          <div className="fg-info-card-title">新增分類</div>
          <div className="food-addcat-row">
            <input
              className="fg-info-input"
              placeholder="ID（英文，如 taiwanese）"
              value={newCat.id}
              onChange={e => setNewCat(f => ({ ...f, id: e.target.value }))}
            />
            <input
              className="fg-info-input"
              placeholder="顯示名稱（如 台式料理）"
              value={newCat.label}
              onChange={e => setNewCat(f => ({ ...f, label: e.target.value }))}
            />
            <button className="fg-btn fg-btn-primary fg-btn-sm" onClick={handleAddCat}>確認新增</button>
            <button className="fg-btn fg-btn-ghost fg-btn-sm" onClick={() => setShowAddCat(false)}>取消</button>
          </div>
        </div>
      )}

      {activeCat && (
        <>
          {/* ── 分類名稱編輯 ── */}
          <div className="fg-floor-bar">
            <span className="fg-floor-bar-label">分類名稱</span>
            <input
              className="fg-label-input"
              value={labelEdit}
              onChange={e => setLabelEdit(e.target.value)}
              placeholder="分類顯示名稱"
            />
            <button className="fg-btn fg-btn-ghost" onClick={handleSaveLabel}>儲存名稱</button>
            <button className="fg-btn fg-btn-danger" onClick={handleDeleteCat}>刪除此分類</button>
          </div>

          {/* ── 主題餐廳 / 美食街 section tabs ── */}
          <div className="fg-building-tabs">
            {SECTIONS.map(s => (
              <button
                key={s.key}
                className={`fg-building-tab${activeSection === s.key ? ' active' : ''}`}
                onClick={() => { setSection(s.key); setShowForm(false); }}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* ── 餐廳列表 ── */}
          <div className="fg-section">
            <div className="fg-section-header">
              <span className="fg-section-title">
                {SECTIONS.find(s => s.key === activeSection)?.label}・共 {restaurants.length} 筆
              </span>
              <button className="fg-btn fg-btn-primary" onClick={openAdd}>＋ 新增餐廳</button>
            </div>

            {/* 新增/編輯表單 */}
            {showForm && (
              <div className="fg-form-card">
                <div className="fg-form-card-title">{editingIdx !== null ? '編輯餐廳' : '新增餐廳'}</div>
                <form className="fg-form" onSubmit={handleSave}>
                  <label>
                    餐廳名稱 *
                    <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                  </label>
                  <div className="food-form-row">
                    <label>
                      棟別
                      <input value={form.building} onChange={e => setForm(f => ({ ...f, building: e.target.value }))} placeholder="A棟" />
                    </label>
                    <label>
                      樓層
                      <input value={form.floor} onChange={e => setForm(f => ({ ...f, floor: e.target.value }))} placeholder="12F" />
                    </label>
                    <label>
                      電話
                      <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="04-2227-0000" />
                    </label>
                  </div>
                  <label>
                    簡介
                    <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="餐廳簡介說明" />
                  </label>

                  <div className="fg-logo-field">
                    <span className="fg-logo-field-label">圖片</span>
                    <div className="fg-logo-field-body">
                      {form.image && (
                        <img src={resolveImg(form.image)} alt="preview" className="fg-logo-preview" style={{ width: 64, height: 64 }} />
                      )}
                      <div className="fg-logo-actions">
                        <button
                          type="button"
                          className="fg-btn fg-btn-ghost fg-btn-sm"
                          onClick={() => imgInputRef.current.click()}
                          disabled={imgUploading}
                        >
                          {imgUploading ? '上傳中…' : (form.image ? '更換圖片' : '選擇圖片')}
                        </button>
                        {form.image && (
                          <button type="button" className="fg-btn fg-btn-sm fg-btn-danger" onClick={() => setForm(f => ({ ...f, image: '' }))}>移除</button>
                        )}
                      </div>
                      <input ref={imgInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImgUpload} />
                    </div>
                  </div>

                  <div className="fg-form-actions">
                    <button type="submit" className="fg-btn fg-btn-primary">儲存</button>
                    <button type="button" className="fg-btn fg-btn-ghost" onClick={closeForm}>取消</button>
                  </div>
                </form>
              </div>
            )}

            {restaurants.length === 0 ? (
              <div className="fg-empty">此分類暫無餐廳資料</div>
            ) : (
              <table className="fg-table">
                <thead>
                  <tr>
                    <th className="fg-th-handle"></th>
                    <th>圖片</th>
                    <th>名稱</th>
                    <th>位置</th>
                    <th>電話</th>
                    <th>簡介</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {restaurants.map((r, i) => (
                    <tr
                      key={i}
                      draggable
                      onDragStart={() => { dragItemRef.current = i; }}
                      onDragEnter={() => { dragOverRef.current = i; setDragOverIdx(i); }}
                      onDragEnd={handleReorderEnd}
                      onDragOver={e => e.preventDefault()}
                      className={dragOverIdx === i ? 'fg-tr-dragover' : ''}
                    >
                      <td className="fg-td-handle"><span className="fg-drag-handle">⠿</span></td>
                      <td>
                        {r.image
                          ? <img src={resolveImg(r.image)} alt={r.name} className="fg-logo-thumb" />
                          : <div className="fg-logo-placeholder">{r.name?.[0] ?? '?'}</div>
                        }
                      </td>
                      <td className="fg-td-name">{r.name}</td>
                      <td className="fg-td-phone">{r.building} {r.floor}</td>
                      <td className="fg-td-phone">{r.phone}</td>
                      <td className="fg-td-desc">{r.description}</td>
                      <td className="fg-td-actions">
                        <button className="fg-btn fg-btn-sm" onClick={() => openEdit(i)}>編輯</button>
                        <button className="fg-btn fg-btn-sm fg-btn-danger" onClick={() => handleDelete(i)}>刪除</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
