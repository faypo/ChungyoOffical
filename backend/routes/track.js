const express = require('express');
const { readJSON, writeJSON } = require('../utils/json');

const router = express.Router();
const FILE   = 'tracking.json';

const VALID_PAGES = ['home', 'floor', 'food', 'service', 'activity', 'winners', 'feedback'];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function ensureDefaults(data) {
  if (!data.home)     data.home     = { total: 0, daily: {} };
  if (!data.floor)    data.floor    = { total: 0, daily: {} };
  if (!data.food)     data.food     = { total: 0, daily: {} };
  if (!data.service)  data.service  = { total: 0, daily: {} };
  if (!data.winners)  data.winners  = { total: 0, daily: {} };
  if (!data.feedback) data.feedback = { total: 0, daily: {} };
  if (!data.activity) data.activity = { total: 0, daily: {}, pages: {} };
  return data;
}

/* POST /api/track */
router.post('/track', (req, res) => {
  const { page, activityId, activityTitle } = req.body;
  if (!VALID_PAGES.includes(page)) return res.status(400).json({ error: 'invalid page' });

  const data = ensureDefaults(readJSON(FILE, {}));
  const date = today();

  if (page === 'activity') {
    if (!activityId) return res.status(400).json({ error: 'activityId required' });
    if (!data.activity.pages[activityId]) {
      data.activity.pages[activityId] = { title: activityTitle || activityId, total: 0, daily: {} };
    }
    data.activity.pages[activityId].total++;
    data.activity.pages[activityId].daily[date] = (data.activity.pages[activityId].daily[date] || 0) + 1;
    if (activityTitle) data.activity.pages[activityId].title = activityTitle;
    data.activity.total++;
    data.activity.daily[date] = (data.activity.daily[date] || 0) + 1;
  } else {
    data[page].total++;
    data[page].daily[date] = (data[page].daily[date] || 0) + 1;
  }

  writeJSON(FILE, data);
  res.json({ success: true });
});

/* GET /api/stats — 後台完整資料 */
router.get('/stats', (req, res) => {
  const data = ensureDefaults(readJSON(FILE, {}));
  res.json(data);
});

/* GET /api/stats/summary — Footer 用首頁總數 */
router.get('/stats/summary', (req, res) => {
  const data = ensureDefaults(readJSON(FILE, {}));
  res.json({ homeTotal: data.home.total });
});

module.exports = router;
