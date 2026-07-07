const express = require('express');
const multer  = require('multer');
const fs      = require('fs');
const path    = require('path');
const { DATA_DIR } = require('../../utils/json');
const prisma  = require('../../utils/db');

const router  = express.Router();
const DOC_DIR = path.join(DATA_DIR, 'documents');
const KEY     = 'sustainabilityReportUrl';
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

router.get('/', async (_req, res) => {
  const row = await prisma.config.findUnique({ where: { key_name: KEY } });
  res.json({ url: row?.value || '' });
});

router.post('/upload', upload.single('pdf'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '請上傳 PDF 檔案' });
  const url = `/api/documents/${req.file.filename}`;
  await prisma.config.upsert({
    where:  { key_name: KEY },
    update: { value: url },
    create: { key_name: KEY, value: url },
  });
  res.json({ success: true, url });
});

router.delete('/', async (_req, res) => {
  const row = await prisma.config.findUnique({ where: { key_name: KEY } });
  if (row?.value) {
    const filepath = path.join(DOC_DIR, path.basename(row.value));
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    await prisma.config.update({ where: { key_name: KEY }, data: { value: '' } });
  }
  res.json({ success: true });
});

module.exports = router;
