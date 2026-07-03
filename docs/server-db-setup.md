# Server DB Setup SOP

從零開始建立 MySQL → 跑 Migration → 匯入資料 → 啟動後端的完整流程。

---

## 前置條件

- Ubuntu server
- Docker + Docker Compose 已安裝
- Node.js 18+ 已安裝（`node -v` 確認）
- 專案程式碼已上傳（例如在 `/var/www/chungyo/`）

---

## Step 1 — 設定 .env 檔案

### 1-1. Docker 環境變數

```bash
cd /var/www/chungyo/docker
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
cd /var/www/chungyo/backend
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
cd /var/www/chungyo/docker
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
    -ucy7191 "-pK!ng.19960827" chungyoOffical \
    < /var/www/chungyo/database/migrations/$1
  echo "Done: $1"
}
```

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
docker exec chungyo_mysql mysql -ucy7191 "-pK!ng.19960827" chungyoOffical \
  -e "SHOW TABLES;" 2>/dev/null
```

---

## Step 4 — 安裝 Node 套件 & 產生 Prisma Client

```bash
cd /var/www/chungyo/backend
npm install
npx prisma generate
```

---

## Step 5 — 匯入初始資料

```bash
cd /var/www/chungyo
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

---

## Step 6 — 插入管理員帳號

```bash
docker exec -i chungyo_mysql mysql \
  --default-character-set=utf8mb4 \
  -ucy7191 "-pK!ng.19960827" chungyoOffical << 'SQL'
INSERT INTO users (id, employee_id, password_hash, role_id, is_active, must_change_password) VALUES
(1, 'admin',  '$2b$12$IBw9nJk1/rxwj33BGDdarOUEe81cEE/PoMO2QOG5/c7NvSmJ4X872', 1, 1, 0),
(2, 'cy7191', '$2b$12$x.V4Mbw6kuurWv7ONKC3herDXF4iK/6oaMr/Pbuqr2au1e/9Z73ve', 1, 1, 0)
ON DUPLICATE KEY UPDATE
  password_hash        = VALUES(password_hash),
  role_id              = VALUES(role_id),
  is_active            = VALUES(is_active),
  must_change_password = VALUES(must_change_password);
SQL
```

---

## Step 7 — 啟動後端

### 用 PM2（推薦）

```bash
npm install -g pm2
cd /var/www/chungyo/backend
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
cd /var/www/chungyo/backend
node server.js
```

---

## Step 8 — Nginx 反向代理（如有使用 Nginx）

`/etc/nginx/sites-available/chungyo`：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端靜態檔案
    root /var/www/chungyo/html;
    index index.html;

    # API 反向代理到 Node.js
    location /api/ {
        proxy_pass         http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
    }

    # 讓 React Router 正常處理前端路由
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/chungyo /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

---

## 日後更新 Migration

每次加新的 migration 只需要跑新增的那支：

```bash
docker exec -i chungyo_mysql mysql \
  --default-character-set=utf8mb4 \
  -ucy7191 "-pK!ng.19960827" chungyoOffical \
  < /var/www/chungyo/database/migrations/015_xxxx.sql
```

## 重置資料（重新匯入 JSON）

```bash
cd /var/www/chungyo
node database/import.js
```

> ⚠️ 會清除現有資料，請確認已備份 DB 或只在測試環境執行。
