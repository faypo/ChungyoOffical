import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../utils/apiFetch';
import './LoginPage.css';

export default function ChangePasswordPage() {
  const [newPw,    setNewPw]    = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const { clearAuth } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPw.length < 8) {
      setError('密碼至少需要 8 個字元');
      return;
    }
    if (newPw !== confirm) {
      setError('兩次輸入的密碼不一致');
      return;
    }

    setLoading(true);
    try {
      const res  = await apiFetch('/api/admin/auth/force-change-password', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ new_password: newPw }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || '設定失敗'); return; }

      // 用 clearAuth 同步清除所有狀態（後端 force-change-password 已刪 session，不需再打 logout API）
      clearAuth();
      navigate('/admin/login', { replace: true, state: { notice: '密碼已設定，請重新登入' } });
    } catch {
      setError('無法連線至伺服器');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">設定新密碼</h1>
        <p style={{ color: '#aaa', fontSize: '0.85rem', marginBottom: '1.2rem', textAlign: 'center' }}>
          請設定您的新密碼以繼續使用後台
        </p>
        <form onSubmit={handleSubmit} className="login-form">
          <label className="login-label">新密碼（至少 8 個字元）</label>
          <input
            className="login-input"
            type="password"
            value={newPw}
            onChange={e => setNewPw(e.target.value)}
            autoComplete="new-password"
            required
          />
          <label className="login-label">確認新密碼</label>
          <input
            className="login-input"
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
          {error && <p className="login-error">{error}</p>}
          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? '設定中…' : '確認設定'}
          </button>
        </form>
      </div>
    </div>
  );
}
