const express = require('express');
const multer  = require('multer');
const fs      = require('fs');
const path    = require('path');
const { DATA_DIR, readJSON, writeJSON } = require('../../utils/json');

const router  = express.Router();
const DOC_DIR = path.join(DATA_DIR, 'documents');
fs.mkdirSync(DOC_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, DOC_DIR),
    filename:    (_req,  file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `sustainability-report${ext}`);
    },
  }),
  fileFilter: (_req, file, cb) => cb(null, /\.pdf$/i.test(file.originalname)),
  limits: { fileSize: 50 * 1024 * 1024 },
});

router.get('/', (_req, res) => {
  const config = readJSON('config.json', {});
  res.json({ url: config.sustainabilityReportUrl || '' });
});

router.post('/upload', upload.single('pdf'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '請上傳 PDF 檔案' });
  const url    = `/api/documents/${req.file.filename}`;
  const config = readJSON('config.json', {});
  config.sustainabilityReportUrl = url;
  writeJSON('config.json', config);
  res.json({ success: true, url });
});

router.delete('/', (_req, res) => {
  const config = readJSON('config.json', {});
  const url    = config.sustainabilityReportUrl || '';
  if (url) {
    const filename = path.basename(url);
    const filepath = path.join(DOC_DIR, filename);
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    delete config.sustainabilityReportUrl;
    writeJSON('config.json', config);
  }
  res.json({ success: true });
});

module.exports = router;
