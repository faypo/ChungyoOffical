const express = require('express');
const fs      = require('fs');
const path    = require('path');
const { DATA_DIR } = require('../utils/json');
const prisma  = require('../utils/db');

const IMAGE_EXT    = /\.(jpg|jpeg|png|webp)$/i;
const SERVICE_KEYS = ['service', 'traffic', 'parking', 'gift'];

const router = express.Router();

router.get('/catalog', async (_req, res) => {
  const catalogs = await prisma.dm_catalogs.findMany({
    include: { dm_buttons: true, dm_hotspots: true },
    orderBy: { sort_order: 'asc' },
  });
  res.json(catalogs.map(dm => ({
    id:        dm.id,
    order:     dm.sort_order,
    title:     dm.title,
    subtitle:  dm.subtitle  || '',
    type:      dm.type,
    cover:     dm.cover     || undefined,
    url:       dm.url       || '',
    startDate: dm.start_date ? dm.start_date.toISOString().slice(0, 10) : '',
    endDate:   dm.end_date   ? dm.end_date.toISOString().slice(0, 10)   : '',
    button:    dm.dm_buttons.map(b => ({ page: b.page, url: b.url || '' })),
    hotspots:  dm.dm_hotspots.map(h => ({
      id: h.id, x: Number(h.x), y: Number(h.y), width: Number(h.width), height: Number(h.height), url: h.url || '',
    })),
  })));
});

router.get('/floor-guide', async (_req, res) => {
  const [floors, infos, counters] = await Promise.all([
    prisma.floor_floors.findMany({ orderBy: { sort_order: 'asc' } }),
    prisma.floor_info.findMany({ include: { floor_info_icons: { orderBy: { sort_order: 'asc' } } } }),
    prisma.floor_counters.findMany({ orderBy: [{ building: 'asc' }, { sort_order: 'asc' }] }),
  ]);
  const floorInfo = {};
  for (const info of infos) {
    if (!floorInfo[info.building]) floorInfo[info.building] = {};
    floorInfo[info.building][info.floor_id] = { title: info.title || '', icons: info.floor_info_icons.map(i => i.file) };
  }
  const counterMap = {};
  for (const c of counters) {
    if (!counterMap[c.building]) counterMap[c.building] = {};
    if (!counterMap[c.building][c.floor_id]) counterMap[c.building][c.floor_id] = [];
    counterMap[c.building][c.floor_id].push({ name: c.name||'', phone: c.phone||'', logo: c.logo||'', description: c.description||'' });
  }
  res.json({ floors: floors.map(f => ({ id: f.id, label: f.label })), floorInfo, counters: counterMap });
});

router.get('/food-guide', async (_req, res) => {
  const [cats, items] = await Promise.all([
    prisma.food_categories.findMany({ orderBy: { sort_order: 'asc' } }),
    prisma.food_items.findMany({ orderBy: { sort_order: 'asc' } }),
  ]);
  const restaurants = {};
  cats.forEach(c => { restaurants[c.id] = { theme: [], foodcourt: [] }; });
  items.forEach(r => {
    const section = r.section || 'theme';
    if (restaurants[r.category_id]) restaurants[r.category_id][section].push({
      name: r.name||'', building: r.building ? r.building+'棟' : '', floor: r.floor_id||'',
      phone: r.phone||'', image: r.logo||'', description: r.description||'',
    });
  });
  res.json({ categories: cats.map(c => ({ id: c.id, label: c.label })), restaurants });
});

router.get('/dm/:id/pages', (req, res) => {
  if (!/^[\w-]+$/.test(req.params.id)) return res.status(400).json({ error: 'Invalid ID' });
  const indexPath = path.join(DATA_DIR, 'dm-pic', req.params.id, 'index.json');
  if (!fs.existsSync(indexPath)) return res.status(404).json({ error: 'DM not found' });
  res.json(JSON.parse(fs.readFileSync(indexPath, 'utf8')));
});

router.get('/service-images', (_req, res) => {
  const dir = path.join(DATA_DIR, 'service');
  const result = {};
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir).filter(f => IMAGE_EXT.test(f));
    SERVICE_KEYS.forEach(key => {
      const found = files.find(f => f.toLowerCase().startsWith(key + '.'));
      if (found) result[key] = `/api/images/service/${found}`;
    });
  }
  res.json(result);
});

router.get('/winners', async (_req, res) => {
  const events = await prisma.winners_events.findMany({
    include: { winners_rows: true },
    orderBy: { sort_order: 'asc' },
  });
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
  res.json({
    events: events.map(ev => ({
      id:        ev.id,
      title:     ev.title,
      subtitle1: ev.subtitle1 || '',
      subtitle2: ev.subtitle2 || '',
      columns:   Array.isArray(ev.columns) ? ev.columns : [],
      rows:      buildTree(
        ev.winners_rows.sort((a, b) => (a.depth??0)-(b.depth??0) || (a.sort_order??0)-(b.sort_order??0))
      ),
    })),
  });
});

router.get('/activity/:id', async (req, res) => {
  const act = await prisma.activities.findUnique({
    where:   { id: req.params.id },
    include: { activity_tags: true, activity_content: { include: { activity_hotspots: true } } },
  });
  if (!act) return res.status(404).json({ error: '找不到此活動頁' });
  res.json({
    id:            act.id,
    title:         act.title,
    startDate:     act.start_date ? act.start_date.toISOString().slice(0, 10) : '',
    endDate:       act.end_date   ? act.end_date.toISOString().slice(0, 10)   : '',
    ogTitle:       act.og_title       ?? '',
    ogDescription: act.og_description ?? '',
    ogImage:       act.og_image       ?? '',
    tags:          act.activity_tags.map(t => t.tag),
    content:       act.activity_content
      .sort((a, b) => (a.sort_order??0) - (b.sort_order??0))
      .map(c => ({
        type:     c.type,
        ...(c.file     && { file:    c.file }),
        ...(c.video_id && { videoId: c.video_id }),
        hotspots: c.activity_hotspots.map(h => ({
          id: h.id, x: Number(h.x), y: Number(h.y), width: Number(h.width), height: Number(h.height), url: h.url??'',
        })),
      })),
  });
});

router.get('/banners', async (_req, res) => {
  const now     = new Date();
  const banners = await prisma.banners.findMany({
    where: {
      is_active: true,
      OR:  [{ start_date: null }, { start_date: { lte: now } }],
      AND: [{ OR: [{ end_date: null }, { end_date: { gte: now } }] }],
    },
    orderBy: { sort_order: 'asc' },
  });
  res.json({ banners });
});

router.get('/home-events', async (_req, res) => {
  const now    = new Date();
  const events = await prisma.home_events.findMany({
    where: {
      OR:  [{ start_date: null }, { start_date: { lte: now } }],
      AND: [{ OR: [{ end_date: null }, { end_date: { gte: now } }] }],
    },
    orderBy: { sort_order: 'asc' },
  });
  res.json({ events });
});

router.get('/gallery', async (_req, res) => {
  const rows = await prisma.gallery_content.findMany({
    include: { gallery_hotspots: true },
    orderBy: { sort_order: 'asc' },
  });
  const content = rows.map(r => ({
    type:    r.type,
    file:    r.file    ?? undefined,
    videoId: r.video_id ?? undefined,
    hotspots: (r.gallery_hotspots ?? []).map(h => ({
      id: h.id, x: Number(h.x), y: Number(h.y),
      width: Number(h.width), height: Number(h.height), url: h.url,
    })),
  }));
  res.json({ content });
});

router.get('/logos', async (_req, res) => {
  const groups = await prisma.logo_groups.findMany({
    include: { logos: { orderBy: { sort_order: 'asc' } } },
    orderBy: { sort_order: 'asc' },
  });
  res.json({ groups });
});

router.get('/home-promo', async (_req, res) => {
  const promo = await prisma.home_promo.findFirst({
    include: { home_promo_cards: { orderBy: { slot: 'asc' } } },
  });
  if (!promo) return res.json({});
  res.json({
    title:      promo.title       ?? '',
    heroFile:   promo.hero_file   ?? '',
    heroUrl:    promo.hero_url    ?? '',
    leftLabel:  promo.left_label  ?? '',
    rightLabel: promo.right_label ?? '',
    cards: promo.home_promo_cards.map(c => ({ slot: c.slot, file: c.file ?? '', url: c.url ?? '' })),
  });
});

router.get('/home-fb', async (_req, res) => {
  const row = await prisma.config.findUnique({ where: { key_name: 'home_fb_src' } });
  res.json({ src: row?.value ?? '' });
});

router.get('/config', async (_req, res) => {
  const rows = await prisma.config.findMany();
  res.json(Object.fromEntries(rows.map(r => [r.key_name, r.value])));
});

router.get('/privacy-policy', (_req, res) => {
  const filePath = path.join(DATA_DIR, 'privacy-policy.html');
  if (!fs.existsSync(filePath)) return res.status(404).send('');
  res.type('html').send(fs.readFileSync(filePath, 'utf8'));
});

module.exports = router;
