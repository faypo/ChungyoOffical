'use strict';

// 這個伺服器的 Node 行程不是跑在台灣時區（其他地方多處用「+8 小時後再取 UTC
// 欄位」的寫法，就是因為這樣才需要手動換算，而不是直接用 Date 的 local getter）。
// 這個檔案統一處理兩種常見的日期輸入：

// 1) <input type="date">（只有日期，例如 Banner／時尚藝廊／DM）
//    "YYYY-MM-DD" 字串本來就會被 ECMAScript 規範解析成 UTC 午夜，跟伺服器時區
//    無關，這部分儲存沒有問題；問題出在「用目前這一刻的 UTC 時間」去跟這個
//    UTC 午夜比較，會在台灣時間每天早上 8 點（UTC+8 的 UTC 午夜）就提早失效
//    一整天。taiwanTodayAsUtcMidnight() 回傳「台灣今天」對齊同一種 UTC 午夜
//    表示法，讓比較以台灣的日曆天為準，結束日當天整天都看得到。

// 2) <input type="datetime-local">（含時間，例如活動頁／首頁活動卡片）
//    "YYYY-MM-DDTHH:mm" 這種沒有時區後綴的字串，會被解析成「伺服器所在時區」
//    的當地時間，不是台灣時間——伺服器不是台灣時區，所以直接 new Date(str)
//    存進去的 UTC 時刻是錯的（通常差 8 小時）。parseTaiwanDateTimeLocal() 明確
//    補上 +08:00 時區後綴，確保不管伺服器時區為何都正確解析成台灣時間對應的
//    UTC 時刻；formatTaiwanDateTimeLocal() 則是讀出來要顯示回 datetime-local
//    輸入框時，把 UTC 時刻換算回台灣當地時間字串。

function taiwanTodayAsUtcMidnight() {
  const t = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
}

function parseTaiwanDateTimeLocal(str) {
  if (!str) return null;
  const hasOffset = /[+-]\d\d:\d\d$|Z$/.test(str);
  return new Date(hasOffset ? str : `${str}+08:00`);
}

function formatTaiwanDateTimeLocal(date) {
  if (!date) return '';
  const tw  = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const pad = n => String(n).padStart(2, '0');
  return `${tw.getUTCFullYear()}-${pad(tw.getUTCMonth() + 1)}-${pad(tw.getUTCDate())}T${pad(tw.getUTCHours())}:${pad(tw.getUTCMinutes())}`;
}

module.exports = { taiwanTodayAsUtcMidnight, parseTaiwanDateTimeLocal, formatTaiwanDateTimeLocal };
