-- ============================================================
-- 帳號資料匯入
-- 在 phpMyAdmin 的 SQL 頁籤貼上執行即可
-- 注意：請在執行完所有 migrations (001~014) 之後再執行此檔
-- ============================================================

INSERT INTO users (id, employee_id, password_hash, role_id, is_active, must_change_password) VALUES
(1, 'admin',  '$2b$12$IBw9nJk1/rxwj33BGDdarOUEe81cEE/PoMO2QOG5/c7NvSmJ4X872', 1, 1, 0),
(2, 'cy7191', '$2b$12$x.V4Mbw6kuurWv7ONKC3herDXF4iK/6oaMr/Pbuqr2au1e/9Z73ve', 1, 1, 0)
ON DUPLICATE KEY UPDATE
  password_hash        = VALUES(password_hash),
  role_id              = VALUES(role_id),
  is_active            = VALUES(is_active),
  must_change_password = VALUES(must_change_password);
