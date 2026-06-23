const express = require('express');
const multer  = require('multer');
const fs      = require('fs');
const path    = require('path');
const { DATA_DIR, readJSON, writeJSON } = require('../../utils/json');

const router    = express.Router();
const FILE      = 'home-events.json';
const EVENT_DIR = path.join(DATA_DIR, 'home-event-pic');
const IMAGE_EXT = /\.(jpg|jpeg|png|webp|gif)$/i;

fs.mkdirSync(EVENT_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, EVENT_DIR),
    filename:    (_req,  file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}${ext}`);
    },
  }),
  fileFilter: (_req, file, cb) => cb(null, IMAGE_EXT.test(file.originalname)),
});

/* GET /api/admin/home-event */
router.get('/', (_req, res) => res.json(readJSON(FILE, { events: [] })));

/* POST /api/admin/home-event/upload */
router.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '無效的圖片' });
  const data = readJSON(FILE, { events: [] });
  const id   = `event-${Date.now()}`;
  data.events.push({ id, file: req.file.filename, url: '', startDate: '', endDate: '' });
  writeJSON(FILE, data);
  res.json({ success: true, id, file: req.file.filename });
});

/* PUT /api/admin/home-event/reorder  — 必須在 /:id 之前 */
router.put('/reorder', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: '無效的排序' });
  const data = readJSON(FILE, { events: [] });
  const map  = Object.fromEntries(data.events.map(e => [e.id, e]));
  data.events = ids.map(id => map[id]).filter(Boolean);
  writeJSON(FILE, data);
  res.json({ success: true });
});

/* PUT /api/admin/home-event/:id */
router.put('/:id', (req, res) => {
  const data = readJSON(FILE, { events: [] });
  const idx  = data.events.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '找不到此活動卡片' });
  const { url, startDate, endDate } = req.body;
  if (url       !== undefined) data.events[idx].url       = url;
  if (startDate !== undefined) data.events[idx].startDate = startDate;
  if (endDate   !== undefined) data.events[idx].endDate   = endDate;
  writeJSON(FILE, data);
  res.json({ success: true });
});

/* POST /api/admin/home-event/:id/replace */
const uploadReplace = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, EVENT_DIR),
    filename:    (_req,  file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}${ext}`);
    },
  }),
  fileFilter: (_req, file, cb) => cb(null, IMAGE_EXT.test(file.originalname)),
});

router.post('/:id/replace', uploadReplace.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '無效的圖片' });
  const data = readJSON(FILE, { events: [] });
  const idx  = data.events.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '找不到此活動卡片' });
  const oldFile = data.events[idx].file;
  data.events[idx].file = req.file.filename;
  writeJSON(FILE, data);
  const oldPath = path.join(EVENT_DIR, oldFile);
  if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  res.json({ success: true, file: req.file.filename });
});

/* DELETE /api/admin/home-event/:id */
router.delete('/:id', (req, res) => {
  const data = readJSON(FILE, { events: [] });
  const idx  = data.events.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '找不到此活動卡片' });
  const { file } = data.events[idx];
  data.events.splice(idx, 1);
  writeJSON(FILE, data);
  const filePath = path.join(EVENT_DIR, file);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  res.json({ success: true });
});

module.exports = router;
