# Prisma 設定 SOP

> 工作目錄：`backend/`

---

## 一、初次安裝（已完成，紀錄用）

使用 **Prisma v6**（v7 的 MySQL adapter 尚未穩定，暫不升級）

```powershell
cd backend
npm install prisma@^6 @prisma/client@^6
npx prisma init --datasource-provider mysql
```

產生的檔案：
- `backend/prisma/schema.prisma` — 資料模型定義（含 datasource URL）
- `backend/generated/prisma/` — 自動產生的 client（不進 git）

> `prisma.config.ts` 是 Prisma v7 的設定檔，v6 不使用，可忽略

---

## 二、設定連線（`backend/.env`）

`.env` 不進 git，請參考 `backend/.env.example` 建立。完整欄位說明見該檔案。

本機開發（Docker）的 `DATABASE_URL`：
```env
DATABASE_URL="mysql://cy7191:K%21ng.19960827@localhost:3306/chungyoOffical"
```

> 注意：密碼中的特殊字元需 URL encode（`!` → `%21`）  
> 正式環境請換成 server 上的 MySQL 帳號密碼與 HOST

---

## 三、從現有 DB 產生 Schema（db pull）

DB 已建好時使用，自動讀取所有 table 結構寫入 `schema.prisma`：

```powershell
npx prisma db pull
```

執行後會看到：
```
Introspected 31 models and wrote them into prisma/schema.prisma
```

---

## 四、產生 Prisma Client

每次修改 `schema.prisma` 後都要跑：

```powershell
npx prisma generate
```

產生的 client 位置：`backend/generated/prisma/`

---

## 五、在程式碼中使用

建立共用 client（`backend/utils/db.js`）：

```javascript
const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();
module.exports = prisma;
```

使用範例：

```javascript
const prisma = require('../utils/db');

// 查詢所有 banners
const banners = await prisma.banners.findMany({
  orderBy: { sort_order: 'asc' },
});

// 新增一筆
await prisma.banners.create({ data: { id, file, url } });

// 更新
await prisma.banners.update({ where: { id }, data: { url } });

// 刪除
await prisma.banners.delete({ where: { id } });
```

---

## 六、常用 CLI 指令

| 指令 | 用途 |
|------|------|
| `npx prisma db pull` | 從 DB 同步 schema（DB 有改動時） |
| `npx prisma generate` | 重新產生 client（schema 改動後） |
| `npx prisma studio` | 開啟 DB 瀏覽器 GUI（http://localhost:5555） |
| `npx prisma db push` | 把 schema 改動推到 DB（開發用，不保留 migration 紀錄） |

---

## 七、注意事項

- `generated/prisma/` 已加入 `.gitignore`，不進 git，**每次部署後都要重新跑 `npx prisma generate`**
- `prisma.config.ts` 的連線字串讀取自 `.env`，`.env` 不進 git
- Server 的 `.env` 要設定對應的正式環境 `DATABASE_URL`
- Prisma v7 的連線設定在 `prisma.config.ts`，**不在** `schema.prisma` 裡

---

*文件版本：2026-06-26*
