const express = require('express');
const multer  = require('multer');
const fs      = require('fs');
const path    = require('path');
const { DATA_DIR, readJSON, writeJSON } = require('../../utils/json');

const router   = express.Router();
const FILE     = 'food-guide.json';
const IMAGE_EXT = /\.(jpg|jpeg|png|webp)$/i;

function deleteImage(imgPath) {
  if (!imgPath || !imgPath.startsWith('/api/images/food-pic/')) return;
  const filePath = path.join(DATA_DIR, imgPath.replace('/api/images/', ''));
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

const imgStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(DATA_DIR, 'food-pic');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const uploadImg = multer({
  storage: imgStorage,
  fileFilter: (_req, file, cb) => cb(null, IMAGE_EXT.test(file.originalname)),
});

/* ── GET all ── */
router.get('/', (_req, res) => {
  res.json(readJSON(FILE));
});

/* ── POST upload image ── */
router.post('/image', uploadImg.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '未收到圖片' });
  res.json({ path: `/api/images/food-pic/${req.file.filename}` });
});

/* ── POST add category ── */
router.post('/categories', (req, res) => {
  const { id, label } = req.body;
  if (!id || !label) return res.status(400).json({ error: 'id 與 label 為必填' });
  const data = readJSON(FILE);
  if (data.categories.find(c => c.id === id)) return res.status(409).json({ error: 'ID 已存在' });
  data.categories.push({ id, label });
  data.restaurants[id] = { theme: [], foodcourt: [] };
  writeJSON(FILE, data);
  res.json({ success: true });
});

/* ── PUT rename category ── */
router.put('/categories/:id', (req, res) => {
  const data = readJSON(FILE);
  const cat = data.categories.find(c => c.id === req.params.id);
  if (!cat) return res.status(404).json({ error: '找不到此分類' });
  if (req.body.label) cat.label = req.body.label;
  writeJSON(FILE, data);
  res.json({ success: true });
});

/* ── DELETE category ── */
router.delete('/categories/:id', (req, res) => {
  const data = readJSON(FILE);
  const idx = data.categories.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '找不到此分類' });
  /* delete images */
  const rest = data.restaurants[req.params.id] ?? {};
  [...(rest.theme ?? []), ...(rest.foodcourt ?? [])].forEach(r => deleteImage(r.image));
  data.categories.splice(idx, 1);
  delete data.restaurants[req.params.id];
  writeJSON(FILE, data);
  res.json({ success: true });
});

/* ── PUT replace section (reorder) ── */
router.put('/:cat/:section', (req, res) => {
  const { cat, section } = req.params;
  if (!['theme', 'foodcourt'].includes(section)) return res.status(400).json({ error: '無效 section' });
  const data = readJSON(FILE);
  if (!data.restaurants[cat]) return res.status(404).json({ error: '找不到此分類' });
  if (!Array.isArray(req.body)) return res.status(400).json({ error: '格式錯誤' });
  data.restaurants[cat][section] = req.body;
  writeJSON(FILE, data);
  res.json({ success: true });
});

/* ── POST add restaurant ── */
router.post('/:cat/:section', (req, res) => {
  const { cat, section } = req.params;
  if (!['theme', 'foodcourt'].includes(section)) return res.status(400).json({ error: '無效 section' });
  const data = readJSON(FILE);
  if (!data.restaurants[cat]) return res.status(404).json({ error: '找不到此分類' });
  data.restaurants[cat][section].push({
    name:        req.body.name        ?? '',
    building:    req.body.building    ?? '',
    floor:       req.body.floor       ?? '',
    description: req.body.description ?? '',
    phone:       req.body.phone       ?? '',
    image:       req.body.image       ?? '',
  });
  writeJSON(FILE, data);
  res.json({ success: true });
});

/* ── PUT update restaurant ── */
router.put('/:cat/:section/:idx', (req, res) => {
  const { cat, section } = req.params;
  const idx = Number(req.params.idx);
  if (!['theme', 'foodcourt'].includes(section)) return res.status(400).json({ error: '無效 section' });
  const data = readJSON(FILE);
  const list = data.restaurants?.[cat]?.[section];
  if (!list || idx < 0 || idx >= list.length) return res.status(404).json({ error: '找不到此餐廳' });
  const oldImg = list[idx].image;
  const newImg = req.body.image ?? '';
  if (oldImg !== newImg) deleteImage(oldImg);
  list[idx] = {
    name:        req.body.name        ?? '',
    building:    req.body.building    ?? '',
    floor:       req.body.floor       ?? '',
    description: req.body.description ?? '',
    phone:       req.body.phone       ?? '',
    image:       newImg,
  };
  writeJSON(FILE, data);
  res.json({ success: true });
});

/* ── DELETE restaurant ── */
router.delete('/:cat/:section/:idx', (req, res) => {
  const { cat, section } = req.params;
  const idx = Number(req.params.idx);
  if (!['theme', 'foodcourt'].includes(section)) return res.status(400).json({ error: '無效 section' });
  const data = readJSON(FILE);
  const list = data.restaurants?.[cat]?.[section];
  if (!list || idx < 0 || idx >= list.length) return res.status(404).json({ error: '找不到此餐廳' });
  deleteImage(list[idx].image);
  list.splice(idx, 1);
  writeJSON(FILE, data);
  res.json({ success: true });
});

module.exports = router;
