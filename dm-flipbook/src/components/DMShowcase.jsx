import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchCatalog } from '../data/catalog';
import './DMShowcase.css';

export default function DMShowcase() {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    fetchCatalog()
      .then(data => {
        const sorted = [...data].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setCatalog(sorted);
        setLoading(false);
      })
      .catch(err  => { setError(err.message); setLoading(false); });
  }, []);

  if (loading) return <div className="page-status">載入中…</div>;
  if (error)   return <div className="page-status page-error">載入失敗：{error}</div>;

  return (
    <div className="showcase-wrapper">
      <div className="showcase-grid">
        {catalog.map((dm) => {
          const coverSrc = `/dm-pic/${dm.id}/cover.jpg`;
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
                    backgroundImage: `url(${coverSrc})`,
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
