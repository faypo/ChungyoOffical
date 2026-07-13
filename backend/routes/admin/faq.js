'use strict';

const express        = require('express');
const multer         = require('multer');
const fs             = require('fs');
const path           = require('path');
const { randomUUID } = require('crypto');
const { DATA_DIR }   = require('../../utils/json');
const prisma         = require('../../utils/db');

const router      = express.Router();
const FAQ_IMG_DIR = path.join(DATA_DIR, 'faq-images');
const IMAGE_EXT   = /\.(jpg|jpeg|png|webp|gif)$/i;

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(FAQ_IMG_DIR, { recursive: true });
      cb(null, FAQ_IMG_DIR);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `${randomUUID()}${ext}`);
    },
  }),
  fileFilter: (_req, file, cb) => cb(null, IMAGE_EXT.test(file.originalname)),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// POST /api/admin/faq/upload — 上傳圖片，回傳可用的 URL
router.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '無效的圖片' });
  res.json({ url: `/api/images/faq-images/${req.file.filename}` });
});

const FAQ_FALLBACK_KEY = 'faq_fallback_message';

// GET /api/admin/faq/config — 取得 FAQ 設定（目前只有 fallback 訊息）
router.get('/config', async (_req, res) => {
  const row = await prisma.config.findUnique({ where: { key_name: FAQ_FALLBACK_KEY } });
  res.json({ fallback_message: row?.value ?? '' });
});

// PUT /api/admin/faq/config — 儲存 fallback 訊息
router.put('/config', async (req, res) => {
  const { fallback_message } = req.body;
  if (typeof fallback_message !== 'string')
    return res.status(400).json({ error: '無效的資料' });
  await prisma.config.upsert({
    where:  { key_name: FAQ_FALLBACK_KEY },
    update: { value: fallback_message.trim() },
    create: { key_name: FAQ_FALLBACK_KEY, value: fallback_message.trim() },
  });
  res.json({ ok: true });
});

// GET /api/admin/faq/unanswered — 未解答問題清單（依次數排序）
router.get('/unanswered', async (_req, res) => {
  const rows = await prisma.faq_unanswered.findMany({ orderBy: [{ ask_count: 'desc' }, { last_asked_at: 'desc' }] });
  res.json(rows);
});

// DELETE /api/admin/faq/unanswered/:id — 刪除（已處理或忽略）
router.delete('/unanswered/:id', async (req, res) => {
  await prisma.faq_unanswered.delete({ where: { id: Number(req.params.id) } }).catch(() => null);
  res.json({ ok: true });
});

// GET /api/admin/faq — 所有節點（flat，含 is_root 標記）
router.get('/', async (_req, res) => {
  const [nodes, links] = await Promise.all([
    prisma.faq_nodes.findMany({ orderBy: { created_at: 'asc' } }),
    prisma.faq_node_links.findMany({ select: { child_id: true } }),
  ]);
  const childIds = new Set(links.map(l => l.child_id));
  res.json(nodes.map(n => ({ ...n, is_root: !childIds.has(n.id) })));
});

// POST /api/admin/faq — 新增節點
router.post('/', async (req, res) => {
  const { question, answer, keywords, start_date, end_date } = req.body;
  if (!question?.trim() || !answer?.trim())
    return res.status(400).json({ error: '問題與答案為必填' });
  const node = await prisma.faq_nodes.create({
    data: {
      question:   question.trim(),
      answer:     answer.trim(),
      keywords:   keywords?.trim() || null,
      start_date: start_date ? new Date(start_date) : null,
      end_date:   end_date   ? new Date(end_date)   : null,
    },
  });
  res.status(201).json(node);
});

// GET /api/admin/faq/:id/links — 某節點的後續問題清單
router.get('/:id/links', async (req, res) => {
  const id = Number(req.params.id);
  const links = await prisma.faq_node_links.findMany({
    where:   { parent_id: id },
    orderBy: { sort_order: 'asc' },
    include: { child: true },
  });
  res.json(links.map(l => ({ link_id: l.id, sort_order: l.sort_order, ...l.child })));
});

// POST /api/admin/faq/:id/links — 新增後續問題連結
router.post('/:id/links', async (req, res) => {
  const parent_id = Number(req.params.id);
  const child_id  = Number(req.body.child_id);
  if (!child_id || child_id === parent_id)
    return res.status(400).json({ error: '無效的連結' });
  const count = await prisma.faq_node_links.count({ where: { parent_id } });
  const link  = await prisma.faq_node_links.create({
    data: { parent_id, child_id, sort_order: count },
  }).catch(() => null);
  if (!link) return res.status(409).json({ error: '連結已存在' });
  res.status(201).json(link);
});

// PUT /api/admin/faq/:id/links/reorder — 重排後續問題順序
// body: [{ link_id, sort_order }, ...]
router.put('/:id/links/reorder', async (req, res) => {
  const items = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ error: 'body 須為陣列' });
  await prisma.$transaction(
    items.map(({ link_id, sort_order }) =>
      prisma.faq_node_links.update({ where: { id: link_id }, data: { sort_order } })
    )
  );
  res.json({ ok: true });
});

// DELETE /api/admin/faq/links/:linkId — 移除連結（不刪節點）
// 必須在 DELETE /:id 之前，避免 'links' 被當成 id
router.delete('/links/:linkId', async (req, res) => {
  const id = Number(req.params.linkId);
  await prisma.faq_node_links.delete({ where: { id } }).catch(() => null);
  res.json({ ok: true });
});

// PUT /api/admin/faq/:id — 更新節點
router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { question, answer, keywords, is_active, start_date, end_date } = req.body;
  if (!question?.trim() || !answer?.trim())
    return res.status(400).json({ error: '問題與答案為必填' });
  const node = await prisma.faq_nodes.update({
    where: { id },
    data: {
      question:   question.trim(),
      answer:     answer.trim(),
      keywords:   keywords?.trim() || null,
      start_date: start_date ? new Date(start_date) : null,
      end_date:   end_date   ? new Date(end_date)   : null,
      ...(is_active !== undefined && { is_active }),
      updated_at: new Date(),
    },
  }).catch(() => null);
  if (!node) return res.status(404).json({ error: '找不到該節點' });
  res.json(node);
});

// DELETE /api/admin/faq/:id — 刪除節點（關聯連結 cascade 自動刪）
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  await prisma.faq_nodes.delete({ where: { id } }).catch(() => null);
  res.json({ ok: true });
});

module.exports = router;
