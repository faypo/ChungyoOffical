import React, { useState, useEffect } from 'react';
import './Food.css';

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

function RestaurantCard({ restaurant }) {
  const imgSrc = restaurant.image
    ? (restaurant.image.startsWith('/') || restaurant.image.startsWith('http')
        ? restaurant.image
        : `/api/images/food-pic/${restaurant.image}`)
    : null;

  return (
    <div className="food-card">
      <div className="food-card-image">
        {imgSrc ? (
          <img src={imgSrc} alt={restaurant.name} />
        ) : (
          <div className="food-card-image-placeholder">
            {restaurant.name?.[0] ?? '?'}
          </div>
        )}
      </div>
      <div className="food-card-info">
        <div className="food-card-name">{restaurant.name}</div>
        <div className="food-card-location">
          {restaurant.building && <span className="food-card-tag">{restaurant.building}</span>}
          {restaurant.floor    && <span className="food-card-tag">{restaurant.floor}</span>}
        </div>
        {restaurant.description && (
          <div className="food-card-desc">{restaurant.description}</div>
        )}
        {restaurant.phone && (
          <a
            className="food-card-phone"
            href={`tel:${restaurant.phone.replace(/[^0-9+]/g, '')}`}
          >
            {restaurant.phone}
          </a>
        )}
      </div>
    </div>
  );
}

function Section({ title, restaurants }) {
  if (!restaurants?.length) return null;
  return (
    <div className="food-section">
      <div className="food-section-header">{title}</div>
      <div className="food-cards">
        {restaurants.map((r) => (
          <RestaurantCard key={r.name} restaurant={r} />
        ))}
      </div>
    </div>
  );
}

function MobileCategoryGrid({ categories, onSelect }) {
  return (
    <div className="food-mobile-category-grid">
      {categories.map(c => (
        <button
          key={c.id}
          className="food-mobile-category-btn"
          onClick={() => onSelect(c.id)}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

export default function Food() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    fetch('/api/food-guide')
      .then(r => r.json())
      .then(d => {
        setData(d);
        if (!isMobile && d.categories?.length) setSelectedCategory(d.categories[0].id);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [isMobile]);

  if (loading) return <div className="page-status">載入中…</div>;
  if (!data)   return <div className="page-status page-error">資料載入失敗</div>;

  const currentCategory = data.categories?.find(c => c.id === selectedCategory);
  const restaurants = data.restaurants?.[selectedCategory] ?? { theme: [], foodcourt: [] };
  const isEmpty = !restaurants.theme?.length && !restaurants.foodcourt?.length;

  /* ── Mobile: two-level navigation ── */
  if (isMobile) {
    if (!selectedCategory) {
      return (
        <div className="food-guide food-guide--mobile-list">
          <MobileCategoryGrid
            categories={data.categories}
            onSelect={setSelectedCategory}
          />
        </div>
      );
    }

    return (
      <div className="food-guide food-guide--mobile-detail">
        <div className="food-mobile-header food-mobile-header--detail">
          <button className="food-back-btn" onClick={() => setSelectedCategory(null)}>‹</button>
          <span>{currentCategory?.label}</span>
        </div>
        <div className="food-content food-content--mobile">
          {isEmpty ? (
            <div className="food-empty">此分類暫無資料</div>
          ) : (
            <>
              <Section title="主題餐廳" restaurants={restaurants.theme} />
              <Section title="美食街"   restaurants={restaurants.foodcourt} />
            </>
          )}
        </div>
      </div>
    );
  }

  /* ── Desktop: sidebar + content ── */
  return (
    <div className="food-guide">
      <div className="food-category-list">
        {data.categories.map(c => (
          <button
            key={c.id}
            className={`food-category-item${selectedCategory === c.id ? ' active' : ''}`}
            onClick={() => setSelectedCategory(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="food-right">
        <div className="food-content">
          {isEmpty ? (
            <div className="food-empty">此分類暫無資料</div>
          ) : (
            <>
              <Section title="主題餐廳" restaurants={restaurants.theme} />
              <Section title="美食街"   restaurants={restaurants.foodcourt} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
