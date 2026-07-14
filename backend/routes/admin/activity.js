const express        = require('express');
const multer         = require('multer');
const fs             = require('fs');
const path           = require('path');
const { randomUUID } = require('crypto');
const { DATA_DIR }   = require('../../utils/json');
const prisma         = require('../../utils/db');

const router    = express.Router();
const IMAGE_EXT = /\.(jpg|jpeg|png|webp|gif)$/i;
const safeName  = (p) => path.basename(p ?? '');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const id = safeName(req.params.id);
    if (!id || id !== req.params.id) return cb(new Error('無效的 ID'));
    const dir = path.join(DATA_DIR, 'activity-pic', id);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${randomUUID()}${ext}`);
  },
});
const upload = multer({ storage, fileFilter: (_req, file, cb) => cb(null, IMAGE_EXT.test(file.originalname)) });

const uploadOg = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const id = safeName(req.params.id);
      if (!id || id !== req.params.id) return cb(new Error('無效的 ID'));
      const dir = path.join(DATA_DIR, 'activity-pic', id);
      fs.mkdirSync(dir, { recursive: true });
      fs.readdirSync(dir).filter(f => f.startsWith('_og-image.')).forEach(f => fs.unlinkSync(path.join(dir, f)));
      cb(null, dir);
    },
    filename: (_req, file, cb) => cb(null, `_og-image${path.extname(file.originalname).toLowerCase() || '.jpg'}`),
  }),
  fileFilter: (_req, file, cb) => cb(null, IMAGE_EXT.test(file.originalname)),
});

function formatActivity(act) {
  return {
    id:            act.id,
    title:         act.title,
    startDate:     act.start_date ? act.start_date.toISOString().slice(0, 10) : '',
    endDate:       act.end_date   ? act.end_date.toISOString().slice(0, 10)   : '',
    ogTitle:       act.og_title       ?? '',
    ogDescription: act.og_description ?? '',
    ogImage:       act.og_image       ?? '',
    tags:          (act.activity_tags  || []).map(t => t.tag),
    content:       (act.activity_content || [])
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map(c => ({
        type:     c.type,
        ...(c.file     && { file:    c.file }),
        ...(c.video_id && { videoId: c.video_id }),
        hotspots: (c.activity_hotspots || []).map(h => ({
          id: h.id, x: Number(h.x), y: Number(h.y),
          width: Number(h.width), height: Number(h.height), url: h.url ?? '',
        })),
      })),
  };
}

const ACTIVITY_INCLUDE = {
  activity_tags:    true,
  activity_content: { include: { activity_hotspots: true } },
};

async function saveContent(tx, activityId, content) {
  await tx.activity_content.deleteMany({ where: { activity_id: activityId } });
  for (const [i, item] of content.entries()) {
    await tx.activity_content.create({
      data: {
        activity_id: activityId,
        type:        item.type,
        file:        item.file    || null,
        video_id:    item.videoId || null,
        sort_order:  i,
        activity_hotspots: {
          create: (item.hotspots || []).map(h => ({
            id: h.id, x: h.x, y: h.y, width: h.width, height: h.height, url: h.url || null,
          })),
        },
      },
    });
  }
}

/* GET all */
router.get('/', async (_req, res) => {
  const acts = await prisma.activities.findMany({
    include:  ACTIVITY_INCLUDE,
    orderBy:  { sort_order: 'asc' },
  });
  res.json({ activities: acts.map(formatActivity) });
});

/* POST create */
router.post('/', async (req, res) => {
  const { title, tags } = req.body;
  if (!title) return res.status(400).json({ error: 'title 為必填' });
  const id    = `act-${Date.now()}`;
  const count = await prisma.activities.count();
  await prisma.activities.create({
    data: {
      id, title, sort_order: count,
      activity_tags: { create: (Array.isArray(tags) ? tags : []).map(tag => ({ tag })) },
    },
  });
  fs.mkdirSync(path.join(DATA_DIR, 'activity-pic', id), { recursive: true });
  res.json({ success: true, id });
});

/* PUT update */
router.put('/:id', async (req, res) => {
  const act = await prisma.activities.findUnique({ where: { id: req.params.id } });
  if (!act) return res.status(404).json({ error: '找不到此活動頁' });
  const { title, content, ogTitle, ogDescription, ogImage, tags, startDate, endDate } = req.body;
  await prisma.$transaction(async (tx) => {
    await tx.activities.update({
      where: { id: req.params.id },
      data: {
        ...(title         !== undefined && { title }),
        ...(ogTitle       !== undefined && { og_title:       ogTitle       || null }),
        ...(ogDescription !== undefined && { og_description: ogDescription || null }),
        ...(ogImage       !== undefined && { og_image:       ogImage       || null }),
        ...(startDate     !== undefined && { start_date:     startDate ? new Date(startDate) : null }),
        ...(endDate       !== undefined && { end_date:       endDate   ? new Date(endDate)   : null }),
      },
    });
    if (tags !== undefined) {
      await tx.activity_tags.deleteMany({ where: { activity_id: req.params.id } });
      if (tags.length > 0) await tx.activity_tags.createMany({ data: tags.map(tag => ({ activity_id: req.params.id, tag })) });
    }
    if (content !== undefined) await saveContent(tx, req.params.id, content);
  });
  res.json({ success: true });
});

/* DELETE */
router.delete('/:id', async (req, res) => {
  const act = await prisma.activities.findUnique({ where: { id: req.params.id } });
  if (!act) return res.status(404).json({ error: '找不到此活動頁' });
  await prisma.activities.delete({ where: { id: req.params.id } });
  const dir = path.join(DATA_DIR, 'activity-pic', safeName(req.params.id));
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
  res.json({ success: true });
});

/* POST /:id/upload — upload content images */
router.post('/:id/upload', upload.array('images'), (req, res) => {
  const files = req.files?.map(f => f.filename) ?? [];
  res.json({ success: true, files });
});

/* POST /:id/upload-og */
router.post('/:id/upload-og', uploadOg.single('ogImage'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '無效的圖片' });
  res.json({ success: true, url: `/api/images/activity-pic/${req.params.id}/${req.file.filename}` });
});

/* POST /:id/replace-image/:index */
router.post('/:id/replace-image/:index', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '無效的圖片' });
  const contentIdx = parseInt(req.params.index, 10);
  if (isNaN(contentIdx)) return res.status(400).json({ error: '無效的索引' });

  const items = await prisma.activity_content.findMany({
    where: { activity_id: req.params.id },
    orderBy: { sort_order: 'asc' },
  });
  const target = items[contentIdx];
  if (!target || target.type !== 'image') return res.status(400).json({ error: '指定項目不是圖片' });

  const oldFile = safeName(target.file || '');
  if (oldFile && oldFile !== req.file.filename) {
    const oldPath = path.join(DATA_DIR, 'activity-pic', safeName(req.params.id), oldFile);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }
  await prisma.activity_content.update({ where: { id: target.id }, data: { file: req.file.filename } });
  res.json({ success: true, file: req.file.filename });
});

/* POST /:id/copy */
router.post('/:id/copy', async (req, res) => {
  const src = await prisma.activities.findUnique({
    where:   { id: req.params.id },
    include: { activity_tags: true, activity_content: { include: { activity_hotspots: true }, orderBy: { sort_order: 'asc' } } },
  });
  if (!src) return res.status(404).json({ error: '找不到此活動頁' });

  const newId  = `act-${Date.now()}`;
  const count  = await prisma.activities.count();

  await prisma.$transaction(async (tx) => {
    await tx.activities.create({
      data: {
        id:            newId,
        title:         `${src.title}（複製）`,
        og_title:      src.og_title,
        og_description: src.og_description,
        og_image:      src.og_image,
        start_date:    src.start_date,
        end_date:      src.end_date,
        sort_order:    count,
        activity_tags: { create: src.activity_tags.map(t => ({ tag: t.tag })) },
      },
    });
    for (const item of src.activity_content) {
      await tx.activity_content.create({
        data: {
          activity_id: newId,
          type:        item.type,
          file:        item.file,
          video_id:    item.video_id,
          sort_order:  item.sort_order,
          activity_hotspots: {
            create: item.activity_hotspots.map(h => ({
              id: randomUUID(), x: h.x, y: h.y, width: h.width, height: h.height, url: h.url,
            })),
          },
        },
      });
    }
  });

  const srcDir = path.join(DATA_DIR, 'activity-pic', safeName(req.params.id));
  const dstDir = path.join(DATA_DIR, 'activity-pic', newId);
  fs.mkdirSync(dstDir, { recursive: true });
  if (fs.existsSync(srcDir)) {
    fs.readdirSync(srcDir).forEach(file => fs.copyFileSync(path.join(srcDir, file), path.join(dstDir, file)));
  }

  res.json({ success: true, id: newId });
});

/* DELETE /:id/image/:file */
router.delete('/:id/image/:file', (req, res) => {
  const id   = safeName(req.params.id);
  const file = safeName(req.params.file);
  if (!id || id !== req.params.id || !/^[\w-]+$/.test(id) || !file || file !== req.params.file)
    return res.status(400).json({ error: '無效的參數' });
  const filePath = path.join(DATA_DIR, 'activity-pic', id, file);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: '檔案不存在' });
  fs.unlinkSync(filePath);
  res.json({ success: true });
});

module.exports = router;
