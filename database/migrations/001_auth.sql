-- ============================================================
-- 001_auth.sql
-- 帳號權限系統：roles / permissions / role_permissions / users / user_sessions
-- 注意：此檔案必須最先執行，其他模組的 created_by / updated_by 依賴 users
-- ============================================================

CREATE TABLE roles (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(50)  NOT NULL UNIQUE COMMENT 'super_admin | editor | viewer',
  description VARCHAR(200),
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE permissions (
  id     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  module VARCHAR(50) NOT NULL COMMENT 'banner | activity | dm | floor | food ...',
  action VARCHAR(20) NOT NULL COMMENT 'read | write',
  UNIQUE KEY uq_perm (module, action)
);

CREATE TABLE role_permissions (
  role_id       INT UNSIGNED NOT NULL,
  permission_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id)       REFERENCES roles(id)       ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

CREATE TABLE users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  employee_id   VARCHAR(20)  NOT NULL UNIQUE COMMENT '工號，作為登入帳號',
  password_hash VARCHAR(255) NOT NULL,
  role_id       INT UNSIGNED NOT NULL,
  is_active     TINYINT(1)   DEFAULT 1,
  last_login_at DATETIME,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id)
);

CREATE TABLE user_sessions (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  token      VARCHAR(255) NOT NULL UNIQUE,
  expires_at DATETIME     NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 預設角色
INSERT INTO roles (name, description) VALUES
  ('super_admin', '全部模組 read + write，含帳號與系統設定'),
  ('editor',      '一般編輯，除帳號管理與系統設定外所有模組 read + write'),
  ('viewer',      '所有模組唯讀');

-- 預設權限清單
INSERT INTO permissions (module, action) VALUES
  ('banner',         'read'), ('banner',         'write'),
  ('home_event',     'read'), ('home_event',     'write'),
  ('home_promo',     'read'), ('home_promo',     'write'),
  ('home_fb',        'read'), ('home_fb',        'write'),
  ('logo',           'read'), ('logo',           'write'),
  ('dm',             'read'), ('dm',             'write'),
  ('floor',          'read'), ('floor',          'write'),
  ('food',           'read'), ('food',           'write'),
  ('winners',        'read'), ('winners',        'write'),
  ('activity',       'read'), ('activity',       'write'),
  ('gallery',        'read'), ('gallery',        'write'),
  ('service',        'read'), ('service',        'write'),
  ('sustainability', 'read'), ('sustainability', 'write'),
  ('config',         'read'), ('config',         'write'),
  ('user',           'read'), ('user',           'write'),
  ('stats',          'read'), ('stats',          'write');

-- super_admin 擁有所有權限
INSERT INTO role_permissions (role_id, permission_id)
  SELECT 1, id FROM permissions;

-- editor 擁有除 user / config / stats 以外所有模組的 read + write
INSERT INTO role_permissions (role_id, permission_id)
  SELECT 2, id FROM permissions
  WHERE module NOT IN ('user', 'config', 'stats');

-- viewer 擁有所有模組 read
INSERT INTO role_permissions (role_id, permission_id)
  SELECT 3, id FROM permissions
  WHERE action = 'read';
