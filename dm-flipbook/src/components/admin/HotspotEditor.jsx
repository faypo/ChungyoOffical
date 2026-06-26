import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Rnd } from 'react-rnd';
import './HotspotEditor.css';

const genId = () => crypto.randomUUID();

function overlaps(a, b) {
  return (
    a.x < b.x + b.width  &&
    a.x + a.width  > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export default function HotspotEditor({ dmId, imgSrc: imgSrcProp, initialHotspots = [], onSave, onCancel }) {
  const [imgSrc, setImgSrc]         = useState(imgSrcProp ?? null);
  const [hotspots, setHotspots]     = useState(
    () => initialHotspots.map(s => ({ ...s, id: s.id || genId() }))
  );
  const [selectedId, setSelectedId] = useState(null);
  const [mode, setMode]             = useState('select'); // 'select' | 'draw'
  const [drawing, setDrawing]       = useState(null);
  const [canvasSize, setCanvasSize] = useState({ width: 1, height: 1 });
  const [collisionIds, setCollisionIds] = useState(new Set());

  const canvasRef  = useRef();
  const drawingRef = useRef(null);

  /* ── 載入圖片（只在沒有外部 imgSrc 時才 fetch DM 圖片）── */
  useEffect(() => {
    if (imgSrcProp || !dmId) return;
    fetch(`/api/dm/${dmId}/pages`)
      .then(r => r.json())
      .then(files => {
        if (files[0]) setImgSrc(`/api/images/dm-pic/${dmId}/${files[0]}`);
      })
      .catch(() => {});
  }, [dmId, imgSrcProp]);

  /* ── 追蹤 canvas 尺寸 ── */
  const updateSize = useCallback(() => {
    if (!canvasRef.current) return;
    setCanvasSize({
      width:  canvasRef.current.offsetWidth,
      height: canvasRef.current.offsetHeight,
    });
  }, []);

  useEffect(() => {
    const obs = new ResizeObserver(updateSize);
    if (canvasRef.current) obs.observe(canvasRef.current);
    return () => obs.disconnect();
  }, [updateSize]);

  /* ── 座標換算 ── */
  const pctToPx = (spot) => ({
    x:      (spot.x      / 100) * canvasSize.width,
    y:      (spot.y      / 100) * canvasSize.height,
    width:  (spot.width  / 100) * canvasSize.width,
    height: (spot.height / 100) * canvasSize.height,
  });

  const pxToPct = (x, y, w, h) => ({
    x:      (x / canvasSize.width)  * 100,
    y:      (y / canvasSize.height) * 100,
    width:  (w / canvasSize.width)  * 100,
    height: (h / canvasSize.height) * 100,
  });

  /* ── 碰撞檢查 ── */
  const checkCollisions = useCallback((spots) => {
    const ids = new Set();
    for (let i = 0; i < spots.length; i++) {
      for (let j = i + 1; j < spots.length; j++) {
        if (overlaps(spots[i], spots[j])) {
          ids.add(spots[i].id);
          ids.add(spots[j].id);
        }
      }
    }
    setCollisionIds(ids);
    return ids;
  }, []);

  /* ── 更新 hotspot ── */
  const updateHotspot = useCallback((id, changes) => {
    setHotspots(prev => {
      const next = prev.map(s => s.id === id ? { ...s, ...changes } : s);
      checkCollisions(next);
      return next;
    });
  }, [checkCollisions]);

  const deleteHotspot = (id) => {
    setHotspots(prev => {
      const next = prev.filter(s => s.id !== id);
      checkCollisions(next);
      return next;
    });
    if (selectedId === id) setSelectedId(null);
  };

  /* ── 繪製新熱區的滑鼠事件 ── */
  const getCanvasPos = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(canvasSize.width,  e.clientX - rect.left)),
      y: Math.max(0, Math.min(canvasSize.height, e.clientY - rect.top)),
    };
  }, [canvasSize]);

  const handleMouseDown = useCallback((e) => {
    if (mode !== 'draw') return;
    e.preventDefault();
    const pos = getCanvasPos(e);
    const d = { startX: pos.x, startY: pos.y, x: pos.x, y: pos.y, w: 0, h: 0 };
    setDrawing(d);
    drawingRef.current = d;
  }, [mode, getCanvasPos]);

  useEffect(() => {
    const onMove = (e) => {
      if (!drawingRef.current) return;
      const d = drawingRef.current;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cx = Math.max(0, Math.min(canvasSize.width,  e.clientX - rect.left));
      const cy = Math.max(0, Math.min(canvasSize.height, e.clientY - rect.top));
      const updated = {
        ...d,
        x: Math.min(d.startX, cx),
        y: Math.min(d.startY, cy),
        w: Math.abs(cx - d.startX),
        h: Math.abs(cy - d.startY),
      };
      drawingRef.current = updated;
      setDrawing({ ...updated });
    };

    const onUp = () => {
      if (!drawingRef.current) return;
      const d = drawingRef.current;
      drawingRef.current = null;
      if (d.w > 15 && d.h > 15) {
        const pct = pxToPct(d.x, d.y, d.w, d.h);
        const newSpot = { id: genId(), url: '', ...pct };
        setHotspots(prev => {
          const next = [...prev, newSpot];
          checkCollisions(next);
          return next;
        });
        setSelectedId(newSpot.id);
        setMode('select');
      }
      setDrawing(null);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, [canvasSize, checkCollisions]);

  /* ── 儲存 ── */
  const handleSave = () => {
    if (collisionIds.size > 0) {
      alert('請先解決熱區重疊的問題再儲存');
      return;
    }
    onSave(hotspots.map(({ id, x, y, width, height, url }) => ({ id, x, y, width, height, url })));
  };

  const selected = hotspots.find(s => s.id === selectedId);

  return (
    <div className="hs-editor">
      {/* 工具列 */}
      <div className="hs-toolbar">
        <button
          className={`btn btn-sm ${mode === 'select' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setMode('select')}
        >選取／移動</button>
        <button
          className={`btn btn-sm ${mode === 'draw' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setMode('draw')}
        >＋ 新增熱區</button>
        {selectedId && (
          <button className="btn btn-sm btn-danger" onClick={() => deleteHotspot(selectedId)}>
            刪除
          </button>
        )}
        {collisionIds.size > 0 && (
          <span className="hs-warn">⚠ 有熱區重疊，請調整後再儲存</span>
        )}
      </div>

      {/* 選中熱區的 URL 輸入（永遠佔位，避免出現時推擠 canvas） */}
      <div className="hs-url-row">
        <span className="hs-url-label">連結 URL</span>
        <input
          className="hs-url-input"
          value={selected?.url ?? ''}
          onChange={e => selected && updateHotspot(selected.id, { url: e.target.value })}
          placeholder={selected ? 'https://...' : '請先選取熱區'}
          disabled={!selected}
        />
      </div>

      {/* 提示文字 */}
      <p className="hs-hint">
        {mode === 'draw'
          ? '在圖片上拖曳以框選熱區範圍'
          : '點選熱區後可拖移位置或拉動邊框調整大小'}
      </p>

      {/* 畫布 */}
      <div className="hs-canvas-wrapper">
        <div
          ref={canvasRef}
          className="hs-canvas"
          style={{ cursor: mode === 'draw' ? 'crosshair' : 'default' }}
          onMouseDown={handleMouseDown}
        >
          {imgSrc
            ? <img src={imgSrc} alt="strip" className="hs-img" onLoad={updateSize} draggable={false} />
            : <div className="hs-no-img">請先上傳圖片</div>
          }

          {hotspots.map(spot => {
            const px        = pctToPx(spot);
            const isSel     = spot.id === selectedId;
            const isCollide = collisionIds.has(spot.id);
            return (
              <Rnd
                key={spot.id}
                position={{ x: px.x, y: px.y }}
                size={{ width: px.width, height: px.height }}
                bounds="parent"
                minWidth={20}
                minHeight={20}
                disableDragging={mode === 'draw'}
                enableResizing={mode === 'select'}
                onMouseDown={(e) => {
                  if (mode === 'select') {
                    e.stopPropagation();
                    setSelectedId(spot.id);
                  }
                }}
                onDragStop={(_e, d) => {
                  updateHotspot(spot.id, pxToPct(d.x, d.y, px.width, px.height));
                }}
                onResizeStop={(_e, _dir, ref, _delta, pos) => {
                  updateHotspot(spot.id, pxToPct(pos.x, pos.y, ref.offsetWidth, ref.offsetHeight));
                }}
              >
                <div className={[
                  'hs-box',
                  isSel     ? 'hs-box--selected'  : '',
                  isCollide ? 'hs-box--collision' : '',
                ].filter(Boolean).join(' ')} />
              </Rnd>
            );
          })}

          {/* 繪製中的暫時矩形 */}
          {drawing && drawing.w > 2 && (
            <div
              className="hs-ghost"
              style={{
                position: 'absolute',
                left: drawing.x,
                top:  drawing.y,
                width:  drawing.w,
                height: drawing.h,
                pointerEvents: 'none',
              }}
            />
          )}
        </div>
      </div>

      <div className="dm-form-actions">
        <button className="btn btn-primary" onClick={handleSave}>儲存熱區</button>
        <button className="btn btn-ghost"   onClick={onCancel}>取消</button>
      </div>
    </div>
  );
}
