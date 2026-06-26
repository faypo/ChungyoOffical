import React, { useState, useEffect } from 'react';
import './SwipeHint.css';

export default function SwipeHint() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading]   = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true),  2200);
    const hideTimer = setTimeout(() => setVisible(false), 2800);
    return () => { clearTimeout(fadeTimer); clearTimeout(hideTimer); };
  }, []);

  if (!visible) return null;

  return (
    <div className={`swipe-hint-wrap${fading ? ' swipe-hint-wrap--fade' : ''}`}>
      <div className="swipe-hint-inner">
        <span className="swipe-hint-arrow swipe-hint-arrow--left">‹</span>
        <span className="swipe-hint-text">右滑上頁　左滑下頁</span>
        <span className="swipe-hint-arrow swipe-hint-arrow--right">›</span>
      </div>
    </div>
  );
}
