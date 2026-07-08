-- 016_faq_permissions.sql
-- 新增 FAQ 模組的 read / write / delete 權限

INSERT IGNORE INTO permissions (module, action) VALUES
  ('faq', 'read'),
  ('faq', 'write'),
  ('faq', 'delete');

-- super_admin 擁有所有 faq 權限
INSERT IGNORE INTO role_permissions (role_id, permission_id)
  SELECT 1, id FROM permissions WHERE module = 'faq';

-- editor 擁有 faq 的 read + write + delete
INSERT IGNORE INTO role_permissions (role_id, permission_id)
  SELECT 2, id FROM permissions WHERE module = 'faq';

-- viewer 只有 faq read
INSERT IGNORE INTO role_permissions (role_id, permission_id)
  SELECT 3, id FROM permissions WHERE module = 'faq' AND action = 'read';
