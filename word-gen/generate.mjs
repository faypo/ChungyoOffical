import {
  Document, Packer, Paragraph, TextRun, ImageRun,
  HeadingLevel, AlignmentType, PageBreak,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  ShadingType, convertInchesToTwip, ExternalHyperlink,
  NumberFormat, Header, Footer, PageNumber,
} from 'docx';
import fs from 'fs';
import path from 'path';

const SCREENSHOTS = path.resolve('../manual-screenshots');
const OUT = path.resolve('../操作人員圖文手冊.docx');

function img(name, widthEmu = 5800000) {
  const p = path.join(SCREENSHOTS, name);
  if (!fs.existsSync(p)) return null;
  const buf = fs.readFileSync(p);
  const heightEmu = Math.round(widthEmu * 0.625); // 假設 16:10
  return new ImageRun({ data: buf, transformation: { width: Math.round(widthEmu / 9525), height: Math.round(heightEmu / 9525) }, type: 'png' });
}

// ── 樣式輔助 ──
const DARK  = '1A1A2E';
const BLUE  = '1A73E8';
const WARN  = 'F57C00';
const GREEN = '4CAF50';

const h1 = (text) => new Paragraph({
  text, heading: HeadingLevel.HEADING_1,
  spacing: { before: 400, after: 200 },
  run: { color: 'FFFFFF', bold: true, size: 32 },
  shading: { type: ShadingType.SOLID, color: DARK, fill: DARK },
});

const h2 = (text) => new Paragraph({
  text, heading: HeadingLevel.HEADING_2,
  spacing: { before: 320, after: 120 },
  border: { left: { style: BorderStyle.SINGLE, size: 20, color: DARK } },
  indent: { left: 160 },
});

const h3 = (text) => new Paragraph({
  children: [new TextRun({ text, bold: true, color: DARK, size: 26 })],
  spacing: { before: 240, after: 80 },
});

const body = (text) => new Paragraph({
  children: [new TextRun({ text, size: 22 })],
  spacing: { before: 60, after: 60 },
});

const step = (num, text) => new Paragraph({
  children: [
    new TextRun({ text: `步驟 ${num}　`, bold: true, color: DARK, size: 22 }),
    new TextRun({ text, size: 22 }),
  ],
  spacing: { before: 80, after: 80 },
  indent: { left: 200 },
});

const tip = (text) => new Paragraph({
  children: [
    new TextRun({ text: '💡 提示　', bold: true, color: BLUE, size: 21 }),
    new TextRun({ text, color: BLUE, size: 21 }),
  ],
  spacing: { before: 100, after: 100 },
  indent: { left: 200, right: 200 },
  shading: { type: ShadingType.SOLID, color: 'E8F4FD', fill: 'E8F4FD' },
});

const warn = (text) => new Paragraph({
  children: [
    new TextRun({ text: '⚠️ 注意　', bold: true, color: WARN, size: 21 }),
    new TextRun({ text, color: WARN, size: 21 }),
  ],
  spacing: { before: 100, after: 100 },
  indent: { left: 200, right: 200 },
  shading: { type: ShadingType.SOLID, color: 'FFF3E0', fill: 'FFF3E0' },
});

const caption = (text) => new Paragraph({
  children: [new TextRun({ text: `▲ ${text}`, italics: true, color: '888888', size: 19 })],
  alignment: AlignmentType.CENTER,
  spacing: { before: 40, after: 160 },
});

const imgPara = (name, cap) => {
  const image = img(name);
  if (!image) return [body(`（截圖：${name}）`), caption(cap)];
  return [
    new Paragraph({ children: [image], alignment: AlignmentType.CENTER, spacing: { before: 120, after: 40 } }),
    caption(cap),
  ];
};

const tableRow = (cells, isHeader = false) => new TableRow({
  children: cells.map(c => new TableCell({
    children: [new Paragraph({
      children: [new TextRun({ text: c, bold: isHeader, size: 20, color: isHeader ? 'FFFFFF' : '222222' })],
    })],
    shading: isHeader ? { type: ShadingType.SOLID, color: '333333', fill: '333333' } : undefined,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
  })),
});

const tbl = (headers, rows) => new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  rows: [
    tableRow(headers, true),
    ...rows.map(r => tableRow(r)),
  ],
});

const br = () => new Paragraph({ children: [new PageBreak()] });
const sp = () => new Paragraph({ text: '', spacing: { before: 0, after: 0 } });

// ══════════════════════════════════════
// 文件內容
// ══════════════════════════════════════
const children = [

  // ── 封面 ──
  new Paragraph({
    children: [new TextRun({ text: '管理後台 操作手冊', bold: true, size: 56, color: DARK })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 2000, after: 400 },
  }),
  new Paragraph({
    children: [new TextRun({ text: '操作人員專用版', size: 28, color: '666666' })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
  }),
  new Paragraph({
    children: [new TextRun({ text: '後台網址：http://你的網址/admin', size: 24, color: BLUE })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 2400 },
  }),
  br(),

  // ── 1. Banner 管理 ──
  h1('1　Banner 管理'),
  body('管理首頁頂部的大圖輪播。點選左側選單「首頁 → Banner 管理」。'),
  ...imgPara('01-banner.png', 'Banner 管理頁面：上方為上傳區，下方為已上傳的 Banner 列表'),

  h2('上傳新 Banner'),
  step(1, '將圖片直接拖曳到虛線框框內，或點擊框框選擇檔案。'),
  step(2, '可以一次拖入多張圖片，系統會依序上傳。'),
  step(3, '上傳完成後，圖片會自動出現在下方的 Banner 列表。'),

  h2('設定點擊連結'),
  step(1, '在每張 Banner 右側的輸入框填入連結網址（例：https://...）。'),
  step(2, '游標移開輸入框後，自動儲存，不需要按任何按鈕。'),
  tip('連結網址留空 = 點擊 Banner 不跳轉任何頁面。'),

  h2('調整 Banner 顯示順序'),
  step(1, '用滑鼠按住每列最左側的 ⠿ 圖示。'),
  step(2, '拖曳到想要的位置後放開，順序自動儲存。'),

  h2('刪除 Banner'),
  step(1, '點擊右側紅色「刪除」按鈕。'),
  step(2, '確認彈出視窗後即刪除。'),
  warn('刪除後無法復原，請確認後再操作。'),
  br(),

  // ── 2. 活動訊息 ──
  h1('2　活動訊息'),
  body('管理首頁中段活動卡片，可設定顯示時間區間。點選左側選單「首頁 → 活動訊息」。'),
  ...imgPara('02-home-event.png', '活動訊息管理頁面：可設定連結網址與顯示起訖時間'),

  h2('新增活動卡片'),
  step(1, '將圖片拖曳到上傳區，或點擊選擇圖片（支援同時多張）。'),
  step(2, '圖片出現在列表後，填寫各項資訊，游標移開自動儲存。'),

  h2('欄位說明'),
  tbl(
    ['欄位', '說明', '是否必填'],
    [
      ['連結網址', '點擊卡片後要跳轉的網址', '選填（留空不跳轉）'],
      ['開始時間', '幾月幾日幾點開始在前台顯示', '選填（不填 = 立即顯示）'],
      ['結束時間', '幾月幾日幾點自動從前台消失', '選填（不填 = 永遠顯示）'],
    ]
  ),
  sp(),
  tip('只填「結束時間」= 活動到期後卡片自動消失，但資料仍保留在後台。'),
  br(),

  // ── 3. FB 社群 ──
  h1('3　FB 社群'),
  body('將 Facebook 貼文嵌入首頁。點選左側選單「首頁 → FB 社群」。'),
  ...imgPara('03-home-fb.png', '貼上 Facebook iframe src 網址後，下方會即時預覽'),

  h2('更換嵌入的 Facebook 貼文'),
  step(1, '前往 Facebook，找到要嵌入的貼文。'),
  step(2, '點擊貼文右上角「⋯」→ 選「嵌入」。'),
  step(3, '在跳出的視窗中，複製 <iframe> 裡 src="..." 的網址。'),
  step(4, '回到後台，清除舊內容，貼上新網址。'),
  step(5, '確認下方預覽畫面正常後，點擊「儲存」。'),
  tip('src 網址格式：https://www.facebook.com/plugins/post.php?href=...'),
  br(),

  // ── 4. 推廣區 ──
  h1('4　推廣區'),
  body('管理首頁推廣版塊（1 張大圖 + 4 張小圖卡）。點選左側選單「首頁 → 推廣區」。'),
  ...imgPara('04-home-promo.png', '推廣區管理：標題、大圖（Hero）、4 張圖卡皆可獨立設定'),

  h2('各欄位操作說明'),
  tbl(
    ['欄位', '操作方式', '儲存方式'],
    [
      ['區塊標題', '點擊文字輸入框修改', '游標移開自動儲存'],
      ['大圖（Hero）', '點「更換圖片」上傳新圖', '上傳即生效'],
      ['大圖連結網址', '填入網址', '游標移開自動儲存'],
      ['左 / 右欄標籤', '點擊文字輸入框修改', '游標移開自動儲存'],
      ['圖卡 1 ～ 4', '點「更換圖片」上傳', '上傳即生效'],
      ['圖卡連結網址', '填入網址', '游標移開自動儲存'],
    ]
  ),
  sp(),
  br(),

  // ── 5. Logo 輪播 ──
  h1('5　Logo 輪播'),
  body('管理首頁底部品牌 Logo，以「組」為單位輪播。點選左側選單「首頁 → Logo 輪播」。'),
  ...imgPara('05-logos.png', '每個方框是一「組」，每組輪播一頁，最多 6 張 Logo'),

  h2('上傳 Logo'),
  step(1, '將圖片拖曳至組別區域，或點擊組內「＋」格子選擇檔案。'),
  step(2, '支援一次上傳多張，每組上限 6 張。'),

  h2('調整 Logo 順序'),
  body('在組內直接拖曳 Logo 圖片到目標位置即可。'),

  h2('新增 / 刪除組別'),
  body('• 新增組別：頁面底部點「＋ 新增組別」'),
  body('• 刪除組別：點組別右上角「刪除此組」→ 確認'),
  tip('建議 Logo 使用透明背景的 PNG 格式，視覺效果較佳。'),
  br(),

  // ── 6. DM 管理 ──
  h1('6　DM 管理'),
  body('管理電子型錄，支援翻頁書與長條捲軸兩種版型。點選左側選單「DM 管理」。'),
  ...imgPara('06-dm.png', 'DM 列表：顯示排序、ID、版型、標題、展示期間與各項操作按鈕'),

  h2('三種版型說明'),
  tbl(
    ['版型', '外觀', '適合用途'],
    [
      ['双頁', '左右兩頁翻頁書', '一般 DM、週年慶型錄'],
      ['單頁', '單頁翻頁', '單面廣告單'],
      ['長條', '垂直捲軸（整張圖）', '活動 Banner、特賣頁'],
    ]
  ),
  sp(),
  warn('版型建立後不能更改，請先確認好再新增。'),

  h2('新增 DM'),
  step(1, '點擊右上角「＋ 新增 DM」。'),
  step(2, '填寫 ID（唯一，例：dm-2026-spring，建立後不可改）、標題、副標題、排序、版型、展示期間。'),
  step(3, '點「儲存」。'),

  h2('上傳圖片'),
  step(1, '在 DM 列表點擊對應的「上傳圖片」。'),
  step(2, '拖曳或選擇圖片（双頁/單頁：可多張；長條：限 1 張）。'),
  step(3, '確認待上傳清單的順序（可拖曳調整）。'),
  step(4, '點「上傳」完成。'),

  h2('操作按鈕說明'),
  tbl(
    ['按鈕', '說明', '適用版型'],
    [
      ['預覽', '在後台即時預覽 DM 所有頁面', '全部'],
      ['上傳圖片', '新增或管理 DM 圖片', '全部'],
      ['嵌入按鈕', '在特定頁面加入連結按鈕', '双頁、單頁'],
      ['熱區管理', '在圖片上設定可點擊的透明區域連結', '長條'],
      ['封面設定', '設定在 DM 列表頁顯示的封面縮圖', '長條'],
      ['編輯', '修改標題、排序、展示日期等基本資料', '全部'],
      ['刪除', '刪除 DM 及所有圖片（無法復原）', '全部'],
    ]
  ),
  sp(),
  br(),

  // ── 7. 樓層導覽 ──
  h1('7　樓層導覽'),
  body('管理各棟各樓層的店家資訊。點選左側選單「樓層導覽」。'),
  ...imgPara('07-floor.png', '頂部選擇棟別與樓層，下方管理該樓層的店家'),

  h2('新增 / 編輯店家'),
  step(1, '頂部選擇棟別（A / B / C）與樓層。'),
  step(2, '點「＋ 新增店家」或現有店家的「編輯」。'),
  step(3, '填寫：店家名稱、電話、說明文字、Logo 圖片。'),
  step(4, '點「儲存」。'),
  body('調整店家順序：按住列表中的 ⠿ 圖示拖曳到目標位置。'),
  br(),

  // ── 8. 美食導覽 ──
  h1('8　美食導覽'),
  body('管理主題餐廳與美食街的店家資料。點選左側選單「美食導覽」。'),
  ...imgPara('08-food.png', '頂部切換主題餐廳或美食街，再選擇分類標籤後管理店家'),

  h2('新增 / 編輯店家'),
  step(1, '頂部切換「主題餐廳」或「美食街」。'),
  step(2, '選擇目標分類標籤。'),
  step(3, '點「＋ 新增店家」或現有店家的「編輯」。'),
  step(4, '填寫：店名、棟別、樓層、說明、電話、圖片。'),
  step(5, '點「儲存」。'),

  h2('管理分類'),
  body('• 新增分類：點「＋ 新增分類」填入 ID 與名稱'),
  body('• 修改名稱：點分類右側「更新標籤」'),
  body('• 刪除分類：點「刪除分類」（會連同該分類下的店家一起刪除）'),
  br(),

  // ── 9. 得獎名單 ──
  h1('9　得獎名單'),
  body('管理抽獎活動的得獎資料，支援樹狀多欄位結構。點選左側選單「得獎名單」。'),
  ...imgPara('09-winners.png', '上方為活動列表，下方為選中活動的資料編輯區'),

  h2('新增活動'),
  step(1, '點「＋ 新增活動」。'),
  step(2, '輸入活動名稱，按 Enter 或點「確認新增」。'),

  h2('設定欄位與填寫名單'),
  step(1, '點活動右側「編輯」。'),
  step(2, '填寫活動標題、小標題 1、小標題 2（說明文字）。'),
  step(3, '設定欄位名稱（最多 5 欄，例：活動名稱、獎項、得獎者、電話末四碼）。'),
  step(4, '點「＋ 新增第一欄資料」加入第一層資料。'),
  step(5, '在每筆資料右側點「＋ 子項」加入下一層（如：獎項下的得獎者）。'),
  step(6, '全部填好後點「儲存」。'),
  warn('此頁面需要手動點「儲存」，游標移開不會自動儲存。'),
  br(),

  // ── 10. 活動頁 ──
  h1('10　活動頁'),
  body('建立獨立活動專頁，可加入圖片、影片並設定社群分享預覽。點選左側選單「活動頁」。'),
  ...imgPara('10-activity.png', '活動頁管理：上方為活動列表，下方為頁面內容編輯區'),

  h2('建立新活動頁'),
  step(1, '點「＋ 新增活動頁」，輸入名稱後確認。'),
  step(2, '點「編輯」進入編輯模式。'),

  h2('設定社群分享預覽（OG Tags）'),
  body('當使用者把活動頁網址分享到 LINE 或 Facebook 時，會顯示以下資訊：'),
  tbl(
    ['欄位', '說明'],
    [
      ['og:title', '分享時顯示的標題'],
      ['og:description', '分享時顯示的說明文字'],
      ['og:image', '分享時顯示的預覽圖，點「上傳圖片」選擇'],
    ]
  ),
  sp(),

  h2('新增頁面內容'),
  step(1, '點「＋ 上傳圖片」選擇圖片（可多選），圖片加入下方列表。'),
  step(2, '如需 YouTube 影片，點「＋ YouTube」→ 貼上網址 → 點「加入」。'),
  step(3, '拖曳列表中的 ⠿ 調整內容顯示順序。'),
  step(4, '如要在圖片上設定可點擊區域，點「熱區」→ 框選位置 → 填連結 → 儲存。'),
  warn('每次編輯完成後，必須點最底部的「儲存」按鈕，否則變更不會生效！'),
  tip('活動頁前台網址格式：/activity/act-xxxxxxxxxx，可在列表中複製後提供給顧客。'),
  br(),

  // ── 11. 時尚藝廊 ──
  h1('11　時尚藝廊'),
  body('管理藝廊展示頁的圖片與影片內容。點選左側選單「時尚藝廊」。'),
  ...imgPara('11-gallery.png', '時尚藝廊管理：操作方式與活動頁相同'),

  h2('操作說明'),
  tbl(
    ['操作', '步驟'],
    [
      ['新增圖片', '點「＋ 上傳圖片」→ 選擇（可多選）→ 自動加入列表'],
      ['新增 YouTube 影片', '點「＋ YouTube」→ 貼上網址或影片 ID → 點「加入」'],
      ['調整顯示順序', '拖曳每列左側的 ⠿ 圖示到目標位置'],
      ['設定圖片熱區', '點「熱區」→ 框選區域 → 填連結網址 → 儲存'],
      ['刪除內容', '點每列右側的「刪除」按鈕'],
    ]
  ),
  sp(),
  warn('修改完畢後，必須點「儲存」按鈕才會生效！'),
  br(),

  // ── 常見問題 ──
  h1('常見問題'),

  h3('Q：改了東西，但前台沒有更新？'),
  body('部分頁面需要手動點「儲存」按鈕：'),
  body('• 自動儲存：Banner 連結、活動訊息各欄位、推廣區文字'),
  body('• 需手動儲存：活動頁、時尚藝廊、得獎名單'),

  h3('Q：出現「無法連線到後端」的訊息？'),
  body('後端服務可能已停止，請聯絡系統管理人員重新啟動伺服器。'),

  h3('Q：圖片上傳後沒有出現？'),
  body('確認圖片格式是否為 JPG、PNG 或 WebP，其他格式不支援。'),

  h3('Q：DM 版型選錯怎麼辦？'),
  body('版型建立後無法修改，需要刪除後重新建立並重新上傳圖片。'),

  h3('Q：活動訊息卡片設了結束時間，但前台還看得到？'),
  body('系統依伺服器時間判斷，請確認結束時間格式填寫正確，且時間已確實到達。'),
];

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: 'Microsoft JhengHei', size: 22 },
      },
    },
    paragraphStyles: [
      {
        id: 'Heading1', name: 'Heading 1',
        basedOn: 'Normal',
        run: { bold: true, color: 'FFFFFF', size: 32, font: 'Microsoft JhengHei' },
        paragraph: {
          spacing: { before: 400, after: 200 },
          shading: { type: ShadingType.SOLID, color: DARK, fill: DARK },
        },
      },
      {
        id: 'Heading2', name: 'Heading 2',
        basedOn: 'Normal',
        run: { bold: true, color: DARK, size: 26, font: 'Microsoft JhengHei' },
        paragraph: { spacing: { before: 280, after: 100 } },
      },
    ],
  },
  sections: [{ children }],
});

const buf = await Packer.toBuffer(doc);
fs.writeFileSync(OUT, buf);
console.log('完成：' + OUT);
