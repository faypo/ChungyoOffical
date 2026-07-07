const express  = require('express');
const multer   = require('multer');
const fs       = require('fs');
const path     = require('path');
const { DATA_DIR } = require('../../utils/json');
const prisma   = require('../../utils/db');

const router    = express.Router();
const PROMO_DIR = path.join(DATA_DIR, 'home-promo-pic');
const IMAGE_EXT = /\.(jpg|jpeg|png|webp|gif)$/i;

fs.mkdirSync(PROMO_DIR, { recursive: true });

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

function deleteOld(basename) {
  for (const ext of ['.jpg', '.jpeg', '.png', '.webp', '.gif']) {
    const p = path.join(PROMO_DIR, basename + ext);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

async function getOrCreate() {
  let promo = await prisma.home_promo.findFirst({ include: { home_promo_cards: { orderBy: { slot: 'asc' } } } });
  if (!promo) {
    promo = await prisma.home_promo.create({
      data: {
        title: '', hero_file: '', hero_url: '', left_label: '', right_label: '',
        home_promo_cards: { create: [1, 2, 3, 4].map(slot => ({ slot, file: '', url: '' })) },
      },
      include: { home_promo_cards: { orderBy: { slot: 'asc' } } },
    });
  }
  return promo;
}

function format(promo) {
  return {
    title:      promo.title      ?? '',
    heroFile:   promo.hero_file  ?? '',
    heroUrl:    promo.hero_url   ?? '',
    leftLabel:  promo.left_label ?? '',
    rightLabel: promo.right_label ?? '',
    cards: promo.home_promo_cards.map(c => ({ slot: c.slot, file: c.file ?? '', url: c.url ?? '' })),
  };
}

/* GET */
router.get('/', async (_req, res) => {
  res.json(format(await getOrCreate()));
});

/* PUT */
router.put('/', async (req, res) => {
  const promo = await getOrCreate();
  const { title, heroUrl, leftLabel, rightLabel, cards } = req.body;
  await prisma.home_promo.update({
    where: { id: promo.id },
    data: {
      ...(title      !== undefined && { title }),
      ...(heroUrl    !== undefined && { hero_url: heroUrl }),
      ...(leftLabel  !== undefined && { left_label: leftLabel }),
      ...(rightLabel !== undefined && { right_label: rightLabel }),
    },
  });
  if (Array.isArray(cards)) {
    await prisma.$transaction(
      cards.map(({ slot, url }) =>
        prisma.home_promo_cards.updateMany({ where: { promo_id: promo.id, slot }, data: { url } })
      )
    );
  }
  res.json({ success: true });
});

/* POST /upload-hero */
router.post('/upload-hero', (req, res, next) => {
  deleteOld('hero');
  makeUpload('hero').single('image')(req, res, next);
}, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '無效的圖片' });
  const promo = await getOrCreate();
  await prisma.home_promo.update({ where: { id: promo.id }, data: { hero_file: req.file.filename } });
  res.json({ success: true, file: req.file.filename });
});

/* POST /upload-card/:slot */
router.post('/upload-card/:slot', (req, res, next) => {
  const slot = parseInt(req.params.slot);
  if (![1, 2, 3, 4].includes(slot)) return res.status(400).json({ error: '無效的 slot' });
  deleteOld(`card-${slot}`);
  makeUpload(`card-${slot}`).single('image')(req, res, next);
}, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '無效的圖片' });
  const slot  = parseInt(req.params.slot);
  const promo = await getOrCreate();
  await prisma.home_promo_cards.updateMany({ where: { promo_id: promo.id, slot }, data: { file: req.file.filename } });
  res.json({ success: true, file: req.file.filename });
});

module.exports = router;
