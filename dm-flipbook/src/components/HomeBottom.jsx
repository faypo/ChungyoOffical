import React, { useState, useEffect } from 'react';
import HomePromo from './HomePromo';
import './HomeBottom.css';

export default function HomeBottom() {
  const [fbSrc, setFbSrc] = useState('');

  useEffect(() => {
    fetch('/api/home-fb')
      .then(r => r.json())
      .then(d => setFbSrc(d.src ?? ''))
      .catch(() => {});
  }, []);

  return (
    <section className="hb-section">
      <div className="hb-columns">

        <div className="hb-left">
          <HomePromo />
        </div>

        {fbSrc && (
          <div className="hb-right">
            <h2 className="hb-col-title">社群活動</h2>
            <div className="hb-fb-wrap">
              <iframe
                src={fbSrc}
                style={{ border: 'none', overflow: 'hidden' }}
                scrolling="no"
                frameBorder="0"
                allowFullScreen
                allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                title="Facebook"
              />
            </div>
          </div>
        )}

      </div>
    </section>
  );
}
