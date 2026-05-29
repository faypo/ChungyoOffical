import React, { useState, useEffect, useRef } from 'react';
import './FloorGuide.css';

const BUILDINGS = ['A', 'B', 'C'];

const BUILDING_COLORS = { A: '#3d3b39', B: '#3d3b39', C: '#3d3b39' };
const BUILDING_BG     = { A: '#f2efeb', B: '#f2efeb', C: '#f2efeb' };

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
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);

  useEffect(() => {
    fetch('/api/floor-guide')
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

  const counters  = data.counters?.[selectedBuilding]?.[selectedFloor] ?? [];
  const floorInfo = data.floorInfo?.[selectedBuilding]?.[selectedFloor] ?? null;
  const currentFloorLabel = data.floors.find(f => f.id === selectedFloor)?.label ?? '';

  const handleFloorSelect = (id) => {
    setSelectedFloor(id);
    setFloorDrawerOpen(false);
  };

  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    // Only trigger if mostly horizontal swipe and enough distance
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      const idx = BUILDINGS.indexOf(selectedBuilding);
      if (dx < 0 && idx < BUILDINGS.length - 1) setSelectedBuilding(BUILDINGS[idx + 1]);
      if (dx > 0 && idx > 0) setSelectedBuilding(BUILDINGS[idx - 1]);
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  return (
    <div className="floor-guide" style={{ '--bc': BUILDING_COLORS[selectedBuilding], '--bc-bg': BUILDING_BG[selectedBuilding] }}>
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
        <div className="floor-content" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {/* 樓層大介紹區塊 */}
          {floorInfo && (floorInfo.title || floorInfo.icons?.length > 0) && (
            <div className="floor-intro">
              {floorInfo.title && (
                <div className="floor-intro-title">{floorInfo.title}</div>
              )}
              {floorInfo.icons?.length > 0 && (
                <div className="floor-intro-icons">
                  {floorInfo.icons.map((icon) => (
                    <img key={icon} className="floor-intro-icon" src={`/api/images/floor-pic/icon/${icon}`} alt={icon} />
                  ))}
                </div>
              )}
            </div>
          )}

          {counters.length === 0 ? (
            <div className="floor-empty">此樓層暫無資料</div>
          ) : (
            <div className="floor-cards">
              {counters.map((c, i) => (
                <div key={c.name || i} className="floor-card">
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
              <span className="floor-tab-bg" />
              <span className="floor-tab-label">
                <span className="floor-tab-letter">{b}</span>
                <span className="floor-tab-suffix">棟</span>
              </span>
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
