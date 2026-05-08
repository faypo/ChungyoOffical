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

        /* 取每個 DM 的第一張圖作為封面 */
        sorted.forEach(dm => {
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

  return (
    <div className="showcase-wrapper">
      <div className="showcase-grid">
        {catalog.map((dm) => {
          const coverSrc = covers[dm.id] ?? '';
          return (
            <button
              key={dm.id}
              className="showcase-card"
              onClick={() => navigate(`/dm/${dm.id}`)}
              title={dm.title}
            >
              <div className="showcase-card-cover">
                <div
                  className="showcase-card-img"
                  style={{
                    backgroundImage: coverSrc ? `url(${coverSrc})` : 'none',
                    backgroundSize: '200% 100%',
                    backgroundPosition: 'right center',
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
