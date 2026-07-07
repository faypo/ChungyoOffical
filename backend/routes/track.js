const express = require('express');
const prisma  = require('../utils/db');

const router = express.Router();

const VALID_PAGES = ['home', 'floor', 'food', 'service', 'activity', 'winners', 'feedback'];

function todayDate() {
  return new Date(new Date().toISOString().slice(0, 10));
}

/* POST /api/track */
router.post('/track', async (req, res) => {
  const { page, activityId, activityTitle } = req.body;
  if (!VALID_PAGES.includes(page)) return res.status(400).json({ error: 'invalid page' });

  const date = todayDate();

  await prisma.page_views.upsert({
    where:  { page_date: { page, date } },
    update: { count: { increment: 1 } },
    create: { page, date, count: 1 },
  });

  if (page === 'activity') {
    if (!activityId) return res.status(400).json({ error: 'activityId required' });
    await prisma.activity_views.upsert({
      where:  { activity_id_date: { activity_id: activityId, date } },
      update: { count: { increment: 1 }, ...(activityTitle && { title: activityTitle }) },
      create: { activity_id: activityId, title: activityTitle || activityId, date, count: 1 },
    });
  }

  res.json({ success: true });
});

/* GET /api/stats */
router.get('/stats', async (_req, res) => {
  const [pageRows, actRows] = await Promise.all([
    prisma.page_views.findMany(),
    prisma.activity_views.findMany(),
  ]);

  const result = Object.fromEntries(
    VALID_PAGES.map(p => [p, { total: 0, daily: {} }])
  );
  result.activity.pages = {};

  for (const row of pageRows) {
    const dateStr = row.date.toISOString().slice(0, 10);
    const p = row.page;
    if (!result[p]) continue;
    result[p].total += row.count ?? 0;
    result[p].daily[dateStr] = (result[p].daily[dateStr] || 0) + (row.count ?? 0);
  }

  for (const row of actRows) {
    const dateStr = row.date.toISOString().slice(0, 10);
    const aId = row.activity_id;
    if (!result.activity.pages[aId]) {
      result.activity.pages[aId] = { title: row.title || aId, total: 0, daily: {} };
    }
    result.activity.pages[aId].total += row.count ?? 0;
    result.activity.pages[aId].daily[dateStr] = (result.activity.pages[aId].daily[dateStr] || 0) + (row.count ?? 0);
    if (row.title) result.activity.pages[aId].title = row.title;
  }

  res.json(result);
});

/* GET /api/stats/summary */
router.get('/stats/summary', async (_req, res) => {
  const rows = await prisma.page_views.findMany({ where: { page: 'home' } });
  const homeTotal = rows.reduce((sum, r) => sum + (r.count ?? 0), 0);
  res.json({ homeTotal });
});

module.exports = router;
