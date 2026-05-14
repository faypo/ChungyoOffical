const express = require('express');
const multer  = require('multer');
const fs      = require('fs');
const path    = require('path');
const { DATA_DIR, readJSON, writeJSON } = require('../../utils/json');

const router = express.Router();
const FILE = 'activities.json';
const IMAGE_EXT = /\.(jpg|jpeg|png|webp)$/i;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(DATA_DIR, 'activity-pic', req.params.id);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => cb(null, file.originalname),
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => cb(null, IMAGE_EXT.test(file.originalname)),
});

/* GET /api/admin/activity */
router.get('/', (_req, res) => res.json(readJSON(FILE, { activities: [] })));

/* POST /api/admin/activity */
router.post('/', (req, res) => {
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: 'title 為必填' });
  const data = readJSON(FILE, { activities: [] });
  const id = `act-${Date.now()}`;
  data.activities.push({ id, title, content: [] });
  fs.mkdirSync(path.join(DATA_DIR, 'activity-pic', id), { recursive: true });
  writeJSON(FILE, data);
  res.json({ success: true, id });
});

/* PUT /api/admin/activity/:id */
router.put('/:id', (req, res) => {
  const data = readJSON(FILE, { activities: [] });
  const idx = data.activities.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '找不到此活動頁' });
  const { title, content } = req.body;
  if (title   !== undefined) data.activities[idx].title   = title;
  if (content !== undefined) data.activities[idx].content = content;
  writeJSON(FILE, data);
  res.json({ success: true });
});

/* DELETE /api/admin/activity/:id */
router.delete('/:id', (req, res) => {
  const data = readJSON(FILE, { activities: [] });
  const idx = data.activities.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '找不到此活動頁' });
  data.activities.splice(idx, 1);
  writeJSON(FILE, data);
  const dir = path.join(DATA_DIR, 'activity-pic', req.params.id);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
  res.json({ success: true });
});

/* POST /api/admin/activity/:id/upload */
router.post('/:id/upload', upload.array('images'), (req, res) => {
  const files = req.files?.map(f => f.filename) ?? [];
  res.json({ success: true, files });
});

/* DELETE /api/admin/activity/:id/image/:file */
router.delete('/:id/image/:file', (req, res) => {
  const filePath = path.join(DATA_DIR, 'activity-pic', req.params.id, req.params.file);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: '檔案不存在' });
  fs.unlinkSync(filePath);
  res.json({ success: true });
});

module.exports = router;
