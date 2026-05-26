require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');

const dataRoutes     = require('./routes/data');
const feedbackRoutes = require('./routes/feedback');
const adminRoutes    = require('./routes/admin');
const { readJSON }   = require('./utils/json');
const { adminLogger } = require('./utils/logger');

const PORT = process.env.PORT || 4000;

const app = express();
app.use(cors());
app.use(express.json());

function escAttr(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// OG 注入：爬蟲拿到 /activity/:id 時回傳帶有 og tags 的 HTML
app.get('/activity/:id', (req, res) => {
  const data     = readJSON('activities.json', { activities: [] });
  const activity = data.activities.find(a => a.id === req.params.id);

  const ogTitle       = escAttr(activity?.ogTitle       || '中友百貨公司');
  const ogDescription = escAttr(activity?.ogDescription || '');
  const rawOgImage    = activity?.ogImage || '';
  const baseUrl       = (process.env.ORIGIN || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  const ogImage       = escAttr(rawOgImage.startsWith('http') ? rawOgImage : (rawOgImage ? baseUrl + rawOgImage : ''));

  const htmlPath = process.env.FRONTEND_HTML_PATH
    || path.join(__dirname, '../html/index.html');

  res.set('Cache-Control', 'public, max-age=300');

  if (!fs.existsSync(htmlPath)) {
    // 開發環境尚未 build，回傳最小 HTML（讓 curl / 爬蟲工具可測試 OG tags）
    return res.type('html').send(
      `<!DOCTYPE html><html><head>\n` +
      `<meta charset="UTF-8">\n` +
      `<meta property="og:title" content="${ogTitle}">\n` +
      `<meta property="og:description" content="${ogDescription}">\n` +
      `<meta property="og:image" content="${ogImage}">\n` +
      `</head><body></body></html>`
    );
  }

  let html = fs.readFileSync(htmlPath, 'utf8');
  const ogTags =
    `\n    <meta property="og:title" content="${ogTitle}">` +
    `\n    <meta property="og:description" content="${ogDescription}">` +
    `\n    <meta property="og:image" content="${ogImage}">`;
  html = html.replace('<head>', '<head>' + ogTags);
  res.type('html').send(html);
});

app.use('/api/images', (req, res, next) => {
  if (!/\.(jpg|jpeg|png|gif|webp|svg|ico|pdf)$/i.test(req.path)) return res.status(403).end();
  next();
}, express.static(path.join(__dirname, 'data')));
app.use('/api/documents', express.static(path.join(__dirname, 'data', 'documents')));
app.use('/api', dataRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/admin', adminLogger);
app.use('/api/admin', adminRoutes);

// 部署時服務前端打包檔案
const distPath = process.env.FRONTEND_DIST_PATH
  || path.join(__dirname, '../html');

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  // SPA catch-all：其他所有路由都回傳 index.html（讓 React Router 處理）
  app.use((req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  const hostname = require('os').hostname();
  console.log(`Local:   http://localhost:${PORT}`);
  console.log(`Network: http://${hostname}:${PORT}`);
});
