-- 017_faq_dag.sql
-- FAQ 資料結構從樹狀（parent_id）改為有向圖（faq_node_links）

-- 1. 建立節點連結表（多對多，可共用葉節點）
CREATE TABLE IF NOT EXISTS faq_node_links (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  parent_id  INT UNSIGNED NOT NULL,
  child_id   INT UNSIGNED NOT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_link (parent_id, child_id),
  INDEX idx_link_parent_sort (parent_id, sort_order),
  INDEX idx_link_child (child_id),
  CONSTRAINT faq_link_parent_fk FOREIGN KEY (parent_id) REFERENCES faq_nodes (id) ON DELETE CASCADE,
  CONSTRAINT faq_link_child_fk  FOREIGN KEY (child_id)  REFERENCES faq_nodes (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. 把舊的 parent_id 樹狀關係遷移到 faq_node_links
INSERT IGNORE INTO faq_node_links (parent_id, child_id, sort_order)
SELECT parent_id, id, sort_order
FROM faq_nodes
WHERE parent_id IS NOT NULL;

-- 3. 移除 faq_nodes 的 parent_id / sort_order（順序由 links 表管理）
ALTER TABLE faq_nodes DROP FOREIGN KEY faq_nodes_parent_fk;
ALTER TABLE faq_nodes DROP INDEX idx_parent;
ALTER TABLE faq_nodes DROP INDEX idx_sort;
ALTER TABLE faq_nodes DROP COLUMN parent_id;
ALTER TABLE faq_nodes DROP COLUMN sort_order;
