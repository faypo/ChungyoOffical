import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import './AdminLayout.css';

const NAV = [
  { to: '/admin/dm',       label: 'DM 管理' },
  { to: '/admin/floor',    label: '樓層導覽' },
  { to: '/admin/food',     label: '美食導覽' },
  { to: '/admin/winners',  label: '得獎名單' },
  { to: '/admin/activity', label: '活動頁' },
  { to: '/admin/gallery',  label: '時尚藝廊' },
];

export default function AdminLayout() {
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <span className="admin-sidebar-title">管理後台</span>
        </div>
        <nav className="admin-nav">
          {NAV.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => 'admin-nav-link' + (isActive ? ' active' : '')}
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
