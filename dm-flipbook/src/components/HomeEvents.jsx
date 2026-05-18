import React, { useState, useEffect } from 'react';
import './HomeEvents.css';

export default function HomeEvents() {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    fetch('/api/home-events')
      .then(r => r.json())
      .then(d => setEvents(d.events ?? []))
      .catch(() => {});
  }, []);

  if (!events.length) return null;

  return (
    <section className="he-section">
      <h2 className="he-title">活動訊息</h2>
      <div className="he-grid">
        {events.map(e => {
          const img = (
            <img
              src={`/api/images/home-event-pic/${e.file}`}
              alt="活動"
              className="he-img"
            />
          );
          return (
            <div key={e.id} className="he-card">
              {e.url ? <a href={e.url} className="he-link">{img}</a> : img}
            </div>
          );
        })}
      </div>
    </section>
  );
}
