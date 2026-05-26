import React, { useState, useEffect, useCallback } from 'react';
import './FloorGuideManager.css';
import './WinnersManager.css';

const API = '/api/admin/winners';

function apiFetch(url, opts = {}) {
  return fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
}

// ── Immutable tree path operations ──
function pathUpdate(nodes, path, value) {
  const [head, ...tail] = path;
  return nodes.map((n, i) => {
    if (i !== head) return n;
    if (tail.length === 0) return { ...n, value };
    return { ...n, children: pathUpdate(n.children ?? [], tail, value) };
  });
}

function pathDelete(nodes, path) {
  const [head, ...tail] = path;
  if (tail.length === 0) return nodes.filter((_, i) => i !== head);
  return nodes.map((n, i) => {
    if (i !== head) return n;
    return { ...n, children: pathDelete(n.children ?? [], tail) };
  });
}

function pathAddChild(nodes, path) {
  const [head, ...tail] = path;
  return nodes.map((n, i) => {
    if (i !== head) return n;
    if (tail.length === 0) {
      return { ...n, children: [...(n.children ?? []), { value: '', children: [] }] };
    }
    return { ...n, children: pathAddChild(n.children ?? [], tail) };
  });
}

// ── NodeRow ──
function NodeRow({ node, path, depth, numCols, columns, onValueChange, onDelete, onAddChild }) {
  const colLabel = columns?.[depth] || `欄位 ${depth + 1}`;

  return (
    <div className="wm-node-block">
      <div
        className="wm-node-row"
        data-depth={depth}
        style={{ paddingLeft: `${10 + depth * 28}px` }}
      >
        <span className="wm-node-col-label">{colLabel}</span>
        <input
          className="wm-node-input"
          value={node.value}
          onChange={e => onValueChange(path, e.target.value)}
          placeholder={`輸入${colLabel}`}
        />
        {depth < numCols - 1 && (
          <button
            type="button"
            className="wm-btn wm-btn-child"
            onClick={() => onAddChild(path)}
          >
            + 子項
          </button>
        )}
        <button
          type="button"
          className="wm-btn wm-btn-del"
          onClick={() => onDelete(path)}
        >
          刪除
        </button>
      </div>
      {(node.children ?? []).map((child, i) => (
        <NodeRow
          key={`${path.join('-')}-${i}`}
          node={child}
          path={[...path, i]}
          depth={depth + 1}
          numCols={numCols}
          columns={columns}
          onValueChange={onValueChange}
          onDelete={onDelete}
          onAddChild={onAddChild}
        />
      ))}
    </div>
  );
}

// ── Main component ──
export default function WinnersManager() {
  const [events, setEvents]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [activeId, setActiveId]     = useState(null);
  const [msg, setMsg]               = useState(null);
  const [saving, setSaving]         = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newTitle, setNewTitle]     = useState('');

  // Active event editable state
  const [editTitle,   setEditTitle]   = useState('');
  const [editSub1,    setEditSub1]    = useState('');
  const [editSub2,    setEditSub2]    = useState('');
  const [editColumns, setEditColumns] = useState(['', '', '', '', '']);
  const [editRows,    setEditRows]    = useState([]);

  const showMsgFn = (text, type = 'ok') => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 3000);
  };

  const load = async () => {
    try {
      const r = await fetch(API);
      const d = await r.json();
      setEvents(d.events ?? []);
      setActiveId(prev => {
        const found = d.events?.find(e => e.id === prev);
        return found ? prev : (d.events?.[0]?.id ?? null);
      });
    } catch {
      showMsgFn('無法連線到後端', 'err');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const ev = events.find(e => e.id === activeId);
    if (!ev) return;
    setEditTitle(ev.title ?? '');
    setEditSub1(ev.subtitle1 ?? '');
    setEditSub2(ev.subtitle2 ?? '');
    setEditColumns(ev.columns?.length === 5 ? [...ev.columns] : ['', '', '', '', '']);
    setEditRows(JSON.parse(JSON.stringify(ev.rows ?? [])));
  }, [activeId, events]);

  const activeEvent = events.find(e => e.id === activeId);

  // ── Save entire event ──
  const handleSave = async () => {
    if (!editTitle.trim()) return showMsgFn('活動名稱為必填', 'err');
    setSaving(true);
    const res = await apiFetch(`${API}/events/${activeId}`, {
      method: 'PUT',
      body: JSON.stringify({
        title: editTitle,
        subtitle1: editSub1,
        subtitle2: editSub2,
        columns: editColumns,
        rows: editRows,
      }),
    });
    setSaving(false);
    const json = await res.json();
    if (!res.ok) return showMsgFn(json.error || '儲存失敗', 'err');
    showMsgFn('已儲存');
    load();
  };

  // ── Add event ──
  const handleAddEvent = async () => {
    if (!newTitle.trim()) return showMsgFn('活動名稱為必填', 'err');
    const res = await apiFetch(`${API}/events`, {
      method: 'POST',
      body: JSON.stringify({ title: newTitle }),
    });
    const json = await res.json();
    if (!res.ok) return showMsgFn(json.error || '新增失敗', 'err');
    showMsgFn('已新增活動');
    setNewTitle('');
    setShowAddEvent(false);
    load();
  };

  // ── Delete event ──
  const handleDeleteEvent = async (id) => {
    const ev = events.find(e => e.id === id);
    if (!window.confirm(`確定要刪除「${ev?.title}」？`)) return;
    const res = await apiFetch(`${API}/events/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) return showMsgFn(json.error || '刪除失敗', 'err');
    showMsgFn('已刪除活動');
    if (activeId === id) setActiveId(null);
    load();
  };

  // ── Tree operations ──
  const handleValueChange = useCallback((path, value) => {
    setEditRows(rows => pathUpdate(rows, path, value));
  }, []);

  const handleDelete = useCallback((path) => {
    setEditRows(rows => pathDelete(rows, path));
  }, []);

  const handleAddChild = useCallback((path) => {
    setEditRows(rows => pathAddChild(rows, path));
  }, []);

  const handleAddRoot = () => {
    setEditRows(rows => [...rows, { value: '', children: [] }]);
  };

  if (loading) return <p className="fg-loading">載入中…</p>;

  return (
    <div className="fg-manager">
      <div className="fg-manager-header">
        <h1 className="fg-manager-title">得獎名單管理</h1>
      </div>

      {msg && <div className={`fg-msg fg-msg--${msg.type}`}>{msg.text}</div>}

      {/* ── Event list ── */}
      <div className="fg-section">
        <div className="fg-section-header">
          <span className="fg-section-title">活動列表</span>
          <button className="fg-btn fg-btn-ghost fg-btn-sm" onClick={() => setShowAddEvent(v => !v)}>
            ＋ 新增活動
          </button>
        </div>

        {showAddEvent && (
          <div className="fg-info-card">
            <div className="fg-info-card-title">新增活動</div>
            <div className="food-addcat-row">
              <input
                className="fg-info-input"
                placeholder="活動名稱"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddEvent()}
              />
              <button className="fg-btn fg-btn-primary fg-btn-sm" onClick={handleAddEvent}>確認新增</button>
              <button className="fg-btn fg-btn-ghost fg-btn-sm" onClick={() => setShowAddEvent(false)}>取消</button>
            </div>
          </div>
        )}

        {events.length === 0 && !showAddEvent && (
          <div className="fg-empty">尚無活動，請點「＋ 新增活動」</div>
        )}

        {events.length > 0 && (
          <table className="fg-table">
            <thead>
              <tr>
                <th>活動名稱</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {events.map(e => (
                <tr key={e.id} className={activeId === e.id ? 'fg-tr-active' : ''}>
                  <td>{e.title}</td>
                  <td className="fg-table-actions">
                    <div className="fg-table-actions-inner">
                      <button
                        className={`fg-btn fg-btn-sm ${activeId === e.id ? 'fg-btn-primary' : 'fg-btn-ghost'}`}
                        onClick={() => { setActiveId(e.id); setShowAddEvent(false); }}
                      >
                        {activeId === e.id ? '編輯中' : '編輯'}
                      </button>
                      <button
                        className="fg-btn fg-btn-danger fg-btn-sm"
                        onClick={() => handleDeleteEvent(e.id)}
                      >
                        刪除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {activeEvent && (
        <div className="wm-editor">
          {/* ── Event meta ── */}
          <div className="fg-info-card">
            <div className="fg-info-card-title">活動資訊</div>
            <div className="wm-meta-grid">
              <label className="wm-meta-label">
                活動標題 *
                <input className="fg-info-input" value={editTitle} onChange={e => setEditTitle(e.target.value)} />
              </label>
              <label className="wm-meta-label">
                小標題 1
                <input className="fg-info-input" value={editSub1} onChange={e => setEditSub1(e.target.value)} placeholder="選填" />
              </label>
              <label className="wm-meta-label">
                小標題 2
                <input className="fg-info-input" value={editSub2} onChange={e => setEditSub2(e.target.value)} placeholder="選填" />
              </label>
            </div>
            <div className="wm-cols-label">欄位名稱（5 欄）</div>
            <div className="wm-cols-grid">
              {editColumns.map((col, i) => (
                <input
                  key={i}
                  className="fg-info-input"
                  value={col}
                  onChange={e => setEditColumns(cols => cols.map((c, j) => j === i ? e.target.value : c))}
                  placeholder={`欄位 ${i + 1}`}
                />
              ))}
            </div>
          </div>

          {/* ── Tree editor ── */}
          <div className="fg-section">
            <div className="fg-section-header">
              <span className="fg-section-title">得獎資料樹狀編輯</span>
              <button className="fg-btn fg-btn-ghost" onClick={handleAddRoot}>＋ 新增第一欄資料</button>
            </div>

            {editRows.length === 0 ? (
              <div className="fg-empty">尚無資料，請點「＋ 新增第一欄資料」</div>
            ) : (
              <div className="wm-tree">
                {editRows.map((node, i) => (
                  <NodeRow
                    key={`root-${i}`}
                    node={node}
                    path={[i]}
                    depth={0}
                    numCols={editColumns.length}
                    columns={editColumns}
                    onValueChange={handleValueChange}
                    onDelete={handleDelete}
                    onAddChild={handleAddChild}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Save / Delete ── */}
          <div className="wm-actions">
            <button className="fg-btn fg-btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? '儲存中…' : '儲存'}
            </button>
            <button className="fg-btn fg-btn-danger" onClick={() => handleDeleteEvent(activeId)}>刪除活動</button>
          </div>
        </div>
      )}
    </div>
  );
}
