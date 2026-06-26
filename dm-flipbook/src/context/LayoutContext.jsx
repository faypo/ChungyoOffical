import React, { createContext, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const LayoutContext = createContext({ isWebView: false, isMobile: false, viewerMode: null, setViewerMode: () => {} });

function detectWebView(search) {
  if (sessionStorage.getItem('webview') === '1') return true;
  try {
    const params = new URLSearchParams(search);
    if (params.get('webview') === '1') {
      sessionStorage.setItem('webview', '1');
      return true;
    }
  } catch (_) {}
  return false;
}

export function LayoutProvider({ children }) {
  const location = useLocation();
  const [isWebView, setIsWebView] = useState(() => detectWebView(window.location.search));

  useEffect(() => {
    if (!isWebView && detectWebView(location.search)) {
      setIsWebView(true);
    }
  }, [location.search]);

  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia('(max-width: 700px)').matches
  );
  const [viewerMode, setViewerMode] = useState(null); // null | 'full' | 'page'

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 700px)');
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <LayoutContext.Provider value={{ isWebView, isMobile, viewerMode, setViewerMode }}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  return useContext(LayoutContext);
}
