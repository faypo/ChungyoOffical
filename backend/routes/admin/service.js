const express = require('express');
const multer  = require('multer');
const fs      = require('fs');
const path    = require('path');
const { DATA_DIR } = require('../../utils/json');

const router      = express.Router();
const SERVICE_DIR = path.join(DATA_DIR, 'service');
const KEYS        = ['service', 'traffic', 'parking', 'gift'];
const IMAGE_EXT   = /\.(jpg|jpeg|png|gif|webp)$/i;

fs.mkdirSync(SERVICE_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, SERVICE_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${req.params.key}${ext}`);
    },
  }),
  fileFilter: (_req, file, cb) => cb(null, IMAGE_EXT.test(file.originalname)),
  limits: { fileSize: 10 * 1024 * 1024 },
});

/* GET /api/admin/service → 回傳各 key 目前圖片 URL */
router.get('/', (_req, res) => {
  const files = fs.existsSync(SERVICE_DIR) ? fs.readdirSync(SERVICE_DIR) : [];
  const result = {};
  KEYS.forEach(key => {
    const found = files.find(f => path.basename(f, path.extname(f)) === key && IMAGE_EXT.test(f));
    if (found) result[key] = `/api/images/service/${found}`;
  });
  res.json(result);
});

/* POST /api/admin/service/:key/upload → 上傳圖片，刪除同 key 舊檔 */
router.post('/:key/upload', (req, res, next) => {
  if (!KEYS.includes(req.params.key)) return res.status(400).json({ error: '無效的 key' });
  next();
}, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '請上傳圖片檔案' });

  // 刪除同 key 的舊檔（副檔名可能不同）
  const files = fs.readdirSync(SERVICE_DIR);
  files.forEach(f => {
    if (path.basename(f, path.extname(f)) === req.params.key && f !== req.file.filename) {
      fs.unlinkSync(path.join(SERVICE_DIR, f));
    }
  });

  res.json({ success: true, url: `/api/images/service/${req.file.filename}` });
});

module.exports = router;
