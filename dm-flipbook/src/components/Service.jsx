import React, { useState, useEffect } from 'react';
import './Service.css';

const TABS = [
  { key: 'service', label: '貼心服務' },
  { key: 'traffic', label: '交通資訊' },
  { key: 'parking', label: '停車資訊' },
  { key: 'gift',    label: '電子禮券' },
];

export default function Service() {
  const [active, setActive] = useState('service');
  const [images, setImages] = useState({});

  useEffect(() => {
    fetch('/api/service-images')
      .then(r => r.json())
      .then(data => setImages(data))
      .catch(() => {});
  }, []);

  const imgSrc = images[active];

  return (
    <div className="service-page">
      <div className="service-sidebar">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`service-tab${active === t.key ? ' active' : ''}`}
            onClick={() => setActive(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="service-content">
        {imgSrc ? (
          <img
            key={active}
            src={imgSrc}
            alt={TABS.find(t => t.key === active)?.label}
            className="service-img"
          />
        ) : (
          <div className="service-empty">
            <span className="service-empty-icon">🖼</span>
            <span>尚未上傳圖片</span>
          </div>
        )}
      </div>
    </div>
  );
}
