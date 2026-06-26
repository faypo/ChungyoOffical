-- ============================================================
-- 005_floor.sql
-- 樓層導覽：floor_floors / floor_info / floor_info_icons / floor_counters
-- 依賴：001_auth.sql（users）
-- 注意：006_food.sql 依賴此檔案的 floor_floors
-- ============================================================

CREATE TABLE floor_floors (
  id         VARCHAR(20)  PRIMARY KEY,
  label      VARCHAR(100) NOT NULL,
  sort_order INT UNSIGNED DEFAULT 0,
  created_by INT UNSIGNED,
  updated_by INT UNSIGNED,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE floor_info (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  floor_id   VARCHAR(20) NOT NULL,
  building   CHAR(1)     NOT NULL COMMENT 'A | B | C',
  title      VARCHAR(200),
  UNIQUE KEY uq_floor_info (floor_id, building),
  FOREIGN KEY (floor_id) REFERENCES floor_floors(id) ON DELETE CASCADE
);

CREATE TABLE floor_info_icons (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  floor_info_id INT UNSIGNED NOT NULL,
  file          VARCHAR(255) NOT NULL,
  sort_order    INT UNSIGNED DEFAULT 0,
  FOREIGN KEY (floor_info_id) REFERENCES floor_info(id) ON DELETE CASCADE
);

CREATE TABLE floor_counters (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  floor_id    VARCHAR(20)  NOT NULL,
  building    CHAR(1)      NOT NULL COMMENT 'A | B | C',
  name        VARCHAR(100),
  phone       VARCHAR(50),
  logo        VARCHAR(255),
  description TEXT,
  sort_order  INT UNSIGNED DEFAULT 0,
  FOREIGN KEY (floor_id) REFERENCES floor_floors(id) ON DELETE CASCADE
);
