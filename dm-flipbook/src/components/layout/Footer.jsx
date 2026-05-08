import React from 'react';
import './Footer.css';

const SOCIAL = [
  { label: 'Facebook', href: 'https://www.facebook.com/chungyo.tw', icon: (
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
  )},
  { label: 'Instagram', href: 'https://www.instagram.com/chungyo_tw/', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
    </svg>
  )},
  { label: 'LINE', href: 'https://page.line.me/ruo8042s?oat_content=url&openQrModal=true', icon: (
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.365 9.863c.349 0 .63.285.63.63 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
  )},
  { label: 'YouTube', href: 'https://www.youtube.com/channel/UCFHa3vwuyLB5gnxHBdSyyqg', icon: (
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.7 15.5V8.5l6.3 3.5-6.3 3.5z"/></svg>
  )},
];

const LINKS = [
  { label: '企業入口', href: 'https://eip.chungyo.com.tw' },
  { label: '人才招募', href: 'https://reurl.cc/zDrrON' },
  { label: '招商專區', href: '#' },
];

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">

        {/* Brand */}
        <div className="footer-brand">
          <img src="/logo.png" alt="中友百貨" className="footer-logo" />
        </div>

        {/* Info */}
        <div className="footer-info">
          <p>地址：404335臺中市北區三民路三段161號</p>
          <p>營業時間：週日～週四 11:00～21:30　週五六、例假日前一日 11:00～22:00</p>
          <p>電話：04-22253456</p>
          <p>統一編號：28411026</p>
        </div>

        {/* Links */}
        <div className="footer-links">
          {LINKS.map(({ label, href }) => (
            <a key={label} href={href} className="footer-link">{label}</a>
          ))}
        </div>

        {/* Social */}
        <div className="footer-social">
          {SOCIAL.map(({ label, href, icon }) => (
            <a key={label} href={href} className="footer-social-btn" aria-label={label}>
              {icon}
            </a>
          ))}
        </div>

      </div>
    </footer>
  );
}
