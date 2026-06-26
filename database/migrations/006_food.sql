-- ============================================================
-- 006_food.sql
-- 美食導覽：food_categories / food_items
-- 依賴：001_auth.sql（users）、005_floor.sql（floor_floors）
-- ============================================================

CREATE TABLE food_categories (
  id         VARCHAR(50)  PRIMARY KEY,
  label      VARCHAR(100) NOT NULL,
  sort_order INT UNSIGNED DEFAULT 0,
  created_by INT UNSIGNED,
  updated_by INT UNSIGNED,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE food_items (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id VARCHAR(50)  NOT NULL,
  name        VARCHAR(200) NOT NULL,
  floor_id    VARCHAR(20),
  building    CHAR(1)      COMMENT 'A | B | C',
  phone       VARCHAR(50),
  logo        VARCHAR(255),
  description TEXT,
  sort_order  INT UNSIGNED DEFAULT 0,
  FOREIGN KEY (category_id) REFERENCES food_categories(id) ON DELETE CASCADE,
  FOREIGN KEY (floor_id)    REFERENCES floor_floors(id)    ON DELETE SET NULL
);
