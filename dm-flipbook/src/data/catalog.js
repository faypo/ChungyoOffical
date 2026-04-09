// 執行期從 public/ 動態讀取，打包後在伺服器上直接修改 catalog.json 即可

/** 讀取全部 DM 的 metadata */
export async function fetchCatalog() {
  const res = await fetch('/catalog.json');
  if (!res.ok) throw new Error('無法載入 catalog.json');
  return res.json(); // [{ id, title, subtitle }]
}

/** 讀取單一 DM 的頁面列表，回傳 pages 陣列 */
export async function fetchDMPages(dmId) {
  const res = await fetch(`/dm-pic/${dmId}/index.json`);
  if (!res.ok) throw new Error(`無法載入 ${dmId}/index.json`);
  const files = await res.json(); // ["cover.jpg", "1-2.jpg", ...]
  return files.map(file => ({
    src: `/dm-pic/${dmId}/${file}`,
    name: file.replace('.jpg', ''),
  }));
}
