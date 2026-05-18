const express = require('express');
const fs      = require('fs');
const path    = require('path');
const { DATA_DIR, readJSON } = require('../utils/json');

const IMAGE_EXT = /\.(jpg|jpeg|png|webp)$/i;
const SERVICE_KEYS = ['service', 'traffic', 'parking', 'gift'];

const router = express.Router();

router.get('/catalog', (_req, res) => {
  res.json(readJSON('catalog.json'));
});

router.get('/floor-guide', (_req, res) => {
  res.json(readJSON('floor-guide.json'));
});

router.get('/food-guide', (_req, res) => {
  res.json(readJSON('food-guide.json'));
});

router.get('/dm/:id/pages', (req, res) => {
  const indexPath = path.join(DATA_DIR, 'dm-pic', req.params.id, 'index.json');
  if (!fs.existsSync(indexPath)) return res.status(404).json({ error: 'DM not found' });
  res.json(JSON.parse(fs.readFileSync(indexPath, 'utf8')));
});

router.get('/service-images', (_req, res) => {
  const dir = path.join(DATA_DIR, 'service');
  const result = {};
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir).filter(f => IMAGE_EXT.test(f));
    SERVICE_KEYS.forEach(key => {
      const found = files.find(f => f.toLowerCase().startsWith(key + '.'));
      if (found) result[key] = `/api/images/service/${found}`;
    });
  }
  res.json(result);
});

router.get('/winners', (_req, res) => {
  res.json(readJSON('winners.json'));
});

router.get('/activity/:id', (req, res) => {
  const data = readJSON('activities.json', { activities: [] });
  const activity = data.activities.find(a => a.id === req.params.id);
  if (!activity) return res.status(404).json({ error: '找不到此活動頁' });
  res.json(activity);
});

router.get('/banners', (_req, res) => {
  res.json(readJSON('banners.json', { banners: [] }));
});

router.get('/gallery', (_req, res) => {
  res.json(readJSON('gallery.json', { content: [] }));
});

router.get('/config', (_req, res) => {
  res.json(readJSON('config.json', {}));
});

module.exports = router;
