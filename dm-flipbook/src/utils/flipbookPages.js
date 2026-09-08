/**
 * Flatten spreads into individual mobile pages.
 * double: spread 0 → right half (cover), spread N → left+right, last → left (back cover)
 * single: each page shown in full, no splitting
 */
export function buildMobilePages(pages, type) {
  if (type === 'single') {
    return pages.map((page, i) => ({ page, side: 'single', spreadIndex: i }));
  }
  const result = [];
  pages.forEach((page, i) => {
    if (i === 0) {
      result.push({ page, side: 'right', spreadIndex: 0 });
    } else {
      result.push({ page, side: 'left',  spreadIndex: i });
      result.push({ page, side: 'right', spreadIndex: i });
    }
  });
  if (pages.length > 0) {
    result.push({ page: pages[0], side: 'left', spreadIndex: 0 });
  }
  return result;
}

/**
 * 把「頁碼」（跟 DMManager 嵌入按鈕 btnForm.page 同一套：mobile 拆頁後的攤平索引，
 * 從 0 起算，第一頁是封面）換成桌機版用的 spread 索引，供路由深連結（?page=N）用。
 *
 * single 版桌機每個 spread 塞兩張原始圖（pages[i*2] / pages[i*2+1]，見 FlipBook.jsx
 * 的 getSpreadPages），但 mobile 版是一張圖一頁攤平顯示，兩邊「頁碼」單位不同，
 * 所以 single 型別要另外除以 2，不能直接用 buildMobilePages 攤平後的 spreadIndex。
 */
export function pageNumberToSpreadIndex(pages, type, pageNumber) {
  if (type === 'single') {
    if (pages.length === 0) return 0;
    const clamped = Math.max(0, Math.min(pageNumber, pages.length - 1));
    return Math.floor(clamped / 2);
  }
  const mobilePages = buildMobilePages(pages, type);
  if (mobilePages.length === 0) return 0;
  const clamped = Math.max(0, Math.min(pageNumber, mobilePages.length - 1));
  return mobilePages[clamped].spreadIndex;
}
