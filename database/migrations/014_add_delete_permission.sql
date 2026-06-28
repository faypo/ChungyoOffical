-- 014_add_delete_permission.sql
-- 為所有模組新增 delete 權限，並自動授予 super_admin

INSERT INTO permissions (module, action) VALUES
  ('banner',         'delete'),
  ('home_event',     'delete'),
  ('home_promo',     'delete'),
  ('home_fb',        'delete'),
  ('logo',           'delete'),
  ('dm',             'delete'),
  ('floor',          'delete'),
  ('food',           'delete'),
  ('winners',        'delete'),
  ('activity',       'delete'),
  ('gallery',        'delete'),
  ('service',        'delete'),
  ('sustainability', 'delete'),
  ('config',         'delete'),
  ('user',           'delete'),
  ('stats',          'delete');

-- super_admin 自動取得所有新增的 delete 權限
INSERT INTO role_permissions (role_id, permission_id)
  SELECT 1, id FROM permissions WHERE action = 'delete';
