# Docker Desktop 安裝 SOP（Windows 11）

> 適用系統：Windows 11 Pro / Enterprise x64  
> 安裝目標：Docker Desktop（含 WSL 2 後端）  
> 預計時間：15–20 分鐘（含重開機）

---

## 前置確認

安裝前請先確認以下兩點：

**1. 確認 CPU 虛擬化已開啟**

開啟工作管理員（`Ctrl + Shift + Esc`）→ 效能 → CPU，查看右下角「虛擬化」是否顯示「已啟用」。

- 已啟用 → 繼續下一步
- 已停用 → 需進入 BIOS 開啟 Virtualization Technology（VT-x），請洽 IT

**2. 確認 Windows 版本**

按 `Win + R` 輸入 `winver`，確認版本為 Windows 11（Build 22000 以上）。

---

## 第一階段：安裝 WSL 2

### 步驟 1 — 以系統管理員身份開啟 PowerShell

在開始功能表搜尋「PowerShell」→ 右鍵 → **以系統管理員身份執行**。

### 步驟 2 — 安裝 WSL

在 PowerShell 中輸入：

```powershell
wsl --install
```

等待安裝完成，畫面會顯示安裝進度。安裝完成後出現提示：

```
The requested operation is successful. Changes will not be effective until the system is rebooted.
```

### 步驟 3 — 重新開機

```powershell
Restart-Computer
```

或手動點選開始功能表 → 電源 → 重新啟動。

### 步驟 4 — 完成 WSL 初始設定

重開機後會自動開啟一個終端視窗，等待 Ubuntu 安裝完成（約 2–3 分鐘）。

完成後會提示建立 Linux 使用者：

```
Enter new UNIX username: （輸入任意英文帳號，例如：admin）
New password: （輸入密碼，輸入時畫面不會顯示字元）
Retype new password: （再次輸入確認）
```

設定完成後終端顯示 `$` 提示符，代表 WSL 2 安裝成功。**關閉該視窗即可。**

### 步驟 5 — 確認 WSL 版本

重新開啟 PowerShell（不需要系統管理員），輸入：

```powershell
wsl --version
```

確認輸出中 `WSL 版本` 為 2.x 以上即可。

---

## 第二階段：安裝 Docker Desktop

### 步驟 6 — 下載安裝程式

開啟瀏覽器，前往 Docker 官網下載頁面：

```
https://www.docker.com/products/docker-desktop/
```

點選「Download for Windows — AMD64」下載 `Docker Desktop Installer.exe`（約 600 MB）。

### 步驟 7 — 執行安裝程式

1. 雙擊 `Docker Desktop Installer.exe`
2. 安裝選項保持預設（確認勾選「Use WSL 2 instead of Hyper-V」）
3. 點選「Ok」開始安裝，等待約 3–5 分鐘
4. 安裝完成後點選「Close and restart」重新開機

### 步驟 8 — 啟動 Docker Desktop

重開機後 Docker Desktop 會自動啟動（工作列右下角出現鯨魚圖示）。

首次啟動會出現服務條款，點選「Accept」接受。

等待 Docker Desktop 初始化完成，狀態列顯示 **「Engine running」** 即完成。

---

## 第三階段：驗證安裝

### 步驟 9 — 確認 Docker 版本

開啟 PowerShell，輸入：

```powershell
docker --version
docker compose version
```

預期輸出（版本號可能不同）：

```
Docker version 27.x.x, build xxxxxxx
Docker Compose version v2.x.x
```

### 步驟 10 — 執行測試容器

```powershell
docker run hello-world
```

看到以下訊息代表安裝完全成功：

```
Hello from Docker!
This message shows that your installation appears to be working correctly.
```

---

## 常見問題

**Q：安裝後 Docker Desktop 顯示「WSL kernel version too low」**

開啟 PowerShell 執行：
```powershell
wsl --update
```
然後重新啟動 Docker Desktop。

**Q：WSL --install 顯示「已安裝功能」但 docker 仍無法使用**

確認 Docker Desktop 已啟動（工作列右下角有鯨魚圖示），若無則從開始功能表手動啟動。

**Q：公司電腦安裝時出現權限不足**

請聯繫 IT 以系統管理員帳號協助執行 `wsl --install` 步驟，Docker Desktop 安裝不需要系統管理員。

---

## 安裝完成後的下一步

安裝完成後，回到專案目錄執行：

```powershell
docker compose up -d
```

即可啟動本機開發資料庫（MySQL 8.0 + phpMyAdmin）。

---

*文件版本：2026-06-25*
