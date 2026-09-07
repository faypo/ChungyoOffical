-- ============================================================
-- 024_faq_documents_category.sql
-- 客服文件（faq_documents）比照 FAQ 問答節點，也可以分類、受角色類別限制
-- 依賴：021_faq_documents.sql（faq_documents）、023_faq_categories.sql（faq_categories）
-- ============================================================

ALTER TABLE faq_documents
  ADD COLUMN category_id INT UNSIGNED NULL AFTER title,
  ADD FOREIGN KEY (category_id) REFERENCES faq_categories(id) ON DELETE SET NULL;
