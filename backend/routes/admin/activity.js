const express = require('express');
const multer  = require('multer');
const fs      = require('fs');
const path    = require('path');
const { DATA_DIR, readJSON, writeJSON } = require('../../utils/json');

const router = express.Router();
const FILE = 'activities.json';
const IMAGE_EXT = /\.(jpg|jpeg|png|webp)$/i;

const safeName = (p) => path.basename(p ?? '');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const id = safeName(req.params.id);
    if (!id || id !== req.params.id) return cb(new Error('無效的 ID'));
    const dir = path.join(DATA_DIR, 'activity-pic', id);
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
  const { title, tags } = req.body;
  if (!title) return res.status(400).json({ error: 'title 為必填' });
  const data = readJSON(FILE, { activities: [] });
  const id = `act-${Date.now()}`;
  data.activities.push({ id, title, content: [], tags: Array.isArray(tags) ? tags : [] });
  fs.mkdirSync(path.join(DATA_DIR, 'activity-pic', id), { recursive: true });
  writeJSON(FILE, data);
  res.json({ success: true, id });
});

/* PUT /api/admin/activity/:id */
router.put('/:id', (req, res) => {
  const data = readJSON(FILE, { activities: [] });
  const idx = data.activities.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '找不到此活動頁' });
  const { title, content, ogTitle, ogDescription, ogImage, tags } = req.body;
  if (title         !== undefined) data.activities[idx].title         = title;
  if (content       !== undefined) data.activities[idx].content       = content;
  if (ogTitle       !== undefined) data.activities[idx].ogTitle       = ogTitle;
  if (ogDescription !== undefined) data.activities[idx].ogDescription = ogDescription;
  if (ogImage       !== undefined) data.activities[idx].ogImage       = ogImage;
  if (tags          !== undefined) data.activities[idx].tags          = tags;
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
  const dir = path.join(DATA_DIR, 'activity-pic', safeName(req.params.id));
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
  res.json({ success: true });
});

/* POST /api/admin/activity/:id/upload */
router.post('/:id/upload', upload.array('images'), (req, res) => {
  const files = req.files?.map(f => f.filename) ?? [];
  res.json({ success: true, files });
});

/* POST /api/admin/activity/:id/upload-og */
const uploadOg = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const id = safeName(req.params.id);
      if (!id || id !== req.params.id) return cb(new Error('無效的 ID'));
      const dir = path.join(DATA_DIR, 'activity-pic', id);
      fs.mkdirSync(dir, { recursive: true });
      // 刪除舊的 _og-image.* 避免不同副檔名的殘檔
      fs.readdirSync(dir)
        .filter(f => f.startsWith('_og-image.'))
        .forEach(f => fs.unlinkSync(path.join(dir, f)));
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `_og-image${ext}`);
    },
  }),
  fileFilter: (_req, file, cb) => cb(null, IMAGE_EXT.test(file.originalname)),
});

router.post('/:id/upload-og', uploadOg.single('ogImage'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '無效的圖片' });
  const url = `/api/images/activity-pic/${req.params.id}/${req.file.filename}`;
  res.json({ success: true, url });
});

/* POST /api/admin/activity/:id/replace-image/:index */
router.post('/:id/replace-image/:index', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '無效的圖片' });
  const idx = parseInt(req.params.index, 10);
  if (isNaN(idx)) return res.status(400).json({ error: '無效的索引' });
  const data = readJSON(FILE, { activities: [] });
  const act  = data.activities.find(a => a.id === req.params.id);
  if (!act) return res.status(404).json({ error: '找不到此活動頁' });
  if (!act.content[idx] || act.content[idx].type !== 'image')
    return res.status(400).json({ error: '指定項目不是圖片' });
  const oldFile = safeName(act.content[idx].file);
  if (oldFile && oldFile !== req.file.filename) {
    const oldPath = path.join(DATA_DIR, 'activity-pic', safeName(req.params.id), oldFile);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }
  act.content[idx].file = req.file.filename;
  writeJSON(FILE, data);
  res.json({ success: true, file: req.file.filename });
});

/* POST /api/admin/activity/:id/copy */
router.post('/:id/copy', (req, res) => {
  const data = readJSON(FILE, { activities: [] });
  const src  = data.activities.find(a => a.id === req.params.id);
  if (!src) return res.status(404).json({ error: '找不到此活動頁' });
  const newId  = `act-${Date.now()}`;
  const newAct = JSON.parse(JSON.stringify(src));
  newAct.id    = newId;
  newAct.title = `${src.title}（複製）`;
  const srcDir = path.join(DATA_DIR, 'activity-pic', safeName(req.params.id));
  const dstDir = path.join(DATA_DIR, 'activity-pic', newId);
  fs.mkdirSync(dstDir, { recursive: true });
  if (fs.existsSync(srcDir)) {
    fs.readdirSync(srcDir).forEach(file =>
      fs.copyFileSync(path.join(srcDir, file), path.join(dstDir, file))
    );
  }
  data.activities.push(newAct);
  writeJSON(FILE, data);
  res.json({ success: true, id: newId });
});

/* DELETE /api/admin/activity/:id/image/:file */
router.delete('/:id/image/:file', (req, res) => {
  const id   = safeName(req.params.id);
  const file = safeName(req.params.file);
  if (!id || id !== req.params.id || !/^[\w-]+$/.test(id) || !file || file !== req.params.file)
    return res.status(400).json({ error: '無效的參數' });
  const filePath = path.join(DATA_DIR, 'activity-pic', id, file);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: '檔案不存在' });
  fs.unlinkSync(filePath);
  res.json({ success: true });
});

module.exports = router;
