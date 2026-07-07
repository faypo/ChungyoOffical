import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../utils/apiFetch';

function checkPwComplexity(pw) {
  if (pw.length < 8) return false;
  return [/[A-Z]/, /[a-z]/, /[0-9]/].filter(r => r.test(pw)).length >= 2;
}

export default function ChangePasswordModal({ onClose }) {
  const [oldPw,   setOldPw]   = useState('');
  const [newPw,   setNewPw]   = useState('');
  const [confirm, setConfirm] = useState('');
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const { clearAuth } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!checkPwComplexity(newPw)) {
      setError('新密碼至少 8 碼，且須包含大寫英文、小寫英文、數字中的至少兩種');
      return;
    }
    if (newPw !== confirm) {
      setError('兩次輸入的密碼不一致');
      return;
    }

    setLoading(true);
    try {
      const res  = await apiFetch('/api/admin/auth/change-password', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ old_password: oldPw, new_password: newPw }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || '更改失敗'); return; }

      clearAuth();
      navigate('/admin/login', { replace: true, state: { notice: '密碼已更新，請重新登入' } });
    } catch {
      setError('無法連線至伺服器');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={styles.card}>
        <h2 style={styles.title}>更改密碼</h2>
        <form onSubmit={handleSubmit}>
          <label style={styles.label}>舊密碼</label>
          <input
            style={styles.input}
            type="password"
            value={oldPw}
            onChange={e => setOldPw(e.target.value)}
            autoComplete="current-password"
            required
          />
          <label style={styles.label}>新密碼</label>
          <input
            style={styles.input}
            type="password"
            value={newPw}
            onChange={e => setNewPw(e.target.value)}
            autoComplete="new-password"
            required
          />
          <label style={styles.label}>確認新密碼</label>
          <input
            style={styles.input}
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
          <p style={styles.hint}>至少 8 碼，須包含大寫英文、小寫英文、數字中的至少兩種</p>
          {error && <p style={styles.error}>{error}</p>}
          <div style={styles.actions}>
            <button type="button" style={styles.cancelBtn} onClick={onClose} disabled={loading}>取消</button>
            <button type="submit" style={styles.submitBtn} disabled={loading}>
              {loading ? '更新中…' : '確認更改'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  card: {
    background: '#fff', borderRadius: '12px', padding: '2rem',
    width: '100%', maxWidth: '380px', boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
  },
  title: {
    color: '#1a1a1a', fontSize: '1.2rem', fontWeight: 600,
    marginBottom: '1.5rem', textAlign: 'center',
  },
  label: { display: 'block', color: '#555', fontSize: '0.82rem', marginBottom: '0.3rem', marginTop: '1rem' },
  input: {
    width: '100%', padding: '0.6rem 0.8rem', background: '#f8f8f8',
    border: '1px solid #ddd', borderRadius: '6px', color: '#1a1a1a',
    fontSize: '0.9rem', boxSizing: 'border-box', outline: 'none',
  },
  hint: { color: '#999', fontSize: '0.75rem', marginTop: '0.5rem', lineHeight: 1.5 },
  error: { color: '#dc2626', fontSize: '0.82rem', marginTop: '0.5rem' },
  actions: { display: 'flex', gap: '0.75rem', marginTop: '1.5rem' },
  cancelBtn: {
    flex: 1, padding: '0.6rem', background: '#fff', border: '1px solid #ddd',
    borderRadius: '6px', color: '#555', cursor: 'pointer', fontSize: '0.9rem',
  },
  submitBtn: {
    flex: 1, padding: '0.6rem', background: '#1a1a1a', border: 'none',
    borderRadius: '6px', color: '#fff', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600,
  },
};
