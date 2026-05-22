import React, { useState, useEffect } from 'react';
import './PrivacyPolicy.css';

export default function PrivacyPolicy() {
  const [html, setHtml] = useState('');

  useEffect(() => {
    fetch('/api/privacy-policy')
      .then(r => r.ok ? r.text() : '')
      .then(setHtml)
      .catch(() => {});
  }, []);

  return (
    <div className="privacy-policy-page">
      <div
        className="privacy-policy-content"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
