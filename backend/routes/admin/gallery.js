const express  = require('express');
const multer   = require('multer');
const fs       = require('fs');
const path     = require('path');
const { DATA_DIR } = require('../../utils/json');
const prisma   = require('../../utils/db');

const router    = express.Router();
const PIC_DIR   = path.join(DATA_DIR, 'gallery-pic');
const IMAGE_EXT = /\.(jpg|jpeg|png|webp)$/i;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => { fs.mkdirSync(PIC_DIR, { recursive: true }); cb(null, PIC_DIR); },
  filename:    (_req, file,  cb) => cb(null, file.originalname),
});
const upload = multer({ storage, fileFilter: (_req, file, cb) => cb(null, IMAGE_EXT.test(file.originalname)) });

function formatContent(rows) {
  return rows.map(r => ({
    type:     r.type,
    file:     r.file     ?? undefined,
    videoId:  r.video_id ?? undefined,
    hotspots: (r.gallery_hotspots ?? []).map(h => ({
      id: h.id, x: Number(h.x), y: Number(h.y),
      width: Number(h.width), height: Number(h.height), url: h.url,
    })),
  }));
}

/* GET */
router.get('/', async (_req, res) => {
  const rows = await prisma.gallery_content.findMany({
    include: { gallery_hotspots: true },
    orderBy: { sort_order: 'asc' },
  });
  res.json({ content: formatContent(rows) });
});

/* PUT — 全量替換 */
router.put('/', async (req, res) => {
  const { content } = req.body;
  if (!Array.isArray(content)) return res.status(400).json({ error: 'content 必須是陣列' });
  await prisma.$transaction(async (tx) => {
    await tx.gallery_content.deleteMany();
    for (const [i, item] of content.entries()) {
      await tx.gallery_content.create({
        data: {
          type:       item.type,
          file:       item.file    || null,
          video_id:   item.videoId || null,
          sort_order: i,
          gallery_hotspots: {
            create: (item.hotspots || []).map(h => ({
              id: h.id, x: h.x, y: h.y, width: h.width, height: h.height, url: h.url || null,
            })),
          },
        },
      });
    }
  });
  res.json({ success: true });
});

/* POST /upload */
router.post('/upload', upload.array('images'), (req, res) => {
  const files = req.files?.map(f => f.filename) ?? [];
  res.json({ success: true, files });
});

/* DELETE /image/:file */
router.delete('/image/:file', (req, res) => {
  const file = path.basename(req.params.file ?? '');
  if (!file || file !== req.params.file) return res.status(400).json({ error: '無效的檔名' });
  const filePath = path.join(PIC_DIR, file);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: '檔案不存在' });
  fs.unlinkSync(filePath);
  res.json({ success: true });
});

module.exports = router;
