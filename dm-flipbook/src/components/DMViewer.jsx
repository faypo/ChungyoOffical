import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import FlipBook from './FlipBook';
import { fetchDMPages } from '../data/catalog';

export default function DMViewer() {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const [pages, setPages]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    setLoading(true);
    setPages([]);
    fetchDMPages(id)
      .then(data => { setPages(data); setLoading(false); })
      .catch(err  => { setError(err.message); setLoading(false); });
  }, [id]);

  if (loading) return <div className="page-status">載入中…</div>;
  if (error)   return <div className="page-status page-error">載入失敗：{error}</div>;

  return (
    <FlipBook
      pages={pages}
      onBack={() => navigate('/dm')}
    />
  );
}
