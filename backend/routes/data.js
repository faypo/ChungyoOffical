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

// POST /api/faq/unanswered — 記錄無法回答的問題（upsert，重複提問累加次數）
router.post('/faq/unanswered', async (req, res) => {
  const query = (req.body?.query ?? '').trim().slice(0, 500);
  if (!query) return res.status(400).json({ error: '缺少 query' });
  await prisma.$executeRaw`
    INSERT INTO faq_unanswered (query, ask_count, last_asked_at)
    VALUES (${query}, 1, NOW())
    ON DUPLICATE KEY UPDATE ask_count = ask_count + 1, last_asked_at = NOW()
  `;
  res.json({ ok: true });
});

// GET /api/faq/search?q=...&context=1,2,3 — 關鍵字搜尋（含對話語境加權）
// 必須在 /faq/:id 之前定義，否則 'search' 會被當成 id 參數
router.get('/faq/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);

  const qLower   = q.toLowerCase();
  const qCompact = qLower.replace(/\s/g, ''); // 去空白，用於字符窗口匹配
  const terms    = q.split(/\s+/).filter(Boolean);

  // 對話語境：最近討論過的節點 ID
  const contextIds = (req.query.context || '')
    .split(',').map(Number).filter(n => n > 0);

  const now = new Date();
  const [nodes, contextLinks, floors, allCounters] = await Promise.all([
    prisma.faq_nodes.findMany({
      where: {
        is_active: true,
        OR: [{ start_date: null }, { start_date: { lte: now } }],
        AND: [{ OR: [{ end_date: null }, { end_date: { gte: now } }] }],
      },
    }),
    contextIds.length > 0
      ? prisma.faq_node_links.findMany({ where: { parent_id: { in: contextIds } }, select: { child_id: true } })
      : Promise.resolve([]),
    prisma.floor_floors.findMany(),
    prisma.floor_counters.findMany(),
  ]);

  const contextChildIds = new Set(contextLinks.map(l => l.child_id));

  // 樓層櫃位名稱比對
  const floorLabel = Object.fromEntries(
    floors.map(f => [f.id, (f.label ?? '').split(/\s+/)[0] || f.id])
  );
  const counterGroups = {};
  for (const c of allCounters) {
    if (!c.name || c.name.length < 2) continue;
    if (qLower.includes(c.name.toLowerCase())) {
      if (!counterGroups[c.name]) counterGroups[c.name] = [];
      counterGroups[c.name].push(`${c.building}棟 ${floorLabel[c.floor_id] ?? c.floor_id}`);
    }
  }
  const counterResults = Object.entries(counterGroups).map(([name, locs]) => ({
    type:     'counter',
    question: `${name} 在哪裡？`,
    answer:   locs.length === 1
      ? `${name} 位於 ${locs[0]}。`
      : `${name} 位於：\n${locs.map(l => `• ${l}`).join('\n')}`,
    score:    4,
  }));

  const scored = nodes
    .map(n => {
      const haystack = (n.keywords ?? '').toLowerCase();

      // 正向：搜尋詞出現在關鍵字中
      const fwdScore = terms.reduce((acc, t) => acc + (haystack.includes(t.toLowerCase()) ? 1 : 0), 0);

      // 反向精確：標籤直接出現在搜尋句中（允許單字關鍵字）
      const kwTokens = (n.keywords ?? '').toLowerCase()
        .split(/[\s,，、;；]+/).filter(kw => kw.length >= 1);
      const revScore = kwTokens.reduce((acc, kw) => acc + (qLower.includes(kw) ? 1 : 0), 0);

      // 滑動窗口：關鍵字的字符在搜尋詞鄰近範圍內都出現（需 >= 2 字才有意義）
      // 處理語序變化，例：「車子停在哪」能匹配關鍵字「停車」
      const winScore = kwTokens.filter(kw => kw.length >= 2).reduce((acc, kw) => {
        if (qLower.includes(kw)) return acc; // 已精確匹配，不重複計分
        const chars   = [...kw];
        const winSize = chars.length * 2;    // 窗口為關鍵字長度的 2 倍
        for (let i = 0; i <= qCompact.length - chars.length; i++) {
          const win = qCompact.slice(i, i + winSize);
          if (chars.every(c => win.includes(c))) return acc + 1;
        }
        return acc;
      }, 0);

      // 語境加分：此節點是語境節點的後續問題，且本身有關鍵字匹配才加分
      // 避免完全不相關的問題被舊對話語境強制拉高
      const baseScore = fwdScore + revScore + winScore;
      const ctxBoost  = (baseScore > 0 && contextChildIds.has(n.id)) ? 2 : 0;

      return { ...n, score: baseScore + ctxBoost };
    })
    .filter(n => n.score > 0)
    .sort((a, b) => b.score - a.score || a.id - b.id)
    .slice(0, 5);

  const combined = [...scored, ...counterResults]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  // 背景寫入查詢紀錄（不阻塞回應）
  prisma.faq_query_log.create({
    data: { query: q, answered: combined.length > 0 },
  }).catch(() => {});

  res.json(combined);
});

// GET /api/faq/:id — 單一節點（含後續問題）
router.get('/faq/:id', async (req, res) => {
  const id  = Number(req.params.id);
  const now = new Date();
  const node = await prisma.faq_nodes.findFirst({
    where: {
      id,
      is_active: true,
      OR:  [{ start_date: null }, { start_date: { lte: now } }],
      AND: [{ OR: [{ end_date: null }, { end_date: { gte: now } }] }],
    },
  });
  if (!node) return res.status(404).json({ error: 'Not found' });

  const links = await prisma.faq_node_links.findMany({
    where:   { parent_id: id },
    orderBy: { sort_order: 'asc' },
    include: { child: true },
  });
  const children = links
    .filter(l => l.child.is_active &&
      (l.child.start_date === null || l.child.start_date <= now) &&
      (l.child.end_date   === null || l.child.end_date   >= now))
    .map(l => l.child);

  res.json({ ...node, children });
});

module.exports = router;
