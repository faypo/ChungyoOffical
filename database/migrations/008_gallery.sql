-- ============================================================
-- 008_gallery.sql
-- 時尚藝廊：gallery_content / gallery_hotspots
-- 依賴：001_auth.sql（users）
-- ============================================================

CREATE TABLE gallery_content (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  type       ENUM('image','youtube') NOT NULL,
  file       VARCHAR(255),
  video_id   VARCHAR(50),
  page_id    INT UNSIGNED NULL COMMENT '預留：未來多分頁用，NULL = 預設共用頁',
  sort_order INT UNSIGNED DEFAULT 0,
  created_by INT UNSIGNED,
  updated_by INT UNSIGNED,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE gallery_hotspots (
  id                 VARCHAR(50)   PRIMARY KEY,
  gallery_content_id INT UNSIGNED  NOT NULL,
  x                  DECIMAL(10,6),
  y                  DECIMAL(10,6),
  width              DECIMAL(10,6),
  height             DECIMAL(10,6),
  url                VARCHAR(500),
  FOREIGN KEY (gallery_content_id) REFERENCES gallery_content(id) ON DELETE CASCADE
);
