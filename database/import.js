#!/usr/bin/env node
// import.js - Import all JSON data into MySQL via Prisma
// Usage: node database/import.js  (from project root, or any directory)
'use strict';

const path = require('path');
const BACKEND = path.join(__dirname, '../backend');

// Load dotenv and Prisma from backend's own node_modules (works from any CWD)
require(path.join(BACKEND, 'node_modules/dotenv')).config({ path: path.join(BACKEND, '.env') });
const fs     = require('fs');
const prisma = require(path.join(BACKEND, 'utils/db'));

const DATA = path.join(BACKEND, 'data');

function read(name) {
  return JSON.parse(fs.readFileSync(path.join(DATA, name), 'utf8'));
}

function toDate(s) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function toBldg(s) {
  if (!s) return null;
  const b = s.replace('棟', '').trim();
  return b || null;
}

// ── winners helpers ──────────────────────────────────────────────────────────
let _rowId = 0;
async function insertTree(tx, nodes, eventId, parentId, depth) {
  for (const [i, node] of nodes.entries()) {
    const row = await tx.winners_rows.create({
      data: { event_id: eventId, parent_id: parentId, value: node.value || '', depth, sort_order: i }
    });
    if (node.children?.length) await insertTree(tx, node.children, eventId, row.id, depth + 1);
    _rowId++;
  }
}

// ── step runner ───────────────────────────────────────────────────────────────
const STEPS = 12;
let step = 0;
function log(label) {
  step++;
  process.stdout.write(`  [${step}/${STEPS}] ${label} ...`);
}
function ok(n) { console.log(` OK (${n})`); }
function fail(e) { console.error(` FAILED: ${e.message}`); }

// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n========================================');
  console.log(`  Data Import -- Node.js / Prisma`);
  console.log('========================================\n');

  // 1. floor
  log('floor');
  try {
    const fg = read('floor-guide.json');
    await prisma.$transaction(async (tx) => {
      await tx.floor_counters.deleteMany({});
      await tx.floor_info_icons.deleteMany({});
      await tx.floor_info.deleteMany({});
      await tx.floor_floors.deleteMany({});

      for (const [i, f] of fg.floors.entries()) {
        await tx.floor_floors.create({ data: { id: f.id, label: f.label, sort_order: i } });
      }

      let infoId = 0;
      for (const bldg of ['A', 'B', 'C']) {
        const bData = fg.floorInfo?.[bldg];
        if (!bData) continue;
        for (const fid of Object.keys(bData)) {
          const info = bData[fid];
          infoId++;
          await tx.floor_info.create({
            data: {
              id: infoId, floor_id: fid, building: bldg, title: info.title || null,
              ...(info.icons?.length ? {
                floor_info_icons: { create: info.icons.map((file, j) => ({ file, sort_order: j })) }
              } : {})
            }
          });
        }
      }

      let ci = 0;
      for (const bldg of ['A', 'B', 'C']) {
        const bData = fg.counters?.[bldg];
        if (!bData) continue;
        for (const fid of Object.keys(bData)) {
          for (const [fi, c] of bData[fid].entries()) {
            await tx.floor_counters.create({
              data: {
                floor_id: fid, building: bldg,
                name: c.name || null, phone: c.phone || null,
                logo: c.logo || null, description: c.description || null,
                sort_order: fi,
              }
            });
            ci++;
          }
        }
      }
      ok(`${fg.floors.length} floors, ${ci} counters`);
    });
  } catch (e) { fail(e); }

  // 2. banners
  log('banners');
  try {
    const j = read('banners.json');
    await prisma.$transaction(async (tx) => {
      await tx.banners.deleteMany({});
      for (const [i, b] of j.banners.entries()) {
        await tx.banners.create({ data: {
          id: b.id, file: b.file, url: b.url || null,
          start_date: toDate(b.startDate), end_date: toDate(b.endDate), sort_order: i
        }});
      }
    });
    ok(`${j.banners.length} records`);
  } catch (e) { fail(e); }

  // 3. activities
  log('activities');
  try {
    const j = read('activities.json');
    await prisma.$transaction(async (tx) => {
      await tx.activity_hotspots.deleteMany({});
      await tx.activity_content.deleteMany({});
      await tx.activity_tags.deleteMany({});
      await tx.activity_views.deleteMany({});
      await tx.activities.deleteMany({});

      for (const [i, a] of j.activities.entries()) {
        await tx.activities.create({ data: {
          id: a.id, title: a.title,
          start_date: toDate(a.startDate), end_date: toDate(a.endDate),
          og_title: a.ogTitle || null, og_description: a.ogDescription || null, og_image: a.ogImage || null,
          sort_order: i,
          activity_tags: { create: (a.tags || []).filter(t => t).map(tag => ({ tag })) },
          activity_content: { create: (a.content || []).map((c, ci) => ({
            type: c.type, file: c.file || null, video_id: c.videoId || null, sort_order: ci,
            activity_hotspots: { create: (c.hotspots || []).map(h => ({
              id: h.id, x: h.x, y: h.y, width: h.width, height: h.height, url: h.url || null
            }))}
          }))}
        }});
      }
    });
    ok(`${j.activities.length} activities`);
  } catch (e) { fail(e); }

  // 4. dm_catalogs
  log('dm_catalogs');
  try {
    const j = read('catalog.json');
    await prisma.$transaction(async (tx) => {
      await tx.dm_hotspots.deleteMany({});
      await tx.dm_buttons.deleteMany({});
      await tx.dm_catalogs.deleteMany({});

      for (const c of j) {
        await tx.dm_catalogs.create({ data: {
          id: c.id, title: c.title || null, subtitle: c.subtitle || null,
          type: c.type || null, cover: c.cover || null, url: c.url || null,
          start_date: toDate(c.startDate), end_date: toDate(c.endDate),
          sort_order: c.order ?? 0,
          ...(c.button?.length ? { dm_buttons: { create: c.button.map(b => ({ page: b.page, url: b.url || null })) } } : {}),
          ...(c.hotspots?.length ? { dm_hotspots: { create: c.hotspots.map(h => ({
            id: h.id, x: h.x, y: h.y, width: h.width, height: h.height, url: h.url || null
          }))} } : {}),
        }});
      }
    });
    ok(`${j.length} catalogs`);
  } catch (e) { fail(e); }

  // 5. food
  log('food');
  try {
    const j = read('food-guide.json');
    await prisma.$transaction(async (tx) => {
      await tx.food_items.deleteMany({});
      await tx.food_categories.deleteMany({});

      for (const [ci, cat] of j.categories.entries()) {
        await tx.food_categories.create({ data: { id: cat.id, label: cat.label, sort_order: ci } });
      }

      let ii = 0;
      for (const cat of j.categories) {
        const rest = j.restaurants[cat.id];
        if (!rest) continue;
        for (const section of ['theme', 'foodcourt']) {
          const items = rest[section];
          if (!items) continue;
          for (const r of items) {
            await tx.food_items.create({ data: {
              category_id: cat.id, section,
              name: r.name || '', floor_id: r.floor || null,
              building: toBldg(r.building),
              phone: r.phone || null, logo: r.image || null,
              description: r.description || null, sort_order: ii++,
            }});
          }
        }
      }
      ok(`${j.categories.length} categories, ${ii} items`);
    });
  } catch (e) { fail(e); }

  // 6. winners
  log('winners');
  try {
    const j = read('winners.json');
    _rowId = 0;
    await prisma.$transaction(async (tx) => {
      await tx.winners_rows.deleteMany({});
      await tx.winners_events.deleteMany({});

      for (const [ei, ev] of j.events.entries()) {
        await tx.winners_events.create({ data: {
          id: ev.id, title: ev.title,
          subtitle1: ev.subtitle1 || null, subtitle2: ev.subtitle2 || null,
          columns: ev.columns, sort_order: ei,
        }});
        await insertTree(tx, ev.rows || [], ev.id, null, 0);
      }
      ok(`${j.events.length} events, ${_rowId} rows`);
    }, { timeout: 60000 });
  } catch (e) { fail(e); }

  // 7. gallery
  log('gallery');
  try {
    const j = read('gallery.json');
    await prisma.$transaction(async (tx) => {
      await tx.gallery_hotspots.deleteMany({});
      await tx.gallery_content.deleteMany({});

      for (const [i, c] of j.content.entries()) {
        await tx.gallery_content.create({ data: {
          type: c.type, file: c.file || null, video_id: c.videoId || null, sort_order: i,
          ...(c.hotspots?.length ? { gallery_hotspots: { create: c.hotspots.map(h => ({
            id: h.id, x: h.x, y: h.y, width: h.width, height: h.height, url: h.url || null
          }))} } : {}),
        }});
      }
    });
    ok(`${j.content.length} items`);
  } catch (e) { fail(e); }

  // 8. home_events
  log('home_events');
  try {
    const j = read('home-events.json');
    await prisma.$transaction(async (tx) => {
      await tx.home_events.deleteMany({});
      for (const [i, e] of j.events.entries()) {
        await tx.home_events.create({ data: {
          id: e.id, file: e.file, url: e.url || null,
          start_date: toDate(e.startDate), end_date: toDate(e.endDate), sort_order: i
        }});
      }
    });
    ok(`${j.events.length} records`);
  } catch (e) { fail(e); }

  // 9. home_promo
  log('home_promo');
  try {
    const j = read('home-promo.json');
    await prisma.$transaction(async (tx) => {
      await tx.home_promo_cards.deleteMany({});
      await tx.home_promo.deleteMany({});
      const promo = await tx.home_promo.create({ data: {
        title: j.title || null, hero_file: j.heroFile || null, hero_url: j.heroUrl || null,
        left_label: j.leftLabel || null, right_label: j.rightLabel || null,
      }});
      for (const c of (j.cards || [])) {
        await tx.home_promo_cards.create({ data: { promo_id: promo.id, slot: c.slot, file: c.file, url: c.url || null } });
      }
    });
    ok('done');
  } catch (e) { fail(e); }

  // 10. logos
  log('logos');
  try {
    const j = read('logos.json');
    await prisma.$transaction(async (tx) => {
      await tx.logos.deleteMany({});
      await tx.logo_groups.deleteMany({});
      for (const [gi, g] of j.groups.entries()) {
        await tx.logo_groups.create({ data: {
          id: g.id, sort_order: gi,
          logos: { create: g.logos.map((l, li) => ({ id: l.id, file: l.file, sort_order: li })) }
        }});
      }
    });
    ok(`${j.groups.length} groups`);
  } catch (e) { fail(e); }

  // 11. config
  log('config');
  try {
    const j = read('config.json');
    await prisma.$transaction(async (tx) => {
      await tx.config.deleteMany({});
      for (const [key, value] of Object.entries(j)) {
        await tx.config.create({ data: { key_name: key, value: String(value) } });
      }
    });
    ok(`${Object.keys(j).length} keys`);
  } catch (e) { fail(e); }

  // 12. tracking
  log('tracking');
  try {
    const j = read('tracking.json');
    await prisma.$transaction(async (tx) => {
      await tx.activity_views.deleteMany({});
      await tx.page_views.deleteMany({});

      let pvCount = 0;
      for (const page of ['home', 'floor', 'food', 'service', 'winners', 'feedback', 'activity']) {
        const pd = j[page];
        if (!pd?.daily) continue;
        for (const [day, count] of Object.entries(pd.daily)) {
          await tx.page_views.create({ data: { page, date: new Date(day), count: Number(count) } });
          pvCount++;
        }
      }

      let avCount = 0;
      if (j.activities) {
        for (const [actId, ad] of Object.entries(j.activities)) {
          if (!ad?.daily) continue;
          for (const [day, count] of Object.entries(ad.daily)) {
            await tx.activity_views.create({ data: {
              activity_id: actId, title: ad.title || actId,
              date: new Date(day), count: Number(count)
            }});
            avCount++;
          }
        }
      }
      ok(`${pvCount + avCount} records`);
    });
  } catch (e) { fail(e); }

  console.log('\n========================================');
  console.log('  Import complete');
  console.log('========================================\n');
}

main()
  .catch(e => { console.error('\nFATAL:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
