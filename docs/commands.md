# 常用指令手冊

> 所有 PowerShell 指令皆在 `C:\code\ChungyoOffical` 目錄下執行

---

## Docker 容器管理

### 啟動
```powershell
docker compose --env-file "docker\.env" -f "docker\docker-compose.yml" up -d
```

### 停止
```powershell
docker compose --env-file "docker\.env" -f "docker\docker-compose.yml" down
```

### 停止並清除資料（重置資料庫）
```powershell
docker compose --env-file "docker\.env" -f "docker\docker-compose.yml" down -v
```

### 確認容器狀態
```powershell
docker ps
```

### 查看容器 Log
```powershell
docker logs chungyo_mysql
docker logs chungyo_phpmyadmin
```

---

## 資料庫 Migration

### 執行所有 Migration（依序）
```powershell
cd database
.\migrate.ps1
```

### 手動執行單一 SQL 檔案
```powershell
Get-Content "database\migrations\001_auth.sql" -Raw -Encoding UTF8 |
  docker exec -i chungyo_mysql mysql --default-character-set=utf8mb4 -u <USER> -p<PASSWORD> <DATABASE>
```

---

## phpMyAdmin

瀏覽器開啟：
```
http://localhost:8080
```

登入資訊（參考 `docker\.env`）：
- **Server**：`mysql`
- **Username**：`MYSQL_USER` 的值
- **Password**：`MYSQL_PASSWORD` 的值

---

## MySQL 直接操作

### 進入 MySQL Shell
```powershell
docker exec -it chungyo_mysql mysql --default-character-set=utf8mb4 -u <USER> -p
```

### 常用 SQL
```sql
SHOW DATABASES;
USE chungyoOffical;
SHOW TABLES;
```

---

## WSL

### 確認 WSL 版本
```powershell
wsl --version
```

### 更新 WSL Kernel
```powershell
wsl --update
```

---

## Docker 驗證（初次安裝確認用）

```powershell
docker --version
docker compose version
docker run hello-world
```

---

*文件版本：2026-06-26*
