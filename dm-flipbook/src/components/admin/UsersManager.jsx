import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '../../utils/apiFetch';
import { useAuth } from '../../context/AuthContext';

export default function UsersManager() {
  const [users,   setUsers]   = useState([]);
  const [roles,   setRoles]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(null); // null | 'create' | { type:'reset'|'role'|'delete', user }

  const { token: _token } = useAuth();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [uRes, rRes] = await Promise.all([
      apiFetch('/api/admin/users'),
      apiFetch('/api/admin/users/roles'),
    ]);
    if (uRes.ok) setUsers(await uRes.json());
    if (rRes.ok) setRoles(await rRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const toggleActive = async (user) => {
    const res = await apiFetch(`/api/admin/users/${user.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ is_active: !user.is_active }),
    });
    if (res.ok) fetchAll();
    else alert((await res.json()).error);
  };

  return (
    <div className="manager-container">
      <div className="manager-header">
        <h2>帳號管理</h2>
        <button className="btn btn-primary" onClick={() => setModal('create')}>＋ 新增帳號</button>
      </div>

      {loading ? (
        <p>載入中…</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>員工編號</th>
              <th>角色</th>
              <th>狀態</th>
              <th>首次改密</th>
              <th>最後登入</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>{u.employee_id}</td>
                <td>
                  <span className="tag">{u.roles?.name ?? '—'}</span>
                </td>
                <td>
                  <button
                    className={`status-btn ${u.is_active ? 'active' : 'inactive'}`}
                    onClick={() => toggleActive(u)}
                    title={u.is_active ? '點擊停用' : '點擊啟用'}
                  >
                    {u.is_active ? '啟用' : '停用'}
                  </button>
                </td>
                <td>
                  {u.must_change_password
                    ? <span className="badge badge-warn">待改密碼</span>
                    : <span className="badge badge-ok">正常</span>}
                </td>
                <td>{u.last_login_at ? new Date(u.last_login_at).toLocaleString('zh-TW') : '從未'}</td>
                <td className="action-cell">
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => setModal({ type: 'role', user: u })}
                  >改角色</button>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => setModal({ type: 'reset', user: u })}
                  >重設密碼</button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => setModal({ type: 'delete', user: u })}
                  >刪除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modal === 'create' && (
        <CreateModal roles={roles} onClose={() => setModal(null)} onDone={fetchAll} />
      )}
      {modal?.type === 'reset' && (
        <ResetModal user={modal.user} onClose={() => setModal(null)} onDone={fetchAll} />
      )}
      {modal?.type === 'role' && (
        <RoleModal user={modal.user} roles={roles} onClose={() => setModal(null)} onDone={fetchAll} />
      )}
      {modal?.type === 'delete' && (
        <DeleteModal user={modal.user} onClose={() => setModal(null)} onDone={fetchAll} />
      )}

      <style>{`
        .manager-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:1.5rem; }
        .manager-header h2 { margin:0; }
        .data-table { width:100%; border-collapse:collapse; font-size:.9rem; }
        .data-table th,
        .data-table td { padding:.65rem .9rem; border-bottom:1px solid #333; text-align:left; }
        .data-table th { background:#1e1e1e; color:#aaa; font-weight:600; }
        .tag { background:#2a3550; color:#7eb8f7; padding:.2rem .55rem; border-radius:4px; font-size:.8rem; }
        .status-btn { border:none; padding:.25rem .7rem; border-radius:4px; cursor:pointer; font-size:.8rem; font-weight:600; }
        .status-btn.active   { background:#1a4731; color:#4ade80; }
        .status-btn.inactive { background:#3d1f1f; color:#f87171; }
        .badge { padding:.2rem .55rem; border-radius:4px; font-size:.78rem; font-weight:600; }
        .badge-warn { background:#3d2f00; color:#fbbf24; }
        .badge-ok   { background:#1a2e1a; color:#4ade80; }
        .action-cell { display:flex; gap:.4rem; align-items:center; }
        .modal-overlay {
          position:fixed; inset:0; background:rgba(0,0,0,.65);
          display:flex; align-items:center; justify-content:center; z-index:1000;
        }
        .modal-box {
          background:#242424; border-radius:10px; padding:2rem;
          min-width:340px; max-width:90vw; box-shadow:0 8px 32px rgba(0,0,0,.6);
        }
        .modal-box h3 { margin:0 0 1.2rem; color:#e0e0e0; }
        .modal-field { display:flex; flex-direction:column; gap:.35rem; margin-bottom:1rem; }
        .modal-field label { font-size:.82rem; color:#aaa; }
        .modal-field input,
        .modal-field select {
          padding:.5rem .7rem; background:#1a1a1a; border:1px solid #444;
          border-radius:6px; color:#e0e0e0; font-size:.9rem;
        }
        .modal-actions { display:flex; gap:.7rem; justify-content:flex-end; margin-top:1.4rem; }
      `}</style>
    </div>
  );
}

function CreateModal({ roles, onClose, onDone }) {
  const [form, setForm] = useState({ employee_id: '', password: '', role_id: roles[0]?.id ?? '' });
  const [err,  setErr]  = useState('');
  const [busy, setBusy] = useState(false);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    const res  = await apiFetch('/api/admin/users', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ...form, role_id: Number(form.role_id) }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setErr(data.error); return; }
    onDone();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <h3>新增帳號</h3>
        <form onSubmit={submit}>
          <div className="modal-field">
            <label>員工編號</label>
            <input value={form.employee_id} onChange={set('employee_id')} required />
          </div>
          <div className="modal-field">
            <label>初始密碼（至少 8 個字元）</label>
            <input type="password" value={form.password} onChange={set('password')} required />
          </div>
          <div className="modal-field">
            <label>角色</label>
            <select value={form.role_id} onChange={set('role_id')}>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          {err && <p style={{ color:'#f87171', margin:'.5rem 0' }}>{err}</p>}
          <p style={{ color:'#888', fontSize:'.8rem' }}>首次登入將強制要求設定新密碼</p>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>取消</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? '建立中…' : '建立'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ResetModal({ user, onClose, onDone }) {
  const [pw,   setPw]  = useState('');
  const [err,  setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    const res  = await apiFetch(`/api/admin/users/${user.id}/reset-password`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ new_password: pw }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setErr(data.error); return; }
    alert(data.message);
    onDone();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <h3>重設密碼 — {user.employee_id}</h3>
        <form onSubmit={submit}>
          <div className="modal-field">
            <label>新密碼（至少 8 個字元）</label>
            <input type="password" value={pw} onChange={e => setPw(e.target.value)} required />
          </div>
          {err && <p style={{ color:'#f87171', margin:'.5rem 0' }}>{err}</p>}
          <p style={{ color:'#888', fontSize:'.8rem' }}>該帳號下次登入將強制要求設定新密碼</p>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>取消</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? '重設中…' : '確認重設'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RoleModal({ user, roles, onClose, onDone }) {
  const [roleId, setRoleId] = useState(user.roles?.id ?? '');
  const [err,    setErr]    = useState('');
  const [busy,   setBusy]   = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const res  = await apiFetch(`/api/admin/users/${user.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ role_id: Number(roleId) }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setErr(data.error); return; }
    onDone();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <h3>變更角色 — {user.employee_id}</h3>
        <form onSubmit={submit}>
          <div className="modal-field">
            <label>角色</label>
            <select value={roleId} onChange={e => setRoleId(e.target.value)}>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          {err && <p style={{ color:'#f87171', margin:'.5rem 0' }}>{err}</p>}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>取消</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? '更新中…' : '確認'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteModal({ user, onClose, onDone }) {
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    const res = await apiFetch(`/api/admin/users/${user.id}`, { method: 'DELETE' });
    setBusy(false);
    if (res.ok) { onDone(); onClose(); }
    else alert((await res.json()).error);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <h3>刪除帳號</h3>
        <p style={{ color:'#e0e0e0' }}>確定要刪除帳號 <strong>{user.employee_id}</strong>？此操作無法復原。</p>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>取消</button>
          <button className="btn btn-danger" onClick={confirm} disabled={busy}>{busy ? '刪除中…' : '確認刪除'}</button>
        </div>
      </div>
    </div>
  );
}
