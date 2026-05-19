const express = require('express');
const multer  = require('multer');
const fs      = require('fs');
const path    = require('path');
const { DATA_DIR, readJSON, writeJSON } = require('../../utils/json');

const router   = express.Router();
const FILE     = 'logos.json';
const LOGO_DIR = path.join(DATA_DIR, 'logo-pic');
const IMAGE_EXT = /\.(jpg|jpeg|png|webp|gif|svg)$/i;

fs.mkdirSync(LOGO_DIR, { recursive: true });

const defaultData = () => ({ groups: [] });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, LOGO_DIR),
    filename:    (_req,  file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}${ext}`);
    },
  }),
  fileFilter: (_req, file, cb) => cb(null, IMAGE_EXT.test(file.originalname)),
});

/* GET */
router.get('/', (_req, res) => res.json(readJSON(FILE, defaultData())));

/* POST /group — 新增組別 */
router.post('/group', (req, res) => {
  const data = readJSON(FILE, defaultData());
  const id   = `group-${Date.now()}`;
  data.groups.push({ id, logos: [] });
  writeJSON(FILE, data);
  res.json({ success: true, id });
});

/* PUT /group/reorder — 重新排列組別 */
router.put('/group/reorder', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: '無效' });
  const data = readJSON(FILE, defaultData());
  const map  = Object.fromEntries(data.groups.map(g => [g.id, g]));
  data.groups = ids.map(id => map[id]).filter(Boolean);
  writeJSON(FILE, data);
  res.json({ success: true });
});

/* DELETE /group/:gid */
router.delete('/group/:gid', (req, res) => {
  const data = readJSON(FILE, defaultData());
  const idx  = data.groups.findIndex(g => g.id === req.params.gid);
  if (idx === -1) return res.status(404).json({ error: '找不到組別' });
  const group = data.groups[idx];
  group.logos.forEach(l => {
    const p = path.join(LOGO_DIR, l.file);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  });
  data.groups.splice(idx, 1);
  writeJSON(FILE, data);
  res.json({ success: true });
});

/* POST /group/:gid/upload — 上傳 logo 至指定組別 */
router.post('/group/:gid/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '無效的圖片' });
  const data  = readJSON(FILE, defaultData());
  const group = data.groups.find(g => g.id === req.params.gid);
  if (!group) return res.status(404).json({ error: '找不到組別' });
  if (group.logos.length >= 6) return res.status(400).json({ error: '每組最多 6 張' });
  const id = `logo-${Date.now()}`;
  group.logos.push({ id, file: req.file.filename });
  writeJSON(FILE, data);
  res.json({ success: true, id, file: req.file.filename });
});

/* PUT /group/:gid/reorder — 組內排序 */
router.put('/group/:gid/reorder', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: '無效' });
  const data  = readJSON(FILE, defaultData());
  const group = data.groups.find(g => g.id === req.params.gid);
  if (!group) return res.status(404).json({ error: '找不到組別' });
  const map = Object.fromEntries(group.logos.map(l => [l.id, l]));
  group.logos = ids.map(id => map[id]).filter(Boolean);
  writeJSON(FILE, data);
  res.json({ success: true });
});

/* DELETE /group/:gid/:lid — 刪除單張 logo */
router.delete('/group/:gid/:lid', (req, res) => {
  const data  = readJSON(FILE, defaultData());
  const group = data.groups.find(g => g.id === req.params.gid);
  if (!group) return res.status(404).json({ error: '找不到組別' });
  const idx = group.logos.findIndex(l => l.id === req.params.lid);
  if (idx === -1) return res.status(404).json({ error: '找不到 Logo' });
  const { file } = group.logos[idx];
  group.logos.splice(idx, 1);
  writeJSON(FILE, data);
  const p = path.join(LOGO_DIR, file);
  if (fs.existsSync(p)) fs.unlinkSync(p);
  res.json({ success: true });
});

module.exports = router;
