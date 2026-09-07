-- ============================================================
-- 023_faq_categories.sql
-- FAQ 問答節點分類 ＋ 依角色限制可編輯的分類
-- 依賴：015_faq.sql（faq_nodes）、001_auth.sql（roles）
--
-- 規則（重要，決定了授權判斷邏輯，見 backend/routes/admin/faq.js）：
--   1. 角色在 role_faq_categories 沒有任何一筆 = 該角色不受類別限制，
--      只要有 faq:write 權限就能編輯所有類別的節點（等同現況，向後相容）。
--   2. faq_nodes.category_id 為 NULL（未分類）= 對所有有 faq:write 權限的角色開放，
--      不受任何角色的類別限制影響。
--   3. 只有角色被「明確」指派了 role_faq_categories 清單時，才會被限制成
--      只能編輯清單內類別的節點。
-- ============================================================

CREATE TABLE faq_categories (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(50) NOT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_faq_category_name (name)
);

ALTER TABLE faq_nodes
  ADD COLUMN category_id INT UNSIGNED NULL AFTER keywords,
  ADD FOREIGN KEY (category_id) REFERENCES faq_categories(id) ON DELETE SET NULL;

CREATE TABLE role_faq_categories (
  role_id     INT UNSIGNED NOT NULL,
  category_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (role_id, category_id),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES faq_categories(id) ON DELETE CASCADE
);
