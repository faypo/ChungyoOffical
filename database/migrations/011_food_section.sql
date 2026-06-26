-- 011_food_section.sql
ALTER TABLE food_items
  ADD COLUMN `section` ENUM('theme','foodcourt') NOT NULL DEFAULT 'theme' AFTER category_id;
