import React, { useState, useEffect } from 'react';
import './ActivityPage.css';

function extractYouTubeId(input = '') {
  const m = input.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{11}$/.test(input.trim())) return input.trim();
  return null;
}

function ImageWithHotspots({ src, hotspots = [] }) {
  return (
    <div className="act-img-wrapper">
      <img src={src} alt="" className="act-image" />
      {hotspots.map(spot =>
        spot.url ? (
          <a
            key={spot.id}
            href={spot.url}
            className="act-hotspot"
            style={{
              left:   `${spot.x}%`,
              top:    `${spot.y}%`,
              width:  `${spot.width}%`,
              height: `${spot.height}%`,
            }}
            target="_blank"
            rel="noreferrer"
            aria-label="連結"
          />
        ) : null
      )}
    </div>
  );
}

export default function GalleryPage() {
  const [content, setContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    fetch('/api/gallery')
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => { setContent(d.content ?? []); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  if (loading) return <div className="act-status">載入中…</div>;
  if (error)   return <div className="act-status">無法載入藝廊內容</div>;

  return (
    <div className="act-page">
      <div className="act-content">
        {content.map((item, i) => {
          if (item.type === 'image') {
            return (
              <ImageWithHotspots
                key={item.file ?? i}
                src={`/api/images/gallery-pic/${item.file}`}
                hotspots={item.hotspots ?? []}
              />
            );
          }
          if (item.type === 'youtube') {
            const vid = extractYouTubeId(item.videoId);
            if (!vid) return null;
            return (
              <div key={item.videoId ?? i} className="act-youtube">
                <iframe
                  src={`https://www.youtube.com/embed/${vid}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title="YouTube"
                />
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}
