import React, { useState, useEffect, useCallback } from 'react';
import './BannerCarousel.css';

export default function BannerCarousel({ banners = [] }) {
  const [index,  setIndex]  = useState(0);
  const [paused, setPaused] = useState(false);
  const count = banners.length;

  const next = useCallback(() => setIndex(i => (i + 1) % count), [count]);
  const prev = useCallback(() => setIndex(i => (i - 1 + count) % count), [count]);

  useEffect(() => {
    if (count <= 1 || paused) return;
    const t = setInterval(next, 5000);
    return () => clearInterval(t);
  }, [count, paused, next]);

  useEffect(() => { setIndex(0); }, [count]);

  if (!count) return null;

  return (
    <div
      className="bc-root"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="bc-track"
        style={{ transform: `translateX(-${index * 100}%)` }}
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
            <div key={b.id} className="bc-slide">
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
