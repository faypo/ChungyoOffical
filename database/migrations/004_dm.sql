-- ============================================================
-- 004_dm.sql
-- 電子型錄 DM：dm_catalogs / dm_buttons / dm_hotspots
-- 依賴：001_auth.sql（users）
-- ============================================================

CREATE TABLE dm_catalogs (
  id         VARCHAR(50)  PRIMARY KEY,
  title      VARCHAR(200),
  subtitle   VARCHAR(200),
  type       ENUM('double','single','strip','url') DEFAULT 'double',
  cover      VARCHAR(255),
  url        VARCHAR(500),
  start_date DATETIME,
  end_date   DATETIME,
  sort_order INT UNSIGNED DEFAULT 0,
  created_by INT UNSIGNED,
  updated_by INT UNSIGNED,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- double / single 版型：每頁一個按鈕連結
CREATE TABLE dm_buttons (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  catalog_id VARCHAR(50)  NOT NULL,
  page       INT UNSIGNED NOT NULL,
  url        VARCHAR(500),
  FOREIGN KEY (catalog_id) REFERENCES dm_catalogs(id) ON DELETE CASCADE
);

-- strip 版型：圖片上的熱點連結
CREATE TABLE dm_hotspots (
  id         VARCHAR(50)   PRIMARY KEY,
  catalog_id VARCHAR(50)   NOT NULL,
  x          DECIMAL(10,6) NOT NULL,
  y          DECIMAL(10,6) NOT NULL,
  width      DECIMAL(10,6) NOT NULL,
  height     DECIMAL(10,6) NOT NULL,
  url        VARCHAR(500),
  FOREIGN KEY (catalog_id) REFERENCES dm_catalogs(id) ON DELETE CASCADE
);
