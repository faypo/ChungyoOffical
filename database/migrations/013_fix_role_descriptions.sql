-- 013_fix_role_descriptions.sql
-- 修正 roles 表中的中文說明，需使用 --default-character-set=utf8mb4 執行

UPDATE roles SET description = '全部模組讀寫，含帳號管理與系統設定' WHERE name = 'super_admin';
UPDATE roles SET description = '一般編輯：除帳號管理與系統設定外，所有模組讀寫' WHERE name = 'editor';
UPDATE roles SET description = '所有模組唯讀' WHERE name = 'viewer';
