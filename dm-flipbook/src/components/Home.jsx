import React, { useState, useEffect } from 'react';
import BannerCarousel from './BannerCarousel';
import './Home.css';

export default function Home() {
  const [banners, setBanners] = useState([]);

  useEffect(() => {
    fetch('/api/banners')
      .then(r => r.json())
      .then(d => setBanners(d.banners ?? []))
      .catch(() => {});
  }, []);

  return (
    <div className="home-page">
      <BannerCarousel banners={banners} />
      {/* 首頁其他區塊 */}
    </div>
  );
}
