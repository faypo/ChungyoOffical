# Server DB Setup SOP

從零開始建立 MySQL → 跑 Migration → 匯入資料 → 啟動後端的完整流程。

---

## 前置條件

- Ubuntu server
- Docker + Docker Compose 已安裝
- Node.js 18+ 已安裝（`node -v` 確認）
- 專案程式碼已上傳（例如在 `/var/www/`）

上傳方式（本機 Windows 執行，排除不需要的資料夾）：

```powershell
scp -r C:\code\ChungyoOffical\backend  帳號@IP:/var/www/
scp -r C:\code\ChungyoOffical\database 帳號@IP:/var/www/
scp -r C:\code\ChungyoOffical\docker   帳號@IP:/var/www/
```

> ⚠️ 不要上傳 `node_modules/`、`generated/`、`.env`、`log/`

---

## Step 1 — 設定 .env 檔案

### 1-1. Docker 環境變數

```bash
cd /var/www/docker
cp .env.example .env
nano .env
```

填入：

```
MYSQL_ROOT_PASSWORD=energyChungyo123
MYSQL_DATABASE=chungyoOffical
MYSQL_USER=cy7191
MYSQL_PASSWORD=K!ng.19960827
```

### 1-2. 後端環境變數

```bash
cd /var/www/backend
nano .env
```

填入（注意密碼中的 `!` 要 URL encode 為 `%21`）：

```
PORT=4000
DATABASE_URL="mysql://cy7191:K%21ng.19960827@localhost:3306/chungyoOffical"
JWT_SECRET=5j/u.3193cji4g;j4yvmp4dk4ej0j;3au4a83
JWT_EXPIRES_IN=8h
ORIGIN=https://your-domain.com

# 視需要填入
API_URL=
SENDGRID_API_KEY=
MAIL_SEND_FROM=
MAIL_SEND_TO=
MAIL_SEND_SUBJECT=
MAIL_SEND_TEXT=
```

---

## Step 2 — 啟動 MySQL 容器

```bash
cd /var/www/docker
docker compose up -d
```

等待 MySQL 就緒（healthcheck 約 30 秒）：

```bash
docker ps
# 確認 STATUS 欄顯示 (healthy)
```

或用 watch 等待：

```bash
watch -n 3 'docker inspect --format="{{.State.Health.Status}}" chungyo_mysql'
# 出現 healthy 後按 Ctrl+C
```

---

## Step 3 — 跑 Migrations（建立所有 Table）

依序執行以下指令。每次成功不會有 ERROR 輸出，只有 Warning 是正常的。

```bash
# 定義快捷函式（貼到終端機）
function migrate() {
  docker exec -i chungyo_mysql mysql \
    --default-character-set=utf8mb4 \
    -ucy7191 '-pK!ng.19960827' chungyoOffical \
    < /var/www/database/migrations/$1
  echo "Done: $1"
}
```

> ⚠️ 密碼必須用**單引號**包住（`'-p...'`），否則 `!` 會被 bash 解析成歷史展開而報錯。

依序執行：

```bash
migrate 001_auth.sql
migrate 002_banners.sql
migrate 003_activities.sql
migrate 004_dm.sql
migrate 005_floor.sql
migrate 006_food.sql
migrate 007_winners.sql
migrate 008_gallery.sql
migrate 009_home.sql
migrate 010_stats.sql
migrate 011_food_section.sql
migrate 012_user_must_change_password.sql
migrate 013_fix_role_descriptions.sql
migrate 014_permissions_delete.sql
```

確認 table 都建好：

```bash
docker exec chungyo_mysql mysql -ucy7191 '-pK!ng.19960827' chungyoOffical \
  -e "SHOW TABLES;" 2>/dev/null
```

---

## Step 4 — 安裝 Node 套件 & 產生 Prisma Client

```bash
cd /var/www/backend
npm install
npx prisma generate
```

---

## Step 5 — 匯入初始資料

```bash
cd /var/www
node database/import.js
```

正常輸出：

```
  [1/12] floor ... OK (21 floors, 459 counters)
  [2/12] banners ... OK (11 records)
  ...
  [12/12] tracking ... OK (14 records)
  Import complete
```

> ⚠️ 若出現 `DATABASE_URL not found`，確認 `backend/.env` 已填入正確的 `DATABASE_URL`。

---

## Step 6 — 插入管理員帳號

原始密碼不在程式碼中保存，部署時需重新產生雜湊：

```bash
# 產生密碼雜湊（bcryptjs，注意不是 bcrypt）
node -e "const b=require('/var/www/backend/node_modules/bcryptjs'); b.hash('你的密碼',12,(e,h)=>console.log(h))"
```

把輸出的雜湊（整串包含開頭的 `$2b$12$`）填入下方 SQL：

```bash
docker exec -i chungyo_mysql mysql \
  --default-character-set=utf8mb4 \
  -ucy7191 '-pK!ng.19960827' chungyoOffical << 'SQL'
INSERT INTO users (id, employee_id, password_hash, role_id, is_active, must_change_password) VALUES
(1, 'admin',  '貼上admin的雜湊', 1, 1, 0),
(2, 'cy7191', '貼上cy7191的雜湊', 1, 1, 0)
ON DUPLICATE KEY UPDATE
  password_hash        = VALUES(password_hash),
  role_id              = VALUES(role_id),
  is_active            = VALUES(is_active),
  must_change_password = VALUES(must_change_password);
SQL
```

確認帳號：

```bash
docker exec chungyo_mysql mysql -ucy7191 '-pK!ng.19960827' chungyoOffical \
  -e "SELECT id, employee_id, role_id, is_active FROM users;" 2>/dev/null
```

---

## Step 7 — 啟動後端

### 用 PM2（推薦）

```bash
npm install -g pm2
cd /var/www/backend
pm2 start server.js --name chungyo-api
pm2 save
pm2 startup   # 跟著提示設定開機自啟
```

確認後端正常：

```bash
curl http://localhost:4000/api/catalog
```

### 或直接測試

```bash
cd /var/www/backend
node server.js
```

---

## Step 8 — 前端部署

本機 build 後上傳：

```powershell
cd C:\code\ChungyoOffical\dm-flipbook
npm run build
scp -r dist\* 帳號@IP:/var/www/html/
```

> ⚠️ 上傳完強制重新整理（`Ctrl + Shift + R`）

---

## Step 9 — Apache 設定確認

確認 `/admin` IP 白名單已包含你目前的連線 IP：

```bash
# 查詢目前連線 IP
echo $SSH_CLIENT | awk '{print $1}'
```

```bash
sudo nano /etc/apache2/sites-available/000-default.conf
```

在 `<RequireAny>` 區塊加入：

```apache
Require ip 你的IP
```

存檔後重載：

```bash
sudo apache2ctl configtest && sudo systemctl reload apache2
```

> ⚠️ `/admin` 還有時間限制（09:00–22:00），測試時請注意。

---

## 日後更新 Migration

每次加新的 migration 只需要跑新增的那支：

```bash
docker exec -i chungyo_mysql mysql \
  --default-character-set=utf8mb4 \
  -ucy7191 '-pK!ng.19960827' chungyoOffical \
  < /var/www/database/migrations/015_xxxx.sql
```

## 日後更新前端

```powershell
cd C:\code\ChungyoOffical\dm-flipbook
npm run build
scp -r dist\* 帳號@IP:/var/www/html/
```

不需要重啟 Apache，覆蓋完直接生效。

## 日後更新後端

```bash
# 上傳修改的檔案後重啟
pm2 restart chungyo-api
pm2 logs chungyo-api --lines 20
```

## 重置資料（重新匯入 JSON）

```bash
cd /var/www
node database/import.js
```

> ⚠️ 會清除現有資料，請確認已備份 DB 或只在測試環境執行。

---

## 常見問題

### migration 執行時報 `event not found`
密碼 `K!ng.19960827` 裡的 `!` 被 bash 解析。改用**單引號**包密碼：`'-pK!ng.19960827'`

### `import.js` 報 `DATABASE_URL not found`
`backend/.env` 裡的 `DATABASE_URL` 沒填或是空的，補上後重跑。

### Admin 頁面只看到 header + footer（無內容）
通常是 `/admin` IP 白名單限制，從 403 被導回首頁。確認目前的 IP 在白名單裡。

### Admin 不跳登入頁 / 資料空白
瀏覽器殘留舊的 session cookie。開 F12 → Application → Cookies → 刪除所有 cookie 後重新整理。
