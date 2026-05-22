const express = require('express');
const multer  = require('multer');
const fs      = require('fs');
const path    = require('path');
const { DATA_DIR, readJSON, writeJSON } = require('../../utils/json');

const router = express.Router();
const FILE       = 'floor-guide.json';
const IMAGE_EXT  = /\.(jpg|jpeg|png|webp)$/i;

/* 只刪除透過管理介面上傳的 logo（路徑以 /api/images/floor-pic/ 開頭）*/
function deleteLogo(logoPath) {
  if (!logoPath || !logoPath.startsWith('/api/images/floor-pic/')) return;
  const filePath = path.join(DATA_DIR, logoPath.replace('/api/images/', ''));
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

/* logo：加時間戳避免衝突 */
const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(DATA_DIR, 'floor-pic');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const uploadLogo = multer({
  storage: logoStorage,
  fileFilter: (_req, file, cb) => cb(null, IMAGE_EXT.test(file.originalname)),
});

/* icon：保留原始檔名（跨樓層共用）*/
const iconStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(DATA_DIR, 'floor-pic', 'icon');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => cb(null, file.originalname),
});
const uploadIcon = multer({
  storage: iconStorage,
  fileFilter: (_req, file, cb) => cb(null, IMAGE_EXT.test(file.originalname)),
});

/* POST upload logo → returns { path } */
router.post('/logo', uploadLogo.single('logo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '未收到圖片' });
  res.json({ path: `/api/images/floor-pic/${req.file.filename}` });
});

/* GET icon library */
router.get('/icons', (_req, res) => {
  const dir = path.join(DATA_DIR, 'floor-pic', 'icon');
  if (!fs.existsSync(dir)) return res.json([]);
  res.json(fs.readdirSync(dir).filter(f => IMAGE_EXT.test(f)));
});

/* POST upload icon → returns { filename } */
router.post('/icon', uploadIcon.single('icon'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '未收到圖片' });
  res.json({ filename: req.file.filename });
});

/* DELETE icon — checks if any floor uses it first */
router.delete('/icon/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(DATA_DIR, 'floor-pic', 'icon', filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: '圖示不存在' });

  const data = readJSON(FILE);
  const usedBy = [];
  for (const building of Object.keys(data.floorInfo ?? {})) {
    for (const floor of Object.keys(data.floorInfo[building] ?? {})) {
      const icons = data.floorInfo[building][floor]?.icons ?? [];
      if (icons.includes(filename)) usedBy.push(`${building}棟 ${floor}`);
    }
  }
  if (usedBy.length) {
    return res.status(409).json({ error: '此圖示正在使用中', usedBy });
  }

  fs.unlinkSync(filePath);
  res.json({ success: true });
});

/* GET all */
router.get('/', (_req, res) => {
  res.json(readJSON(FILE));
});

/* PUT floor label */
router.put('/floors/:id', (req, res) => {
  const data = readJSON(FILE);
  const floor = data.floors.find(f => f.id === req.params.id);
  if (!floor) return res.status(404).json({ error: '找不到此樓層' });
  if (req.body.label !== undefined) floor.label = req.body.label;
  writeJSON(FILE, data);
  res.json({ success: true });
});

/* PUT floor info（title + icons）*/
router.put('/:building/:floor/info', (req, res) => {
  const { building, floor } = req.params;
  const data = readJSON(FILE);
  if (!data.floorInfo?.[building]) return res.status(404).json({ error: '找不到此棟' });
  data.floorInfo[building][floor] = {
    title: req.body.title ?? '',
    icons: Array.isArray(req.body.icons) ? req.body.icons : [],
  };
  writeJSON(FILE, data);
  res.json({ success: true });
});

/* PUT replace entire counter list（用於排序）*/
router.put('/:building/:floor/counters', (req, res) => {
  const { building, floor } = req.params;
  const data = readJSON(FILE);
  if (!data.counters?.[building]) return res.status(404).json({ error: '找不到此棟' });
  if (!Array.isArray(req.body)) return res.status(400).json({ error: '格式錯誤' });
  data.counters[building][floor] = req.body;
  writeJSON(FILE, data);
  res.json({ success: true });
});

/* POST add counter */
router.post('/:building/:floor/counters', (req, res) => {
  const { building, floor } = req.params;
  const data = readJSON(FILE);
  if (!data.counters?.[building]) return res.status(404).json({ error: '找不到此棟' });
  if (!Array.isArray(data.counters[building][floor])) data.counters[building][floor] = [];
  data.counters[building][floor].push({
    name:        req.body.name        ?? '',
    phone:       req.body.phone       ?? '',
    description: req.body.description ?? '',
    logo:        req.body.logo        ?? '',
  });
  writeJSON(FILE, data);
  res.json({ success: true });
});

/* PUT update counter */
router.put('/:building/:floor/counters/:idx', (req, res) => {
  const { building, floor } = req.params;
  const idx  = Number(req.params.idx);
  const data = readJSON(FILE);
  const list = data.counters?.[building]?.[floor];
  if (!list || idx < 0 || idx >= list.length) return res.status(404).json({ error: '找不到此品牌' });
  const oldLogo = list[idx].logo;
  const newLogo = req.body.logo ?? '';
  if (oldLogo !== newLogo) deleteLogo(oldLogo);
  list[idx] = {
    name:        req.body.name        ?? '',
    phone:       req.body.phone       ?? '',
    description: req.body.description ?? '',
    logo:        newLogo,
  };
  writeJSON(FILE, data);
  res.json({ success: true });
});

/* DELETE counter */
router.delete('/:building/:floor/counters/:idx', (req, res) => {
  const { building, floor } = req.params;
  const idx  = Number(req.params.idx);
  const data = readJSON(FILE);
  const list = data.counters?.[building]?.[floor];
  if (!list || idx < 0 || idx >= list.length) return res.status(404).json({ error: '找不到此品牌' });
  deleteLogo(list[idx].logo);
  list.splice(idx, 1);
  writeJSON(FILE, data);
  res.json({ success: true });
});

module.exports = router;
