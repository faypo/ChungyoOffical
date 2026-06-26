const express = require('express');
const multer  = require('multer');
const fs      = require('fs');
const path    = require('path');
const { DATA_DIR } = require('../../utils/json');
const prisma  = require('../../utils/db');

const router    = express.Router();
const FLOOR_DIR = path.join(DATA_DIR, 'floor-pic');
const ICON_DIR  = path.join(FLOOR_DIR, 'icon');
const IMAGE_EXT = /\.(jpg|jpeg|png|webp)$/i;

function deleteLogo(logoPath) {
  if (!logoPath || !logoPath.startsWith('/api/images/floor-pic/')) return;
  const filePath = path.join(DATA_DIR, logoPath.replace('/api/images/', ''));
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => { fs.mkdirSync(FLOOR_DIR, { recursive: true }); cb(null, FLOOR_DIR); },
  filename:    (_req, file,  cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const uploadLogo = multer({ storage: logoStorage, fileFilter: (_req, file, cb) => cb(null, IMAGE_EXT.test(file.originalname)) });

const iconStorage = multer.diskStorage({
  destination: (_req, _file, cb) => { fs.mkdirSync(ICON_DIR, { recursive: true }); cb(null, ICON_DIR); },
  filename:    (_req, file,  cb) => cb(null, file.originalname),
});
const uploadIcon = multer({ storage: iconStorage, fileFilter: (_req, file, cb) => cb(null, IMAGE_EXT.test(file.originalname)) });

/* POST upload logo */
router.post('/logo', uploadLogo.single('logo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '未收到圖片' });
  res.json({ path: `/api/images/floor-pic/${req.file.filename}` });
});

/* GET icon library */
router.get('/icons', (_req, res) => {
  if (!fs.existsSync(ICON_DIR)) return res.json([]);
  res.json(fs.readdirSync(ICON_DIR).filter(f => IMAGE_EXT.test(f)));
});

/* POST upload icon */
router.post('/icon', uploadIcon.single('icon'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '未收到圖片' });
  res.json({ filename: req.file.filename });
});

/* DELETE icon — check DB before deleting */
router.delete('/icon/:filename', async (req, res) => {
  const filename = path.basename(req.params.filename ?? '');
  if (!filename || filename !== req.params.filename) return res.status(400).json({ error: '無效的檔名' });
  const filePath = path.join(ICON_DIR, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: '圖示不存在' });

  const used = await prisma.floor_info_icons.findMany({
    where: { file: filename },
    include: { floor_info: true },
  });
  if (used.length > 0) {
    return res.status(409).json({
      error: '此圖示正在使用中',
      usedBy: used.map(i => `${i.floor_info.building}棟 ${i.floor_info.floor_id}`),
    });
  }

  fs.unlinkSync(filePath);
  res.json({ success: true });
});

/* GET all */
router.get('/', async (_req, res) => {
  const [floors, infos, counters] = await Promise.all([
    prisma.floor_floors.findMany({ orderBy: { sort_order: 'asc' } }),
    prisma.floor_info.findMany({ include: { floor_info_icons: { orderBy: { sort_order: 'asc' } } } }),
    prisma.floor_counters.findMany({ orderBy: [{ building: 'asc' }, { sort_order: 'asc' }] }),
  ]);

  const floorInfo = {};
  for (const info of infos) {
    if (!floorInfo[info.building]) floorInfo[info.building] = {};
    floorInfo[info.building][info.floor_id] = {
      title: info.title || '',
      icons: info.floor_info_icons.map(i => i.file),
    };
  }

  const counterMap = {};
  for (const c of counters) {
    if (!counterMap[c.building]) counterMap[c.building] = {};
    if (!counterMap[c.building][c.floor_id]) counterMap[c.building][c.floor_id] = [];
    counterMap[c.building][c.floor_id].push({
      name: c.name || '', phone: c.phone || '', logo: c.logo || '', description: c.description || '',
    });
  }

  res.json({
    floors: floors.map(f => ({ id: f.id, label: f.label })),
    floorInfo,
    counters: counterMap,
  });
});

/* PUT floor label */
router.put('/floors/:id', async (req, res) => {
  const floor = await prisma.floor_floors.findUnique({ where: { id: req.params.id } });
  if (!floor) return res.status(404).json({ error: '找不到此樓層' });
  if (req.body.label !== undefined) {
    await prisma.floor_floors.update({ where: { id: req.params.id }, data: { label: req.body.label } });
  }
  res.json({ success: true });
});

/* PUT floor info（title + icons）*/
router.put('/:building/:floor/info', async (req, res) => {
  const { building, floor } = req.params;
  const icons = Array.isArray(req.body.icons) ? req.body.icons : [];
  const title = req.body.title ?? '';

  const existing = await prisma.floor_info.findFirst({ where: { floor_id: floor, building } });

  await prisma.$transaction(async (tx) => {
    if (existing) {
      await tx.floor_info_icons.deleteMany({ where: { floor_info_id: existing.id } });
      await tx.floor_info.update({ where: { id: existing.id }, data: { title } });
      if (icons.length > 0) {
        await tx.floor_info_icons.createMany({
          data: icons.map((file, i) => ({ floor_info_id: existing.id, file, sort_order: i })),
        });
      }
    } else {
      await tx.floor_floors.findUniqueOrThrow({ where: { id: floor } });
      await tx.floor_info.create({
        data: {
          floor_id: floor, building, title,
          floor_info_icons: { create: icons.map((file, i) => ({ file, sort_order: i })) },
        },
      });
    }
  });

  res.json({ success: true });
});

/* PUT replace entire counter list（排序）*/
router.put('/:building/:floor/counters', async (req, res) => {
  const { building, floor } = req.params;
  if (!Array.isArray(req.body)) return res.status(400).json({ error: '格式錯誤' });
  await prisma.$transaction(async (tx) => {
    await tx.floor_counters.deleteMany({ where: { building, floor_id: floor } });
    for (const [i, c] of req.body.entries()) {
      await tx.floor_counters.create({
        data: { floor_id: floor, building, name: c.name||'', phone: c.phone||'', logo: c.logo||'', description: c.description||'', sort_order: i },
      });
    }
  });
  res.json({ success: true });
});

/* POST add counter */
router.post('/:building/:floor/counters', async (req, res) => {
  const { building, floor } = req.params;
  const floorExists = await prisma.floor_floors.findUnique({ where: { id: floor } });
  if (!floorExists) return res.status(404).json({ error: '找不到此棟樓層' });
  const count = await prisma.floor_counters.count({ where: { building, floor_id: floor } });
  await prisma.floor_counters.create({
    data: {
      floor_id:    floor,
      building,
      name:        req.body.name        ?? '',
      phone:       req.body.phone       ?? '',
      description: req.body.description ?? '',
      logo:        req.body.logo        ?? '',
      sort_order:  count,
    },
  });
  res.json({ success: true });
});

/* PUT update counter */
router.put('/:building/:floor/counters/:idx', async (req, res) => {
  const { building, floor } = req.params;
  const idx  = Number(req.params.idx);
  const list = await prisma.floor_counters.findMany({ where: { building, floor_id: floor }, orderBy: { sort_order: 'asc' } });
  const target = list[idx];
  if (!target) return res.status(404).json({ error: '找不到此品牌' });

  const newLogo = req.body.logo ?? '';
  if (target.logo !== newLogo) deleteLogo(target.logo);

  await prisma.floor_counters.update({
    where: { id: target.id },
    data: {
      name:        req.body.name        ?? '',
      phone:       req.body.phone       ?? '',
      description: req.body.description ?? '',
      logo:        newLogo,
    },
  });
  res.json({ success: true });
});

/* DELETE counter */
router.delete('/:building/:floor/counters/:idx', async (req, res) => {
  const { building, floor } = req.params;
  const idx  = Number(req.params.idx);
  const list = await prisma.floor_counters.findMany({ where: { building, floor_id: floor }, orderBy: { sort_order: 'asc' } });
  const target = list[idx];
  if (!target) return res.status(404).json({ error: '找不到此品牌' });
  deleteLogo(target.logo);
  await prisma.floor_counters.delete({ where: { id: target.id } });
  res.json({ success: true });
});

module.exports = router;
