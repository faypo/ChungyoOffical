import React from 'react';

export default function PageContent({ page, side }) {
  if (!page) return <div className="page-empty" />;

  return (
    <div
      className="page-inner"
      style={{
        backgroundImage: `url(${page.src})`,
        backgroundSize: '200% 100%',
        backgroundPosition: side === 'left' ? 'left center' : 'right center',
        backgroundRepeat: 'no-repeat',
      }}
    />
  );
}
