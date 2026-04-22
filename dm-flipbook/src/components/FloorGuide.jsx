import React, { useState, useEffect } from 'react';
import './FloorGuide.css';

const BUILDINGS = ['A', 'B', 'C'];

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia('(max-width: 700px)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 700px)');
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

export default function FloorGuide() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedBuilding, setSelectedBuilding] = useState('A');
  const [selectedFloor, setSelectedFloor] = useState(null);
  const [floorDrawerOpen, setFloorDrawerOpen] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    fetch('/floor-guide.json')
      .then(r => r.json())
      .then(d => {
        setData(d);
        if (d.floors?.length) setSelectedFloor(d.floors[0].id);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-status">載入中…</div>;
  if (!data)   return <div className="page-status page-error">資料載入失敗</div>;

  const counters = data.counters?.[selectedBuilding]?.[selectedFloor] ?? [];
  const currentFloorLabel = data.floors.find(f => f.id === selectedFloor)?.label ?? '';

  const handleFloorSelect = (id) => {
    setSelectedFloor(id);
    setFloorDrawerOpen(false);
  };

  return (
    <div className="floor-guide">
      {/* ── Mobile: floor drawer overlay ── */}
      {isMobile && (
        <>
          {floorDrawerOpen && (
            <div className="floor-drawer-backdrop" onClick={() => setFloorDrawerOpen(false)} />
          )}
          <div className={`floor-drawer${floorDrawerOpen ? ' open' : ''}`}>
            <div className="floor-drawer-header">
              <span>選擇樓層</span>
              <button className="floor-drawer-close" onClick={() => setFloorDrawerOpen(false)}>✕</button>
            </div>
            {data.floors.map(f => (
              <button
                key={f.id}
                className={`floor-list-item${selectedFloor === f.id ? ' active' : ''}`}
                onClick={() => handleFloorSelect(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── Desktop: left floor list ── */}
      {!isMobile && (
        <div className="floor-list">
          {data.floors.map(f => (
            <button
              key={f.id}
              className={`floor-list-item${selectedFloor === f.id ? ' active' : ''}`}
              onClick={() => setSelectedFloor(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Right: building tabs + content */}
      <div className="floor-right">
        {/* Content — rendered FIRST so tabs paint on top */}
        <div className="floor-content">
          {counters.length === 0 ? (
            <div className="floor-empty">此樓層暫無資料</div>
          ) : (
            <div className="floor-cards">
              {counters.map((c, i) => (
                <div key={i} className="floor-card">
                  <div className="floor-card-logo">
                    {c.logo ? (
                      <img src={c.logo} alt={c.name} />
                    ) : (
                      <div className="floor-card-logo-placeholder">
                        {c.name?.[0] ?? '?'}
                      </div>
                    )}
                  </div>
                  <div className="floor-card-info">
                    <div className="floor-card-name">{c.name}</div>
                    {c.phone && (
                      <a className="floor-card-phone" href={`tel:${c.phone.replace(/[^0-9+]/g, '')}`}>
                        {c.phone}
                      </a>
                    )}
                    {c.description && <div className="floor-card-desc">{c.description}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tab circles */}
        <div className="floor-tabs">
          {BUILDINGS.map(b => (
            <button
              key={b}
              className={`floor-tab-btn${selectedBuilding === b ? ' active' : ''}`}
              onClick={() => setSelectedBuilding(b)}
            >
              <span className="floor-tab-label">{b}棟</span>
            </button>
          ))}
        </div>

        {/* Mobile: floor menu button (top-right) */}
        {isMobile && (
          <button className="floor-menu-btn" onClick={() => setFloorDrawerOpen(true)}>
            <span className="floor-menu-btn-label">{currentFloorLabel || '樓層'}</span>
            <span className="floor-menu-btn-icon">☰</span>
          </button>
        )}
      </div>
    </div>
  );
}
