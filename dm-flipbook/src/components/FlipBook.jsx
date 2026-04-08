import React, { useState, useCallback, useRef, useEffect } from 'react';
import PageContent from './PageContent';
import { pages } from '../data/pages';

// Each "spread" corresponds to one image from dm-pic
// spread 0 => cover.jpg (right side only, left is empty)
// spread 1..N => full spread images shown across both sides
const TOTAL_SPREADS = pages.length;

function getSpreadPages(spreadIndex) {
  const page = pages[spreadIndex] ?? null;
  if (spreadIndex === 0) {
    return { left: null, right: page }; // cover on right only
  }
  return { left: page, right: page };
}

export default function FlipBook() {
  const [currentSpread, setCurrentSpread] = useState(0);
  const [flipping, setFlipping] = useState(false);
  const [flipDirection, setFlipDirection] = useState(null); // 'next' | 'prev'
  const [pendingSpread, setPendingSpread] = useState(null);
  const [showThumbnails, setShowThumbnails] = useState(false);
  const timeoutRef = useRef(null);

  const { left: leftPage, right: rightPage } = getSpreadPages(currentSpread);

  const goToSpread = useCallback((targetSpread) => {
    if (flipping || targetSpread === currentSpread) return;
    if (targetSpread < 0 || targetSpread >= TOTAL_SPREADS) return;

    const dir = targetSpread > currentSpread ? 'next' : 'prev';
    setFlipDirection(dir);
    setPendingSpread(targetSpread);
    setFlipping(true);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setCurrentSpread(targetSpread);
      setFlipping(false);
      setFlipDirection(null);
      setPendingSpread(null);
    }, 700);
  }, [flipping, currentSpread]);

  const goNext = useCallback(() => goToSpread(currentSpread + 1), [goToSpread, currentSpread]);
  const goPrev = useCallback(() => goToSpread(currentSpread - 1), [goToSpread, currentSpread]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goNext();
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goPrev();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goNext, goPrev]);

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  // For animation: determine which side flips
  const isFlippingNext = flipping && flipDirection === 'next';
  const isFlippingPrev = flipping && flipDirection === 'prev';

  const pendingPages = pendingSpread !== null ? getSpreadPages(pendingSpread) : null;

  const pageLabel = currentSpread === 0
    ? '封面'
    : pages[currentSpread]?.name || `第 ${currentSpread + 1} 頁`;

  return (
    <div className="flipbook-wrapper">
      {/* Floating thumbnails button */}
      <button
        className="float-thumb-btn"
        onClick={() => setShowThumbnails(v => !v)}
        title="頁面導覽"
      >
        ☰
      </button>

      {/* Main Stage */}
      <div className="stage" onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        if (x > rect.width / 2) goNext(); else goPrev();
      }}>
        <div className={`book ${flipping ? `flipping-${flipDirection}` : ''}`}>
          {/* Left page */}
          <div className="book-side book-left">
            <div className="page-face page-front">
              {/* Immediately show pending content underneath the overlay */}
              <PageContent
                page={flipping && pendingPages ? pendingPages.left : leftPage}
                side="left"
              />
            </div>
            {isFlippingPrev && (
              <div className="page-face flipping-page left-flip">
                <PageContent page={leftPage} side="left" />
              </div>
            )}
          </div>

          {/* Spine shadow */}
          <div className="book-spine" />

          {/* Right page */}
          <div className="book-side book-right">
            <div className="page-face page-front">
              {/* Immediately show pending content underneath the overlay */}
              <PageContent
                page={flipping && pendingPages ? pendingPages.right : rightPage}
                side="right"
              />
            </div>
            {isFlippingNext && (
              <div className="page-face flipping-page right-flip">
                <PageContent page={rightPage} side="right" />
              </div>
            )}
          </div>
        </div>

        {/* Click zones hint */}
        <div className="click-hint left-hint" onClick={(e) => { e.stopPropagation(); goPrev(); }}>
          {currentSpread > 0 && <span className="hint-arrow">‹</span>}
        </div>
        <div className="click-hint right-hint" onClick={(e) => { e.stopPropagation(); goNext(); }}>
          {currentSpread < TOTAL_SPREADS - 1 && <span className="hint-arrow">›</span>}
        </div>
      </div>

      {/* Floating page dots */}
      <div className="float-dots">
        {Array.from({ length: TOTAL_SPREADS }).map((_, i) => (
          <button
            key={i}
            className={`dot ${i === currentSpread ? 'active' : ''}`}
            onClick={() => goToSpread(i)}
            title={`第 ${i + 1} 頁`}
          />
        ))}
      </div>

      {/* Thumbnails Panel */}
      {showThumbnails && (
        <div className="thumbnails-overlay" onClick={() => setShowThumbnails(false)}>
          <div className="thumbnails-panel" onClick={e => e.stopPropagation()}>
            <div className="thumbnails-header">
              <span>頁面導覽</span>
              <button onClick={() => setShowThumbnails(false)}>✕</button>
            </div>
            <div className="thumbnails-grid">
              {pages.map((page, i) => {
                const label = i === 0 ? '封面' : page.name;
                return (
                  <button
                    key={i}
                    className={`thumb-item ${i === currentSpread ? 'active' : ''}`}
                    onClick={() => { goToSpread(i); setShowThumbnails(false); }}
                    style={{
                      backgroundImage: `url(${page.src})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  >
                    <span className="thumb-label">{label}</span>
                    {(i === currentSpread) && <span className="thumb-current">▶</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
