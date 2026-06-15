import React from 'react';
import { useLocation } from 'react-router-dom';
import { useLayout } from '../../context/LayoutContext';
import Header from './Header';
import Footer from './Footer';
import './Layout.css';

export default function Layout({ children }) {
  const { isWebView, viewerMode } = useLayout();
  const { pathname } = useLocation();

  const isDmRoute = /^\/dm\/.+/.test(pathname);
  /* strip DMs set viewerMode='page'; flipbook DMs set 'full'; non-DM routes ignore viewerMode */
  const isViewer = isDmRoute && viewerMode !== 'page';

  if (isWebView) {
    return <div className={`layout layout--webview${isViewer ? ' layout--webview-viewer' : ''}`}>{children}</div>;
  }

  return (
    <div className={`layout layout--browser ${isViewer ? 'layout--viewer' : 'layout--page'}`}>
      <Header />
      <main className="layout-main">{children}</main>
      {!isViewer && <Footer />}
    </div>
  );
}
