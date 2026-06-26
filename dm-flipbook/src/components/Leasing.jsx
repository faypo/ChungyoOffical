import React from 'react';
import './Leasing.css';

export default function Leasing() {
  return (
    <div className="leasing-page">
      <div className="leasing-content">
        <h1 className="leasing-title">招商專區</h1>
        <div className="leasing-divider" />
        <div className="leasing-info">
          <p><span className="leasing-label">聯絡電話</span>04-22253456　分機 324</p>
          <p>
            <span className="leasing-label">Email</span>
            <a href="mailto:c2200@chungyo.me" className="leasing-email">c2200@chungyo.me</a>
          </p>
        </div>
      </div>
    </div>
  );
}
