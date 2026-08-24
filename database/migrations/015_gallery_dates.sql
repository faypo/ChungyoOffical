-- ============================================================
-- 015_gallery_dates.sql
-- 時尚藝廊：新增起訖時間功能（start_date / end_date）
-- 依賴：008_gallery.sql（gallery_content）
-- ============================================================

ALTER TABLE gallery_content
  ADD COLUMN start_date DATETIME NULL AFTER video_id,
  ADD COLUMN end_date   DATETIME NULL AFTER start_date;
