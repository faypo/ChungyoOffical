import React, { useState, useEffect, useCallback } from 'react';
import './LogoCarousel.css';

export default function LogoCarousel() {
  const [groups, setGroups] = useState([]);
  const [index,  setIndex]  = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    fetch('/api/logos')
      .then(r => r.json())
      .then(d => setGroups((d.groups ?? []).filter(g => g.logos?.length > 0)))
      .catch(() => {});
  }, []);

  const count = groups.length;
  const next  = useCallback(() => setIndex(i => (i + 1) % count), [count]);

  useEffect(() => { setIndex(0); }, [count]);

  useEffect(() => {
    if (count <= 1 || paused) return;
    const t = setInterval(next, 5000);
    return () => clearInterval(t);
  }, [count, paused, next]);

  if (!count) return null;

  return (
    <section
      className="lc-section"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <p className="lc-section-label">Our Brands</p>
      <div className="lc-viewport">
        <div
          className="lc-track"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {groups.map((group, gi) => (
            <div key={group.id ?? gi} className="lc-slide">
              {group.logos.map(logo => (
                <div key={logo.id} className="lc-logo-wrap">
                  <img
                    src={`/api/images/logo-pic/${logo.file}`}
                    alt="Logo"
                    className="lc-logo"
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
