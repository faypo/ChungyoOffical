import React from 'react';
import { useLayout } from '../../context/LayoutContext';
import Header from './Header';
import Footer from './Footer';
import './Layout.css';

export default function Layout({ children }) {
  const { isWebView } = useLayout();

  if (isWebView) {
    return <div className="layout layout--webview">{children}</div>;
  }

  return (
    <div className="layout layout--browser">
      <Header />
      <main className="layout-main">{children}</main>
      <Footer />
    </div>
  );
}
