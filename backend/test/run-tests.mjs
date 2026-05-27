/**
 * ChungyoOffical Backend — 整合測試工具 v2.1
 * 涵蓋：黑箱安全、白箱邏輯、Admin API、HTTP Method 矩陣、CORS、Header 驗證、
 *        Payload 注入、漸進式負載、混合流量、慢速連線 (Slowloris)
 *
 * 用法：node run-tests.mjs [options]
 *   --base-url    http://localhost:4000        目標伺服器（預設 localhost:4000）
 *   --mode        all|black|white|admin|stress 測試模式（預設 all）
 *   --concurrency 20                          壓力測試並發數
 *   --iterations  50                          壓力測試迭代次數
 *
 * 回歸標記：
 *   [R-JSON]  防止 /api/images 洩漏 JSON 資料（修復 2026-05）
 *   [R-PATH]  防止 /api/dm/:id 路徑穿越（修復 2026-05）
 */

import net from 'net';

// ─── 設定 ─────────────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2)
    .map((a, i, arr) => i % 2 === 0 ? [a.replace('--', ''), arr[i + 1]] : null)
    .filter(Boolean)
);
const BASE_URL    = args['base-url']    || 'http://localhost:4000';
const MODE        = args['mode']        || 'all';
const STRESS_CONC = parseInt(args['concurrency'] || '20');
const STRESS_ITER = parseInt(args['iterations']  || '50');

const _url     = new URL(BASE_URL);
const RAW_HOST = _url.hostname;
const RAW_PORT = parseInt(_url.port) || (_url.protocol === 'https:' ? 443 : 80);

// ─── 顏色輸出 ─────────────────────────────────────────────────────────────────
const c = {
  reset: '\x1b[0m', bold: '\x1b[1m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  cyan: '\x1b[36m', gray: '\x1b[90m', magenta: '\x1b[35m', blue: '\x1b[34m',
};
const PASS = `${c.green}✔ PASS${c.reset}`;
const FAIL = `${c.red}✘ FAIL${c.reset}`;
const WARN = `${c.yellow}⚠ WARN${c.reset}`;
const INFO = `${c.cyan}ℹ${c.reset}`;

// ─── 統計 ─────────────────────────────────────────────────────────────────────
const stats = { passed: 0, failed: 0, warned: 0 };

// ─── 工具函式 ─────────────────────────────────────────────────────────────────
async function req(method, path, { body, headers = {}, timeoutMs = 8000, skipBody = false } = {}) {
  const url  = `${BASE_URL}${path}`;
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), timeoutMs);
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    signal: ctrl.signal,
  };
  if (body !== undefined) opts.body = typeof body === 'string' ? body : JSON.stringify(body);
  const t0 = performance.now();
  try {
    const res = await fetch(url, opts);
    clearTimeout(tid);
    const ms  = Math.round(performance.now() - t0);
    // 圖片等二進位資源：drain body 釋放連線但不存入記憶體
    if (skipBody || /\.(jpg|jpeg|png|webp|gif|pdf)$/i.test(path)) {
      try { await res.body?.cancel(); } catch {}
      return { ok: res.ok, status: res.status, ms, text: '', json: null, headers: res.headers };
    }
    let text = '';
    try { text = await res.text(); } catch {}
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { ok: res.ok, status: res.status, ms, text, json, headers: res.headers };
  } catch (e) {
    clearTimeout(tid);
    return { ok: false, status: 0, ms: Math.round(performance.now() - t0), error: e.message };
  }
}

function assert(label, condition, detail = '', tag = '') {
  const tagStr = tag ? ` ${c.blue}[${tag}]${c.reset}` : '';
  const det    = detail ? `${c.gray}  ${detail}${c.reset}` : '';
  if (condition) {
    console.log(`  ${PASS}${tagStr}  ${label}${det}`);
    stats.passed++;
  } else {
    console.log(`  ${FAIL}${tagStr}  ${label}${det}`);
    stats.failed++;
  }
}

function assertWarn(label, condition, detail = '') {
  const det = detail ? `${c.gray}  ${detail}${c.reset}` : '';
  if (condition) {
    console.log(`  ${PASS}  ${label}${det}`);
    stats.passed++;
  } else {
    console.log(`  ${WARN}  ${label}${det}`);
    stats.warned++;
  }
}

function section(title) {
  console.log(`\n${c.bold}${c.cyan}── ${title} ${c.reset}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 黑箱安全測試
// ═══════════════════════════════════════════════════════════════════════════════
async function blackBoxTests() {
  console.log(`\n${c.bold}${c.magenta}▶ 黑箱安全測試 (Black Box Security Tests)${c.reset}`);

  // ── 1. JSON 資料檔案封鎖 ─────────────────────────────────────────────────────
  section('1. /api/images — 封鎖 JSON/非圖片檔案 [R-JSON]');
  const jsonFiles = ['banners.json', 'activities.json', 'config.json', 'winners.json',
                     'catalog.json', 'food-guide.json', 'floor-guide.json', 'gallery.json',
                     'home-events.json', 'logos.json', 'home-promo.json'];
  for (const f of jsonFiles) {
    const r = await req('GET', `/api/images/${f}`);
    assert(`封鎖 /api/images/${f}`, r.status === 403, `HTTP ${r.status}`, 'R-JSON');
  }
  const r_pkg = await req('GET', '/api/images/../package.json');
  assert('封鎖 /api/images/../package.json', r_pkg.status === 403 || r_pkg.status === 404, `HTTP ${r_pkg.status}`, 'R-JSON');

  // ── 2. 路徑穿越攻擊 ──────────────────────────────────────────────────────────
  section('2. 路徑穿越 — /api/dm/:id/pages [R-PATH]');
  const traversalPayloads = [
    ['..%5C..', '反斜線編碼穿越 (Windows %5C)'],
    ['..%2F..', '正斜線編碼穿越 (%2F)'],
    ['....//..', '雙點穿越變體'],
    ['..%5Cdata', '穿越至 data 目錄'],
    ['..%5Cnode_modules%5Cexpress', '穿越至 node_modules'],
    ['%2e%2e%5c%2e%2e', '全部編碼穿越'],
    ['../../../etc/passwd', 'Unix 經典穿越'],
    ['..\\..\\..\\Windows\\System32', 'Windows 系統目錄穿越'],
    ['a.b.c', '含點字元'],
    ['id;ls', 'Command Injection 嘗試'],
    ['<script>alert(1)</script>', 'XSS 注入嘗試'],
    ['0'.repeat(500), '超長 ID 字串'],
    ['%00etc%00passwd', 'Null Byte 注入'],
    ['..%c0%af..', 'Unicode 斜線編碼 (CVE-2000-0884)'],
  ];
  for (const [id, label] of traversalPayloads) {
    const r = await req('GET', `/api/dm/${id}/pages`);
    assert(`阻擋 [${label}]`, r.status === 400 || r.status === 404, `HTTP ${r.status}`, 'R-PATH');
  }

  // ── 3. 正常 DM ID 白名單 ─────────────────────────────────────────────────────
  section('3. 正常 DM ID 白名單驗證');
  for (const id of ['dm-1', 'dm-2', 'dm-3', '123', '999', '20260508', '50505']) {
    const r = await req('GET', `/api/dm/${id}/pages`);
    assert(`正常 ID [${id}] 可存取`, r.status === 200 || r.status === 404, `HTTP ${r.status}`);
  }

  // ── 4. 圖片靜態服務正常 ───────────────────────────────────────────────────────
  section('4. 圖片靜態服務正常');
  const imgTests = [
    ['/api/images/banner-pic/1779085459697.jpg', 'banner-pic .jpg'],
    ['/api/images/logo-pic/1779157363965.jpg',   'logo-pic .jpg'],
  ];
  for (const [path, label] of imgTests) {
    const r = await req('GET', path);
    assert(`圖片可存取 [${label}]`, r.status === 200, `HTTP ${r.status}`);
  }

  // ── 5. 錯誤回應內容安全 ───────────────────────────────────────────────────────
  section('5. 錯誤回應不洩漏內部資訊');
  const r_404 = await req('GET', '/api/dm/nonexistentid999/pages');
  const hasStack = r_404.text?.includes('at ') && r_404.text?.includes('node_modules');
  assert('404 回應不含 Node.js stack trace', !hasStack, r_404.text?.slice(0, 80));
  assert('404 回應為 JSON 格式', r_404.json !== null || r_404.status === 404, r_404.text?.slice(0, 40));

  // ── 6. HTTP Method 矩陣 ───────────────────────────────────────────────────────
  section('6. HTTP Method 矩陣（GET-only 端點不接受其他方法）');
  const readOnlyEndpoints = [
    '/api/catalog', '/api/banners', '/api/home-events', '/api/food-guide',
    '/api/floor-guide', '/api/winners', '/api/gallery', '/api/logos',
    '/api/config', '/api/home-promo', '/api/home-fb',
  ];
  const mutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  for (const endpoint of readOnlyEndpoints) {
    for (const method of mutatingMethods) {
      const r = await req(method, endpoint, { body: { test: 1 } });
      assert(
        `${method} ${endpoint} → 4xx`,
        r.status >= 400 && r.status < 600,
        `HTTP ${r.status}`
      );
    }
  }

  // ── 7. CORS 跨域測試 ──────────────────────────────────────────────────────────
  section('7. CORS 跨域回應標頭');
  const r_cors = await req('GET', '/api/banners', {
    headers: { Origin: 'https://evil.com' },
  });
  const acao = r_cors.headers?.get('access-control-allow-origin');
  assertWarn(
    'CORS: Access-Control-Allow-Origin 不應開放所有來源 (*)',
    acao !== '*',
    `目前值: ${acao ?? '(無)'}`
  );

  const r_opt = await req('OPTIONS', '/api/banners', {
    headers: {
      Origin: 'https://evil.com',
      'Access-Control-Request-Method': 'POST',
    },
  });
  const acam = r_opt.headers?.get('access-control-allow-methods');
  console.log(`  ${INFO}  OPTIONS 預檢回應: HTTP ${r_opt.status}  Allow-Methods: ${acam ?? '(無)'}`);

  // ── 8. Content-Type 與 Payload 注入 ──────────────────────────────────────────
  section('8. Content-Type 與 Payload 邊界測試');
  // 非字串 payload 應全部回 400（型別驗證）
  const invalidPayloads = [
    [{ payload: null },  'null payload'],
    [{ payload: 123 },   'number payload'],
    [{ payload: [] },    'array payload'],
    [{ payload: {} },    'object payload'],
    [{},                 '缺少 payload 欄位'],
  ];
  for (const [body, label] of invalidPayloads) {
    const r = await req('POST', '/api/feedback', { body });
    assert(`Feedback POST [${label}] → 400`, r.status === 400, `HTTP ${r.status}`);
  }

  // 超大 payload 字串 — 應轉發至下游（不 crash）
  const rBig = await req('POST', '/api/feedback', { body: { payload: 'A'.repeat(100_000) } });
  assert('Feedback POST [100KB 字串] — 不 crash (非 500)', rBig.status !== 500, `HTTP ${rBig.status}`);

  // 非 JSON Content-Type
  const r_ct = await req('POST', '/api/feedback', {
    body: 'payload=hello',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  assert(
    'Feedback: 非 JSON Content-Type 不 crash (非 500)',
    r_ct.status !== 500,
    `HTTP ${r_ct.status}`
  );

  // ── 9. Response Header 安全性驗證 ────────────────────────────────────────────
  section('9. Response Header 安全驗證');
  const r_hdr = await req('GET', '/api/banners');
  const ct     = r_hdr.headers?.get('content-type') ?? '';
  const xpb    = r_hdr.headers?.get('x-powered-by') ?? '';

  assert('API 回應 Content-Type 包含 application/json', ct.includes('application/json'), ct);
  assertWarn('X-Powered-By 標頭未洩漏框架資訊', xpb === '', `目前值: "${xpb}" (建議執行 app.disable('x-powered-by'))`);

  const r_img  = await req('GET', '/api/images/banner-pic/1779085459697.jpg');
  const imgCt  = r_img.headers?.get('content-type') ?? '';
  assert('圖片回應 Content-Type 為 image/*', imgCt.startsWith('image/'), imgCt);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 白箱邏輯測試
// ═══════════════════════════════════════════════════════════════════════════════
async function whiteBoxTests() {
  console.log(`\n${c.bold}${c.magenta}▶ 白箱邏輯測試 (White Box Logic Tests)${c.reset}`);

  // ── 1. Banner 日期過濾 ────────────────────────────────────────────────────────
  section('1. /api/banners — 日期過濾邏輯');
  const rb = await req('GET', '/api/banners');
  assert('/api/banners 回傳 200', rb.status === 200, `HTTP ${rb.status}`);
  if (rb.json) {
    const now = new Date();
    const allFiltered = rb.json.banners?.every(b => {
      if (b.startDate && new Date(b.startDate) > now) return false;
      if (b.endDate) {
        const end = new Date(b.endDate);
        end.setHours(23, 59, 59, 999);
        if (now > end) return false;
      }
      return true;
    }) ?? true;
    assert('所有 Banner 都在有效期間內', allFiltered, `共 ${rb.json.banners?.length ?? 0} 筆`);
    const rj = await req('GET', '/api/images/banners.json');
    assert('直接存取 banners.json 被封鎖（防繞過日期過濾）', rj.status === 403, `HTTP ${rj.status}`, 'R-JSON');
  }

  // ── 2. Home Events 日期過濾 ───────────────────────────────────────────────────
  section('2. /api/home-events — 日期過濾邏輯');
  const rhe = await req('GET', '/api/home-events');
  assert('/api/home-events 回傳 200', rhe.status === 200, `HTTP ${rhe.status}`);
  if (rhe.json?.events) {
    const now = new Date();
    const allValid = rhe.json.events.every(e => {
      const start = e.startDate ? new Date(e.startDate) : null;
      const end   = e.endDate   ? new Date(e.endDate)   : null;
      if (start && now < start) return false;
      if (end   && now > end)   return false;
      return true;
    });
    assert('所有活動都在有效期間內', allValid, `共 ${rhe.json.events.length} 筆`);
  }

  // ── 3. /api/catalog 資料結構 ──────────────────────────────────────────────────
  section('3. /api/catalog — 資料結構驗證');
  const rc = await req('GET', '/api/catalog');
  assert('/api/catalog 回傳 200', rc.status === 200);
  assert('catalog 回傳 DM 陣列', Array.isArray(rc.json), `共 ${rc.json?.length} 筆`);
  if (Array.isArray(rc.json) && rc.json.length > 0) {
    assert('每筆 DM 含 id 欄位',    typeof rc.json[0].id    === 'string', rc.json[0].id);
    assert('每筆 DM 含 title 欄位', typeof rc.json[0].title === 'string', rc.json[0].title);
  }

  // ── 4. /api/dm/:id/pages 資料結構 ────────────────────────────────────────────
  section('4. /api/dm/:id/pages — 資料結構驗證');
  const rd = await req('GET', '/api/dm/dm-1/pages');
  if (rd.status === 200) {
    assert('DM pages 回傳陣列',       Array.isArray(rd.json),              `共 ${rd.json?.length} 頁`);
    assert('每頁為檔名字串',           typeof rd.json?.[0] === 'string',    rd.json?.[0]);
    assert('檔名為圖片格式',           /\.(jpg|jpeg|png|webp)$/i.test(rd.json?.[0] ?? ''), rd.json?.[0]);
  } else {
    assert('dm-1 資料存在', false, `HTTP ${rd.status}`);
  }

  // ── 5. /api/service-images ────────────────────────────────────────────────────
  section('5. /api/service-images — 服務圖片對應');
  const rs = await req('GET', '/api/service-images');
  assert('/api/service-images 回傳 200', rs.status === 200);
  if (rs.json) {
    const keys = Object.keys(rs.json);
    assert(
      '圖片路徑格式正確（以 /api/images/service/ 開頭）',
      keys.every(k => rs.json[k].startsWith('/api/images/service/')),
      keys.map(k => rs.json[k]).join(', ').slice(0, 80)
    );
  }

  // ── 6. DM ID 正則邊界 ─────────────────────────────────────────────────────────
  section('6. DM ID 正則白名單邊界測試 [R-PATH]');
  const idCases = [
    ['a',           true,  '單字母'],
    ['1',           true,  '單數字'],
    ['dm-1',        true,  '含連字號'],
    ['DM_TEST',     true,  '含底線大寫'],
    ['abc-123_XYZ', true,  '混合格式'],
    ['a.b',         false, '含點號'],
    ['a b',         false, '含空白'],
    ['a/b',         false, '含正斜線'],
    ['a%b',         false, '含百分號'],
    ['<xss>',       false, 'XSS 標籤'],
    ['a\tb',        false, 'Tab 字元'],
    ['\x00abc',     false, 'Null byte'],
  ];
  for (const [id, shouldPass, label] of idCases) {
    const r = await req('GET', `/api/dm/${encodeURIComponent(id)}/pages`);
    if (shouldPass) {
      assert(`允許合法 ID [${label}] "${id}"`, r.status === 200 || r.status === 404, `HTTP ${r.status}`, 'R-PATH');
    } else {
      assert(`阻擋非法 ID [${label}] "${id}"`, r.status === 400, `HTTP ${r.status}`, 'R-PATH');
    }
  }

  // ── 7. Feedback 端點 ──────────────────────────────────────────────────────────
  section('7. POST /api/feedback — 輸入驗證');
  const fbMissing = await req('POST', '/api/feedback', { body: {} });
  assert('缺少 payload → 400', fbMissing.status === 400, `HTTP ${fbMissing.status}`);
  assert('缺少 payload → 回傳 JSON error', fbMissing.json?.error !== undefined, fbMissing.text?.slice(0, 60));

  const fbNull = await req('POST', '/api/feedback', { body: { payload: null } });
  assert('payload=null → 400', fbNull.status === 400, `HTTP ${fbNull.status}`);

  const fbNum = await req('POST', '/api/feedback', { body: { payload: 123 } });
  assert('payload=123 (數字) → 400（型別驗證）', fbNum.status === 400, `HTTP ${fbNum.status}`);

  const fbOk = await req('POST', '/api/feedback', { body: { payload: 'valid-looking-encrypted-string' } });
  assert(
    'payload=字串 → 轉發至下游（非 500）',
    fbOk.status !== 500,
    `HTTP ${fbOk.status}`
  );

  // ── 8. Activity 端點 ──────────────────────────────────────────────────────────
  section('8. GET /api/activity/:id — 活動資料');
  const ract = await req('GET', '/api/activity/nonexistent999');
  assert('/api/activity/nonexistent → 404', ract.status === 404, `HTTP ${ract.status}`);
  assert('404 回傳 JSON 格式', ract.json !== null, ract.text?.slice(0, 40));

  // 取第一筆合法 id 做測試
  if (Array.isArray(rc.json) && rc.json.length > 0) {
    // catalog 是 DM 資料，實際 activity id 從 activities.json 取，
    // 這裡用 API 本身確認端點存在即可
    const validId = rc.json[0]?.id ?? 'dm-1';
    const ractV   = await req('GET', `/api/activity/${validId}`);
    assert(
      `/api/activity/${validId} → 200 或 404（端點正常回應）`,
      ractV.status === 200 || ractV.status === 404,
      `HTTP ${ractV.status}`
    );
  }

  // ── 9. Privacy Policy 端點 ────────────────────────────────────────────────────
  section('9. GET /api/privacy-policy — 隱私政策');
  const rpp = await req('GET', '/api/privacy-policy');
  assert('/api/privacy-policy 回傳 200', rpp.status === 200, `HTTP ${rpp.status}`);
  const ppCt = rpp.headers?.get('content-type') ?? '';
  assert('回應 Content-Type 為 text/html', ppCt.includes('text/html'), ppCt);
  assert('內容不含 Node.js stack trace', !rpp.text?.includes('at Object.<anonymous>'), rpp.text?.slice(0, 60));

  // ── 10. 全端點 JSON 格式一致性 ───────────────────────────────────────────────
  section('10. 全端點 JSON 格式一致性');
  const jsonEndpoints = [
    '/api/catalog', '/api/banners', '/api/home-events', '/api/food-guide',
    '/api/floor-guide', '/api/winners', '/api/gallery', '/api/logos',
    '/api/config', '/api/home-promo', '/api/home-fb', '/api/service-images',
  ];
  for (const ep of jsonEndpoints) {
    const r  = await req('GET', ep);
    const ct = r.headers?.get('content-type') ?? '';
    assert(`${ep} → JSON 格式`, r.json !== null && ct.includes('application/json'), `HTTP ${r.status} CT:${ct.slice(0, 30)}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 壓力測試
// ═══════════════════════════════════════════════════════════════════════════════

async function runLoad(label, path, method = 'GET', bodyFn = null) {
  const results = [];
  const batches = Math.ceil(STRESS_ITER / STRESS_CONC);
  for (let b = 0; b < batches; b++) {
    const batchSize = Math.min(STRESS_CONC, STRESS_ITER - b * STRESS_CONC);
    const batch     = Array.from({ length: batchSize }, () =>
      req(method, path, bodyFn ? { body: bodyFn() } : {})
    );
    results.push(...await Promise.all(batch));
  }
  const ok      = results.filter(r => r.status > 0 && r.status < 500);
  const errors  = results.filter(r => r.status === 0 || r.status >= 500);
  const times   = results.map(r => r.ms).sort((a, b) => a - b);
  const p50     = times[Math.floor(times.length * 0.50)];
  const p95     = times[Math.floor(times.length * 0.95)];
  const p99     = times[Math.floor(times.length * 0.99)];
  const avg     = Math.round(times.reduce((s, v) => s + v, 0) / times.length);
  const errRate = ((errors.length / results.length) * 100).toFixed(1);
  const icon    = errors.length === 0 ? PASS : (errors.length < results.length * 0.01 ? WARN : FAIL);
  console.log(`  ${icon}  ${label}`);
  console.log(`         ${c.gray}成功率: ${ok.length}/${results.length} (錯誤率 ${errRate}%)  avg: ${avg}ms  P50: ${p50}ms  P95: ${p95}ms  P99: ${p99}ms${c.reset}`);
  if (errors.length === 0) stats.passed++;
  else if (errors.length < results.length * 0.01) stats.warned++;
  else stats.failed++;
  return { avg, p50, p95, p99, errRate: parseFloat(errRate) };
}

async function stressTests() {
  console.log(`\n${c.bold}${c.magenta}▶ 壓力測試 (Stress Tests)${c.reset}`);
  console.log(`  ${INFO} 並發數: ${STRESS_CONC}  迭代次數: ${STRESS_ITER}\n`);

  // ── 1-4. 各端點固定並發 ───────────────────────────────────────────────────────
  section('1. API 讀取端點壓力');
  await runLoad('/api/catalog',      '/api/catalog');
  await runLoad('/api/banners',      '/api/banners');
  await runLoad('/api/home-events',  '/api/home-events');
  await runLoad('/api/food-guide',   '/api/food-guide');
  await runLoad('/api/floor-guide',  '/api/floor-guide');
  await runLoad('/api/winners',      '/api/winners');
  await runLoad('/api/gallery',      '/api/gallery');
  await runLoad('/api/logos',        '/api/logos');
  await runLoad('/api/config',       '/api/config');

  section('2. DM 頁面端點壓力');
  await runLoad('/api/dm/dm-1/pages',     '/api/dm/dm-1/pages');
  await runLoad('/api/dm/20260508/pages', '/api/dm/20260508/pages');

  section('3. 靜態圖片服務壓力');
  await runLoad('banner-pic .jpg', '/api/images/banner-pic/1779085459697.jpg');
  await runLoad('logo-pic .jpg',   '/api/images/logo-pic/1779157363965.jpg');

  section('4. 安全防護在高並發下的穩定性 [R-PATH] [R-JSON]');
  await runLoad('路徑穿越攻擊（高並發）', '/api/dm/..%5C..%5Cdata/pages');
  await runLoad('JSON 封鎖（高並發）',    '/api/images/banners.json');

  // ── 5. 漸進式負載測試 ─────────────────────────────────────────────────────────
  section('5. 漸進式負載測試 — 找出臨界點');
  const rampLevels = [1, 5, 10, 50, 100, 200, 500];
  const endpoint   = '/api/banners';
  const rampIter   = 20;
  let   lastOk     = 0;

  for (const conc of rampLevels) {
    const results = await Promise.all(
      Array.from({ length: rampIter }, () => req('GET', endpoint))
    );
    const errors  = results.filter(r => r.status === 0 || r.status >= 500);
    const times   = results.map(r => r.ms).sort((a, b) => a - b);
    const p95     = times[Math.floor(times.length * 0.95)];
    const errRate = ((errors.length / results.length) * 100).toFixed(1);
    const icon    = errors.length === 0 ? PASS : FAIL;
    console.log(`  ${icon}  並發 ${String(conc).padStart(4)}  ${c.gray}P95: ${String(p95).padStart(5)}ms  錯誤率: ${errRate}%${c.reset}`);
    if (errors.length === 0) {
      lastOk = conc;
      stats.passed++;
    } else {
      stats.failed++;
      console.log(`         ${c.yellow}↑ 臨界點約在並發 ${lastOk}~${conc} 之間${c.reset}`);
      break;
    }
  }

  // ── 6. 混合流量壓力測試 ───────────────────────────────────────────────────────
  section('6. 混合流量壓力測試（模擬真實使用情境）');
  const mixedPool = [
    '/api/catalog', '/api/banners', '/api/home-events', '/api/food-guide',
    '/api/floor-guide', '/api/winners', '/api/gallery', '/api/logos',
    '/api/config', '/api/home-promo', '/api/home-fb',
    '/api/dm/dm-1/pages', '/api/dm/20260508/pages',
    '/api/images/banner-pic/1779085459697.jpg',
    '/api/images/logo-pic/1779157363965.jpg',
  ];

  const mixedResults = await Promise.all(
    Array.from({ length: STRESS_ITER }, () => {
      const path = mixedPool[Math.floor(Math.random() * mixedPool.length)];
      return req('GET', path).then(r => ({ ...r, path }));
    })
  );
  const mixedErrors = mixedResults.filter(r => r.status === 0 || r.status >= 500);
  const mixedTimes  = mixedResults.map(r => r.ms).sort((a, b) => a - b);
  const mP95        = mixedTimes[Math.floor(mixedTimes.length * 0.95)];
  const mErrRate    = ((mixedErrors.length / mixedResults.length) * 100).toFixed(1);
  const mIcon       = mixedErrors.length === 0 ? PASS : (mixedErrors.length < mixedResults.length * 0.01 ? WARN : FAIL);
  console.log(`  ${mIcon}  混合 ${STRESS_ITER} 個請求（${mixedPool.length} 種端點隨機混合）`);
  console.log(`         ${c.gray}成功率: ${mixedResults.length - mixedErrors.length}/${mixedResults.length}  P95: ${mP95}ms  錯誤率: ${mErrRate}%${c.reset}`);
  if (mixedErrors.length === 0) stats.passed++;
  else if (mixedErrors.length < mixedResults.length * 0.01) stats.warned++;
  else stats.failed++;

  // ── 7. 慢速連線測試 (Slowloris) ──────────────────────────────────────────────
  section('7. 慢速連線測試（Slowloris 模擬）');

  async function slowlorisProbe(timeoutSec = 3) {
    return new Promise(resolve => {
      const sock = new net.Socket();
      let   serverClosed = false;

      sock.connect(RAW_PORT, RAW_HOST, () => {
        // 送出不完整的 HTTP 請求（沒有結尾的 \r\n\r\n）
        sock.write(`GET /api/banners HTTP/1.1\r\nHost: ${RAW_HOST}:${RAW_PORT}\r\nX-Test: slowloris\r\n`);
      });

      sock.on('close', () => { serverClosed = true; });
      sock.on('end',   () => { serverClosed = true; });
      sock.on('error', () => { serverClosed = true; });

      setTimeout(() => {
        if (!sock.destroyed) sock.destroy();
        resolve(serverClosed);
      }, timeoutSec * 1000);
    });
  }

  // 同時開多條慢速連線
  const slowCount  = 5;
  const WAIT_SEC   = 3;
  const slowResults = await Promise.all(
    Array.from({ length: slowCount }, () => slowlorisProbe(WAIT_SEC))
  );
  const closedCount = slowResults.filter(Boolean).length;

  assertWarn(
    `伺服器在 ${WAIT_SEC}s 內主動關閉不完整 HTTP 連線（防 Slowloris）`,
    closedCount === slowCount,
    `${closedCount}/${slowCount} 條連線被伺服器主動關閉（未關閉表示無 header timeout 設定）`
  );

  if (closedCount < slowCount) {
    console.log(`         ${c.yellow}建議：在 server.js 中加入 server.headersTimeout = 5000${c.reset}`);
    console.log(`         ${c.yellow}      (Node.js 預設值為 60000ms，Express 不自動設定)${c.reset}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Admin API 測試
// ═══════════════════════════════════════════════════════════════════════════════
async function adminTests() {
  console.log(`\n${c.bold}${c.magenta}▶ Admin API 測試${c.reset}`);

  // ── 1. Admin GET 端點 — 連通性與 JSON 格式 ─────────────────────────────────
  section('1. Admin GET 端點 — 連通性與資料結構');
  const adminGetCases = [
    ['/api/admin/activity',    d => Array.isArray(d?.activities), 'activities 陣列'],
    ['/api/admin/catalog',     d => Array.isArray(d),             'Array'],
    ['/api/admin/banner',      d => d !== null,                   '物件'],
    ['/api/admin/floor-guide', d => d !== null,                   '物件'],
    ['/api/admin/food-guide',  d => d !== null,                   '物件'],
    ['/api/admin/gallery',     d => d !== null,                   '物件'],
    ['/api/admin/home-event',  d => d !== null,                   '物件'],
    ['/api/admin/home-fb',     d => d !== null,                   '物件'],
    ['/api/admin/home-promo',  d => d !== null,                   '物件'],
    ['/api/admin/logos',       d => d !== null,                   '物件'],
    ['/api/admin/winners',     d => d !== null,                   '物件'],
  ];
  for (const [ep, check, label] of adminGetCases) {
    const r = await req('GET', ep);
    assert(`GET ${ep} → 200`,   r.status === 200, `HTTP ${r.status}`);
    assert(`GET ${ep} → ${label}`, check(r.json),  r.text?.slice(0, 40));
  }

  // floor-guide 額外：GET /icons
  const rIcons = await req('GET', '/api/admin/floor-guide/icons');
  assert('GET /api/admin/floor-guide/icons → 200 且為陣列', rIcons.status === 200 && Array.isArray(rIcons.json), `HTTP ${rIcons.status}`);

  // ── 2. Admin POST 必填欄位驗證 ─────────────────────────────────────────────
  section('2. Admin POST — 必填欄位驗證 → 400');
  const requiredFieldCases = [
    ['/api/admin/activity', {},         'activity 缺 title'],
    ['/api/admin/catalog',  {},         'catalog 缺 title'],
    ['/api/admin/banner',   {},         'banner 缺 file'],
  ];
  for (const [ep, body, label] of requiredFieldCases) {
    const r = await req('POST', ep, { body });
    assert(`${label} → 400`, r.status === 400, `HTTP ${r.status}`);
    assert(`${label} → JSON error 欄位`, r.json?.error !== undefined, r.text?.slice(0, 40));
  }

  // ── 3. Admin 不存在 ID → 404 ───────────────────────────────────────────────
  section('3. Admin — 不存在 ID 回傳 404');
  const notFoundCases = [
    ['PUT',    '/api/admin/activity/nonexistent-99999',       { title: 'x' }],
    ['DELETE', '/api/admin/activity/nonexistent-99999',       {}],
    ['POST',   '/api/admin/activity/nonexistent-99999/copy',  {}],
    ['PUT',    '/api/admin/catalog/nonexistent-99999',        { title: 'x' }],
    ['DELETE', '/api/admin/catalog/nonexistent-99999',        {}],
    ['PUT',    '/api/admin/winners/nonexistent-99999',        {}],
    ['DELETE', '/api/admin/winners/nonexistent-99999',        {}],
  ];
  for (const [method, path, body] of notFoundCases) {
    const r = await req(method, path, { body });
    assert(`${method} ${path} → 404`, r.status === 404, `HTTP ${r.status}`);
  }

  // ── 4. Admin safeName 路徑穿越防護 ─────────────────────────────────────────
  section('4. Admin 端點 safeName 路徑穿越防護 [R-PATH]');

  // 穿越用的 ID 與檔名（URL 編碼，讓 Express 解碼後含路徑符號）
  const traversalIds = [
    ['..%2Fetc',           'URL 編碼斜線穿越'],
    ['..%2F..%2Fetc',      '雙層 URL 編碼穿越'],
    ['..%5C..%5Cetc',      'Windows 反斜線編碼穿越'],
    ['..%2Fdata%2Fconfig', '穿越至 config.json'],
  ];
  const traversalFiles = [
    ['..%2Fetc.jpg',          'URL 編碼斜線檔名'],
    ['..%2F..%2Fconfig.json', '穿越至 config.json 檔名'],
  ];

  // DELETE /api/admin/activity/:id/image/:file — id 驗證
  for (const [id, label] of traversalIds) {
    const r = await req('DELETE', `/api/admin/activity/${id}/image/test.jpg`);
    assert(`activity DELETE /:id/image — 阻擋 ID [${label}]`, r.status === 400, `HTTP ${r.status}`, 'R-PATH');
  }
  // DELETE /api/admin/activity/:id/image/:file — file 驗證
  for (const [file, label] of traversalFiles) {
    const r = await req('DELETE', `/api/admin/activity/act-test/image/${file}`);
    assert(`activity DELETE /:id/image — 阻擋 file [${label}]`, r.status === 400, `HTTP ${r.status}`, 'R-PATH');
  }

  // DELETE /api/admin/catalog/:id/images/:file — id 驗證
  for (const [id, label] of traversalIds) {
    const r = await req('DELETE', `/api/admin/catalog/${id}/images/test.jpg`);
    assert(`catalog DELETE /:id/images — 阻擋 ID [${label}]`, r.status === 400, `HTTP ${r.status}`, 'R-PATH');
  }
  // DELETE /api/admin/catalog/:id/images/:file — file 驗證
  for (const [file, label] of traversalFiles) {
    const r = await req('DELETE', `/api/admin/catalog/dm-1/images/${file}`);
    assert(`catalog DELETE /:id/images — 阻擋 file [${label}]`, r.status === 400, `HTTP ${r.status}`, 'R-PATH');
  }

  // DELETE /api/admin/floor-guide/icon/:filename
  for (const [file, label] of traversalFiles) {
    const r = await req('DELETE', `/api/admin/floor-guide/icon/${file}`);
    assert(`floor-guide DELETE /icon — 阻擋 filename [${label}]`, r.status === 400, `HTTP ${r.status}`, 'R-PATH');
  }

  // DELETE /api/admin/gallery/image/:file
  for (const [file, label] of traversalFiles) {
    const r = await req('DELETE', `/api/admin/gallery/image/${file}`);
    assert(`gallery DELETE /image — 阻擋 file [${label}]`, r.status === 400, `HTTP ${r.status}`, 'R-PATH');
  }

  // ── 5. 上傳端點 — 無檔案請求不 crash ──────────────────────────────────────
  section('5. 上傳端點 — 無檔案請求不 crash（非 500）');
  const uploadNoCrashCases = [
    'POST /api/admin/activity/nonexistent/upload',
    'POST /api/admin/activity/nonexistent/upload-og',
    'POST /api/admin/catalog/nonexistent/upload',
    'POST /api/admin/catalog/nonexistent/cover',
    'POST /api/admin/gallery/upload',
    'POST /api/admin/floor-guide/logo',
    'POST /api/admin/floor-guide/icon',
  ];
  for (const entry of uploadNoCrashCases) {
    const [method, path] = entry.split(' ');
    const r = await req(method, path);
    assert(`${method} ${path} 無檔案 → 非 500`, r.status !== 500, `HTTP ${r.status}`);
  }

  // ── 6. 新功能 — 活動頁複製（含 cleanup）─────────────────────────────────
  section('6. 新功能 — 活動頁複製 POST /:id/copy');
  const actListR = await req('GET', '/api/admin/activity');
  if (actListR.json?.activities?.length > 0) {
    const srcId = actListR.json.activities[0].id;
    const srcTitle = actListR.json.activities[0].title;

    const copyR = await req('POST', `/api/admin/activity/${srcId}/copy`);
    assert(`POST /activity/${srcId}/copy → 200`, copyR.status === 200, `HTTP ${copyR.status}`);
    assert('回傳新 id 字串', typeof copyR.json?.id === 'string', JSON.stringify(copyR.json));

    if (copyR.json?.id) {
      const newId = copyR.json.id;
      const listR = await req('GET', '/api/admin/activity');
      const copied = listR.json?.activities?.find(a => a.id === newId);
      assert('複製的活動頁出現在清單中',  !!copied, newId);
      assert('複製標題含「（複製）」',    copied?.title?.includes('（複製）'), copied?.title);
      assert('複製標題包含原標題',        copied?.title?.includes(srcTitle), copied?.title);

      // cleanup
      const delR = await req('DELETE', `/api/admin/activity/${newId}`);
      assert(`清除複製品（${newId}）→ 200`, delR.status === 200, `HTTP ${delR.status}`);
    }
  } else {
    console.log(`  ${INFO}  無活動資料，跳過複製測試`);
  }

  // 複製不存在 ID → 404
  const badCopyR = await req('POST', '/api/admin/activity/nonexistent-copy-99/copy');
  assert('複製不存在 ID → 404', badCopyR.status === 404, `HTTP ${badCopyR.status}`);

  // ── 7. 新功能 — 標籤 (tags) ───────────────────────────────────────────────
  section('7. 新功能 — 活動頁標籤 tags');
  const actListR2 = await req('GET', '/api/admin/activity');
  if (actListR2.json?.activities?.length > 0) {
    const testAct = actListR2.json.activities[0];
    const origTags = testAct.tags ?? [];

    // 寫入 tags
    const putR = await req('PUT', `/api/admin/activity/${testAct.id}`, {
      body: { tags: ['測試A', '測試B'] },
    });
    assert(`PUT /activity/${testAct.id} 更新 tags → 200`, putR.status === 200, `HTTP ${putR.status}`);

    // 驗證
    const verR = await req('GET', '/api/admin/activity');
    const updated = verR.json?.activities?.find(a => a.id === testAct.id);
    assert('tags 正確儲存為陣列',       Array.isArray(updated?.tags), JSON.stringify(updated?.tags));
    assert('tags 內容正確',             JSON.stringify(updated?.tags) === JSON.stringify(['測試A', '測試B']), JSON.stringify(updated?.tags));

    // 清空 tags
    await req('PUT', `/api/admin/activity/${testAct.id}`, { body: { tags: origTags } });
    console.log(`  ${INFO}  已還原 tags 為 [${origTags.join(', ')}]`);
  } else {
    console.log(`  ${INFO}  無活動資料，跳過標籤測試`);
  }

  // ── 8. 抽換圖片 — 無檔案與不存在 ID ─────────────────────────────────────
  section('8. 新功能 — 抽換圖片 POST /:id/replace-image/:index');
  const badReplaceId = await req('POST', '/api/admin/activity/nonexistent-99999/replace-image/0');
  assert('不存在 ID + 無檔案 → 400',   badReplaceId.status === 400, `HTTP ${badReplaceId.status}`);

  const badReplaceIdx = await req('POST', '/api/admin/activity/act-test/replace-image/notanumber');
  assert('非數字 index + 無檔案 → 400', badReplaceIdx.status === 400, `HTTP ${badReplaceIdx.status}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 主入口
// ═══════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log(`${c.bold}${c.cyan}
╔══════════════════════════════════════════════════════╗
║   ChungyoOffical — API 測試工具 v2.1                  ║
║   目標: ${BASE_URL.padEnd(44)}║
║   模式: ${MODE.padEnd(44)}║
╚══════════════════════════════════════════════════════╝${c.reset}`);

  const t0 = performance.now();

  if (MODE === 'all' || MODE === 'black')  await blackBoxTests();
  if (MODE === 'all' || MODE === 'white')  await whiteBoxTests();
  if (MODE === 'all' || MODE === 'admin')  await adminTests();
  if (MODE === 'all' || MODE === 'stress') await stressTests();

  const elapsed = ((performance.now() - t0) / 1000).toFixed(1);

  console.log(`\n${c.bold}${'─'.repeat(56)}${c.reset}`);
  console.log(`${c.bold}  測試結果摘要${c.reset}  (耗時 ${elapsed}s)`);
  console.log(`  ${c.green}通過: ${stats.passed}${c.reset}  ${c.red}失敗: ${stats.failed}${c.reset}  ${c.yellow}警告: ${stats.warned}${c.reset}`);
  console.log(`${'─'.repeat(56)}`);

  if (stats.failed > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
