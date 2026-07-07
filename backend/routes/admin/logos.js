const express  = require('express');
const multer   = require('multer');
const fs       = require('fs');
const path     = require('path');
const { DATA_DIR } = require('../../utils/json');
const prisma   = require('../../utils/db');

const router    = express.Router();
const LOGO_DIR  = path.join(DATA_DIR, 'logo-pic');
const IMAGE_EXT = /\.(jpg|jpeg|png|webp|gif|svg)$/i;

fs.mkdirSync(LOGO_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, LOGO_DIR),
    filename:    (_req,  file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}${ext}`);
    },
  }),
  fileFilter: (_req, file, cb) => cb(null, IMAGE_EXT.test(file.originalname)),
});

/* GET */
router.get('/', async (_req, res) => {
  const groups = await prisma.logo_groups.findMany({
    include: { logos: { orderBy: { sort_order: 'asc' } } },
    orderBy: { sort_order: 'asc' },
  });
  res.json({ groups });
});

/* POST /group */
router.post('/group', async (_req, res) => {
  const id    = `group-${Date.now()}`;
  const count = await prisma.logo_groups.count();
  await prisma.logo_groups.create({ data: { id, sort_order: count } });
  res.json({ success: true, id });
});

/* PUT /group/reorder */
router.put('/group/reorder', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: '無效' });
  await prisma.$transaction(
    ids.map((id, i) => prisma.logo_groups.update({ where: { id }, data: { sort_order: i } }))
  );
  res.json({ success: true });
});

/* DELETE /group/:gid */
router.delete('/group/:gid', async (req, res) => {
  const group = await prisma.logo_groups.findUnique({
    where: { id: req.params.gid },
    include: { logos: true },
  });
  if (!group) return res.status(404).json({ error: '找不到組別' });
  group.logos.forEach(l => {
    const p = path.join(LOGO_DIR, l.file);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  });
  await prisma.logo_groups.delete({ where: { id: req.params.gid } });
  res.json({ success: true });
});

/* POST /group/:gid/upload */
router.post('/group/:gid/upload', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '無效的圖片' });
  const group = await prisma.logo_groups.findUnique({
    where: { id: req.params.gid },
    include: { logos: true },
  });
  if (!group) return res.status(404).json({ error: '找不到組別' });
  if (group.logos.length >= 6) return res.status(400).json({ error: '每組最多 6 張' });
  const id    = `logo-${Date.now()}`;
  const count = group.logos.length;
  await prisma.logos.create({ data: { id, group_id: req.params.gid, file: req.file.filename, sort_order: count } });
  res.json({ success: true, id, file: req.file.filename });
});

/* PUT /group/:gid/reorder */
router.put('/group/:gid/reorder', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: '無效' });
  await prisma.$transaction(
    ids.map((id, i) => prisma.logos.update({ where: { id }, data: { sort_order: i } }))
  );
  res.json({ success: true });
});

/* DELETE /group/:gid/:lid */
router.delete('/group/:gid/:lid', async (req, res) => {
  const logo = await prisma.logos.findUnique({ where: { id: req.params.lid } });
  if (!logo) return res.status(404).json({ error: '找不到 Logo' });
  await prisma.logos.delete({ where: { id: req.params.lid } });
  const p = path.join(LOGO_DIR, logo.file);
  if (fs.existsSync(p)) fs.unlinkSync(p);
  res.json({ success: true });
});

module.exports = router;
