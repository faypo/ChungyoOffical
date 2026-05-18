import React, { useState, useEffect, useRef, useCallback } from 'react';
import './BannerCarousel.css';

export default function BannerCarousel({ banners = [] }) {
  const [index,      setIndex]      = useState(0);
  const [paused,     setPaused]     = useState(false);
  const [slideWidth, setSlideWidth] = useState(0);
  const rootRef  = useRef();
  const timerRef = useRef();
  const count = banners.length;

  /* 量測容器寬度，視窗縮放時同步更新 */
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSlideWidth(el.offsetWidth));
    ro.observe(el);
    setSlideWidth(el.offsetWidth);
    return () => ro.disconnect();
  }, []);

  const next = useCallback(() => setIndex(i => (i + 1) % count), [count]);
  const prev = useCallback(() => setIndex(i => (i - 1 + count) % count), [count]);

  useEffect(() => {
    if (count <= 1 || paused) return;
    timerRef.current = setInterval(next, 5000);
    return () => clearInterval(timerRef.current);
  }, [count, paused, next]);

  useEffect(() => { setIndex(0); }, [count]);

  if (!count) return null;

  return (
    <div
      className="bc-root"
      ref={rootRef}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="bc-track"
        style={{ transform: `translateX(-${index * slideWidth}px)` }}
      >
        {banners.map((b, i) => {
          const img = (
            <img
              src={`/api/images/banner-pic/${b.file}`}
              alt={`Banner ${i + 1}`}
              className="bc-img"
            />
          );
          return (
            <div
              key={b.id}
              className="bc-slide"
              style={{ width: slideWidth || undefined }}
            >
              {b.url ? <a href={b.url} className="bc-link">{img}</a> : img}
            </div>
          );
        })}
      </div>

      {count > 1 && (
        <>
          <button className="bc-arrow bc-arrow--prev" onClick={prev} aria-label="上一張">&#8249;</button>
          <button className="bc-arrow bc-arrow--next" onClick={next} aria-label="下一張">&#8250;</button>
          <div className="bc-dots">
            {banners.map((_, i) => (
              <button
                key={i}
                className={`bc-dot${i === index ? ' active' : ''}`}
                onClick={() => setIndex(i)}
                aria-label={`第 ${i + 1} 張`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
