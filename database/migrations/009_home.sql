-- ============================================================
-- 009_home.sql
-- 首頁模組：home_events / home_promo / home_promo_cards / logo_groups / logos / config
-- 依賴：001_auth.sql（users）
-- ============================================================

CREATE TABLE home_events (
  id         VARCHAR(50)  PRIMARY KEY,
  file       VARCHAR(255) NOT NULL,
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

-- 促銷區（永遠只有 1 筆）
CREATE TABLE home_promo (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title       VARCHAR(200),
  hero_file   VARCHAR(255),
  hero_url    VARCHAR(500),
  left_label  VARCHAR(100),
  right_label VARCHAR(100),
  created_by  INT UNSIGNED,
  updated_by  INT UNSIGNED,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 促銷卡片（固定 4 個 slot）
CREATE TABLE home_promo_cards (
  id       INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
  promo_id INT UNSIGNED    NOT NULL,
  slot     TINYINT UNSIGNED NOT NULL COMMENT '卡片位置 1–4',
  file     VARCHAR(255),
  url      VARCHAR(500),
  FOREIGN KEY (promo_id) REFERENCES home_promo(id) ON DELETE CASCADE
);

CREATE TABLE logo_groups (
  id         VARCHAR(50) PRIMARY KEY,
  sort_order INT UNSIGNED DEFAULT 0,
  created_by INT UNSIGNED,
  updated_by INT UNSIGNED,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 每個 group 最多 6 張，由 application 層控制
CREATE TABLE logos (
  id         VARCHAR(50)  PRIMARY KEY,
  group_id   VARCHAR(50)  NOT NULL,
  file       VARCHAR(255) NOT NULL,
  sort_order INT UNSIGNED DEFAULT 0,
  FOREIGN KEY (group_id) REFERENCES logo_groups(id) ON DELETE CASCADE
);

CREATE TABLE config (
  key_name   VARCHAR(100) PRIMARY KEY,
  value      TEXT,
  created_by INT UNSIGNED,
  updated_by INT UNSIGNED,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);
