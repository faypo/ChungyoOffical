import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import FlipBook from './FlipBook';
import StripViewer from './StripViewer';
import { fetchDMPages, fetchDMMeta } from '../data/catalog';
import { useLayout } from '../context/LayoutContext';
import './DMViewer.css';

export default function DMViewer() {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const [searchParams] = useSearchParams();
  // ?page=N — 跟 DMManager 嵌入按鈕的「頁碼」同一套編號（拆頁後的攤平索引，封面=0）
  const pageParam  = searchParams.get('page');
  const initialPage = pageParam !== null && !Number.isNaN(Number(pageParam)) ? Number(pageParam) : undefined;
  const { setViewerMode } = useLayout();
  const [pages,   setPages]   = useState([]);
  const [meta,    setMeta]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    return () => setViewerMode(null);
  }, [setViewerMode]);

  useEffect(() => {
    setLoading(true);
    setPages([]);
    setMeta(null);
    Promise.all([fetchDMPages(id), fetchDMMeta(id)])
      .then(([pageData, metaData]) => {
        setPages(pageData);
        setMeta(metaData);
        setViewerMode(metaData?.type === 'strip' ? 'page' : 'full');
        setLoading(false);
      })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [id, setViewerMode]);

  if (loading) return <div className="page-status">載入中…</div>;
  if (error)   return <div className="page-status page-error">載入失敗：{error}</div>;

  if (meta?.type === 'strip') {
    return (
      <StripViewer
        pages={pages}
        hotspots={meta.hotspots ?? []}
        onBack={() => navigate(-1)}
      />
    );
  }

  return (
    <FlipBook
      pages={pages}
      type={meta?.type ?? 'double'}
      buttons={meta?.button ?? []}
      onBack={() => navigate(-1)}
      initialPage={initialPage}
    />
  );
}
