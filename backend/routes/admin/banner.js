const express = require('express');
const multer  = require('multer');
const fs      = require('fs');
const path    = require('path');
const { DATA_DIR, readJSON, writeJSON } = require('../../utils/json');

const router     = express.Router();
const FILE       = 'banners.json';
const BANNER_DIR = path.join(DATA_DIR, 'banner-pic');
const IMAGE_EXT  = /\.(jpg|jpeg|png|webp|gif)$/i;

fs.mkdirSync(BANNER_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, BANNER_DIR),
    filename:    (_req,  file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}${ext}`);
    },
  }),
  fileFilter: (_req, file, cb) => cb(null, IMAGE_EXT.test(file.originalname)),
});

/* GET /api/admin/banner */
router.get('/', (_req, res) => res.json(readJSON(FILE, { banners: [] })));

/* POST /api/admin/banner — 根路由無檔案直接拒絕 */
router.post('/', (_req, res) => res.status(400).json({ error: 'file 為必填，請使用 /upload' }));

/* POST /api/admin/banner/upload */
router.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '無效的圖片' });
  const data = readJSON(FILE, { banners: [] });
  const id   = `banner-${Date.now()}`;
  data.banners.push({ id, file: req.file.filename, url: '' });
  writeJSON(FILE, data);
  res.json({ success: true, id, file: req.file.filename });
});

/* PUT /api/admin/banner/reorder  — 必須在 /:id 之前 */
router.put('/reorder', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: '無效的排序' });
  const data = readJSON(FILE, { banners: [] });
  const map  = Object.fromEntries(data.banners.map(b => [b.id, b]));
  data.banners = ids.map(id => map[id]).filter(Boolean);
  writeJSON(FILE, data);
  res.json({ success: true });
});

/* PUT /api/admin/banner/:id */
router.put('/:id', (req, res) => {
  const data = readJSON(FILE, { banners: [] });
  const idx  = data.banners.findIndex(b => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '找不到此 Banner' });
  const { url, startDate, endDate } = req.body;
  if (url       !== undefined) data.banners[idx].url       = url;
  if (startDate !== undefined) data.banners[idx].startDate = startDate;
  if (endDate   !== undefined) data.banners[idx].endDate   = endDate;
  writeJSON(FILE, data);
  res.json({ success: true });
});

/* DELETE /api/admin/banner/:id */
router.delete('/:id', (req, res) => {
  const data = readJSON(FILE, { banners: [] });
  const idx  = data.banners.findIndex(b => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '找不到此 Banner' });
  const { file } = data.banners[idx];
  data.banners.splice(idx, 1);
  writeJSON(FILE, data);
  const filePath = path.join(BANNER_DIR, file);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  res.json({ success: true });
});

module.exports = router;
