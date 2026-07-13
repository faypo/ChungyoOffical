-- 019_faq_validity.sql
-- FAQ 節點新增有效起迄時間（NULL 表示無限制）

ALTER TABLE faq_nodes
  ADD COLUMN start_date DATETIME NULL DEFAULT NULL AFTER is_active,
  ADD COLUMN end_date   DATETIME NULL DEFAULT NULL AFTER start_date;
