import React, { useState, useEffect, useRef, useCallback } from 'react';
import './FloorGuideManager.css';

const API      = '/api/admin/floor-guide';
const BUILDINGS = ['A', 'B', 'C'];
const EMPTY_FORM = { name: '', phone: '', description: '', logo: '' };

function apiFetch(url, opts = {}) {
  return fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
}

export default function FloorGuideManager() {
  const [data, setData]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [building, setBuilding]     = useState('A');
  const [floor, setFloor]           = useState('');
  const [labelEdit, setLabelEdit]   = useState('');
  const [form, setForm]             = useState(EMPTY_FORM);
  const [editingIdx, setEditingIdx] = useState(null);
  const [showForm, setShowForm]     = useState(false);
  const [infoForm, setInfoForm]           = useState({ title: '', icons: [] });
  const [iconLibrary, setIconLibrary]     = useState([]);
  const [iconUploading, setIconUploading] = useState(false);
  const iconInputRef                      = useRef();
  const [logoUploading, setLogoUploading] = useState(false);
  const [dragOverIdx, setDragOverIdx]     = useState(null);
  const [msg, setMsg]               = useState(null);
  const logoInputRef                = useRef();
  const dragItemRef                 = useRef(null);
  const dragOverRef                 = useRef(null);

  /* 初始載入 */
  useEffect(() => {
    fetch(API)
      .then(r => r.json())
      .then(d => {
        setData(d);
        if (d.floors?.length) setFloor(d.floors[0].id);
        setLoading(false);
      })
      .catch(() => { showMsgFn('無法連線到後端', 'err'); setLoading(false); });
  }, []);

  /* 切換棟/樓層時同步 label 和 floorInfo 輸入框 */
  useEffect(() => {
    if (!data || !floor) return;
    const f = data.floors.find(f => f.id === floor);
    setLabelEdit(f?.label ?? '');
    const info = data.floorInfo?.[building]?.[floor] ?? { title: '', icons: [] };
    setInfoForm({ title: info.title ?? '', icons: [...(info.icons ?? [])] });
  }, [floor, building, data]);

  const reload = () =>
    fetch(API).then(r => r.json()).then(d => setData(d)).catch(() => {});

  const reloadIcons = useCallback(() =>
    fetch(`${API}/icons`).then(r => r.json()).then(setIconLibrary).catch(() => {}), []);

  useEffect(() => { reloadIcons(); }, [reloadIcons]);

  const showMsgFn = (text, type = 'ok') => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 3000);
  };

  const counters = data?.counters?.[building]?.[floor] ?? [];
  const floors   = data?.floors ?? [];

  /* ── Counter CRUD ── */
  const openAdd = () => {
    setForm(EMPTY_FORM);
    setEditingIdx(null);
    setShowForm(true);
  };

  const openEdit = (idx) => {
    const c = counters[idx];
    setForm({ name: c.name, phone: c.phone, description: c.description, logo: c.logo });
    setEditingIdx(idx);
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditingIdx(null); };

  const handleSaveCounter = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return showMsgFn('品牌名稱為必填', 'err');
    const url    = editingIdx !== null
      ? `${API}/${building}/${floor}/counters/${editingIdx}`
      : `${API}/${building}/${floor}/counters`;
    const method = editingIdx !== null ? 'PUT' : 'POST';
    const res    = await apiFetch(url, { method, body: JSON.stringify(form) });
    const data   = await res.json();
    if (!res.ok) return showMsgFn(data.error || '操作失敗', 'err');
    showMsgFn(editingIdx !== null ? '已更新' : '已新增');
    closeForm();
    reload();
  };

  const handleDelete = async (idx) => {
    if (!window.confirm(`確定要刪除「${counters[idx]?.name}」？`)) return;
    const res  = await apiFetch(`${API}/${building}/${floor}/counters/${idx}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) return showMsgFn(data.error || '刪除失敗', 'err');
    showMsgFn('已刪除');
    reload();
  };

  /* ── 拖曳排序 ── */
  const handleReorderEnd = async () => {
    const from = dragItemRef.current;
    const to   = dragOverRef.current;
    dragItemRef.current = null;
    dragOverRef.current = null;
    setDragOverIdx(null);
    if (from === null || to === null || from === to) return;

    const reordered = [...counters];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);

    /* 即時更新畫面 */
    setData(prev => ({
      ...prev,
      counters: {
        ...prev.counters,
        [building]: { ...prev.counters[building], [floor]: reordered },
      },
    }));

    /* 存到後端 */
    const res = await apiFetch(`${API}/${building}/${floor}/counters`, {
      method: 'PUT',
      body: JSON.stringify(reordered),
    });
    if (!res.ok) { showMsgFn('排序儲存失敗', 'err'); reload(); }
  };

  /* ── Logo upload ── */
  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    setLogoUploading(true);
    const fd = new FormData();
    fd.append('logo', file);
    const res  = await fetch(`${API}/logo`, { method: 'POST', body: fd });
    const data = await res.json();
    setLogoUploading(false);
    if (!res.ok) return showMsgFn(data.error || '上傳失敗', 'err');
    setForm(f => ({ ...f, logo: data.path }));
  };

  /* ── Floor info ── */
  const handleSaveInfo = async () => {
    const res  = await apiFetch(`${API}/${building}/${floor}/info`, {
      method: 'PUT',
      body: JSON.stringify(infoForm),
    });
    const data = await res.json();
    if (!res.ok) return showMsgFn(data.error || '儲存失敗', 'err');
    showMsgFn('樓層資訊已更新');
    reload();
  };

  const toggleIcon = (filename) => {
    setInfoForm(f => {
      const has = f.icons.includes(filename);
      return { ...f, icons: has ? f.icons.filter(x => x !== filename) : [...f.icons, filename] };
    });
  };

  const handleIconDelete = async (filename) => {
    const res  = await fetch(`${API}/icon/${encodeURIComponent(filename)}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.status === 409) {
      showMsgFn(`此圖示正在使用中：${data.usedBy.join('、')}，請先從樓層資訊移除後再刪除`, 'err');
      return;
    }
    if (!res.ok) { showMsgFn(data.error || '刪除失敗', 'err'); return; }
    setIconLibrary(prev => prev.filter(f => f !== filename));
    setInfoForm(f => ({ ...f, icons: f.icons.filter(x => x !== filename) }));
    showMsgFn('圖示已刪除');
  };

  const handleIconUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    setIconUploading(true);
    const fd = new FormData();
    fd.append('icon', file);
    const res  = await fetch(`${API}/icon`, { method: 'POST', body: fd });
    const data = await res.json();
    setIconUploading(false);
    if (!res.ok) return showMsgFn(data.error || '上傳失敗', 'err');
    await reloadIcons();
    toggleIcon(data.filename);
  };

  /* ── Floor label ── */
  const handleSaveLabel = async () => {
    const res  = await apiFetch(`${API}/floors/${floor}`, {
      method: 'PUT',
      body: JSON.stringify({ label: labelEdit }),
    });
    const data = await res.json();
    if (!res.ok) return showMsgFn(data.error || '儲存失敗', 'err');
    showMsgFn('樓層描述已更新');
    reload();
  };

  if (loading) return <p className="fg-loading">載入中…</p>;

  return (
    <div className="fg-manager">
      <div className="fg-manager-header">
        <h1 className="fg-manager-title">樓層導覽管理</h1>
      </div>

      {msg && <div className="admin-popup-overlay"><div className={`admin-popup admin-popup--${msg.type}`}>{msg.text}</div></div>}

      {/* 棟別切換 */}
      <div className="fg-building-tabs">
        {BUILDINGS.map(b => (
          <button
            key={b}
            className={`fg-building-tab${building === b ? ' active' : ''}`}
            onClick={() => { setBuilding(b); setShowForm(false); }}
          >
            {b} 棟
          </button>
        ))}
      </div>

      {/* 樓層選擇 + 樓層描述編輯 */}
      <div className="fg-floor-bar">
        <span className="fg-floor-bar-label">樓層</span>
        <select
          className="fg-floor-select"
          value={floor}
          onChange={e => { setFloor(e.target.value); setShowForm(false); }}
        >
          {floors.map(f => (
            <option key={f.id} value={f.id}>{f.id}</option>
          ))}
        </select>
        <input
          className="fg-label-input"
          value={labelEdit}
          onChange={e => setLabelEdit(e.target.value)}
          placeholder="樓層描述（例：1F   化妝品|名品|服飾）"
        />
        <button className="fg-btn fg-btn-ghost" onClick={handleSaveLabel}>儲存描述</button>
      </div>

      {/* 樓層資訊（floorInfo）*/}
      <div className="fg-info-card">
        <div className="fg-info-card-title">樓層資訊</div>
        <label className="fg-info-label">
          標題
          <input
            className="fg-info-input"
            value={infoForm.title}
            onChange={e => setInfoForm(f => ({ ...f, title: e.target.value }))}
            placeholder="例：15F 主題餐廳"
          />
        </label>
        <div className="fg-info-label">
          圖示
          <div className="fg-icon-library">
            {iconLibrary.length === 0 && (
              <span className="fg-icon-empty">尚未上傳任何圖示</span>
            )}
            {iconLibrary.map(filename => {
              const selected = infoForm.icons.includes(filename);
              return (
                <div key={filename} className="fg-icon-wrap">
                  <button
                    type="button"
                    className={`fg-icon-item${selected ? ' selected' : ''}`}
                    onClick={() => toggleIcon(filename)}
                    title={filename}
                  >
                    <img src={`/api/images/floor-pic/icon/${filename}`} alt={filename} />
                    {selected && <span className="fg-icon-check">✓</span>}
                  </button>
                  <button
                    type="button"
                    className="fg-icon-delete"
                    onClick={() => handleIconDelete(filename)}
                    title="刪除圖示"
                  >✕</button>
                </div>
              );
            })}
            <button
              type="button"
              className="fg-icon-upload-btn"
              onClick={() => iconInputRef.current.click()}
              disabled={iconUploading}
            >
              {iconUploading ? '上傳中…' : '+ 上傳圖示'}
            </button>
            <input
              ref={iconInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleIconUpload}
            />
          </div>
        </div>
        <div>
          <button className="fg-btn fg-btn-primary" onClick={handleSaveInfo}>儲存樓層資訊</button>
        </div>
      </div>

      {/* 品牌列表 */}
      <div className="fg-section">
        <div className="fg-section-header">
          <span className="fg-section-title">
            {building} 棟・{floor}・共 {counters.length} 筆
          </span>
          <button className="fg-btn fg-btn-primary" onClick={openAdd}>＋ 新增品牌</button>
        </div>

        {/* 新增/編輯表單 */}
        {showForm && (
          <div className="fg-form-card">
            <div className="fg-form-card-title">{editingIdx !== null ? '編輯品牌' : '新增品牌'}</div>
            <form className="fg-form" onSubmit={handleSaveCounter}>
              <label>
                品牌名稱 *
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                />
              </label>
              <label>
                電話
                <input
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="例：04-2227-0000"
                />
              </label>
              <label>
                簡介
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  placeholder="品牌簡介說明"
                />
              </label>
              <div className="fg-logo-field">
                <span className="fg-logo-field-label">Logo</span>
                <div className="fg-logo-field-body">
                  {form.logo && (
                    <img src={form.logo} alt="logo" className="fg-logo-preview" />
                  )}
                  <div className="fg-logo-actions">
                    <button
                      type="button"
                      className="fg-btn fg-btn-ghost fg-btn-sm"
                      onClick={() => logoInputRef.current.click()}
                      disabled={logoUploading}
                    >
                      {logoUploading ? '上傳中…' : (form.logo ? '更換圖片' : '選擇圖片')}
                    </button>
                    {form.logo && (
                      <button
                        type="button"
                        className="fg-btn fg-btn-sm fg-btn-danger"
                        onClick={() => setForm(f => ({ ...f, logo: '' }))}
                      >
                        移除
                      </button>
                    )}
                  </div>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleLogoUpload}
                  />
                </div>
              </div>
              <div className="fg-form-actions">
                <button type="submit" className="fg-btn fg-btn-primary">儲存</button>
                <button type="button" className="fg-btn fg-btn-ghost" onClick={closeForm}>取消</button>
              </div>
            </form>
          </div>
        )}

        {counters.length === 0 ? (
          <div className="fg-empty">此樓層暫無品牌資料</div>
        ) : (
          <table className="fg-table">
            <thead>
              <tr>
                <th className="fg-th-handle"></th>
                <th>Logo</th>
                <th>品牌名稱</th>
                <th>電話</th>
                <th>簡介</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {counters.map((c, i) => (
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
                    {c.logo
                      ? <img src={c.logo} alt={c.name} className="fg-logo-thumb" />
                      : <div className="fg-logo-placeholder">{c.name?.[0] ?? '?'}</div>
                    }
                  </td>
                  <td className="fg-td-name">{c.name}</td>
                  <td className="fg-td-phone">{c.phone}</td>
                  <td className="fg-td-desc">{c.description}</td>
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
    </div>
  );
}
