const express = require('express');
const multer  = require('multer');
const fs      = require('fs');
const path    = require('path');
const { DATA_DIR, readJSON, writeJSON } = require('../../utils/json');

const router = express.Router();
const FILE = 'gallery.json';
const IMAGE_EXT = /\.(jpg|jpeg|png|webp)$/i;
const PIC_DIR = () => path.join(DATA_DIR, 'gallery-pic');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = PIC_DIR();
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => cb(null, file.originalname),
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => cb(null, IMAGE_EXT.test(file.originalname)),
});

/* GET /api/admin/gallery */
router.get('/', (_req, res) => res.json(readJSON(FILE, { content: [] })));

/* PUT /api/admin/gallery */
router.put('/', (req, res) => {
  const { content } = req.body;
  if (!Array.isArray(content)) return res.status(400).json({ error: 'content 必須是陣列' });
  writeJSON(FILE, { content });
  res.json({ success: true });
});

/* POST /api/admin/gallery/upload */
router.post('/upload', upload.array('images'), (req, res) => {
  const files = req.files?.map(f => f.filename) ?? [];
  res.json({ success: true, files });
});

/* DELETE /api/admin/gallery/image/:file */
router.delete('/image/:file', (req, res) => {
  const file = path.basename(req.params.file ?? '');
  if (!file || file !== req.params.file) return res.status(400).json({ error: '無效的檔名' });
  const filePath = path.join(PIC_DIR(), file);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: '檔案不存在' });
  fs.unlinkSync(filePath);
  res.json({ success: true });
});

module.exports = router;
