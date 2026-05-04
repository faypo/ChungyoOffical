import React, { createContext, useContext, useEffect, useState } from 'react';

const LayoutContext = createContext({ isWebView: false, isMobile: false });

export function LayoutProvider({ children }) {
  const [isWebView] = useState(() => {
    if (sessionStorage.getItem('webview') === '1') return true;
    const params = new URLSearchParams(window.location.search);
    if (params.get('webview') === '1') {
      sessionStorage.setItem('webview', '1');
      return true;
    }
    return false;
  });

  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia('(max-width: 700px)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 700px)');
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <LayoutContext.Provider value={{ isWebView, isMobile }}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  return useContext(LayoutContext);
}
