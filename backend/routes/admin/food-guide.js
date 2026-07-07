const express = require('express');
const multer  = require('multer');
const fs      = require('fs');
const path    = require('path');
const { DATA_DIR } = require('../../utils/json');
const prisma  = require('../../utils/db');

const router    = express.Router();
const FOOD_DIR  = path.join(DATA_DIR, 'food-pic');
const IMAGE_EXT = /\.(jpg|jpeg|png|webp)$/i;

function deleteImage(imgPath) {
  if (!imgPath || !imgPath.startsWith('/api/images/food-pic/')) return;
  const filePath = path.join(DATA_DIR, imgPath.replace('/api/images/', ''));
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

function toBldg(bldgStr) {
  if (!bldgStr) return null;
  return bldgStr.replace('棟', '').trim() || null;
}

function toItem(r) {
  return {
    name:        r.name        || '',
    building:    r.building ? r.building + '棟' : '',
    floor:       r.floor_id   || '',
    phone:       r.phone       || '',
    image:       r.logo        || '',
    description: r.description || '',
  };
}

async function getAll() {
  const [cats, items] = await Promise.all([
    prisma.food_categories.findMany({ orderBy: { sort_order: 'asc' } }),
    prisma.food_items.findMany({ orderBy: { sort_order: 'asc' } }),
  ]);
  const restaurants = {};
  cats.forEach(c => { restaurants[c.id] = { theme: [], foodcourt: [] }; });
  items.forEach(r => {
    const section = r.section || 'theme';
    if (restaurants[r.category_id]) restaurants[r.category_id][section].push(toItem(r));
  });
  return { categories: cats.map(c => ({ id: c.id, label: c.label })), restaurants };
}

const imgStorage = multer.diskStorage({
  destination: (_req, _file, cb) => { fs.mkdirSync(FOOD_DIR, { recursive: true }); cb(null, FOOD_DIR); },
  filename:    (_req, file,  cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const uploadImg = multer({ storage: imgStorage, fileFilter: (_req, file, cb) => cb(null, IMAGE_EXT.test(file.originalname)) });

/* GET all */
router.get('/', async (_req, res) => {
  res.json(await getAll());
});

/* POST upload image */
router.post('/image', uploadImg.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '未收到圖片' });
  res.json({ path: `/api/images/food-pic/${req.file.filename}` });
});

/* POST add category */
router.post('/categories', async (req, res) => {
  const { id, label } = req.body;
  if (!id || !label) return res.status(400).json({ error: 'id 與 label 為必填' });
  const existing = await prisma.food_categories.findUnique({ where: { id } });
  if (existing) return res.status(409).json({ error: 'ID 已存在' });
  const count = await prisma.food_categories.count();
  await prisma.food_categories.create({ data: { id, label, sort_order: count } });
  res.json({ success: true });
});

/* PUT rename category */
router.put('/categories/:id', async (req, res) => {
  const cat = await prisma.food_categories.findUnique({ where: { id: req.params.id } });
  if (!cat) return res.status(404).json({ error: '找不到此分類' });
  if (req.body.label) await prisma.food_categories.update({ where: { id: req.params.id }, data: { label: req.body.label } });
  res.json({ success: true });
});

/* DELETE category */
router.delete('/categories/:id', async (req, res) => {
  const cat = await prisma.food_categories.findUnique({ where: { id: req.params.id } });
  if (!cat) return res.status(404).json({ error: '找不到此分類' });
  const items = await prisma.food_items.findMany({ where: { category_id: req.params.id } });
  items.forEach(r => deleteImage(r.logo));
  await prisma.food_categories.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

/* PUT replace section（reorder）*/
router.put('/:cat/:section', async (req, res) => {
  const { cat, section } = req.params;
  if (!['theme', 'foodcourt'].includes(section)) return res.status(400).json({ error: '無效 section' });
  if (!Array.isArray(req.body)) return res.status(400).json({ error: '格式錯誤' });
  const catExists = await prisma.food_categories.findUnique({ where: { id: cat } });
  if (!catExists) return res.status(404).json({ error: '找不到此分類' });

  await prisma.$transaction(async (tx) => {
    await tx.food_items.deleteMany({ where: { category_id: cat, section } });
    for (const [i, r] of req.body.entries()) {
      await tx.food_items.create({
        data: {
          category_id: cat,
          section,
          name:        r.name        || '',
          floor_id:    r.floor       || null,
          building:    toBldg(r.building),
          phone:       r.phone       || null,
          logo:        r.image       || null,
          description: r.description || null,
          sort_order:  i,
        },
      });
    }
  });
  res.json({ success: true });
});

/* POST add restaurant */
router.post('/:cat/:section', async (req, res) => {
  const { cat, section } = req.params;
  if (!['theme', 'foodcourt'].includes(section)) return res.status(400).json({ error: '無效 section' });
  const catExists = await prisma.food_categories.findUnique({ where: { id: cat } });
  if (!catExists) return res.status(404).json({ error: '找不到此分類' });
  const count = await prisma.food_items.count({ where: { category_id: cat, section } });
  await prisma.food_items.create({
    data: {
      category_id: cat,
      section,
      name:        req.body.name        || '',
      floor_id:    req.body.floor       || null,
      building:    toBldg(req.body.building),
      phone:       req.body.phone       || null,
      logo:        req.body.image       || null,
      description: req.body.description || null,
      sort_order:  count,
    },
  });
  res.json({ success: true });
});

/* PUT update restaurant */
router.put('/:cat/:section/:idx', async (req, res) => {
  const { cat, section } = req.params;
  const idx = Number(req.params.idx);
  if (!['theme', 'foodcourt'].includes(section)) return res.status(400).json({ error: '無效 section' });
  const list = await prisma.food_items.findMany({
    where: { category_id: cat, section },
    orderBy: { sort_order: 'asc' },
  });
  const target = list[idx];
  if (!target) return res.status(404).json({ error: '找不到此餐廳' });

  const newImg = req.body.image ?? '';
  if (target.logo !== newImg) deleteImage(target.logo);

  await prisma.food_items.update({
    where: { id: target.id },
    data: {
      name:        req.body.name        || '',
      floor_id:    req.body.floor       || null,
      building:    toBldg(req.body.building),
      phone:       req.body.phone       || null,
      logo:        newImg               || null,
      description: req.body.description || null,
    },
  });
  res.json({ success: true });
});

/* DELETE restaurant */
router.delete('/:cat/:section/:idx', async (req, res) => {
  const { cat, section } = req.params;
  const idx = Number(req.params.idx);
  if (!['theme', 'foodcourt'].includes(section)) return res.status(400).json({ error: '無效 section' });
  const list = await prisma.food_items.findMany({
    where: { category_id: cat, section },
    orderBy: { sort_order: 'asc' },
  });
  const target = list[idx];
  if (!target) return res.status(404).json({ error: '找不到此餐廳' });
  deleteImage(target.logo);
  await prisma.food_items.delete({ where: { id: target.id } });
  res.json({ success: true });
});

module.exports = router;
