'use strict';

const prisma = require('./db');

/**
 * 把 Lambda 回應內的 usage 陣列（[{service, category, costUsd, quantity, unit}]）
 * 寫入 aws_usage_log，供後台「AWS 用量統計」頁面使用。Fire-and-forget，寫入
 * 失敗只印 log，不影響原本呼叫端的回應。
 * @param {Array<{service: string, category: string, costUsd: number, quantity?: number, unit?: string}>} usageEntries
 */
function logAwsUsage(usageEntries) {
  if (!Array.isArray(usageEntries) || usageEntries.length === 0) return;

  const now = new Date();
  const rows = usageEntries
    .filter(u => u && u.service && u.category && Number.isFinite(u.costUsd))
    .map(u => ({
      service:     String(u.service).slice(0, 50),
      category:    String(u.category).slice(0, 50),
      cost_usd:    u.costUsd,
      quantity:    Number.isFinite(u.quantity) ? u.quantity : null,
      unit:        u.unit ? String(u.unit).slice(0, 20) : null,
      occurred_at: now,
    }));
  if (rows.length === 0) return;

  prisma.aws_usage_log.createMany({ data: rows }).catch(e => {
    console.error('[aws usage] 寫入用量紀錄失敗：', e.message || e);
  });
}

module.exports = { logAwsUsage };
