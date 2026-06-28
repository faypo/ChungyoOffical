import React, { useState } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './LoginPage.css';

export default function LoginPage() {
  const [employeeId, setEmployeeId] = useState('');
  const [password,   setPassword]   = useState('');
  const [error,      setError]      = useState('');
  const [loading,    setLoading]    = useState(false);

  const { login }    = useAuth();
  const navigate     = useNavigate();
  const location     = useLocation();
  const rawFrom = location.state?.from?.pathname;
  const from    = (rawFrom && rawFrom !== '/admin/change-password') ? rawFrom : '/admin/banner';
  const notice       = location.state?.notice || '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res  = await fetch('/api/admin/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ employee_id: employeeId, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || '登入失敗'); return; }
      flushSync(() => {
        login(data.must_change_password ?? false, data.user ?? null);
      });
      if (data.must_change_password) {
        navigate('/admin/change-password', { replace: true });
      } else {
        navigate(from, { replace: true });
      }
    } catch {
      setError('無法連線至伺服器');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">管理後台</h1>
        {notice && <p style={{ color:'#4ade80', textAlign:'center', marginBottom:'.8rem', fontSize:'.88rem' }}>{notice}</p>}
        <form onSubmit={handleSubmit} className="login-form">
          <label className="login-label">員工編號</label>
          <input
            className="login-input"
            type="text"
            value={employeeId}
            onChange={e => setEmployeeId(e.target.value)}
            autoComplete="username"
            required
          />
          <label className="login-label">密碼</label>
          <input
            className="login-input"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          {error && <p className="login-error">{error}</p>}
          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? '登入中…' : '登入'}
          </button>
        </form>
      </div>
    </div>
  );
}
