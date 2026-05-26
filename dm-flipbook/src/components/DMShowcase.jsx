import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchCatalog } from '../data/catalog';
import './DMShowcase.css';

export default function DMShowcase() {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState([]);
  const [covers, setCovers]   = useState({});   // { [dmId]: url }
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    fetchCatalog()
      .then(data => {
        const sorted = [...data].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setCatalog(sorted);
        setLoading(false);

        /* 有 cover 欄位的直接用，其餘取第一張圖 */
        const initial = {};
        sorted.forEach(dm => {
          if (dm.cover) initial[dm.id] = `/api/images/dm-pic/${dm.id}/${dm.cover}`;
        });
        setCovers(initial);

        sorted.filter(dm => !dm.cover && dm.type !== 'url').forEach(dm => {
          fetch(`/api/dm/${dm.id}/pages`)
            .then(r => r.ok ? r.json() : [])
            .then(files => {
              if (files.length > 0) {
                setCovers(prev => ({
                  ...prev,
                  [dm.id]: `/api/images/dm-pic/${dm.id}/${files[0]}`,
                }));
              }
            })
            .catch(() => {});
        });
      })
      .catch(err => { setError(err.message); setLoading(false); });
  }, []);

  if (loading) return <div className="page-status">載入中…</div>;
  if (error)   return <div className="page-status page-error">載入失敗：{error}</div>;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const visibleDMs = catalog.filter(dm => {
    if (dm.startDate && today < new Date(dm.startDate)) return false;
    if (dm.endDate) {
      const end = new Date(dm.endDate);
      end.setHours(23, 59, 59, 999);
      if (today > end) return false;
    }
    return true;
  });

  return (
    <div className="showcase-wrapper">
      <div className="showcase-grid">
        {visibleDMs.map((dm) => {
          const coverSrc = covers[dm.id] ?? '';
          return (
            <button
              key={dm.id}
              className="showcase-card"
              onClick={() => {
                if (dm.type === 'url' && dm.url) {
                  window.location.href = dm.url;
                } else {
                  navigate(`/dm/${dm.id}`);
                }
              }}
              title={dm.title}
            >
              <div className="showcase-card-cover">
                <div
                  className="showcase-card-img"
                  style={{
                    backgroundImage: coverSrc ? `url(${coverSrc})` : 'none',
                    ...(dm.type === 'double'
                      ? { backgroundSize: '200% 100%', backgroundPosition: 'right center' }
                      : { backgroundSize: 'cover',    backgroundPosition: 'center top' }),
                  }}
                />
                <div className="showcase-card-overlay">
                  <span className="showcase-card-read">閱讀</span>
                </div>
              </div>
              <div className="showcase-card-info">
                <span className="showcase-card-name">{dm.title}</span>
                {dm.subtitle && (
                  <span className="showcase-card-sub">{dm.subtitle}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
