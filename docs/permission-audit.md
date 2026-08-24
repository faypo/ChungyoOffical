# 權限控制稽核紀錄 — 2026-07-21

> 稽核範圍：後台 admin 角色/權限控制機制（未涉及城市/分店權限——目前系統為單一館別架構，資料庫與程式碼中不存在城市權限機制）。

## 運作機制概述

- 登入時（`backend/routes/admin/auth.js`）將使用者的 `roleId`、`roleName`、`permissions[]` 整包簽入 JWT，存於 httpOnly cookie，效期 2 小時，同時在 `user_sessions` 表建立對應紀錄。
- 每次 admin API 請求由 `backend/middleware/auth.js` 的 `requireAdmin` 驗證：JWT 簽章是否正確、`user_sessions` 是否存在且未過期。**不會重新查詢 `users` 表**（不重查 `is_active`、不重抓最新 `role_id`/權限）。
- 各模組路由的權限檢查集中在 `backend/routes/admin/index.js` 的 `MODULE_PATH_MAP`：依路徑前綴對應到 `module` 名稱，再依 HTTP method 判斷 `action`（GET→read、DELETE→delete、其餘→write），檢查 `module:action` 是否在 JWT 的 permissions 集合中。
- `/roles`、`/users` 兩條路由額外寫死 `roleName !== 'super_admin'` 判斷，不吃 `MODULE_PATH_MAP` 的通用權限表。

## 問題清單（依風險排序）

### 1. 停用帳號不會立即生效（高風險）
`is_active` 只在登入當下檢查一次（`auth.js`），`requireAdmin` middleware 完全不會重新查 `users.is_active`。管理員把某帳號設為停用後，該帳號現有的登入 session 仍可正常操作後台，直到 token 自然過期（最長 2 小時），沒有主動撤銷機制。

### 2. 降級/收回權限有延遲，不會即時撤銷 session（高風險）
在角色管理改某角色的權限，或在帳號管理把某人 `role_id` 降級，都不會清除該使用者現有的 `user_sessions`。對照「重設密碼」功能會做 `user_sessions.deleteMany`，可見 session 撤銷機制沒有統一套用在所有權限變更情境。

### 3. 後台「流量統計」的權限判斷是假的（中風險）
`/admin/stats` 選單有 `stats:read` 權限管控是否顯示，但後端根本沒有掛載 `/api/admin/stats` 路由。前端 `StatsManager.jsx` 實際呼叫的是 `backend/routes/track.js` 掛在 `/api/stats` 的公開端點，完全不需要登入、不需要任何權限。任何人不用登入後台即可直接取得統計數據，前端權限選單無實際保護作用。

### 4. `/users` 模組存在殭屍權限設定（低風險，屬誤導性設定）
`MODULE_PATH_MAP` 把 `/users` 對應到 `user` 模組，理論上可透過角色管理畫面授予自訂角色 `user:read/write/delete`，但 `routes/admin/users.js` 自行寫死 `roleName !== 'super_admin'` 直接 403，完全繞過權限表判斷。若在角色管理介面勾選 `user:*` 權限，實際上永遠不會生效。

### 5. 前端權限判斷純粹是 UI 層（觀察點，非漏洞）
`AuthContext.jsx` 把權限資料存在 `localStorage`，理論上可被竄改讓選單全開，但真正的資料操作都靠後端 JWT 判斷，竄改 localStorage 頂多讓 UI 顯示錯亂，無法真正繞過後端保護。風險在於系統完全沒有第二道防線——未來新增路由若忘記加入 `MODULE_PATH_MAP`，會直接變成無保護的真實漏洞（第 3 點的 `/stats` 即為同類問題實例）。

### 6. `MODULE_PATH_MAP` 靠字串前綴比對，非精確路由白名單
`req.path.startsWith(prefix)`，目前 16 組前綴彼此不重疊，暫無誤配對問題，但屬於較脆弱的設計，未來新增路由需留意前綴是否互相包含。

## 相關檔案

- `backend/prisma/schema.prisma`（`roles` / `permissions` / `role_permissions` / `users` / `user_sessions`，第 369-446 行）
- `backend/middleware/auth.js`（`requireAdmin`）
- `backend/routes/admin/index.js`（`MODULE_PATH_MAP`）
- `backend/routes/admin/auth.js`（登入簽發 JWT / 登出 / 改密碼）
- `backend/routes/admin/roles.js`（角色 CRUD，寫死 `super_admin`）
- `backend/routes/admin/users.js`（帳號 CRUD / 改角色 / 重設密碼）
- `backend/routes/track.js`（公開的 `GET /api/stats`、`/api/stats/summary`）
- `backend/server.js`（路由掛載順序）
- `dm-flipbook/src/context/AuthContext.jsx`（前端權限狀態來自 `localStorage`）
- `dm-flipbook/src/components/admin/AdminLayout.jsx`（導覽選單依 `hasPermission` 過濾）
- `dm-flipbook/src/components/admin/StatsManager.jsx`（實際呼叫公開的 `/api/stats`）

## 建議優先處理順序

1. 第 1、2 項：在 `requireAdmin` 加入輕量 DB 查詢確認 `is_active` 仍為真（可搭配快取降低效能影響），或在停用帳號 / 改角色時主動清除該使用者的 `user_sessions`。
2. 第 3 項：確認 `/api/stats` 是否本來就該公開；若否，需補上驗證或搬到 `/api/admin/stats` 並掛上 `requireAdmin`。
3. 第 4 項：移除 `MODULE_PATH_MAP` 中無實際作用的 `/users` 對應，或讓 `users.js` 改吃權限表判斷，兩者擇一以避免混淆。
