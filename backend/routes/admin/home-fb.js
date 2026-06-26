const express = require('express');
const prisma  = require('../../utils/db');

const router = express.Router();
const KEY    = 'home_fb_src';

router.get('/', async (_req, res) => {
  const row = await prisma.config.findUnique({ where: { key_name: KEY } });
  res.json({ src: row?.value ?? '' });
});

router.put('/', async (req, res) => {
  const { src } = req.body;
  if (typeof src !== 'string') return res.status(400).json({ error: '無效的資料' });
  await prisma.config.upsert({
    where:  { key_name: KEY },
    update: { value: src.trim() },
    create: { key_name: KEY, value: src.trim() },
  });
  res.json({ success: true });
});

module.exports = router;
