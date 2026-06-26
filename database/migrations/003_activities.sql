-- ============================================================
-- 003_activities.sql
-- 活動頁：activities / activity_tags / activity_content / activity_hotspots
-- 依賴：001_auth.sql（users）
-- ============================================================

CREATE TABLE activities (
  id             VARCHAR(50)  PRIMARY KEY,
  title          VARCHAR(200) NOT NULL,
  start_date     DATETIME,
  end_date       DATETIME,
  og_title       VARCHAR(200),
  og_description TEXT,
  og_image       VARCHAR(500),
  sort_order     INT UNSIGNED DEFAULT 0,
  created_by     INT UNSIGNED,
  updated_by     INT UNSIGNED,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE activity_tags (
  activity_id VARCHAR(50)  NOT NULL,
  tag         VARCHAR(100) NOT NULL,
  PRIMARY KEY (activity_id, tag),
  FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE
);

CREATE TABLE activity_content (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  activity_id VARCHAR(50)  NOT NULL,
  type        ENUM('image','youtube') NOT NULL,
  file        VARCHAR(255),
  video_id    VARCHAR(50),
  sort_order  INT UNSIGNED DEFAULT 0,
  FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE
);

CREATE TABLE activity_hotspots (
  id                  VARCHAR(50)   PRIMARY KEY,
  activity_content_id INT UNSIGNED  NOT NULL,
  x                   DECIMAL(10,6) NOT NULL,
  y                   DECIMAL(10,6) NOT NULL,
  width               DECIMAL(10,6) NOT NULL,
  height              DECIMAL(10,6) NOT NULL,
  url                 VARCHAR(500),
  FOREIGN KEY (activity_content_id) REFERENCES activity_content(id) ON DELETE CASCADE
);
