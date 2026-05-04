import React from 'react';
import './Footer.css';

export default function Footer() {
  return (
    <footer className="site-footer">
      <span>© {new Date().getFullYear()} 台中中友百貨股份有限公司　版權所有</span>
    </footer>
  );
}
