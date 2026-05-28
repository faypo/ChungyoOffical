const fs   = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'feedback-log');

function getLogPath() {
  const tw  = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const pad = n => String(n).padStart(2, '0');
  const name = `${tw.getUTCFullYear()}-${pad(tw.getUTCMonth() + 1)}-${pad(tw.getUTCDate())}_${pad(tw.getUTCHours())}.jsonl`;
  return path.join(LOG_DIR, name);
}

function writeLog(entry) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(getLogPath(), JSON.stringify(entry) + '\n', 'utf8');
  } catch (_) {}
}

function feedbackLogger(req, _res, next) {
  if (req.method === 'GET') return next();

  const tw   = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const ip   = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || '';

  const entry = {
    time:   tw.toISOString().replace('Z', '+08:00'),
    ip,
    method: req.method,
  };

  writeLog(entry);
  next();
}

module.exports = { feedbackLogger };
