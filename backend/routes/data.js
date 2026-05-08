const express = require('express');
const fs      = require('fs');
const path    = require('path');
const { DATA_DIR, readJSON } = require('../utils/json');

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

module.exports = router;
