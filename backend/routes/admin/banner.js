const express = require('express');
const multer  = require('multer');
const fs      = require('fs');
const path    = require('path');
const { DATA_DIR } = require('../../utils/json');
const prisma        = require('../../utils/db');

const router     = express.Router();
const BANNER_DIR = path.join(DATA_DIR, 'banner-pic');
const IMAGE_EXT  = /\.(jpg|jpeg|png|webp|gif)$/i;

fs.mkdirSync(BANNER_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, BANNER_DIR),
    filename:    (_req,  file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}${ext}`);
    },
  }),
  fileFilter: (_req, file, cb) => cb(null, IMAGE_EXT.test(file.originalname)),
});

/* GET /api/admin/banner */
router.get('/', async (_req, res) => {
  const banners = await prisma.banners.findMany({ orderBy: { sort_order: 'asc' } });
  res.json({
    banners: banners.map(b => ({
      id:         b.id,
      file:       b.file,
      url:        b.url ?? '',
      is_active:  b.is_active,
      sort_order: b.sort_order,
      startDate:  b.start_date ? b.start_date.toISOString().slice(0, 10) : '',
      endDate:    b.end_date   ? b.end_date.toISOString().slice(0, 10)   : '',
    })),
  });
});

/* POST /api/admin/banner — 根路由無檔案直接拒絕 */
router.post('/', (_req, res) => res.status(400).json({ error: 'file 為必填，請使用 /upload' }));

/* POST /api/admin/banner/upload */
router.post('/upload', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '無效的圖片' });
  const id    = `banner-${Date.now()}`;
  const count = await prisma.banners.count();
  await prisma.banners.create({ data: { id, file: req.file.filename, url: '', sort_order: count } });
  res.json({ success: true, id, file: req.file.filename });
});

/* POST /api/admin/banner/:id/replace — 換圖 */
router.post('/:id/replace', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '無效的圖片' });
  const banner = await prisma.banners.findUnique({ where: { id: req.params.id } });
  if (!banner) {
    fs.unlinkSync(path.join(BANNER_DIR, req.file.filename));
    return res.status(404).json({ error: '找不到此 Banner' });
  }
  await prisma.banners.update({ where: { id: req.params.id }, data: { file: req.file.filename } });
  const oldPath = path.join(BANNER_DIR, banner.file);
  if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  res.json({ success: true, file: req.file.filename });
});

/* PUT /api/admin/banner/reorder — 必須在 /:id 之前 */
router.put('/reorder', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: '無效的排序' });
  await prisma.$transaction(
    ids.map((id, i) => prisma.banners.update({ where: { id }, data: { sort_order: i } }))
  );
  res.json({ success: true });
});

/* PUT /api/admin/banner/:id */
router.put('/:id', async (req, res) => {
  const banner = await prisma.banners.findUnique({ where: { id: req.params.id } });
  if (!banner) return res.status(404).json({ error: '找不到此 Banner' });
  const { url, startDate, endDate } = req.body;
  await prisma.banners.update({
    where: { id: req.params.id },
    data: {
      ...(url       !== undefined && { url }),
      ...(startDate !== undefined && { start_date: startDate ? new Date(startDate) : null }),
      ...(endDate   !== undefined && { end_date:   endDate   ? new Date(endDate)   : null }),
    },
  });
  res.json({ success: true });
});

/* DELETE /api/admin/banner/:id */
router.delete('/:id', async (req, res) => {
  const banner = await prisma.banners.findUnique({ where: { id: req.params.id } });
  if (!banner) return res.status(404).json({ error: '找不到此 Banner' });
  await prisma.banners.delete({ where: { id: req.params.id } });
  const filePath = path.join(BANNER_DIR, banner.file);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  res.json({ success: true });
});

module.exports = router;
