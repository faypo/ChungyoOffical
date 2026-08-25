'use strict';

const express = require('express');
const prisma  = require('../../utils/db');

const router = express.Router();
const THRESHOLD_KEY = 'aws_usage_monthly_budget_usd';

function currentMonthRange() {
  const now   = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
}

// GET /api/admin/aws-usage/stats?days=14 — 依大分類／日期／小時彙總的用量成本估算
router.get('/stats', async (req, res) => {
  const days = Math.min(90, Math.max(1, Number(req.query.days) || 14));
  const rangeStart = new Date();
  rangeStart.setDate(rangeStart.getDate() - (days - 1));
  rangeStart.setHours(0, 0, 0, 0);

  const rows = await prisma.$queryRaw`
    SELECT category,
           DATE_FORMAT(occurred_at, '%Y-%m-%d') AS day,
           HOUR(occurred_at) AS hour,
           SUM(cost_usd) AS cost,
           COUNT(*) AS calls
    FROM aws_usage_log
    WHERE occurred_at >= ${rangeStart}
    GROUP BY category, day, hour
    ORDER BY day ASC, hour ASC
  `;

  const byCategory = {};
  const byDate = {};
  let totalCostUsd = 0;

  for (const r of rows) {
    const cost = Number(r.cost) || 0;
    const hour = Number(r.hour);
    totalCostUsd += cost;
    byCategory[r.category] = (byCategory[r.category] || 0) + cost;

    if (!byDate[r.day]) byDate[r.day] = { totalCostUsd: 0, byCategory: {}, byHour: {} };
    byDate[r.day].totalCostUsd += cost;
    byDate[r.day].byCategory[r.category] = (byDate[r.day].byCategory[r.category] || 0) + cost;
    if (!byDate[r.day].byHour[hour]) byDate[r.day].byHour[hour] = {};
    byDate[r.day].byHour[hour][r.category] = (byDate[r.day].byHour[hour][r.category] || 0) + cost;
  }

  const { start: monthStart, end: monthEnd } = currentMonthRange();
  const monthAgg = await prisma.aws_usage_log.aggregate({
    _sum:  { cost_usd: true },
    where: { occurred_at: { gte: monthStart, lt: monthEnd } },
  });
  const currentMonthCostUsd = Number(monthAgg._sum.cost_usd || 0);

  const thresholdRow = await prisma.config.findUnique({ where: { key_name: THRESHOLD_KEY } });
  const monthlyBudgetUsd = thresholdRow?.value ? Number(thresholdRow.value) : null;

  res.json({
    categories: Object.keys(byCategory).sort(),
    totalCostUsd,
    byCategory,
    byDate,
    threshold: {
      monthlyBudgetUsd,
      currentMonthCostUsd,
      percent: monthlyBudgetUsd ? (currentMonthCostUsd / monthlyBudgetUsd) * 100 : null,
    },
  });
});

// GET /api/admin/aws-usage/threshold — 讀取每月預算水位（美金）
router.get('/threshold', async (_req, res) => {
  const row = await prisma.config.findUnique({ where: { key_name: THRESHOLD_KEY } });
  res.json({ monthlyBudgetUsd: row?.value ? Number(row.value) : null });
});

// PUT /api/admin/aws-usage/threshold — 設定每月預算水位（美金）
// 目前僅作為顯示用的門檻（超過會在後台顯示警示），尚未接自動關閉 AI 問答的邏輯。
// 未來若要做「超過水位自動關閉」，可以在這裡比對 currentMonthCostUsd 後呼叫
// 既有的 PUT /api/admin/faq/ai-config 把 faq_ai_enabled 關掉即可，不需要動架構。
router.put('/threshold', async (req, res) => {
  const raw = req.body?.monthlyBudgetUsd;
  const value = raw === null || raw === '' || raw === undefined ? '' : String(Number(raw));
  await prisma.config.upsert({
    where:  { key_name: THRESHOLD_KEY },
    update: { value },
    create: { key_name: THRESHOLD_KEY, value },
  });
  res.json({ ok: true });
});

module.exports = router;
