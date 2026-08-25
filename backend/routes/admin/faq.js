'use strict';

const express        = require('express');
const multer         = require('multer');
const fs             = require('fs');
const path           = require('path');
const iconv          = require('iconv-lite');
const { randomUUID } = require('crypto');
const { DATA_DIR }   = require('../../utils/json');
const prisma         = require('../../utils/db');
const { syncFaqKnowledgeBase } = require('../../utils/faqAiClient');
const { logAwsUsage } = require('../../utils/awsUsageLogger');

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

// ── 客服文件（純文字，附起訖日期，同步時併入知識庫）───────────────────────
const FAQ_DOC_DIR = path.join(DATA_DIR, 'faq-documents');
const DOC_EXT      = /\.txt$/i;

// 用 memoryStorage 而非 diskStorage，因為要先偵測/轉換編碼才能寫檔案。
const uploadDoc = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => cb(null, DOC_EXT.test(file.originalname)),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB，純文字檔已足夠
});

// 使用者上傳的 .txt 常常是 Windows 記事本存的 Big5 編碼，不是 UTF-8，
// 直接當 UTF-8 讀會整段變亂碼。這裡判斷：原始位元組轉成字串再轉回位元組，
// 如果跟原始完全一樣，代表本來就是合法 UTF-8；不一樣的話視為 Big5 並轉換。
function decodeToUtf8(buffer) {
  const asUtf8 = buffer.toString('utf8');
  if (Buffer.from(asUtf8, 'utf8').equals(buffer)) return asUtf8;
  return iconv.decode(buffer, 'big5');
}

// 把 FAQ 節點＋櫃位樓層資料＋客服文件同步進 Bedrock 知識庫（共用邏輯，
// 供手動「立即同步知識庫」按鈕與文件上傳/刪除/切換啟用時自動觸發共用）。
// 注意：這裡只過濾 is_active，刻意不過濾 start_date/end_date——把起訖日期寫進
// 文件內容裡，讓 AI 在每次回答時比對「今天日期」動態判斷是否仍在有效期間，
// 這樣日期跨界（開始生效／過期）不需要等下次手動同步就會生效，也不用每天
// 排程重新同步增加成本。詳見 infra/faq-ai/lambda/bedrock_client.py。
async function runKnowledgeBaseSync() {
  const [nodes, counters, docs] = await Promise.all([
    prisma.faq_nodes.findMany({ where: { is_active: true } }),
    prisma.floor_counters.findMany({ include: { floor_floors: true } }),
    prisma.faq_documents.findMany({ where: { is_active: true } }),
  ]);

  const formatDate = d => d ? d.toISOString().slice(0, 10) : null;
  const validityText = (start, end) => {
    if (!start && !end) return '有效期間：長期有效';
    return `有效期間：${formatDate(start) ?? '無起始限制'} 至 ${formatDate(end) ?? '無結束限制'}`;
  };

  const faqDocuments = nodes.map(n => ({
    id:   `faq-${n.id}`,
    text: `問題：${n.question}\n答案：${n.answer}${n.keywords ? `\n關鍵字：${n.keywords}` : ''}\n${validityText(n.start_date, n.end_date)}`,
  }));

  const counterDocuments = counters
    .filter(c => c.name?.trim())
    .map(c => ({
      id: `counter-${c.id}`,
      text: [
        `店家／櫃位：${c.name}`,
        `位置：${c.building}棟 ${c.floor_floors?.label ?? c.floor_id}`,
        c.phone       ? `電話：${c.phone}`       : null,
        c.description ? `簡介：${c.description}` : null,
      ].filter(Boolean).join('\n'),
    }));

  const uploadedDocuments = docs.map(d => {
    const filePath = path.join(FAQ_DOC_DIR, d.filename);
    let content = '';
    try { content = fs.readFileSync(filePath, 'utf8'); } catch { content = ''; }
    return {
      id:   `doc-${d.id}`,
      text: `文件標題：${d.title}\n${content}\n${validityText(d.start_date, d.end_date)}`,
    };
  }).filter(d => d.text.trim());

  const result = await syncFaqKnowledgeBase([...faqDocuments, ...counterDocuments, ...uploadedDocuments]);
  logAwsUsage(result.usage);
  return result;
}

// GET /api/admin/faq/documents — 客服文件清單
router.get('/documents', async (_req, res) => {
  const docs = await prisma.faq_documents.findMany({ orderBy: { created_at: 'desc' } });
  res.json(docs);
});

// 文件異動後自動觸發知識庫同步。在背景執行、不等待完成才回應，避免每次上傳/
// 刪除/切換啟用都要卡在等待完整同步（列出並比對 S3 所有檔案）跑完才有反應。
// 失敗只記錄在伺服器 log，管理者可用「立即同步知識庫」按鈕手動確認/重試。
function syncAfterDocChange() {
  runKnowledgeBaseSync().catch(e => {
    console.error('[faq documents] 背景同步知識庫失敗：', e.message || e);
  });
}

// POST /api/admin/faq/documents/upload — 上傳客服文件（僅純文字 .txt，附起訖日期），上傳後自動同步知識庫
router.post('/documents/upload', uploadDoc.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '請上傳 .txt 純文字檔（2MB 以內）' });
  const title = (req.body?.title || '').trim();
  if (!title) return res.status(400).json({ error: '標題為必填' });

  const content  = decodeToUtf8(req.file.buffer);
  const filename = `${randomUUID()}.txt`;
  fs.mkdirSync(FAQ_DOC_DIR, { recursive: true });
  fs.writeFileSync(path.join(FAQ_DOC_DIR, filename), content, 'utf8');

  const { start_date, end_date } = req.body;
  const doc = await prisma.faq_documents.create({
    data: {
      title,
      filename,
      original_filename:  req.file.originalname,
      start_date: start_date ? new Date(start_date) : null,
      end_date:   end_date   ? new Date(end_date)   : null,
    },
  });
  syncAfterDocChange();
  res.status(201).json(doc);
});

// PUT /api/admin/faq/documents/:id — 更新標題／起訖日期／啟用狀態，異動後自動同步知識庫
router.put('/documents/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { title, start_date, end_date, is_active } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: '標題為必填' });
  const doc = await prisma.faq_documents.update({
    where: { id },
    data: {
      title:      title.trim(),
      start_date: start_date ? new Date(start_date) : null,
      end_date:   end_date   ? new Date(end_date)   : null,
      ...(is_active !== undefined && { is_active }),
      updated_at: new Date(),
    },
  }).catch(() => null);
  if (!doc) return res.status(404).json({ error: '找不到該文件' });
  syncAfterDocChange();
  res.json(doc);
});

// DELETE /api/admin/faq/documents/:id — 刪除文件（含本機檔案），刪除後自動同步知識庫
router.delete('/documents/:id', async (req, res) => {
  const id = Number(req.params.id);
  const doc = await prisma.faq_documents.delete({ where: { id } }).catch(() => null);
  if (doc) {
    const filePath = path.join(FAQ_DOC_DIR, doc.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  syncAfterDocChange();
  res.json({ ok: true });
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

const FAQ_AI_ENABLED_KEY = 'faq_ai_enabled';

// GET /api/admin/faq/ai-config — 取得 AI 問答開關狀態
router.get('/ai-config', async (_req, res) => {
  const row = await prisma.config.findUnique({ where: { key_name: FAQ_AI_ENABLED_KEY } });
  res.json({ enabled: row?.value === '1' });
});

// PUT /api/admin/faq/ai-config — 切換 AI 問答開關
router.put('/ai-config', async (req, res) => {
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') return res.status(400).json({ error: '無效的資料' });
  await prisma.config.upsert({
    where:  { key_name: FAQ_AI_ENABLED_KEY },
    update: { value: enabled ? '1' : '' },
    create: { key_name: FAQ_AI_ENABLED_KEY, value: enabled ? '1' : '' },
  });
  res.json({ ok: true });
});

// POST /api/admin/faq/sync-knowledge-base — 手動觸發同步（邏輯同文件上傳/刪除/切換時自動觸發的那套）
router.post('/sync-knowledge-base', async (req, res) => {
  try {
    const result = await runKnowledgeBaseSync();
    res.json(result);
  } catch (e) {
    res.status(e.status && e.status < 500 ? e.status : 502).json({ error: e.message || '同步知識庫失敗' });
  }
});

// GET /api/admin/faq/wordcloud — 查詢文字雲（bigram 切詞頻率）
router.get('/wordcloud', async (_req, res) => {
  let logs;
  try {
    logs = await prisma.faq_query_log.findMany({
      select:  { query: true },
      orderBy: { created_at: 'desc' },
      take:    2000,
    });
  } catch {
    return res.status(500).json({ error: '查詢紀錄表不存在，請先執行 migration 020' });
  }

  const STOP = new Set('的了在是我有和就不都一上也很到說要去你會著嗎呢啊哦嗯哈那這什麼可以如何怎麼哪裡誰'.split(''));

  const freq = {};
  for (const { query } of logs) {
    const q = query.trim();
    // 空白/標點切出整詞（≥ 2 字，加權較高）
    for (const w of q.split(/[\s,，、！？!?.。]+/).filter(w => w.length >= 2)) {
      freq[w] = (freq[w] || 0) + 3;
    }
    // Bigram（去空白後連續 2 字）
    const compact = q.replace(/\s/g, '');
    for (let i = 0; i < compact.length - 1; i++) {
      const bg = compact.slice(i, i + 2);
      if (![...bg].some(c => STOP.has(c))) {
        freq[bg] = (freq[bg] || 0) + 1;
      }
    }
  }

  const words = Object.entries(freq)
    .filter(([w]) => w.length >= 2 && ![...w].every(c => STOP.has(c)))
    .map(([text, value]) => ({ text, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 80);

  res.json(words);
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
