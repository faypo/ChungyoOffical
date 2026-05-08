const express = require('express');
const multer  = require('multer');
const fs      = require('fs');
const path    = require('path');
const { DATA_DIR, readJSON, writeJSON } = require('../../utils/json');

const router = express.Router();

const IMAGE_EXT = /\.(jpg|jpeg|png|webp)$/i;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(DATA_DIR, 'dm-pic', req.params.id);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => cb(null, file.originalname),
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => cb(null, IMAGE_EXT.test(file.originalname)),
});

function rebuildIndex(dmId) {
  const dir = path.join(DATA_DIR, 'dm-pic', dmId);
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir)
    .filter(f => IMAGE_EXT.test(f))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(files, null, 2));
  return files;
}

/* ── GET /api/admin/catalog ── */
router.get('/', (_req, res) => {
  res.json(readJSON('catalog.json'));
});

/* ── POST /api/admin/catalog ── 新增 DM */
router.post('/', (req, res) => {
  const { id, title, subtitle, order, button } = req.body;
  if (!id || !title) return res.status(400).json({ error: 'id 與 title 為必填' });

  const catalog = readJSON('catalog.json');
  if (catalog.find(d => d.id === id)) return res.status(409).json({ error: 'ID 已存在' });

  catalog.push({
    id,
    order:    Number(order) || catalog.length + 1,
    title,
    subtitle: subtitle || '',
    button:   button   || [],
  });
  writeJSON('catalog.json', catalog);
  fs.mkdirSync(path.join(DATA_DIR, 'dm-pic', id), { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, 'dm-pic', id, 'index.json'), '[]');

  res.json({ success: true });
});

/* ── PUT /api/admin/catalog/:id ── 編輯 DM */
router.put('/:id', (req, res) => {
  const catalog = readJSON('catalog.json');
  const idx = catalog.findIndex(d => d.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '找不到此 DM' });

  catalog[idx] = { ...catalog[idx], ...req.body, id: req.params.id };
  writeJSON('catalog.json', catalog);
  res.json({ success: true });
});

/* ── DELETE /api/admin/catalog/:id ── 刪除 DM */
router.delete('/:id', (req, res) => {
  let catalog = readJSON('catalog.json');
  if (!catalog.find(d => d.id === req.params.id)) return res.status(404).json({ error: '找不到此 DM' });

  catalog = catalog.filter(d => d.id !== req.params.id);
  writeJSON('catalog.json', catalog);

  const dmDir = path.join(DATA_DIR, 'dm-pic', req.params.id);
  if (fs.existsSync(dmDir)) fs.rmSync(dmDir, { recursive: true });

  res.json({ success: true });
});

/* ── POST /api/admin/catalog/:id/upload ── 上傳圖片 */
router.post('/:id/upload', upload.array('images'), (req, res) => {
  const files = rebuildIndex(req.params.id);
  res.json({ success: true, files });
});

/* ── DELETE /api/admin/catalog/:id/images/:file ── 刪除單張圖片 */
router.delete('/:id/images/:file', (req, res) => {
  const filePath = path.join(DATA_DIR, 'dm-pic', req.params.id, req.params.file);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: '檔案不存在' });
  fs.unlinkSync(filePath);
  const files = rebuildIndex(req.params.id);
  res.json({ success: true, files });
});

module.exports = router;
