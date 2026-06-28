import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '../../utils/apiFetch';

const MODULE_LABELS = {
  banner:         'Banner',
  home_event:     '活動訊息',
  home_promo:     '推廣區',
  home_fb:        'FB 社群',
  logo:           'Logo 輪播',
  dm:             'DM 目錄',
  floor:          '樓層導覽',
  food:           '美食導覽',
  winners:        '得獎名單',
  activity:       '活動頁',
  gallery:        '時尚藝廊',
  service:        '貼心服務',
  sustainability: '永續報告書',
  stats:          '流量統計',
  config:         '系統設定',
  user:           '帳號管理',
};

export default function RolesManager() {
  const [data,    setData]    = useState({ roles: [], permissions: [] });
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch('/api/admin/roles');
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return (
    <div style={{ padding: '0' }}>
      <div className="rm-header">
        <h2 className="rm-title">角色管理</h2>
        <button className="btn btn-primary" onClick={() => setModal('create')}>＋ 新增角色</button>
      </div>

      {loading ? (
        <p style={{ color: '#888' }}>載入中…</p>
      ) : (
        <table className="rm-table">
          <thead>
            <tr>
              <th>角色名稱</th>
              <th>說明</th>
              <th>使用者數</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {data.roles.map(r => (
              <tr key={r.id}>
                <td>
                  <span className="rm-tag">{r.name}</span>
                  {r.name === 'super_admin' && (
                    <span className="rm-lock" title="系統保留角色">&#128274;</span>
                  )}
                </td>
                <td className="rm-desc">{r.description ?? '—'}</td>
                <td>{r.user_count}</td>
                <td className="rm-actions">
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => setModal({ type: 'edit', role: r })}
                  >編輯權限</button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => setModal({ type: 'delete', role: r })}
                    disabled={r.name === 'super_admin'}
                    title={r.name === 'super_admin' ? '系統保留角色，無法刪除' : undefined}
                  >刪除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modal === 'create' && (
        <RoleFormModal
          permissions={data.permissions}
          onClose={() => setModal(null)}
          onDone={fetchAll}
        />
      )}
      {modal?.type === 'edit' && (
        <RoleFormModal
          role={modal.role}
          permissions={data.permissions}
          onClose={() => setModal(null)}
          onDone={fetchAll}
        />
      )}
      {modal?.type === 'delete' && (
        <DeleteModal
          role={modal.role}
          onClose={() => setModal(null)}
          onDone={fetchAll}
        />
      )}

      <style>{`
        .rm-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 1.5rem;
        }
        .rm-title { margin: 0; color: #e0e0e0; font-size: 1.2rem; }
        .rm-table {
          width: 100%; border-collapse: collapse; font-size: .9rem;
        }
        .rm-table th,
        .rm-table td {
          padding: .65rem .9rem; border-bottom: 1px solid #333; text-align: left;
        }
        .rm-table th { background: #1e1e1e; color: #aaa; font-weight: 600; }
        .rm-tag {
          background: #2a3550; color: #7eb8f7;
          padding: .2rem .55rem; border-radius: 4px; font-size: .8rem;
        }
        .rm-lock { margin-left: .4rem; font-size: .9rem; }
        .rm-desc { color: #888; }
        .rm-actions { display: flex; gap: .4rem; align-items: center; }

        .rm-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,.65);
          display: flex; align-items: center; justify-content: center; z-index: 1000;
        }
        .rm-box {
          background: #242424; border-radius: 10px; padding: 2rem;
          width: 560px; max-width: 95vw; max-height: 85vh; overflow-y: auto;
          box-shadow: 0 8px 32px rgba(0,0,0,.6);
        }
        .rm-box h3 { margin: 0 0 1.2rem; color: #e0e0e0; }
        .rm-field { display: flex; flex-direction: column; gap: .35rem; margin-bottom: 1rem; }
        .rm-field label { font-size: .82rem; color: #aaa; }
        .rm-field input {
          padding: .5rem .7rem; background: #1a1a1a; border: 1px solid #444;
          border-radius: 6px; color: #e0e0e0; font-size: .9rem;
        }
        .rm-field input:disabled { opacity: .5; cursor: not-allowed; }
        .rm-section-label {
          color: #666; font-size: .75rem; font-weight: 700; letter-spacing: .06em;
          text-transform: uppercase; margin: 1rem 0 .4rem;
        }
        .rm-perm-table { width: 100%; border-collapse: collapse; }
        .rm-perm-table th,
        .rm-perm-table td {
          padding: .4rem .6rem; border-bottom: 1px solid #2a2a2a; font-size: .85rem;
        }
        .rm-perm-table th { color: #777; font-weight: 600; }
        .rm-perm-table td:first-child { color: #ccc; }
        .rm-perm-table input[type=checkbox] {
          width: 1rem; height: 1rem; cursor: pointer; accent-color: #7eb8f7;
        }
        .rm-modal-actions {
          display: flex; gap: .7rem; justify-content: flex-end; margin-top: 1.4rem;
        }
        .btn { padding: .45rem .9rem; border-radius: 6px; border: 1px solid transparent; font-size: .85rem; font-weight: 600; cursor: pointer; font-family: inherit; }
        .btn:disabled { opacity: .4; cursor: not-allowed; }
        .btn-primary  { background: #2c2c2c; color: #fff; border-color: #555; }
        .btn-primary:hover:not(:disabled) { background: #3d3d3d; }
        .btn-ghost    { background: #1a1a1a; color: #ccc; border-color: #444; }
        .btn-ghost:hover:not(:disabled) { background: #2a2a2a; }
        .btn-danger   { background: transparent; color: #f87171; border-color: #7f2020; }
        .btn-danger:hover:not(:disabled) { background: #3d1f1f; }
        .btn-sm { padding: .25rem .6rem; font-size: .8rem; }
      `}</style>
    </div>
  );
}

function RoleFormModal({ role, permissions, onClose, onDone }) {
  const isEdit       = !!role;
  const isSuperAdmin = role?.name === 'super_admin';

  const modules = [...new Set(permissions.map(p => p.module))].sort();
  const permMap = {};
  for (const p of permissions) {
    if (!permMap[p.module]) permMap[p.module] = {};
    permMap[p.module][p.action] = p.id;
  }

  const [name,        setName]        = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [checkedIds,  setCheckedIds]  = useState(new Set(role?.permission_ids ?? []));
  const [err,         setErr]         = useState('');
  const [busy,        setBusy]        = useState(false);

  const toggle = (id) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleModule = (allIds) => {
    const allChecked = allIds.every(id => checkedIds.has(id));
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (allChecked) allIds.forEach(id => next.delete(id));
      else            allIds.forEach(id => next.add(id));
      return next;
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!isSuperAdmin && !name.trim()) { setErr('請輸入角色名稱'); return; }
    setErr('');
    setBusy(true);

    const body   = { name: isSuperAdmin ? role.name : name.trim(), description, permission_ids: [...checkedIds] };
    const url    = isEdit ? `/api/admin/roles/${role.id}` : '/api/admin/roles';
    const method = isEdit ? 'PUT' : 'POST';

    const res  = await apiFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setErr(data.error); return; }
    onDone();
    onClose();
  };

  return (
    <div className="rm-overlay" onClick={onClose}>
      <div className="rm-box" onClick={e => e.stopPropagation()}>
        <h3>{isEdit ? `編輯角色 — ${role.name}` : '新增角色'}</h3>
        <form onSubmit={submit}>
          <div className="rm-field">
            <label>角色名稱</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={isSuperAdmin}
              placeholder="例：editor"
              required={!isSuperAdmin}
            />
          </div>
          <div className="rm-field">
            <label>說明（選填）</label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="角色功能說明"
            />
          </div>

          <div className="rm-section-label">模組權限</div>
          <table className="rm-perm-table">
            <thead>
              <tr>
                <th>模組</th>
                <th style={{ textAlign: 'center', width: '60px' }}>讀取</th>
                <th style={{ textAlign: 'center', width: '60px' }}>寫入</th>
                <th style={{ textAlign: 'center', width: '60px' }}>刪除</th>
                <th style={{ textAlign: 'center', width: '60px' }}>全選</th>
              </tr>
            </thead>
            <tbody>
              {modules.map(mod => {
                const mp       = permMap[mod] ?? {};
                const readId   = mp.read;
                const writeId  = mp.write;
                const deleteId = mp.delete;
                const allIds   = [readId, writeId, deleteId].filter(Boolean);
                const allChk   = allIds.length > 0 && allIds.every(id => checkedIds.has(id));
                return (
                  <tr key={mod}>
                    <td>{MODULE_LABELS[mod] ?? mod}</td>
                    <td style={{ textAlign: 'center' }}>
                      {readId
                        ? <input type="checkbox" checked={checkedIds.has(readId)}   onChange={() => toggle(readId)} />
                        : '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {writeId
                        ? <input type="checkbox" checked={checkedIds.has(writeId)}  onChange={() => toggle(writeId)} />
                        : '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {deleteId
                        ? <input type="checkbox" checked={checkedIds.has(deleteId)} onChange={() => toggle(deleteId)} />
                        : '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={allChk}
                        onChange={() => toggleModule(allIds)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {err && <p style={{ color: '#f87171', margin: '.7rem 0 0', fontSize: '.88rem' }}>{err}</p>}
          <div className="rm-modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>取消</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? '儲存中…' : (isEdit ? '儲存' : '建立')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteModal({ role, onClose, onDone }) {
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    const res = await apiFetch(`/api/admin/roles/${role.id}`, { method: 'DELETE' });
    setBusy(false);
    if (res.ok) { onDone(); onClose(); }
    else alert((await res.json()).error);
  };

  return (
    <div className="rm-overlay" onClick={onClose}>
      <div className="rm-box" style={{ width: '400px' }} onClick={e => e.stopPropagation()}>
        <h3>刪除角色</h3>
        <p style={{ color: '#e0e0e0', margin: '0 0 .5rem' }}>
          確定要刪除角色 <strong>{role.name}</strong>？
        </p>
        {role.user_count > 0 && (
          <p style={{ color: '#f87171', fontSize: '.88rem', margin: '0 0 .5rem' }}>
            ⚠ 此角色下還有 {role.user_count} 位使用者，請先在「帳號管理」將這些使用者改為其他角色。
          </p>
        )}
        <div className="rm-modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>取消</button>
          <button
            className="btn btn-danger"
            onClick={confirm}
            disabled={busy || role.user_count > 0}
          >{busy ? '刪除中…' : '確認刪除'}</button>
        </div>
      </div>
    </div>
  );
}
