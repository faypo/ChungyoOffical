import React, { useState, useCallback, useRef, useEffect } from 'react';
import PageContent from './PageContent';

/**
 * Flatten spreads into individual mobile pages.
 *   spread 0 → right half only (cover)
 *   spread 1..N → left half, then right half
 */
function buildMobilePages(pages) {
  const result = [];
  pages.forEach((page, i) => {
    if (i === 0) {
      result.push({ page, side: 'right', spreadIndex: 0 });
    } else {
      result.push({ page, side: 'left',  spreadIndex: i });
      result.push({ page, side: 'right', spreadIndex: i });
    }
  });
  return result;
}

export default function MobileFlipBook({ pages, buttons = [], onBack }) {
  const mobilePages = buildMobilePages(pages);
  const TOTAL = mobilePages.length;

  // dragOffset: -1..1  (negative = moving toward next, positive = moving toward prev)
  const [current, setCurrent]     = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [slideDir, setSlideDir]   = useState(null); // 'next'|'prev'

  const currentRef     = useRef(0);
  const dragOffsetRef  = useRef(0);
  const slideDirRef    = useRef(null);
  const isDraggingRef  = useRef(false);
  const isAnimatingRef = useRef(false);
  const dragStartXRef  = useRef(0);
  const dragStartYRef  = useRef(0);
  const lockAxisRef    = useRef(null); // 'h' | 'v' — set after first significant move
  const animFrameRef   = useRef(null);
  const containerRef   = useRef(null);

  useEffect(() => { currentRef.current = current; }, [current]);

  // ─── Core helpers ─────────────────────────────────────────────────────────

  const setOffsetBoth = useCallback((v) => {
    dragOffsetRef.current = v;
    setDragOffset(v);
  }, []);

  const cancelAnim = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }, []);

  const animateTo = useCallback((from, to, durationMs, onDone) => {
    cancelAnim();
    const startTime = performance.now();
    const tick = (now) => {
      const t     = Math.min(1, (now - startTime) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setOffsetBoth(from + (to - from) * eased);
      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(tick);
      } else {
        animFrameRef.current = null;
        onDone();
      }
    };
    animFrameRef.current = requestAnimationFrame(tick);
  }, [cancelAnim, setOffsetBoth]);

  // ─── Slide commit / snap-back ─────────────────────────────────────────────

  const commitSlide = useCallback((dir) => {
    const cur    = currentRef.current;
    const target = dir === 'next' ? cur + 1 : cur - 1;
    const to     = dir === 'next' ? -1 : 1;
    const from   = dragOffsetRef.current;
    animateTo(from, to, Math.max(Math.abs(to - from) * 260, 80), () => {
      setCurrent(target);
      currentRef.current = target;
      setOffsetBoth(0);
      slideDirRef.current = null;
      setSlideDir(null);
      isAnimatingRef.current = false;
    });
  }, [animateTo, setOffsetBoth]);

  const snapBack = useCallback(() => {
    const from = dragOffsetRef.current;
    animateTo(from, 0, Math.max(Math.abs(from) * 220, 80), () => {
      setOffsetBoth(0);
      slideDirRef.current = null;
      setSlideDir(null);
      isAnimatingRef.current = false;
    });
  }, [animateTo, setOffsetBoth]);

  // ─── Navigate (button / keyboard) ────────────────────────────────────────

  const navigate = useCallback((dir) => {
    if (isAnimatingRef.current || isDraggingRef.current) return;
    const cur    = currentRef.current;
    const target = dir === 'next' ? cur + 1 : cur - 1;
    if (target < 0 || target >= TOTAL) return;
    isAnimatingRef.current = true;
    slideDirRef.current    = dir;
    setSlideDir(dir);
    setOffsetBoth(0);
    commitSlide(dir);
  }, [TOTAL, commitSlide, setOffsetBoth]);

  // ─── Drag logic ───────────────────────────────────────────────────────────

  const startDrag = useCallback((clientX, clientY) => {
    if (isAnimatingRef.current) return;
    isDraggingRef.current  = true;
    dragStartXRef.current  = clientX;
    dragStartYRef.current  = clientY;
    lockAxisRef.current    = null;
  }, []);

  const moveDrag = useCallback((clientX, clientY) => {
    if (!isDraggingRef.current || !containerRef.current) return;
    const dx = clientX - dragStartXRef.current;
    const dy = clientY - dragStartYRef.current;

    // Determine scroll axis on first significant movement
    if (!lockAxisRef.current) {
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
      lockAxisRef.current = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';
    }
    if (lockAxisRef.current === 'v') return; // let page scroll naturally

    const cur   = currentRef.current;
    const width = containerRef.current.offsetWidth;
    let ratio   = dx / width; // positive = swiping right (prev), negative = left (next)

    // Clamp at edges
    if (ratio < 0 && cur >= TOTAL - 1) ratio = Math.max(ratio, -0.15);
    if (ratio > 0 && cur <= 0)         ratio = Math.min(ratio,  0.15);

    const dir = ratio < 0 ? 'next' : ratio > 0 ? 'prev' : slideDirRef.current;
    if (dir !== slideDirRef.current) {
      slideDirRef.current = dir;
      setSlideDir(dir);
    }
    setOffsetBoth(ratio);
  }, [TOTAL, setOffsetBoth]);

  const endDrag = useCallback((clientX, clientY) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    const dx     = clientX - dragStartXRef.current;
    const dy     = clientY - dragStartYRef.current;
    const offset = dragOffsetRef.current;

    // Tap: barely moved → navigate by tap position
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
      const mid = window.innerWidth / 2;
      if (clientX > mid && currentRef.current < TOTAL - 1) {
        isAnimatingRef.current = true;
        slideDirRef.current    = 'next';
        setSlideDir('next');
        commitSlide('next');
      } else if (clientX <= mid && currentRef.current > 0) {
        isAnimatingRef.current = true;
        slideDirRef.current    = 'prev';
        setSlideDir('prev');
        commitSlide('prev');
      } else {
        slideDirRef.current = null;
        setSlideDir(null);
        setOffsetBoth(0);
      }
      return;
    }

    // Vertical scroll in progress — reset silently
    if (lockAxisRef.current === 'v') {
      slideDirRef.current = null;
      setSlideDir(null);
      setOffsetBoth(0);
      return;
    }

    // Horizontal drag: commit if past threshold, otherwise snap back
    isAnimatingRef.current = true;
    const dir    = offset < 0 ? 'next' : 'prev';
    const target = dir === 'next' ? currentRef.current + 1 : currentRef.current - 1;
    if (Math.abs(offset) >= 0.3 && target >= 0 && target < TOTAL) {
      commitSlide(dir);
    } else {
      snapBack();
    }
  }, [TOTAL, commitSlide, snapBack, setOffsetBoth]);

  // ─── Global touch events ─────────────────────────────────────────────────

  useEffect(() => {
    const onTouchMove = (e) => {
      if (isDraggingRef.current && lockAxisRef.current === 'h') e.preventDefault();
      moveDrag(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onTouchEnd = (e) => {
      const t = e.changedTouches[0];
      endDrag(t.clientX, t.clientY);
    };
    window.addEventListener('touchmove',  onTouchMove, { passive: false });
    window.addEventListener('touchend',   onTouchEnd);
    return () => {
      window.removeEventListener('touchmove',  onTouchMove);
      window.removeEventListener('touchend',   onTouchEnd);
    };
  }, [moveDrag, endDrag]);

  // ─── Keyboard ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') navigate('next');
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   navigate('prev');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  useEffect(() => () => cancelAnim(), [cancelAnim]);

  // ─── Compute transforms ───────────────────────────────────────────────────

  const currentItem = mobilePages[current];
  const adjIndex    = slideDir === 'next' ? current + 1
                    : slideDir === 'prev' ? current - 1
                    : null;
  const adjItem     = (adjIndex !== null && adjIndex >= 0 && adjIndex < TOTAL)
                    ? mobilePages[adjIndex] : null;

  // current page: translateX(offset * 100%)
  // adjacent page (incoming):
  //   next: starts at 100%, moves to 0 → (1 + offset) * 100%
  //   prev: starts at -100%, moves to 0 → (-1 + offset) * 100%
  const currentTranslate = dragOffset * 100;
  const adjTranslate     = slideDir === 'next'
    ? (1  + dragOffset) * 100
    : (-1 + dragOffset) * 100;

  // ─── Render ───────────────────────────────────────────────────────────────

  // 找出目前手機頁（半頁）對應的按鈕設定
  const activeButton = buttons.find(b => b.page === current) ?? null;

  return (
    <div className="mobile-flipbook">
      {onBack && (
        <button className="flipbook-back-btn" onClick={onBack}>← 返回</button>
      )}

      {activeButton && (
        <a
          className="mobile-shop-btn"
          href={activeButton.url}
        >
          前往選購
        </a>
      )}

      <div
        className="mobile-page-area"
        onTouchStart={(e) => startDrag(e.touches[0].clientX, e.touches[0].clientY)}
        onMouseDown={(e) => { if (e.button === 0) { e.preventDefault(); startDrag(e.clientX, e.clientY); } }}
        onMouseMove={(e) => { if (isDraggingRef.current) moveDrag(e.clientX, e.clientY); }}
        onMouseUp={(e)   => { if (isDraggingRef.current) endDrag(e.clientX, e.clientY); }}
      >
        {/* Fixed aspect-ratio frame — pages slide inside this */}
        <div className="mobile-book-frame" ref={containerRef}>
          {/* Current page */}
          <div
            className="mobile-page"
            style={{ transform: `translateX(${currentTranslate}%)` }}
          >
            <PageContent page={currentItem.page} side={currentItem.side} />
          </div>

          {/* Adjacent page (incoming during drag / animation) */}
          {adjItem && (
            <div
              className="mobile-page"
              style={{ transform: `translateX(${adjTranslate}%)` }}
            >
              <PageContent page={adjItem.page} side={adjItem.side} />
            </div>
          )}
        </div>
      </div>

      {/* Prev / Next buttons */}
      <button
        className="mobile-nav mobile-nav-prev"
        onClick={() => navigate('prev')}
        disabled={current <= 0}
        aria-label="上一頁"
      >‹</button>
      <button
        className="mobile-nav mobile-nav-next"
        onClick={() => navigate('next')}
        disabled={current >= TOTAL - 1}
        aria-label="下一頁"
      >›</button>

      {/* Page indicator */}
      <div className="mobile-page-indicator">
        {current + 1} / {TOTAL}
      </div>
    </div>
  );
}
