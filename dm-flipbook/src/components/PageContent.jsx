import React from 'react';
import './PageContent.css';

export default function PageContent({ page, side, pageType = 'double' }) {
  if (!page) return <div className="page-empty" />;

  const isSingle = pageType === 'single';
  return (
    <div
      className="page-inner"
      style={{
        backgroundImage: `url(${page.src})`,
        backgroundSize:    isSingle ? 'contain'   : '200% auto',
        backgroundPosition:isSingle ? 'center'    : (side === 'left' ? 'left center' : 'right center'),
        backgroundRepeat: 'no-repeat',
        backgroundColor:  '#fff',
      }}
    />
  );
}
