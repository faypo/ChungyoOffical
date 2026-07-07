-- 012_user_must_change_password.sql
-- 新增「首次登入/重設後強制改密碼」旗標

ALTER TABLE users
  ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0
  AFTER is_active;
