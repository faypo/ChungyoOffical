'use strict';

const express = require('express');
const prisma  = require('../../utils/db');

const router = express.Router();

// 將 DB 節點列表組成樹狀結構
function buildTree(nodes, parentId = null) {
  return nodes
    .filter(n => n.parent_id === parentId)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(n => ({ ...n, children: buildTree(nodes, n.id) }));
}

// GET /api/admin/faq — 完整樹
router.get('/', async (_req, res) => {
  const nodes = await prisma.faq_nodes.findMany({ orderBy: { sort_order: 'asc' } });
  res.json(buildTree(nodes));
});

// POST /api/admin/faq — 新增節點
router.post('/', async (req, res) => {
  const { parent_id, question, answer, keywords, sort_order } = req.body;
  if (!question?.trim() || !answer?.trim()) {
    return res.status(400).json({ error: '問題與答案為必填' });
  }
  const node = await prisma.faq_nodes.create({
    data: {
      parent_id:  parent_id ?? null,
      question:   question.trim(),
      answer:     answer.trim(),
      keywords:   keywords?.trim() || null,
      sort_order: sort_order ?? 0,
    },
  });
  res.status(201).json(node);
});

// PUT /api/admin/faq/:id — 更新節點
router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { question, answer, keywords, sort_order, is_active, parent_id } = req.body;
  if (!question?.trim() || !answer?.trim()) {
    return res.status(400).json({ error: '問題與答案為必填' });
  }
  const node = await prisma.faq_nodes.update({
    where: { id },
    data: {
      question:   question.trim(),
      answer:     answer.trim(),
      keywords:   keywords?.trim() || null,
      sort_order: sort_order ?? 0,
      is_active:  is_active ?? true,
      ...(parent_id !== undefined ? { parent_id: parent_id ?? null } : {}),
      updated_at: new Date(),
    },
  }).catch(() => null);
  if (!node) return res.status(404).json({ error: '找不到該節點' });
  res.json(node);
});

// DELETE /api/admin/faq/:id — 刪除節點（子節點 cascade）
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  await prisma.faq_nodes.delete({ where: { id } }).catch(() => null);
  res.json({ ok: true });
});

// PUT /api/admin/faq/reorder — 批次更新同層 sort_order
// body: [{ id, sort_order }, ...]
router.put('/reorder', async (req, res) => {
  const items = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ error: 'body 須為陣列' });
  await prisma.$transaction(
    items.map(({ id, sort_order }) =>
      prisma.faq_nodes.update({ where: { id }, data: { sort_order } })
    )
  );
  res.json({ ok: true });
});

module.exports = router;
