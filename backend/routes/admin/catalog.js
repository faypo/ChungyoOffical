const express = require('express');
const multer  = require('multer');
const fs      = require('fs');
const path    = require('path');
const { DATA_DIR } = require('../../utils/json');
const prisma  = require('../../utils/db');

const router    = express.Router();
const IMAGE_EXT = /\.(jpg|jpeg|png|webp)$/i;
const safeName  = (p) => path.basename(p ?? '');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const id = safeName(req.params.id);
    if (!id || id !== req.params.id) return cb(new Error('無效的 ID'));
    const dir = path.join(DATA_DIR, 'dm-pic', id);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => cb(null, file.originalname),
});
const upload = multer({ storage, fileFilter: (_req, file, cb) => cb(null, IMAGE_EXT.test(file.originalname)) });

const coverStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const id = safeName(req.params.id);
    if (!id || id !== req.params.id) return cb(new Error('無效的 ID'));
    const dir = path.join(DATA_DIR, 'dm-pic', id);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `cover${ext}`);
  },
});
const coverUpload = multer({ storage: coverStorage, fileFilter: (_req, file, cb) => cb(null, IMAGE_EXT.test(file.originalname)) });

function rebuildIndex(dmId) {
  const dir = path.join(DATA_DIR, 'dm-pic', dmId);
  if (!fs.existsSync(dir)) return [];
  const allFiles = new Set(fs.readdirSync(dir).filter(f => IMAGE_EXT.test(f) && !/^cover\./i.test(f)));
  const indexPath = path.join(dir, 'index.json');
  let existing = [];
  try { existing = JSON.parse(fs.readFileSync(indexPath, 'utf8')); } catch {}
  const ordered = existing.filter(f => allFiles.has(f));
  const orderedSet = new Set(ordered);
  const newFiles = [...allFiles].filter(f => !orderedSet.has(f)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const files = [...ordered, ...newFiles];
  fs.writeFileSync(indexPath, JSON.stringify(files, null, 2));
  return files;
}

function generateId(existing) {
  const tw  = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const pad = n => String(n).padStart(2, '0');
  const date = `${tw.getUTCFullYear()}${pad(tw.getUTCMonth() + 1)}${pad(tw.getUTCDate())}`;
  const pattern = new RegExp(`^${date}(\\d{3})$`);
  let max = 0;
  for (const dm of existing) {
    const m = dm.id.match(pattern);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${date}${String(max + 1).padStart(3, '0')}`;
}

function formatCatalog(dm, buttons, hotspots) {
  return {
    id:        dm.id,
    order:     dm.sort_order,
    title:     dm.title,
    subtitle:  dm.subtitle  || '',
    type:      dm.type,
    cover:     dm.cover     || undefined,
    url:       dm.url       || '',
    startDate: dm.start_date ? dm.start_date.toISOString().slice(0, 10) : '',
    endDate:   dm.end_date   ? dm.end_date.toISOString().slice(0, 10)   : '',
    button:    (buttons  || []).map(b => ({ page: b.page, url: b.url || '' })),
    hotspots:  (hotspots || []).map(h => ({
      id: h.id, x: Number(h.x), y: Number(h.y), width: Number(h.width), height: Number(h.height), url: h.url || '',
    })),
  };
}

/* GET all */
router.get('/', async (_req, res) => {
  const catalogs = await prisma.dm_catalogs.findMany({
    include: { dm_buttons: true, dm_hotspots: true },
    orderBy: { sort_order: 'asc' },
  });
  res.json(catalogs.map(dm => formatCatalog(dm, dm.dm_buttons, dm.dm_hotspots)));
});

/* POST new DM */
router.post('/', async (req, res) => {
  const { title, subtitle, order, button, type, hotspots, url } = req.body;
  if (!title) return res.status(400).json({ error: 'title 為必填' });
  const existing = await prisma.dm_catalogs.findMany({ select: { id: true } });
  const id = generateId(existing);
  const dmType = type || 'double';
  const count  = await prisma.dm_catalogs.count();

  await prisma.$transaction(async (tx) => {
    await tx.dm_catalogs.create({
      data: {
        id,
        title,
        subtitle:   subtitle || '',
        type:       dmType,
        url:        dmType === 'url' ? (url || '') : '',
        sort_order: Number(order) || count + 1,
        dm_buttons:  { create: (Array.isArray(button)   ? button   : []).map(b => ({ page: b.page, url: b.url || '' })) },
        dm_hotspots: { create: (Array.isArray(hotspots) ? hotspots : []).map(h => ({ id: h.id, x: h.x, y: h.y, width: h.width, height: h.height, url: h.url || '' })) },
      },
    });
  });

  fs.mkdirSync(path.join(DATA_DIR, 'dm-pic', id), { recursive: true });
  if (dmType !== 'url') fs.writeFileSync(path.join(DATA_DIR, 'dm-pic', id, 'index.json'), '[]');

  res.json({ success: true, id });
});

/* PUT edit DM */
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  if (!id || !/^[\w-]+$/.test(id)) return res.status(400).json({ error: '無效的 DM ID' });
  const dm = await prisma.dm_catalogs.findUnique({ where: { id } });
  if (!dm) return res.status(404).json({ error: '找不到此 DM' });

  const { title, subtitle, order, button, hotspots, url, startDate, endDate, type } = req.body;

  await prisma.$transaction(async (tx) => {
    await tx.dm_catalogs.update({
      where: { id },
      data: {
        ...(title     !== undefined && { title }),
        ...(subtitle  !== undefined && { subtitle }),
        ...(order     !== undefined && { sort_order: Number(order) }),
        ...(url       !== undefined && { url }),
        ...(type      !== undefined && { type }),
        ...(startDate !== undefined && { start_date: startDate ? new Date(startDate) : null }),
        ...(endDate   !== undefined && { end_date:   endDate   ? new Date(endDate)   : null }),
      },
    });
    if (button !== undefined) {
      await tx.dm_buttons.deleteMany({ where: { catalog_id: id } });
      if (button.length > 0) {
        await tx.dm_buttons.createMany({ data: button.map(b => ({ catalog_id: id, page: b.page, url: b.url || '' })) });
      }
    }
    if (hotspots !== undefined) {
      await tx.dm_hotspots.deleteMany({ where: { catalog_id: id } });
      if (hotspots.length > 0) {
        await tx.dm_hotspots.createMany({
          data: hotspots.map(h => ({ id: h.id, catalog_id: id, x: h.x, y: h.y, width: h.width, height: h.height, url: h.url || '' })),
        });
      }
    }
  });

  res.json({ success: true });
});

/* DELETE DM */
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  if (!id || !/^[\w-]+$/.test(id)) return res.status(400).json({ error: '無效的 DM ID' });
  const dm = await prisma.dm_catalogs.findUnique({ where: { id } });
  if (!dm) return res.status(404).json({ error: '找不到此 DM' });
  await prisma.dm_catalogs.delete({ where: { id } });
  const dmDir = path.join(DATA_DIR, 'dm-pic', safeName(id));
  if (fs.existsSync(dmDir)) fs.rmSync(dmDir, { recursive: true });
  res.json({ success: true });
});

/* POST upload pages */
router.post('/:id/upload', upload.array('images'), (req, res) => {
  const files = rebuildIndex(safeName(req.params.id));
  res.json({ success: true, files });
});

/* PUT page order */
router.put('/:id/pages/order', (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order 必須是陣列' });
  const dir = path.join(DATA_DIR, 'dm-pic', safeName(req.params.id));
  if (!fs.existsSync(dir)) return res.status(404).json({ error: '找不到此 DM' });
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(order, null, 2));
  res.json({ success: true });
});

/* DELETE single page image */
router.delete('/:id/images/:file', (req, res) => {
  const id   = safeName(req.params.id);
  const file = safeName(req.params.file);
  if (!id || id !== req.params.id || !/^[\w-]+$/.test(id) || !file || file !== req.params.file)
    return res.status(400).json({ error: '無效的參數' });
  const filePath = path.join(DATA_DIR, 'dm-pic', id, file);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: '檔案不存在' });
  fs.unlinkSync(filePath);
  const files = rebuildIndex(id);
  res.json({ success: true, files });
});

/* POST cover */
router.post('/:id/cover', coverUpload.single('cover'), async (req, res) => {
  const dm = await prisma.dm_catalogs.findUnique({ where: { id: req.params.id } });
  if (!dm) return res.status(404).json({ error: '找不到此 DM' });
  const newFile = req.file?.filename;
  if (!newFile) return res.status(400).json({ error: '未提供封面圖片' });
  const dir = path.join(DATA_DIR, 'dm-pic', safeName(req.params.id));
  fs.readdirSync(dir).filter(f => /^cover\./i.test(f) && f !== newFile).forEach(f => fs.unlinkSync(path.join(dir, f)));
  await prisma.dm_catalogs.update({ where: { id: req.params.id }, data: { cover: newFile } });
  res.json({ success: true, cover: newFile });
});

/* DELETE cover */
router.delete('/:id/cover', async (req, res) => {
  const dm = await prisma.dm_catalogs.findUnique({ where: { id: req.params.id } });
  if (!dm) return res.status(404).json({ error: '找不到此 DM' });
  const dir = path.join(DATA_DIR, 'dm-pic', safeName(req.params.id));
  if (fs.existsSync(dir)) fs.readdirSync(dir).filter(f => /^cover\./i.test(f)).forEach(f => fs.unlinkSync(path.join(dir, f)));
  await prisma.dm_catalogs.update({ where: { id: req.params.id }, data: { cover: null } });
  res.json({ success: true });
});

module.exports = router;
