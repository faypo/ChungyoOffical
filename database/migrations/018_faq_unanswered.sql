-- 018_faq_unanswered.sql
-- 記錄 FAQ 無法回答的問題，供後台維護人員補充答案

CREATE TABLE IF NOT EXISTS faq_unanswered (
  id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  query       VARCHAR(500)  NOT NULL,
  ask_count   INT UNSIGNED  NOT NULL DEFAULT 1,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_asked_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_query (query(255)),
  INDEX idx_count (ask_count DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
