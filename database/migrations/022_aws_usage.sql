-- 022_aws_usage.sql
-- FAQ AI 功能會呼叫的 AWS 服務用量成本估算紀錄，供後台「AWS 用量統計」頁面使用。
-- 每筆紀錄代表一次 AWS 服務呼叫的估算成本（見 infra/faq-ai/lambda/usage_tracker.py）。

CREATE TABLE IF NOT EXISTS aws_usage_log (
  id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  service     VARCHAR(50)   NOT NULL COMMENT 'bedrock_converse | bedrock_retrieve | bedrock_embed | transcribe | polly',
  category    VARCHAR(50)   NOT NULL COMMENT '顯示用大分類，例如 AI 對話、語音辨識',
  cost_usd    DECIMAL(12,8) NOT NULL DEFAULT 0,
  quantity    DECIMAL(14,4),
  unit        VARCHAR(20),
  occurred_at DATETIME      NOT NULL,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_occurred_at (occurred_at),
  INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- aws_usage 模組權限（沿用既有 module/action pattern）
INSERT INTO permissions (module, action) VALUES
  ('aws_usage', 'read'),
  ('aws_usage', 'write');

-- super_admin 擁有所有 aws_usage 權限
INSERT INTO role_permissions (role_id, permission_id)
  SELECT 1, id FROM permissions WHERE module = 'aws_usage';

-- 成本資料比照 stats/config，editor 不開放（僅 super_admin 可讀寫）

-- viewer 只有 aws_usage read
INSERT INTO role_permissions (role_id, permission_id)
  SELECT 3, id FROM permissions WHERE module = 'aws_usage' AND action = 'read';
