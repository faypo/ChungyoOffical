const express = require('express');
const { readJSON, writeJSON } = require('../../utils/json');

const router = express.Router();

router.get('/', (_req, res) => {
  res.json(readJSON('home-fb.json', { src: '' }));
});

router.put('/', (req, res) => {
  const { src } = req.body;
  if (typeof src !== 'string') return res.status(400).json({ error: '無效的資料' });
  writeJSON('home-fb.json', { src: src.trim() });
  res.json({ success: true });
});

module.exports = router;
