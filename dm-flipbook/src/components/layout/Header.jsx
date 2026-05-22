import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import './Header.css';

const INTERNAL_NAV = [
  { to: '/dm',               label: '電子型錄DM' },
  { to: '/floor',            label: '樓層導覽' },
  { to: '/food',             label: '美食導覽' },
  { to: '/service',          label: '貼心服務' },
  { to: '/winners',          label: '得獎名單' },
  { to: '/gallery',          label: '中友時尚藝廊' },
  { to: '/CustomerFeedback', label: '顧客意見' },
];

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [memberUrl, setMemberUrl] = useState('');

  useEffect(() => {
    fetch('/api/config')
      .then(r => r.ok ? r.json() : {})
      .then(d => { if (d.memberUrl) setMemberUrl(d.memberUrl); })
      .catch(() => {});
  }, []);

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <NavLink to="/" className="site-logo">
          <img src="/BN-LOGO.png" alt="中友百貨" className="site-logo-img" />
        </NavLink>

        {/* Desktop nav */}
        <nav className="site-nav">
          {INTERNAL_NAV.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => 'site-nav-link' + (isActive ? ' active' : '')}
            >
              {label}
            </NavLink>
          ))}
          {memberUrl && (
            <a
              href={memberUrl}
              className="site-nav-link"
            >
              會員點數查詢
            </a>
          )}
        </nav>

        {/* Mobile hamburger */}
        <button
          className="site-hamburger"
          onClick={() => setMenuOpen(o => !o)}
          aria-label="選單"
        >
          <span /><span /><span />
        </button>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="site-mobile-backdrop" onClick={() => setMenuOpen(false)} />
      )}
      <nav className={`site-mobile-nav${menuOpen ? ' open' : ''}`}>
        {INTERNAL_NAV.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => 'site-mobile-nav-link' + (isActive ? ' active' : '')}
            onClick={() => setMenuOpen(false)}
          >
            {label}
          </NavLink>
        ))}
        {memberUrl && (
          <a
            href={memberUrl}
            className="site-mobile-nav-link"
            onClick={() => setMenuOpen(false)}
          >
            會員點數查詢
          </a>
        )}
      </nav>
    </header>
  );
}
