import React, { useState, useEffect } from 'react';
import './HomePromo.css';

export default function HomePromo() {
  const [promo, setPromo] = useState(null);

  useEffect(() => {
    fetch('/api/home-promo')
      .then(r => r.json())
      .then(setPromo)
      .catch(() => {});
  }, []);

  if (!promo) return null;

  const wrapLink = (url, child) =>
    url ? <a href={url} className="hp-link">{child}</a> : child;

  return (
    <div className="hp-root">
      {promo.title && (
        <>
          <p className="hp-title-sub">Promotion</p>
          <h2 className="hp-title">{promo.title}</h2>
        </>
      )}

      {promo.heroFile && (
        <div className="hp-hero">
          {wrapLink(promo.heroUrl,
            <img src={`/api/images/home-promo-pic/${promo.heroFile}`} alt="主視覺" className="hp-img" />
          )}
        </div>
      )}

      {(promo.leftLabel || promo.rightLabel) && (
        <div className="hp-labels">
          <span className="hp-label">{promo.leftLabel}</span>
          <span className="hp-label">{promo.rightLabel}</span>
        </div>
      )}

      {promo.cards?.some(c => c.file) && (
        <div className="hp-grid">
          {promo.cards.map(card =>
            card.file ? (
              <div key={card.slot} className="hp-card">
                {wrapLink(card.url,
                  <img src={`/api/images/home-promo-pic/${card.file}`} alt={`圖卡${card.slot}`} className="hp-img" />
                )}
              </div>
            ) : null
          )}
        </div>
      )}
    </div>
  );
}
