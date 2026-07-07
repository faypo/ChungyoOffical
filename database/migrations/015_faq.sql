CREATE TABLE IF NOT EXISTS faq_nodes (
  id         INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  parent_id  INT UNSIGNED    NULL,
  question   VARCHAR(300)    NOT NULL,
  answer     TEXT            NOT NULL,
  keywords   VARCHAR(500)    NULL,
  sort_order INT UNSIGNED    NOT NULL DEFAULT 0,
  is_active  TINYINT(1)      NOT NULL DEFAULT 1,
  created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT faq_nodes_parent_fk FOREIGN KEY (parent_id) REFERENCES faq_nodes (id) ON DELETE CASCADE,
  INDEX idx_parent (parent_id),
  INDEX idx_sort  (parent_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
