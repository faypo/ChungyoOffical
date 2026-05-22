import React, { useState, useEffect, useRef } from 'react';

const API = '/api/admin/logos';

function GroupBlock({ group, index: gi, onDelete, onLogoDelete, onLogoUpload, onLogoReorder }) {
  const fileInput   = useRef();
  const [drag,      setDrag]     = useState(null);
  const [over,      setOver]     = useState(null);
  const [dropping,  setDrop]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const counter = useRef(0);

  const isFile = (e) => e.dataTransfer?.types?.includes('Files');

  const uploadFiles = async (files) => {
    const imgs = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (!imgs.length) return;
    setUploading(true);
    for (const f of imgs) {
      await onLogoUpload(group.id, f);
    }
    setUploading(false);
  };

  /* 整個組別區域的拖曳事件 */
  const onZoneEnter = (e) => { if (!isFile(e)) return; counter.current++; setDrop(true); };
  const onZoneLeave = (e) => { if (!isFile(e)) return; counter.current--; if (!counter.current) setDrop(false); };
  const onZoneOver  = (e) => { if (!isFile(e)) return; e.preventDefault(); };
  const onZoneDrop  = (e) => {
    if (!isFile(e)) return;
    e.preventDefault(); counter.current = 0; setDrop(false);
    uploadFiles(e.dataTransfer.files);
  };

  /* Logo 圖片之間的拖曳排序 */
  const onItemDragStart = (e, id) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setDrag(id);
  };
  const onItemDragOver = (e, id) => {
    if (isFile(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setOver(id);
  };
  const onItemDragEnd = () => { setDrag(null); setOver(null); };
  const onItemDrop    = (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    const fromId = e.dataTransfer.getData('text/plain') || drag;
    if (!fromId || fromId === id) { setDrag(null); setOver(null); return; }
    const arr  = [...group.logos];
    const from = arr.findIndex(l => l.id === fromId);
    const to   = arr.findIndex(l => l.id === id);
    if (from === -1 || to === -1) { setDrag(null); setOver(null); return; }
    arr.splice(to, 0, arr.splice(from, 1)[0]);
    onLogoReorder(group.id, arr.map(l => l.id));
    setDrag(null); setOver(null);
  };

  const full = group.logos.length >= 6;

  return (
    <div
      onDragEnter={onZoneEnter} onDragLeave={onZoneLeave}
      onDragOver={onZoneOver}   onDrop={onZoneDrop}
      style={{
        border: `2px ${dropping ? 'dashed #555' : 'solid #e0e0e0'}`,
        borderRadius: 8, padding: 16, marginBottom: 16,
        background: dropping ? '#f5f5f5' : '#fff',
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontWeight: 700 }}>
          第 {gi + 1} 組（{group.logos.length} / 6 張）
          {uploading && <span style={{ fontWeight: 400, color: '#888', fontSize: 12, marginLeft: 8 }}>上傳中…</span>}
        </span>
        <button onClick={() => onDelete(group.id)}
          style={{ background: '#e53935', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontSize: 12 }}>
          刪除此組
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {group.logos.map(logo => (
          <div key={logo.id} draggable
            onDragStart={e => onItemDragStart(e, logo.id)}
            onDragOver={e => onItemDragOver(e, logo.id)}
            onDragEnd={onItemDragEnd}
            onDrop={e => onItemDrop(e, logo.id)}
            style={{
              position: 'relative', width: 90, height: 72,
              border: `2px solid ${over === logo.id ? '#1976d2' : '#ddd'}`,
              borderRadius: 6, background: over === logo.id ? '#e3f2fd' : '#fff',
              cursor: 'grab', opacity: drag === logo.id ? 0.35 : 1,
              flexShrink: 0, transition: 'border-color 0.12s, background 0.12s',
              outline: over === logo.id ? '2px solid #1976d2' : 'none',
            }}
          >
            <img src={`/api/images/logo-pic/${logo.file}`} alt="logo"
              draggable={false}
              style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
            <button onClick={() => onLogoDelete(group.id, logo.id)}
              style={{
                position: 'absolute', top: 2, right: 2,
                background: 'rgba(0,0,0,0.55)', color: '#fff',
                border: 'none', borderRadius: 3, width: 18, height: 18,
                fontSize: 11, cursor: 'pointer', padding: 0, lineHeight: '18px',
              }}>✕</button>
          </div>
        ))}

        {!full ? (
          <div onClick={() => fileInput.current.click()}
            style={{
              width: 90, height: 72, border: '2px dashed #ccc',
              borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', background: '#fafafa', flexShrink: 0,
              fontSize: 22, color: '#bbb',
            }}
          >+
            <input ref={fileInput} type="file" accept="image/*" multiple style={{ display: 'none' }}
              onChange={e => { if (e.target.files.length) uploadFiles(e.target.files); }} />
          </div>
        ) : (
          <span style={{ fontSize: 12, color: '#aaa' }}>已達上限 6 張</span>
        )}
      </div>

      {!full && (
        <p style={{ fontSize: 12, color: '#aaa', margin: '10px 0 0' }}>
          可將圖片拖曳至此區域上傳，或點擊「+」選擇檔案（支援多張同時上傳）
        </p>
      )}
    </div>
  );
}

export default function LogoManager() {
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    fetch(API).then(r => r.json()).then(d => setGroups(d.groups ?? []));
  }, []);

  const reload = () => fetch(API).then(r => r.json()).then(d => setGroups(d.groups ?? []));

  const addGroup = async () => {
    const r = await fetch(`${API}/group`, { method: 'POST' });
    const d = await r.json();
    if (d.id) setGroups(prev => [...prev, { id: d.id, logos: [] }]);
  };

  const deleteGroup = async (gid) => {
    await fetch(`${API}/group/${gid}`, { method: 'DELETE' });
    setGroups(prev => prev.filter(g => g.id !== gid));
  };

  const uploadLogo = async (gid, file) => {
    const fd = new FormData();
    fd.append('image', file);
    const r = await fetch(`${API}/group/${gid}/upload`, { method: 'POST', body: fd });
    const d = await r.json();
    if (d.id) {
      setGroups(prev => prev.map(g =>
        g.id === gid ? { ...g, logos: [...g.logos, { id: d.id, file: d.file }] } : g
      ));
    } else if (d.error) {
      alert(d.error);
    }
  };

  const deleteLogo = async (gid, lid) => {
    await fetch(`${API}/group/${gid}/${lid}`, { method: 'DELETE' });
    setGroups(prev => prev.map(g =>
      g.id === gid ? { ...g, logos: g.logos.filter(l => l.id !== lid) } : g
    ));
  };

  const reorderLogos = async (gid, ids) => {
    setGroups(prev => prev.map(g =>
      g.id === gid
        ? { ...g, logos: ids.map(id => g.logos.find(l => l.id === id)).filter(Boolean) }
        : g
    ));
    await fetch(`${API}/group/${gid}/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
  };

  return (
    <div style={{ maxWidth: 800 }}>
      <h2 style={{ marginBottom: 8 }}>Logo 輪播管理</h2>
      <p style={{ color: '#888', fontSize: 13, marginBottom: 24 }}>
        每組是一個輪播頁面，各組可以有不同數量的 Logo（最多 6 張）。
      </p>

      {groups.map((group, gi) => (
        <GroupBlock
          key={group.id}
          group={group}
          index={gi}
          onDelete={deleteGroup}
          onLogoDelete={deleteLogo}
          onLogoUpload={uploadLogo}
          onLogoReorder={reorderLogos}
        />
      ))}

      {!groups.length && (
        <p style={{ color: '#bbb', fontSize: 13, marginBottom: 20 }}>尚未建立任何組別</p>
      )}

      <button onClick={addGroup}
        style={{
          padding: '10px 24px', background: '#333', color: '#fff',
          border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>
        ＋ 新增組別
      </button>
    </div>
  );
}
