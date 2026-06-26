import React, { useState, useEffect } from 'react';
import './FloorGuideManager.css';
import './StatsManager.css';

const PAGE_LABELS = {
  home:     '首頁進入',
  floor:    '樓層導覽',
  food:     '美食導覽',
  service:  '貼心服務',
  winners:  '得獎名單',
  feedback: '意見回饋',
  activity: '活動頁（合計）',
};

function sortedDates(daily) {
  return Object.keys(daily || {}).sort((a, b) => b.localeCompare(a));
}

export default function StatsManager() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState('summary');  // 'summary' | 'activity'
  const [days, setDays]       = useState(14);

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <p className="fg-loading">載入中…</p>;
  if (!data)   return <p className="fg-loading">無法載入統計資料</p>;

  // 取最近 N 天的日期列表
  const recentDates = Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().slice(0, 10);
  });

  return (
    <div className="fg-manager">
      <div className="fg-manager-header">
        <h1 className="fg-manager-title">流量統計</h1>
      </div>

      {/* Tab */}
      <div className="stats-tabs">
        <button className={`stats-tab${tab === 'summary' ? ' active' : ''}`} onClick={() => setTab('summary')}>頁面總覽</button>
        <button className={`stats-tab${tab === 'activity' ? ' active' : ''}`} onClick={() => setTab('activity')}>活動頁明細</button>
      </div>

      {/* 天數選擇 */}
      <div className="stats-day-sel">
        顯示最近：
        {[7, 14, 30].map(n => (
          <button key={n} className={`stats-day-btn${days === n ? ' active' : ''}`} onClick={() => setDays(n)}>
            {n} 天
          </button>
        ))}
      </div>

      {tab === 'summary' && (
        <div className="fg-section">
          {/* 累計卡片 */}
          <div className="stats-cards">
            {Object.entries(PAGE_LABELS).map(([key, label]) => (
              <div key={key} className="stats-card">
                <div className="stats-card-label">{label}</div>
                <div className="stats-card-total">{(data[key]?.total ?? 0).toLocaleString()}</div>
                <div className="stats-card-today">
                  今日 +{(data[key]?.daily?.[new Date().toISOString().slice(0, 10)] ?? 0).toLocaleString()}
                </div>
              </div>
            ))}
          </div>

          {/* 每日趨勢表格 */}
          <div className="stats-table-wrap">
            <table className="fg-table stats-table">
              <thead>
                <tr>
                  <th>日期</th>
                  {Object.values(PAGE_LABELS).map(l => <th key={l}>{l}</th>)}
                </tr>
              </thead>
              <tbody>
                {recentDates.map(date => (
                  <tr key={date}>
                    <td>{date}</td>
                    {Object.keys(PAGE_LABELS).map(key => (
                      <td key={key} className="stats-num">
                        {data[key]?.daily?.[date] ?? 0}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'activity' && (
        <div className="fg-section">
          <div className="stats-table-wrap">
            <table className="fg-table stats-table">
              <thead>
                <tr>
                  <th>活動名稱</th>
                  <th>累計</th>
                  <th>今日</th>
                  {recentDates.map(d => <th key={d}>{d.slice(5)}</th>)}
                </tr>
              </thead>
              <tbody>
                {Object.entries(data.activity?.pages ?? {})
                  .sort((a, b) => b[1].total - a[1].total)
                  .map(([id, page]) => (
                    <tr key={id}>
                      <td>{page.title || id}</td>
                      <td className="stats-num">{page.total.toLocaleString()}</td>
                      <td className="stats-num">
                        {page.daily?.[new Date().toISOString().slice(0, 10)] ?? 0}
                      </td>
                      {recentDates.map(d => (
                        <td key={d} className="stats-num">{page.daily?.[d] ?? 0}</td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
