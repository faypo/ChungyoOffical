const express = require('express');
const { readJSON, writeJSON } = require('../../utils/json');

const router = express.Router();
const FILE   = 'winners.json';

router.get('/', (_req, res) => res.json(readJSON(FILE)));

/* ── POST add event ── */
router.post('/events', (req, res) => {
  const { title, subtitle1, subtitle2, columns } = req.body;
  if (!title) return res.status(400).json({ error: 'title 為必填' });
  const data = readJSON(FILE);
  data.events.push({
    id:        `ev-${Date.now()}`,
    title,
    subtitle1: subtitle1 ?? '',
    subtitle2: subtitle2 ?? '',
    columns:   Array.isArray(columns) ? columns : ['', '', '', '', ''],
    rows:      [],
  });
  writeJSON(FILE, data);
  res.json({ success: true });
});

/* ── PUT update event (atomic: title / columns / rows) ── */
router.put('/events/:id', (req, res) => {
  const data = readJSON(FILE);
  const idx  = data.events.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '找不到此活動' });
  data.events[idx] = { ...data.events[idx], ...req.body, id: req.params.id };
  writeJSON(FILE, data);
  res.json({ success: true });
});

/* ── DELETE event ── */
router.delete('/events/:id', (req, res) => {
  const data = readJSON(FILE);
  const idx  = data.events.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '找不到此活動' });
  data.events.splice(idx, 1);
  writeJSON(FILE, data);
  res.json({ success: true });
});

/* ── PUT reorder events ── */
router.put('/events', (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: '格式錯誤' });
  const data = readJSON(FILE);
  data.events = req.body;
  writeJSON(FILE, data);
  res.json({ success: true });
});

/* ── PUT /api/admin/winners/:id ── 直接以 event id 更新（需在 /events 之後避免衝突）*/
router.put('/:id', (req, res) => {
  const data = readJSON(FILE);
  const idx  = data.events.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '找不到此活動' });
  data.events[idx] = { ...data.events[idx], ...req.body, id: req.params.id };
  writeJSON(FILE, data);
  res.json({ success: true });
});

/* ── DELETE /api/admin/winners/:id ── 直接以 event id 刪除 */
router.delete('/:id', (req, res) => {
  const data = readJSON(FILE);
  const idx  = data.events.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '找不到此活動' });
  data.events.splice(idx, 1);
  writeJSON(FILE, data);
  res.json({ success: true });
});

module.exports = router;
