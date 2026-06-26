const fs   = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'log');

const UPLOAD_PATH = /\/(upload|upload-og|icon|logo)($|\/)/;
const SKIP_KEYS   = new Set(['content', 'icons', 'ids']);

function getLogPath() {
  const tw  = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const pad = n => String(n).padStart(2, '0');
  const name = `${tw.getUTCFullYear()}-${pad(tw.getUTCMonth() + 1)}-${pad(tw.getUTCDate())}_${pad(tw.getUTCHours())}.jsonl`;
  return path.join(LOG_DIR, name);
}

function sanitizeBody(body, reqPath) {
  if (UPLOAD_PATH.test(reqPath)) return '[file upload]';
  if (!body || typeof body !== 'object' || !Object.keys(body).length) return undefined;

  const out = {};
  for (const [k, v] of Object.entries(body)) {
    if (SKIP_KEYS.has(k))                          { out[k] = `[${Array.isArray(v) ? 'array:' + v.length : 'object'}]`; }
    else if (Array.isArray(v))                     { out[k] = `[array:${v.length}]`; }
    else if (typeof v === 'string' && v.length > 300) { out[k] = '[long string]'; }
    else if (typeof v === 'object' && v !== null)  { out[k] = '[object]'; }
    else                                           { out[k] = v; }
  }
  return Object.keys(out).length ? out : undefined;
}

function writeLog(entry) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(getLogPath(), JSON.stringify(entry) + '\n', 'utf8');
  } catch (_) {}
}

function adminLogger(req, _res, next) {
  if (req.method === 'GET') return next();

  const tw   = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const ip   = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || '';
  const body = sanitizeBody(req.body, req.path);

  const entry = {
    time:   tw.toISOString().replace('Z', '+08:00'),
    ip,
    method: req.method,
    path:   req.path,
  };
  if (body !== undefined) entry.body = body;

  writeLog(entry);
  next();
}

module.exports = { adminLogger };
