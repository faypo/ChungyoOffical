import React, { useState, useCallback, useRef, useEffect } from 'react';
import PageContent from './PageContent';

function getSpreadPages(pages, spreadIndex) {
  const page = pages[spreadIndex] ?? null;
  if (spreadIndex === 0) return { left: null, right: page };
  return { left: page, right: page };
}

// Compute closing/opening leaf rotateY angles from progress (0–1) and direction.
//
// Sequential two-phase animation:
//   progress 0→0.5 : closing leaf folds flat→perpendicular (0 → ±90°)
//   progress 0.5→1 : opening leaf unfolds perpendicular→flat (±90° → 0°)
//
// The opening leaf stays clamped at ±90° (invisible edge) during the first phase.
function leafAngles(progress, direction) {
  // closing: 0 → ±90° over the first half
  const closingT = Math.min(progress * 2, 1);
  // opening: ±90° → 0° over the second half (clamped to ±90° during first half)
  const openingT = Math.min(1, Math.max(0, (progress - 0.5) * 2)); // 0→1 during 0.5–1

  if (direction === 'next') {
    return {
      closing: -90 * closingT,
      opening:  90 * (1 - openingT),   // 90° → 0°
    };
  }
  return {
    closing:  90 * closingT,
    opening: -90 * (1 - openingT),    // -90° → 0°
  };
}

export default function FlipBook({ pages, onBack }) {
  const TOTAL_SPREADS = pages.length;

  const [currentSpread, setCurrentSpread]   = useState(0);
  const [flipActive, setFlipActive]         = useState(false);
  const [flipDirection, setFlipDirection]   = useState(null); // 'next' | 'prev'
  const [pendingSpread, setPendingSpread]   = useState(null);
  const [progress, setProgress]             = useState(0);    // 0–1
  const [autoFlipPending, setAutoFlipPending] = useState(false);

  // Mutable refs — no re-renders needed for these
  const isDraggingRef     = useRef(false);
  const dragStartXRef     = useRef(0);
  const progressRef       = useRef(0);   // mirrors progress state for event handlers
  const flipActiveRef     = useRef(false);
  const flipDirectionRef  = useRef(null);
  const pendingSpreadRef  = useRef(null);
  const currentSpreadRef  = useRef(0);
  const animFrameRef      = useRef(null);
  const bookRef           = useRef(null);

  // Keep currentSpreadRef in sync
  useEffect(() => { currentSpreadRef.current = currentSpread; }, [currentSpread]);

  const { left: leftPage, right: rightPage } = getSpreadPages(pages, currentSpread);
  const pendingPages = pendingSpread !== null ? getSpreadPages(pages, pendingSpread) : null;

  // Under the closing leaf, show the incoming page so it's revealed as the leaf rotates away
  let bgLeft  = leftPage;
  let bgRight = rightPage;
  if (flipActive && flipDirection === 'next') bgRight = pendingPages?.right ?? null;
  if (flipActive && flipDirection === 'prev') bgLeft  = pendingPages?.left  ?? null;

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const setProgressBoth = useCallback((p) => {
    progressRef.current = p;
    setProgress(p);
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
    const frame = (now) => {
      const t      = Math.min(1, (now - startTime) / durationMs);
      const eased  = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setProgressBoth(from + (to - from) * eased);
      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(frame);
      } else {
        animFrameRef.current = null;
        onDone();
      }
    };
    animFrameRef.current = requestAnimationFrame(frame);
  }, [cancelAnim, setProgressBoth]);

  // Called after a successful flip (progress reaches 1)
  const finishFlip = useCallback(() => {
    const target = pendingSpreadRef.current;
    setCurrentSpread(target);
    setFlipActive(false);
    setFlipDirection(null);
    setPendingSpread(null);
    setProgressBoth(0);
    flipActiveRef.current    = false;
    flipDirectionRef.current = null;
    pendingSpreadRef.current = null;
  }, [setProgressBoth]);

  // Called when snap-back animation finishes (progress returns to 0)
  const revertFlip = useCallback(() => {
    setFlipActive(false);
    setFlipDirection(null);
    setPendingSpread(null);
    setProgressBoth(0);
    flipActiveRef.current    = false;
    flipDirectionRef.current = null;
    pendingSpreadRef.current = null;
  }, [setProgressBoth]);

  const completeFlip = useCallback((fromProgress) => {
    const remaining = 1 - fromProgress;
    animateTo(fromProgress, 1, Math.max(remaining * 380, 80), finishFlip);
  }, [animateTo, finishFlip]);

  const cancelFlip = useCallback((fromProgress) => {
    animateTo(fromProgress, 0, Math.max(fromProgress * 280, 80), revertFlip);
  }, [animateTo, revertFlip]);

  // ─── Flip initialisation ──────────────────────────────────────────────────

  // Sets up refs + state for a new flip; returns false if blocked
  const beginFlip = useCallback((direction, targetSpread) => {
    if (flipActiveRef.current) return false;
    const current = currentSpreadRef.current;
    const target  = targetSpread ?? (direction === 'next' ? current + 1 : current - 1);
    if (target < 0 || target >= TOTAL_SPREADS) return false;

    flipDirectionRef.current  = direction;
    pendingSpreadRef.current  = target;
    flipActiveRef.current     = true;

    setFlipDirection(direction);
    setPendingSpread(target);
    setProgressBoth(0);
    setFlipActive(true);
    return true;
  }, [setProgressBoth]);

  // Auto-flip triggered by click / keyboard / dots
  // Uses useEffect below to start animation after leaves are mounted
  const autoFlip = useCallback((direction, targetSpread) => {
    if (!beginFlip(direction, targetSpread)) return;
    setAutoFlipPending(true);
  }, [beginFlip]);

  // Once flipActive is true and autoFlipPending, the leaves are in the DOM — start animation
  useEffect(() => {
    if (!flipActive || !autoFlipPending) return;
    setAutoFlipPending(false);
    completeFlip(0);
  }, [flipActive, autoFlipPending, completeFlip]);

  // ─── Drag handlers ───────────────────────────────────────────────────────

  const handleDragStart = useCallback((clientX, stageRect) => {
    const x         = clientX - stageRect.left;
    const direction = x > stageRect.width / 2 ? 'next' : 'prev';
    if (!beginFlip(direction)) return;
    isDraggingRef.current  = true;
    dragStartXRef.current  = clientX;
    document.body.style.cursor = 'grabbing';
  }, [beginFlip]);

  const handleDragMove = useCallback((clientX) => {
    if (!isDraggingRef.current || !bookRef.current) return;
    const halfWidth = bookRef.current.offsetWidth / 2;
    const dir       = flipDirectionRef.current;
    const delta     = dir === 'next'
      ? dragStartXRef.current - clientX
      : clientX - dragStartXRef.current;
    setProgressBoth(Math.max(0, Math.min(1, delta / halfWidth)));
  }, [setProgressBoth]);

  const handleDragEnd = useCallback((clientX) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    document.body.style.cursor = '';

    const moved = Math.abs(clientX - dragStartXRef.current);
    const prog  = progressRef.current;

    // A tap (barely moved) → treat as a click → complete the flip
    if (moved < 8 || prog >= 0.5) {
      completeFlip(prog);
    } else {
      cancelFlip(prog);
    }
  }, [completeFlip, cancelFlip]);

  // ─── Global mouse / touch events ─────────────────────────────────────────

  useEffect(() => {
    const onMouseMove  = (e) => handleDragMove(e.clientX);
    const onMouseUp    = (e) => handleDragEnd(e.clientX);
    const onTouchMove  = (e) => {
      if (isDraggingRef.current) e.preventDefault();
      handleDragMove(e.touches[0].clientX);
    };
    const onTouchEnd   = (e) =>
      handleDragEnd(e.changedTouches[0]?.clientX ?? dragStartXRef.current);

    window.addEventListener('mousemove',  onMouseMove);
    window.addEventListener('mouseup',    onMouseUp);
    window.addEventListener('touchmove',  onTouchMove, { passive: false });
    window.addEventListener('touchend',   onTouchEnd);
    return () => {
      window.removeEventListener('mousemove',  onMouseMove);
      window.removeEventListener('mouseup',    onMouseUp);
      window.removeEventListener('touchmove',  onTouchMove);
      window.removeEventListener('touchend',   onTouchEnd);
    };
  }, [handleDragMove, handleDragEnd]);

  // ─── Keyboard ─────────────────────────────────────────────────────────────

  const goNext     = useCallback(() => autoFlip('next'),         [autoFlip]);
  const goPrev     = useCallback(() => autoFlip('prev'),         [autoFlip]);
  const goToSpread = useCallback((target) => {
    if (flipActiveRef.current) return;
    const current = currentSpreadRef.current;
    if (target === current) return;
    autoFlip(target > current ? 'next' : 'prev', target);
  }, [autoFlip]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goNext();
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   goPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev]);

  useEffect(() => () => cancelAnim(), [cancelAnim]);

  // ─── Compute leaf transforms ──────────────────────────────────────────────

  const { closing: closingAngle, opening: openingAngle } =
    flipActive && flipDirection
      ? leafAngles(progress, flipDirection)
      : { closing: 0, opening: flipDirection === 'prev' ? -90 : 90 };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flipbook-wrapper">
      {onBack && (
        <button className="flipbook-back-btn" onClick={onBack} title="返回型錄">
          ← 返回
        </button>
      )}
      <div
        className="stage"
        onMouseDown={(e) => {
          if (e.button !== 0 || flipActiveRef.current) return;
          e.preventDefault();
          handleDragStart(e.clientX, e.currentTarget.getBoundingClientRect());
        }}
        onTouchStart={(e) => {
          if (flipActiveRef.current) return;
          const t = e.touches[0];
          handleDragStart(t.clientX, e.currentTarget.getBoundingClientRect());
        }}
      >
        <div className="book" ref={bookRef}>
          {/* Left page */}
          <div className="book-side book-left">
            <PageContent page={bgLeft} side="left" />
          </div>

          {/* Spine */}
          <div className="book-spine" />

          {/* Right page */}
          <div className="book-side book-right">
            <PageContent page={bgRight} side="right" />
          </div>

          {/* Two-leaf drag-driven flip — lives at book level to cross the spine */}
          {flipActive && flipDirection === 'next' && <>
            <div
              className="flip-leaf flip-next-closing"
              style={{ transform: `rotateY(${closingAngle}deg)` }}
            >
              <PageContent page={rightPage} side="right" />
            </div>
            <div
              className="flip-leaf flip-next-opening"
              style={{ transform: `rotateY(${openingAngle}deg)` }}
            >
              <PageContent page={pendingPages?.left} side="left" />
            </div>
          </>}
          {flipActive && flipDirection === 'prev' && <>
            <div
              className="flip-leaf flip-prev-closing"
              style={{ transform: `rotateY(${closingAngle}deg)` }}
            >
              <PageContent page={leftPage} side="left" />
            </div>
            <div
              className="flip-leaf flip-prev-opening"
              style={{ transform: `rotateY(${openingAngle}deg)` }}
            >
              <PageContent page={pendingPages?.right} side="right" />
            </div>
          </>}
        </div>

        {/* Click zone arrows */}
        <div
          className="click-hint left-hint"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
        >
          {currentSpread > 0 && <span className="hint-arrow">‹</span>}
        </div>
        <div
          className="click-hint right-hint"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); goNext(); }}
        >
          {currentSpread < TOTAL_SPREADS - 1 && <span className="hint-arrow">›</span>}
        </div>
      </div>

      {/* Page dots */}
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

    </div>
  );
}
