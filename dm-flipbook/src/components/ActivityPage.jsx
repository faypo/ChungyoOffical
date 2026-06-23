import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
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
            aria-label="連結"
          />
        ) : null
      )}
    </div>
  );
}

export default function ActivityPage() {
  const { id } = useParams();
  const [activity, setActivity] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  useEffect(() => {
    fetch(`/api/activity/${id}`, { cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => { setActivity(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [id]);

  const touchStartX = useRef(null);
  const touchStartY = useRef(null);

  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx > 0) window.history.back();
    else        window.history.forward();
  };

  if (loading) return <div className="act-status">載入中…</div>;
  if (error)   return <div className="act-status">找不到此活動頁</div>;

  return (
    <div className="act-page" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="act-content">
        {(activity.content ?? []).map((item, i) => {
          if (item.type === 'image') {
            return (
              <ImageWithHotspots
                key={item.file ?? i}
                src={`/api/images/activity-pic/${id}/${item.file}`}
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
