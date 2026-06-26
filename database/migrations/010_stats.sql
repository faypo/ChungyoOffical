-- ============================================================
-- 010_stats.sql
-- 流量統計：page_views / activity_views
-- 依賴：003_activities.sql（activities）
-- ============================================================

-- 各頁面每日瀏覽統計
CREATE TABLE page_views (
  id      INT UNSIGNED     AUTO_INCREMENT PRIMARY KEY,
  page    VARCHAR(50)      NOT NULL COMMENT 'home|floor|food|service|winners|feedback|activity',
  date    DATE             NOT NULL,
  hour    TINYINT UNSIGNED NULL COMMENT '預留：0-23，NULL = 日粒度（未啟用時段分析）',
  count   INT UNSIGNED     DEFAULT 0,
  UNIQUE KEY uq_page_date (page, date)
);

-- 活動頁個別瀏覽統計
CREATE TABLE activity_views (
  id          INT UNSIGNED     AUTO_INCREMENT PRIMARY KEY,
  activity_id VARCHAR(50)      NOT NULL,
  title       VARCHAR(200)     COMMENT '活動標題快照，活動刪除後保留歷史紀錄',
  date        DATE             NOT NULL,
  hour        TINYINT UNSIGNED NULL COMMENT '預留：0-23，NULL = 日粒度（未啟用時段分析）',
  count       INT UNSIGNED     DEFAULT 0,
  UNIQUE KEY uq_act_date (activity_id, date),
  FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE
);
