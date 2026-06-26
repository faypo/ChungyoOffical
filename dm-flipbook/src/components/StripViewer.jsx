import React, { useState, useRef, useEffect, useCallback } from 'react';
import './StripViewer.css';

export default function StripViewer({ pages, hotspots = [], onBack }) {
  const src       = pages[0]?.src;
  const canvasRef = useRef();
  const [canvasPx, setCanvasPx] = useState(null); // { width, height } in pixels

  /* ── 追蹤 canvas 實際渲染尺寸 ── */
  const measure = useCallback(() => {
    if (!canvasRef.current) return;
    const { offsetWidth, offsetHeight } = canvasRef.current;
    if (offsetHeight > 0) setCanvasPx({ width: offsetWidth, height: offsetHeight });
  }, []);

  useEffect(() => {
    const obs = new ResizeObserver(measure);
    if (canvasRef.current) obs.observe(canvasRef.current);
    return () => obs.disconnect();
  }, [measure]);

  /* ── 百分比 → px（確保有最小可點擊高度）── */
  const spotStyle = (spot) => {
    if (!canvasPx) return { display: 'none' };
    return {
      left:   (spot.x      / 100) * canvasPx.width,
      top:    (spot.y      / 100) * canvasPx.height,
      width:  (spot.width  / 100) * canvasPx.width,
      height: Math.max(44, (spot.height / 100) * canvasPx.height),
    };
  };

  return (
    <div className="strip-viewer">
      <div className="strip-topbar">
        <button className="strip-back-btn" onClick={onBack}>← 返回</button>
      </div>
      <div className="strip-scroll">
        <div ref={canvasRef} className="strip-canvas">
          {src
            ? <img src={src} alt="DM" className="strip-image" onLoad={measure} />
            : <p className="strip-empty">尚無圖片</p>
          }
          {canvasPx && hotspots.map(spot =>
            spot.url ? (
              <div
                key={spot.id}
                className="strip-hotspot"
                style={spotStyle(spot)}
                onClick={() => { window.location.href = spot.url; }}
              />
            ) : null
          )}
        </div>
      </div>
    </div>
  );
}
