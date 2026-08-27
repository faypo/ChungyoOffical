import React, { useState, useEffect, useCallback } from 'react';
import './FloorGuideManager.css';
import './StatsManager.css';
import './AwsUsageManager.css';
import { apiFetch } from '../../utils/apiFetch';
import { useModulePermission } from '../../utils/useModulePermission';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function fmtUsd(n) {
  const v = Number(n) || 0;
  if (v === 0) return '$0';
  if (v < 0.01) return `$${v.toFixed(6)}`;
  return `$${v.toFixed(4)}`;
}

export default function AwsUsageManager() {
  const { canWrite } = useModulePermission('aws_usage');
  const [data,        setData]        = useState(null);
  const [loading,      setLoading]     = useState(true);
  const [days,         setDays]        = useState(14);
  const [selectedDate, setSelectedDate] = useState(null);
  const [budgetInput,  setBudgetInput]  = useState('');
  const [saving,       setSaving]       = useState(false);
  const [saveMsg,      setSaveMsg]      = useState('');

  const load = useCallback(() => {
    setLoading(true);
    apiFetch(`/api/admin/aws-usage/stats?days=${days}`)
      .then(r => r.json())
      .then(d => {
        setData(d);
        setBudgetInput(d?.threshold?.monthlyBudgetUsd ?? '');
        setLoading(false);
        const dates = Object.keys(d?.byDate ?? {}).sort((a, b) => b.localeCompare(a));
        setSelectedDate(prev => (prev && d.byDate[prev] ? prev : (dates[0] ?? null)));
      })
      .catch(() => setLoading(false));
  }, [days]);

  useEffect(() => { load(); }, [load]);

  async function handleSaveBudget() {
    setSaving(true);
    setSaveMsg('');
    try {
      const res = await apiFetch('/api/admin/aws-usage/threshold', {
        method: 'PUT',
        body: JSON.stringify({ monthlyBudgetUsd: budgetInput === '' ? null : Number(budgetInput) }),
      });
      if (!res.ok) throw new Error();
      setSaveMsg('已儲存');
      load();
    } catch {
      setSaveMsg('儲存失敗');
    }
    setSaving(false);
  }

  if (loading) return <p className="fg-loading">載入中…</p>;
  if (!data)   return <p className="fg-loading">無法載入用量統計，請確認已執行 migration 022</p>;

  const dates = Object.keys(data.byDate).sort((a, b) => b.localeCompare(a));
  const selected = selectedDate ? data.byDate[selectedDate] : null;
  const { threshold } = data;
  const percent = threshold.percent;
  const gaugeLevel = percent == null ? 'ok' : percent >= 100 ? 'over' : percent >= 80 ? 'warn' : 'ok';

  return (
    <div className="fg-manager">
      <div className="fg-manager-header">
        <h1 className="fg-manager-title">AWS 用量統計</h1>
      </div>

      {/* 水位（每月預算門檻）*/}
      <div className="fg-section">
        <div className="fg-section-header">
          <div className="fg-section-title">本月預算水位</div>
        </div>
        <div className="aws-usage-gauge-row">
          <div className="aws-usage-gauge">
            <div
              className={`aws-usage-gauge-fill aws-usage-gauge-fill--${gaugeLevel}`}
              style={{ width: `${Math.min(100, percent ?? 0)}%` }}
            />
          </div>
          <div className="aws-usage-gauge-label">
            {fmtUsd(threshold.currentMonthCostUsd)}
            {threshold.monthlyBudgetUsd != null && (
              <> / ${threshold.monthlyBudgetUsd.toFixed(2)}（{percent.toFixed(1)}%）</>
            )}
          </div>
        </div>
        {gaugeLevel === 'over' && (
          <div className="faq-hint faq-wordcloud-status--err">本月用量已超過設定的預算水位</div>
        )}
        {gaugeLevel === 'warn' && (
          <div className="faq-hint">本月用量已接近設定的預算水位</div>
        )}
        <div className="aws-usage-budget-form">
          <label>
            每月預算（美金）：
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="未設定"
              value={budgetInput}
              onChange={e => setBudgetInput(e.target.value)}
              disabled={!canWrite}
            />
          </label>
          <button className="fg-btn" onClick={handleSaveBudget} disabled={!canWrite || saving}>
            {saving ? '儲存中…' : '儲存'}
          </button>
          {saveMsg && <span className="faq-hint">{saveMsg}</span>}
        </div>
        <p className="faq-hint">
          金額為依 AWS 公開定價換算的估算值，非實際帳單金額。
        </p>
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

      {/* 大分類累計卡片 */}
      <div className="fg-section">
        <div className="stats-cards">
          <div className="stats-card">
            <div className="stats-card-label">期間總計</div>
            <div className="stats-card-total">{fmtUsd(data.totalCostUsd)}</div>
          </div>
          {data.categories.map(cat => (
            <div key={cat} className="stats-card">
              <div className="stats-card-label">{cat}</div>
              <div className="stats-card-total">{fmtUsd(data.byCategory[cat])}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 每日彙總（點列可展開下方的小時明細）*/}
      <div className="fg-section">
        <div className="fg-section-header">
          <div className="fg-section-title">每日彙總（點選查看小時明細）</div>
        </div>
        <div className="stats-table-wrap">
          <table className="fg-table stats-table">
            <thead>
              <tr>
                <th>日期</th>
                <th>總計</th>
                {data.categories.map(cat => <th key={cat}>{cat}</th>)}
              </tr>
            </thead>
            <tbody>
              {dates.length === 0 && (
                <tr><td colSpan={2 + data.categories.length}>此期間尚無用量紀錄</td></tr>
              )}
              {dates.map(date => (
                <tr
                  key={date}
                  className={date === selectedDate ? 'fg-tr-active' : ''}
                  onClick={() => setSelectedDate(date)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>{date}</td>
                  <td className="stats-num">{fmtUsd(data.byDate[date].totalCostUsd)}</td>
                  {data.categories.map(cat => (
                    <td key={cat} className="stats-num">{fmtUsd(data.byDate[date].byCategory[cat] ?? 0)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 選定日期的小時明細 */}
      {selected && (
        <div className="fg-section">
          <div className="fg-section-header">
            <div className="fg-section-title">{selectedDate} 小時明細</div>
          </div>
          <div className="stats-table-wrap">
            <table className="fg-table stats-table">
              <thead>
                <tr>
                  <th>分類</th>
                  {HOURS.map(h => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {data.categories.map(cat => (
                  <tr key={cat}>
                    <td>{cat}</td>
                    {HOURS.map(h => {
                      const v = selected.byHour[h]?.[cat];
                      return (
                        <td key={h} className="stats-num">
                          {v ? fmtUsd(v) : ''}
                        </td>
                      );
                    })}
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
