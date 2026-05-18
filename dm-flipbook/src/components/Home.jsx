import React, { useState, useEffect } from 'react';
import BannerCarousel from './BannerCarousel';
import HomeEvents from './HomeEvents';
import HomeBottom from './HomeBottom';
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
      <HomeEvents />
      <HomeBottom />
    </div>
  );
}
