import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useLayout } from '../../context/LayoutContext';
import Header from './Header';
import Footer from './Footer';
import FaqWidget from '../FaqWidget';
import './Layout.css';

const PAGE_MAP = {
  '/floor':              'floor',
  '/food':               'food',
  '/service':            'service',
  '/winners':            'winners',
  '/CustomerFeedback':   'feedback',
};

function sendTrack(body) {
  fetch('/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => {});
}

function usePageTracking(pathname) {
  const entrySet = useRef(false);

  useEffect(() => {
    // 首頁入口判斷：session 第一頁是 /
    if (!sessionStorage.getItem('cy_entry')) {
      sessionStorage.setItem('cy_entry', pathname);
      if (pathname === '/') sendTrack({ page: 'home' });
    }

    // floor / food / service：session 內只算一次
    const pageKey = PAGE_MAP[pathname];
    if (pageKey) {
      const ssKey = `cy_${pageKey}`;
      if (!sessionStorage.getItem(ssKey)) {
        sessionStorage.setItem(ssKey, '1');
        sendTrack({ page: pageKey });
      }
    }
  }, [pathname]);
}

export default function Layout({ children }) {
  const { isWebView, viewerMode } = useLayout();
  const { pathname } = useLocation();

  usePageTracking(pathname);

  const isDmRoute = /^\/dm\/.+/.test(pathname);
  /* strip DMs set viewerMode='page'; flipbook DMs set 'full'; non-DM routes ignore viewerMode。
     注意：/faq 是獨立頁，在 App.jsx 裡直接掛在 Layout 外面（不經過這個元件），
     所以這裡完全不需要處理 /faq——它沒有 Header/Footer，是它自己的全螢幕頁面。 */
  const isViewer = isDmRoute && viewerMode !== 'page';

  if (isWebView) {
    return <div className={`layout layout--webview${isViewer ? ' layout--webview-viewer' : ''}`}>{children}</div>;
  }

  return (
    <div className={`layout layout--browser ${isViewer ? 'layout--viewer' : 'layout--page'}`}>
      <Header />
      <main className="layout-main">{children}</main>
      {!isViewer && <Footer />}
      {!isViewer && <FaqWidget />}
    </div>
  );
}
