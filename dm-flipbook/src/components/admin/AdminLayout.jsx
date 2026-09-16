import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useModulePermission } from '../../utils/useModulePermission';
import ChangePasswordModal from './ChangePasswordModal';
import './AdminLayout.css';
// 後台每個管理頁的 CSS 不是完全獨立的：不只互相 import 共用檔案（例如
// FloorGuideManager.css 是很多頁的共用基底），還有更隱性的狀況——例如
// ActivityManager.jsx 的表單用了 .wm-meta-label 這個 class，但它的基礎樣式
// （display:flex; flex-direction:column 等）其實是定義在 WinnersManager.css
// 裡，ActivityManager.jsx 自己完全沒有 import 那個檔案，純粹是因為改成
// lazy-loading 以前，全部後台頁面的 CSS 打包成同一包全域樣式表，所以「誰定義
// 誰使用」從來不用對齊，都能互相套用。改成路由層級動態載入後，每個管理頁的
// CSS 只剩自己 import 的那份，上面這種隱性依賴就會直接消失、版型跑掉。
// 與其一個個抓漏，這裡乾脆把全部後台管理頁的 CSS 都固定 eager import
// （跟 AdminLayout 本身一樣，每個 /admin/* 路由一定會先載入），還原成改
// lazy-loading 之前「全部後台 CSS 都是全域的」這個狀態，只有元件的 JS
// 程式碼維持 lazy-loading（vite build chunk 過大的問題本來就是 JS 造成的，
// CSS 檔案都很小，全部 eager 載入不會有實際影響）。
import './FloorGuideManager.css';
import './HotspotEditor.css';
import './DMManager.css';
import './FoodGuideManager.css';
import './WinnersManager.css';
import './ActivityManager.css';
import './BannerManager.css';
import './HomeEventsManager.css';
import './StatsManager.css';

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
