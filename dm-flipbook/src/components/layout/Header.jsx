import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import './Header.css';

const NAV_ITEMS = [
  { to: '/dm',               label: 'DM導覽' },
  { to: '/floor',            label: '樓層導覽' },
  { to: '/food',             label: '美食導覽' },
  { to: '/CustomerFeedback', label: '客服意見' },
];

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <NavLink to="/dm" className="site-logo">中友百貨</NavLink>

        {/* Desktop nav */}
        <nav className="site-nav">
          {NAV_ITEMS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => 'site-nav-link' + (isActive ? ' active' : '')}
            >
              {label}
            </NavLink>
          ))}
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
        {NAV_ITEMS.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => 'site-mobile-nav-link' + (isActive ? ' active' : '')}
            onClick={() => setMenuOpen(false)}
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
