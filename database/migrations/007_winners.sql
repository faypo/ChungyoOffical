-- ============================================================
-- 007_winners.sql
-- 得獎名單：winners_events / winners_rows
-- 依賴：001_auth.sql（users）
-- ============================================================

CREATE TABLE winners_events (
  id         VARCHAR(50) PRIMARY KEY,
  title      VARCHAR(200),
  subtitle1  TEXT,
  subtitle2  TEXT,
  columns    JSON COMMENT '欄位名稱陣列（最多 5 欄，可擴充）',
  sort_order INT UNSIGNED DEFAULT 0,
  created_by INT UNSIGNED,
  updated_by INT UNSIGNED,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE winners_rows (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_id   VARCHAR(50)      NOT NULL,
  parent_id  INT UNSIGNED     COMMENT 'NULL = 根節點',
  value      TEXT,
  depth      TINYINT UNSIGNED DEFAULT 0 COMMENT '所在層級，0 = 最頂層，加速查詢用',
  sort_order INT UNSIGNED     DEFAULT 0,
  FOREIGN KEY (event_id)  REFERENCES winners_events(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES winners_rows(id)   ON DELETE CASCADE
);
