# FAQ 智能客服系統

## 架構概述

FAQ 採用 **有向無環圖（DAG）** 資料結構，節點之間透過 `faq_node_links` 連結表管理關聯，同一個子節點可被多個父節點共用。前台以浮動聊天視窗（YOYO）呈現，支援關鍵字搜尋與對話語境記憶。

---

## 搜尋權重算法

搜尋端點：`GET /api/faq/search?q=搜尋詞&context=1,2,3`

### 分數計算

每個節點的總分 = `fwdScore + revScore + winScore + ctxBoost`

#### 1. 正向匹配（fwdScore）

```
搜尋詞以空白切割成 terms，每個 term 出現在「關鍵字」中 → +1
（不比對問題文字，避免問題中的常見詞誤觸發）
```

| 搜尋詞 | 節點關鍵字 | 結果 |
|--------|-----------|------|
| 停車 | 停車 收費 | +1 |
| 停車 費用 | 停車 費用 折抵 | +2 |

#### 2. 反向精確匹配（revScore）

```
節點關鍵字（以空白/逗號/頓號/分號分隔，≥2字）逐一檢查是否為搜尋詞的子字串 → 每個 +1
```

適合中文自然語言：使用者輸入完整句子，系統從中找出關鍵字片段。

| 搜尋詞 | 節點關鍵字 | 結果 |
|--------|-----------|------|
| 我要去哪裡停車 | 停車 | +1（「停車」是搜尋句的子字串） |
| 有停車方案嗎 | 停車 | +1 |
| 今天天氣如何 | 停車 | 0 |

#### 3. 滑動窗口字符匹配（winScore）

```
關鍵字的每個字符，在搜尋詞長度 2 倍的滑動窗口內全部出現 → +1
（僅在該關鍵字未被 revScore 精確匹配時才計分，避免重複加分）
```

處理中文語序變化，例如「車子停在哪」中「停」與「車」順序顛倒，無法精確匹配「停車」，但兩字都在鄰近窗口內。

| 搜尋詞 | 關鍵字 | 窗口（大小=4） | 結果 |
|--------|--------|---------------|------|
| 車子停在哪 | 停車 | 「車子停在」含「停」且含「車」 | +1 |
| 今天有活動嗎 | 停車 | 無任何窗口同時含「停」和「車」 | 0 |

> **三種比對均只針對關鍵字欄位，不比對問題文字。** 避免問題句中的常見字（如「哪裡」、「什麼」）誤觸發不相關節點。

#### 4. 對話語境加分（ctxBoost）

```
若此節點是最近訪問過節點的後續問題（child）AND 本身有基礎分數（baseScore > 0）→ +2
```

**語境記憶**：前台保留最近 3 個訪問過的節點 ID，傳入 `context` 參數。
後端查出這些節點的所有子節點，搜尋時給予加分。

| 情境 | baseScore | ctxBoost | 結果 |
|------|-----------|----------|------|
| 問停車後問「要不要錢」（費用節點是停車子節點，有費用關鍵字） | 1 | +2 | 3，優先顯示 ✅ |
| 問停車後問「活動」（活動節點非停車子節點） | 1+ | 0 | 正常搜尋 ✅ |
| 問停車後輸入完全無關內容（停車子節點無關鍵字匹配） | 0 | 0 | 觸發 fallback ✅ |

> **設計原則**：`ctxBoost` 必須搭配 `baseScore > 0` 才生效，避免無關節點被語境強制拉高。

#### 5. 穩定排序

```
主排序：score 由高到低
次排序：id 由小到大（分數相同時 id 較小的優先，避免結果隨機跳動）
```

#### 6. 有效時間過濾

```
搜尋與節點點選均會過濾：
  start_date IS NULL OR start_date <= NOW()
  end_date   IS NULL OR end_date   >= NOW()

NULL 表示無限制，後續問題（children）也同樣套用此過濾。
```

#### 7. Fallback 門檻

```
最高分節點的 score < MIN_SCORE（目前 = 1）→ 顯示 fallback 訊息並記錄至 faq_unanswered
```

---

## 資料庫結構

### faq_nodes
| 欄位 | 說明 |
|------|------|
| id | 主鍵 |
| question | 問題文字（最長 300 字） |
| answer | 答案（支援 `[文字](url)` 連結、`![alt](url)` 圖片語法） |
| keywords | 搜尋關鍵字，空白分隔（最長 500 字） |
| is_active | 是否啟用 |
| created_at / updated_at | 時間戳 |

### faq_node_links
| 欄位 | 說明 |
|------|------|
| id | 主鍵 |
| parent_id | 父節點 ID |
| child_id | 子節點 ID |
| sort_order | 顯示順序 |

- `UNIQUE(parent_id, child_id)` 防止重複連結
- 兩個 FK 均設 `ON DELETE CASCADE`

### faq_unanswered
| 欄位 | 說明 |
|------|------|
| id | 主鍵 |
| query | 使用者輸入（最長 500 字） |
| ask_count | 被問次數（重複自動累加） |
| created_at | 首次提問時間 |
| last_asked_at | 最後提問時間 |

---

## 修改檔案清單

### 資料庫 Migration

| 檔案 | 說明 |
|------|------|
| `database/migrations/015_faq.sql` | 建立 faq_nodes（舊樹狀結構） |
| `database/migrations/016_faq_permissions.sql` | 新增 FAQ 模組權限（read/write/delete） |
| `database/migrations/017_faq_dag.sql` | 將 faq_nodes 從樹狀改為 DAG，建立 faq_node_links，移除 parent_id / sort_order |
| `database/migrations/018_faq_unanswered.sql` | 建立未解答問題記錄表 |
| `database/migrations/019_faq_validity.sql` | faq_nodes 新增 start_date / end_date 有效期欄位 |

### 後端

| 檔案 | 狀態 | 說明 |
|------|------|------|
| `backend/prisma/schema.prisma` | 修改 | 新增 faq_nodes（含 start_date/end_date）、faq_node_links、faq_unanswered 模型 |
| `backend/routes/data.js` | 修改 | 新增 `/faq/search`（含語境加權、時間過濾）、`/faq/:id`、`POST /faq/unanswered` |
| `backend/routes/admin/faq.js` | **新增** | FAQ 後台管理 API（節點 CRUD、連結管理、圖片上傳、fallback config、未解答清單） |
| `backend/routes/admin/index.js` | 修改 | 註冊 FAQ 路由與 `faq` 模組權限控管 |
| `backend/routes/admin/auth.js` | 修改 | 登入回傳 `employee_id` |

### 前端

| 檔案 | 狀態 | 說明 |
|------|------|------|
| `dm-flipbook/src/App.jsx` | 修改 | 新增 `/faq` 獨立路由 |
| `dm-flipbook/src/components/layout/Layout.jsx` | 修改 | 加入 FaqWidget 浮動按鈕 |
| `dm-flipbook/src/pages/FaqPage.jsx` | **新增** | `/faq` 獨立頁（供 webview 嵌入） |
| `dm-flipbook/src/utils/faqAnswer.jsx` | **新增** | 解析 `[文字](url)` 連結與 `![alt](url)` 圖片語法並渲染 |
| `dm-flipbook/src/components/FaqWidget.jsx` | **新增** | 浮動聊天視窗主元件（YOYO），含語境記憶、搜尋、fallback、未解答記錄 |
| `dm-flipbook/src/components/FaqWidget.css` | **新增** | 聊天視窗樣式 |
| `dm-flipbook/src/components/admin/FaqManager.jsx` | **新增** | FAQ 後台管理介面（節點列表、DAG 連結管理、起迄時間、圖片上傳、未解答問題區塊、建立問題後自動清除待補充紀錄） |
| `dm-flipbook/src/components/admin/FaqManager.css` | **新增** | FAQ 後台樣式 |
| `dm-flipbook/src/components/admin/AdminLayout.jsx` | 修改 | 側邊欄顯示登入者工號 |
| `dm-flipbook/src/components/admin/AdminLayout.css` | 修改 | 工號顯示樣式 |
| `dm-flipbook/src/components/admin/ActivityManager.jsx` | 修改 | 分頁新增「第一頁 «」與「最後一頁 »」按鈕 |

---

## 前台操作流程

1. 使用者點擊右下角紫色按鈕開啟 YOYO 視窗
2. 輸入問題 → 後端搜尋評分 → 顯示最高分節點的答案
3. 若節點有後續問題 → 顯示選項 chip 供點選
4. 點選 chip → 顯示該節點答案（並更新對話語境）
5. 繼續輸入 → 語境加權搜尋，同主題問題優先

## 後台操作流程

1. 進入「FAQ 管理」
2. 設定「無法回答時的訊息」（頁面頂部）
3. 點「＋ 新增問題」建立節點（填問題、答案、關鍵字）
4. 選取已建立的節點 → 右側「後續問題」區塊 → 新增連結
5. 「待補充問題」黃色區塊顯示使用者曾問但無法回答的問題，可直接點「建立問題」預填
