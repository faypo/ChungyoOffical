const express        = require('express');
const multer         = require('multer');
const fs             = require('fs');
const path           = require('path');
const { randomUUID } = require('crypto');
const { DATA_DIR }   = require('../../utils/json');
const prisma   = require('../../utils/db');

const router    = express.Router();
const EVENT_DIR = path.join(DATA_DIR, 'home-event-pic');
const IMAGE_EXT = /\.(jpg|jpeg|png|webp|gif)$/i;

fs.mkdirSync(EVENT_DIR, { recursive: true });

const makeUpload = () => multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, EVENT_DIR),
    filename:    (_req,  file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `${randomUUID()}${ext}`);
    },
  }),
  fileFilter: (_req, file, cb) => cb(null, IMAGE_EXT.test(file.originalname)),
});

/* GET */
router.get('/', async (_req, res) => {
  const events = await prisma.home_events.findMany({ orderBy: { sort_order: 'asc' } });
  res.json({
    events: events.map(e => ({
      id:         e.id,
      file:       e.file,
      url:        e.url ?? '',
      sort_order: e.sort_order,
      startDate:  e.start_date ? e.start_date.toISOString().slice(0, 16) : '',
      endDate:    e.end_date   ? e.end_date.toISOString().slice(0, 16)   : '',
    })),
  });
});

/* POST /upload */
router.post('/upload', makeUpload().single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '無效的圖片' });
  const id    = `event-${Date.now()}`;
  const count = await prisma.home_events.count();
  await prisma.home_events.create({ data: { id, file: req.file.filename, url: '', sort_order: count } });
  res.json({ success: true, id, file: req.file.filename });
});

/* PUT /reorder */
router.put('/reorder', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: '無效的排序' });
  await prisma.$transaction(
    ids.map((id, i) => prisma.home_events.update({ where: { id }, data: { sort_order: i } }))
  );
  res.json({ success: true });
});

/* PUT /:id */
router.put('/:id', async (req, res) => {
  const event = await prisma.home_events.findUnique({ where: { id: req.params.id } });
  if (!event) return res.status(404).json({ error: '找不到此活動卡片' });
  const { url, startDate, endDate } = req.body;
  await prisma.home_events.update({
    where: { id: req.params.id },
    data: {
      ...(url       !== undefined && { url }),
      ...(startDate !== undefined && { start_date: startDate ? new Date(startDate) : null }),
      ...(endDate   !== undefined && { end_date:   endDate   ? new Date(endDate)   : null }),
    },
  });
  res.json({ success: true });
});

/* POST /:id/replace */
router.post('/:id/replace', makeUpload().single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '無效的圖片' });
  const event = await prisma.home_events.findUnique({ where: { id: req.params.id } });
  if (!event) return res.status(404).json({ error: '找不到此活動卡片' });
  await prisma.home_events.update({ where: { id: req.params.id }, data: { file: req.file.filename } });
  const oldPath = path.join(EVENT_DIR, event.file);
  if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  res.json({ success: true, file: req.file.filename });
});

/* DELETE /:id */
router.delete('/:id', async (req, res) => {
  const event = await prisma.home_events.findUnique({ where: { id: req.params.id } });
  if (!event) return res.status(404).json({ error: '找不到此活動卡片' });
  await prisma.home_events.delete({ where: { id: req.params.id } });
  const filePath = path.join(EVENT_DIR, event.file);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  res.json({ success: true });
});

module.exports = router;
