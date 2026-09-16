import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useModulePermission } from '../../utils/useModulePermission';
import ChangePasswordModal from './ChangePasswordModal';
import './AdminLayout.css';
// 這三個是好幾個後台管理頁共用的基底樣式表（FloorGuideManager.css 是最底層的
// fg-* 共用 class，ActivityManager.css／BannerManager.css 再往上疊）。改成
// lazy-loading 之前，全部頁面打包成同一包 CSS，這幾個檔案的載入順序（覆蓋關係）
// 是固定的；改成路由層級動態載入後，順序會變成「看使用者先逛哪個後台頁」，
// 導致哪個樣式蓋過哪個變得不確定，版型忽好忽壞。在這裡固定 import 一次（跟
// AdminLayout 本身一樣是 eager、永遠先載入），確保覆蓋順序永遠固定。
import './FloorGuideManager.css';
import './ActivityManager.css';
import './BannerManager.css';

const OTHER_NAV = [
  { to: '/admin/dm',             label: 'DM 管理',    module: 'dm' },
  { to: '/admin/floor',          label: '樓層導覽',   module: 'floor' },
  { to: '/admin/food',           label: '美食導覽',   module: 'food' },
  { to: '/admin/winners',        label: '得獎名單',   module: 'winners' },
  { to: '/admin/activity',       label: '活動頁',     module: 'activity' },
  { to: '/admin/gallery',        label: '時尚藝廊',   module: 'gallery' },
  { to: '/admin/sustainability',  label: '永續報告書', module: 'sustainability' },
  { to: '/admin/service',        label: '貼心服務',   module: 'service' },
  { to: '/admin/stats',          label: '流量統計',   module: 'stats' },
];

const HOME_NAV = [
  { to: '/admin/banner',     label: 'Banner 管理', module: 'banner' },
  { to: '/admin/home-event', label: '活動訊息',    module: 'home_event' },
  { to: '/admin/home-fb',    label: 'FB 社群',     module: 'home_fb' },
  { to: '/admin/home-promo', label: '推廣區',      module: 'home_promo' },
  { to: '/admin/logos',      label: 'Logo 輪播',   module: 'logo' },
];

export default function AdminLayout() {
  const { pathname } = useLocation();
  const isHomePath = HOME_NAV.some(n => pathname.startsWith(n.to));
  const [homeOpen, setHomeOpen] = useState(isHomePath);
  const { logout, isSuperAdmin, hasPermission } = useAuth();
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
              {HOME_NAV.filter(n => hasPermission(n.module, 'read')).map(({ to, label }) => (
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
          {OTHER_NAV.filter(n => hasPermission(n.module, 'read')).map(({ to, label }) => (
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
