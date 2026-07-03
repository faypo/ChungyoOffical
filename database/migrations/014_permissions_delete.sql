-- 014_permissions_delete.sql
-- 補充各模組的 delete 權限

INSERT IGNORE INTO permissions (module, action) VALUES
  ('banner',         'delete'),
  ('home_event',     'delete'),
  ('logo',           'delete'),
  ('dm',             'delete'),
  ('floor',          'delete'),
  ('food',           'delete'),
  ('winners',        'delete'),
  ('activity',       'delete'),
  ('gallery',        'delete'),
  ('service',        'delete'),
  ('sustainability', 'delete'),
  ('user',           'delete');

-- super_admin 擁有所有新增的 delete 權限
INSERT IGNORE INTO role_permissions (role_id, permission_id)
  SELECT 1, id FROM permissions WHERE action = 'delete';

-- editor 擁有除 user 以外的 delete 權限
INSERT IGNORE INTO role_permissions (role_id, permission_id)
  SELECT 2, id FROM permissions
  WHERE action = 'delete' AND module NOT IN ('user');
