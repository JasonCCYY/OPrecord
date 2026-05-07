# Ortho Record PWA

骨科手術紀錄管理系統 — Progressive Web App

## 功能
- 📋 手術紀錄（按月分組、類型標記）
- 🏥 醫材管理（醫材記錄、自費醫材、代碼、代碼紀錄、預估）
- 💉 門診管理（自費項目、門診記錄）
- 🔐 Google 帳號登入（私人保護）
- 📱 PWA 可安裝至手機主畫面

## Google Sheets 結構

| 分頁名稱   | 對應功能  | 欄位                          |
|-----------|---------|-------------------------------|
| 手術       | 手術紀錄 | 日期, 院區, 姓名, 類型, 術式, 備註 |
| 骨材記錄   | 醫材記錄 | 日期, 廠牌, 產品, 數量, 單價     |
| 骨材產品   | 自費醫材 | 廠牌, 產品, 單價, 醫院           |
| OP代碼     | 代碼    | 代碼, 術式, 院區, 單價           |
| OP代碼記錄  | 代碼紀錄 | 日期, 術式, 代碼, 單價, 數量, 院區|
| 預估       | 預估    | 月份, 預估, 醫材, 中正           |
| 門診產品   | 門診自費項目| ItemID, 產品, 單價            |
| 門診       | 門診記錄 | 日期, 產品, 數量, 總價           |

## 部署步驟

### 1. Google Cloud Console 設定

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 選擇你的專案（OAuth Client ID 所在的專案）
3. APIs & Services → Credentials → 選擇你的 OAuth 2.0 Client
4. 在 **Authorized JavaScript origins** 加入：
   - `https://你的github名稱.github.io`
5. 在 **Authorized redirect URIs** 加入（若需要）：
   - `https://你的github名稱.github.io`

### 2. GitHub Pages 部署

```bash
# Clone 你的 repo
git clone https://github.com/JasonCCYY/OPrecord.git
cd OPrecord

# 複製所有檔案到此目錄
# 然後 push
git add .
git commit -m "Add PWA app"
git push origin main
```

3. 在 GitHub → Settings → Pages → Source 選擇 `main` branch

4. 等待幾分鐘後訪問：`https://JasonCCYY.github.io/OPrecord/`

### 3. 在 iPhone 安裝 PWA

1. 用 Safari 開啟網址
2. 點擊下方分享按鈕
3. 選擇「加入主畫面」
4. 完成！

## 安全性說明

- 使用 Google OAuth 2.0 登入
- Access Token 儲存在 localStorage（僅限你的裝置）
- Token 有效期約 1 小時，自動過期
- 只有登入者才能讀取 Google Sheet

## 技術棧

- Vanilla HTML/CSS/JS（無框架依賴）
- Google Identity Services (GIS)
- Google Sheets API v4
- Service Worker（離線支援）
- PWA Manifest（可安裝）
