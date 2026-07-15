CREATE TABLE IF NOT EXISTS faq_query_log (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  query      VARCHAR(500) NOT NULL,
  answered   TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME     NOT NULL DEFAULT NOW(),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
