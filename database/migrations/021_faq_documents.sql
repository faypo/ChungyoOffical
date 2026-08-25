-- ============================================================
-- 021_faq_documents.sql
-- FAQ AI 客服文件：可上傳純文字文件（含起訖有效日期），同步進 AI 知識庫
-- 依賴：001_auth.sql（users）
-- ============================================================

CREATE TABLE faq_documents (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title             VARCHAR(200) NOT NULL,
  filename          VARCHAR(255) NOT NULL COMMENT '本機儲存檔名',
  original_filename VARCHAR(255) NULL COMMENT '使用者上傳時的原始檔名',
  is_active         TINYINT(1) NOT NULL DEFAULT 1,
  start_date        DATETIME NULL,
  end_date          DATETIME NULL,
  created_by        INT UNSIGNED NULL,
  updated_by        INT UNSIGNED NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);
