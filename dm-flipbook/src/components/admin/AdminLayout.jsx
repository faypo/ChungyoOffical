import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ChangePasswordModal from './ChangePasswordModal';
import './AdminLayout.css';

const OTHER_NAV = [
  { to: '/admin/dm',       label: 'DM 管理' },
  { to: '/admin/floor',    label: '樓層導覽' },
  { to: '/admin/food',     label: '美食導覽' },
  { to: '/admin/winners',  label: '得獎名單' },
  { to: '/admin/activity', label: '活動頁' },
  { to: '/admin/gallery',        label: '時尚藝廊' },
  { to: '/admin/sustainability', label: '永續報告書' },
  { to: '/admin/service',       label: '貼心服務' },
  { to: '/admin/stats',         label: '流量統計' },
];

const HOME_NAV = [
  { to: '/admin/banner',     label: 'Banner 管理' },
  { to: '/admin/home-event', label: '活動訊息' },
  { to: '/admin/home-fb',    label: 'FB 社群' },
  { to: '/admin/home-promo', label: '推廣區' },
  { to: '/admin/logos',      label: 'Logo 輪播' },
];

export default function AdminLayout() {
  const { pathname } = useLocation();
  const isHomePath = HOME_NAV.some(n => pathname.startsWith(n.to));
  const [homeOpen, setHomeOpen] = useState(isHomePath);
  const { logout, isSuperAdmin } = useAuth();
  const navigate   = useNavigate();
  const [showChangePw, setShowChangePw] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <span className="admin-sidebar-title">管理後台</span>
        </div>
        <nav className="admin-nav">

          {/* 首頁折疊群組 */}
          <button
            className={`admin-nav-group${isHomePath ? ' active' : ''}`}
            onClick={() => setHomeOpen(v => !v)}
          >
            首頁
            <span className="admin-nav-group-arrow">{homeOpen ? '▾' : '▸'}</span>
          </button>
          {homeOpen && (
            <div className="admin-nav-children">
              {HOME_NAV.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) => 'admin-nav-link admin-nav-link--child' + (isActive ? ' active' : '')}
                >
                  {label}
                </NavLink>
              ))}
            </div>
          )}

          {/* 其他功能 */}
          {OTHER_NAV.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => 'admin-nav-link' + (isActive ? ' active' : '')}
            >
              {label}
            </NavLink>
          ))}

          {isSuperAdmin && (
            <>
              <div className="admin-nav-divider" />
              <NavLink
                to="/admin/users"
                className={({ isActive }) => 'admin-nav-link' + (isActive ? ' active' : '')}
              >
                帳號管理
              </NavLink>
              <NavLink
                to="/admin/roles"
                className={({ isActive }) => 'admin-nav-link' + (isActive ? ' active' : '')}
              >
                角色管理
              </NavLink>
            </>
          )}

        </nav>
        <button className="admin-change-pw-btn" onClick={() => setShowChangePw(true)}>更改密碼</button>
        <button className="admin-logout-btn" onClick={handleLogout}>登出</button>
      </aside>
      {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
