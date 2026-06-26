const express = require('express');
const multer  = require('multer');
const fs      = require('fs');
const path    = require('path');
const { DATA_DIR, readJSON, writeJSON } = require('../../utils/json');

const router    = express.Router();
const FILE      = 'home-promo.json';
const PROMO_DIR = path.join(DATA_DIR, 'home-promo-pic');
const IMAGE_EXT = /\.(jpg|jpeg|png|webp|gif)$/i;

fs.mkdirSync(PROMO_DIR, { recursive: true });

const defaultData = () => ({
  title: '', heroFile: '', heroUrl: '',
  leftLabel: '', rightLabel: '',
  cards: [1, 2, 3, 4].map(slot => ({ slot, file: '', url: '' })),
});

const makeUpload = (filename) => multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, PROMO_DIR),
    filename:    (_req,  file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${filename}${ext}`);
    },
  }),
  fileFilter: (_req, file, cb) => cb(null, IMAGE_EXT.test(file.originalname)),
});

function deleteOld(dir, basename) {
  for (const ext of ['.jpg', '.jpeg', '.png', '.webp', '.gif']) {
    const p = path.join(dir, basename + ext);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

/* GET */
router.get('/', (_req, res) => res.json(readJSON(FILE, defaultData())));

/* PUT — 更新所有文字欄位與連結 */
router.put('/', (req, res) => {
  const data = readJSON(FILE, defaultData());
  const { title, heroUrl, leftLabel, rightLabel, cards } = req.body;
  if (title      !== undefined) data.title      = title;
  if (heroUrl    !== undefined) data.heroUrl    = heroUrl;
  if (leftLabel  !== undefined) data.leftLabel  = leftLabel;
  if (rightLabel !== undefined) data.rightLabel = rightLabel;
  if (Array.isArray(cards)) {
    cards.forEach(({ slot, url }) => {
      const card = data.cards.find(c => c.slot === slot);
      if (card && url !== undefined) card.url = url;
    });
  }
  writeJSON(FILE, data);
  res.json({ success: true });
});

/* POST /upload-hero */
router.post('/upload-hero', (req, res, next) => {
  deleteOld(PROMO_DIR, 'hero');
  makeUpload('hero').single('image')(req, res, next);
}, (req, res) => {
  if (!req.file) return res.status(400).json({ error: '無效的圖片' });
  const data = readJSON(FILE, defaultData());
  data.heroFile = req.file.filename;
  writeJSON(FILE, data);
  res.json({ success: true, file: req.file.filename });
});

/* POST /upload-card/:slot (1–4) */
router.post('/upload-card/:slot', (req, res, next) => {
  const slot = parseInt(req.params.slot);
  if (![1, 2, 3, 4].includes(slot)) return res.status(400).json({ error: '無效的 slot' });
  deleteOld(PROMO_DIR, `card-${slot}`);
  makeUpload(`card-${slot}`).single('image')(req, res, next);
}, (req, res) => {
  if (!req.file) return res.status(400).json({ error: '無效的圖片' });
  const slot = parseInt(req.params.slot);
  const data = readJSON(FILE, defaultData());
  const card = data.cards.find(c => c.slot === slot);
  if (card) card.file = req.file.filename;
  writeJSON(FILE, data);
  res.json({ success: true, file: req.file.filename });
});

module.exports = router;
