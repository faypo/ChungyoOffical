const express = require('express');
const prisma  = require('../../utils/db');

const router = express.Router();

function buildTree(rows) {
  const map = {};
  for (const r of rows) map[r.id] = { value: r.value || '', children: [] };
  const roots = [];
  for (const r of rows) {
    if (r.parent_id === null) roots.push(map[r.id]);
    else if (map[r.parent_id]) map[r.parent_id].children.push(map[r.id]);
  }
  return roots;
}

async function insertTree(tx, nodes, eventId, parentId, depth) {
  for (const [i, node] of nodes.entries()) {
    const row = await tx.winners_rows.create({
      data: { event_id: eventId, parent_id: parentId, value: node.value || '', depth, sort_order: i },
    });
    if (node.children?.length) await insertTree(tx, node.children, eventId, row.id, depth + 1);
  }
}

async function formatEvent(ev) {
  return {
    id:        ev.id,
    title:     ev.title,
    subtitle1: ev.subtitle1 || '',
    subtitle2: ev.subtitle2 || '',
    columns:   Array.isArray(ev.columns) ? ev.columns : [],
    rows:      buildTree(
      (ev.winners_rows || []).sort((a, b) => (a.depth ?? 0) - (b.depth ?? 0) || (a.sort_order ?? 0) - (b.sort_order ?? 0))
    ),
  };
}

/* GET all */
router.get('/', async (_req, res) => {
  const events = await prisma.winners_events.findMany({
    include: { winners_rows: true },
    orderBy: { sort_order: 'asc' },
  });
  res.json({ events: await Promise.all(events.map(formatEvent)) });
});

/* POST add event */
router.post('/events', async (req, res) => {
  const { title, subtitle1, subtitle2, columns } = req.body;
  if (!title) return res.status(400).json({ error: 'title 為必填' });
  const count = await prisma.winners_events.count();
  await prisma.winners_events.create({
    data: {
      id:        `ev-${Date.now()}`,
      title,
      subtitle1: subtitle1 ?? '',
      subtitle2: subtitle2 ?? '',
      columns:   Array.isArray(columns) ? columns : ['', '', '', '', ''],
      sort_order: count,
    },
  });
  res.json({ success: true });
});

/* PUT update event */
router.put('/events/:id', async (req, res) => {
  const ev = await prisma.winners_events.findUnique({ where: { id: req.params.id } });
  if (!ev) return res.status(404).json({ error: '找不到此活動' });
  const { title, subtitle1, subtitle2, columns, rows } = req.body;
  await prisma.$transaction(async (tx) => {
    await tx.winners_events.update({
      where: { id: req.params.id },
      data: {
        ...(title     !== undefined && { title }),
        ...(subtitle1 !== undefined && { subtitle1 }),
        ...(subtitle2 !== undefined && { subtitle2 }),
        ...(columns   !== undefined && { columns }),
      },
    });
    if (rows !== undefined) {
      await tx.winners_rows.deleteMany({ where: { event_id: req.params.id } });
      await insertTree(tx, rows, req.params.id, null, 0);
    }
  });
  res.json({ success: true });
});

/* DELETE event */
router.delete('/events/:id', async (req, res) => {
  const ev = await prisma.winners_events.findUnique({ where: { id: req.params.id } });
  if (!ev) return res.status(404).json({ error: '找不到此活動' });
  await prisma.winners_events.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

/* PUT reorder events (sends full events array with new sort positions) */
router.put('/events', async (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: '格式錯誤' });
  await prisma.$transaction(async (tx) => {
    for (const [i, ev] of req.body.entries()) {
      if (!ev.id) continue;
      const { title, subtitle1, subtitle2, columns, rows } = ev;
      await tx.winners_events.update({
        where: { id: ev.id },
        data: {
          sort_order: i,
          ...(title     !== undefined && { title }),
          ...(subtitle1 !== undefined && { subtitle1 }),
          ...(subtitle2 !== undefined && { subtitle2 }),
          ...(columns   !== undefined && { columns }),
        },
      });
      if (rows !== undefined) {
        await tx.winners_rows.deleteMany({ where: { event_id: ev.id } });
        await insertTree(tx, rows, ev.id, null, 0);
      }
    }
  });
  res.json({ success: true });
});

/* PUT /:id — alias for update by event ID */
router.put('/:id', async (req, res) => {
  const ev = await prisma.winners_events.findUnique({ where: { id: req.params.id } });
  if (!ev) return res.status(404).json({ error: '找不到此活動' });
  const { title, subtitle1, subtitle2, columns, rows } = req.body;
  await prisma.$transaction(async (tx) => {
    await tx.winners_events.update({
      where: { id: req.params.id },
      data: {
        ...(title     !== undefined && { title }),
        ...(subtitle1 !== undefined && { subtitle1 }),
        ...(subtitle2 !== undefined && { subtitle2 }),
        ...(columns   !== undefined && { columns }),
      },
    });
    if (rows !== undefined) {
      await tx.winners_rows.deleteMany({ where: { event_id: req.params.id } });
      await insertTree(tx, rows, req.params.id, null, 0);
    }
  });
  res.json({ success: true });
});

/* DELETE /:id — alias for delete by event ID */
router.delete('/:id', async (req, res) => {
  const ev = await prisma.winners_events.findUnique({ where: { id: req.params.id } });
  if (!ev) return res.status(404).json({ error: '找不到此活動' });
  await prisma.winners_events.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

module.exports = router;
