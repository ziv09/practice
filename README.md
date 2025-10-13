# Practice PWA（習慣練習管理）

一個以台灣繁體中文為主的習慣練習管理 PWA Web App。支援「今日記錄、習慣管理、目標追蹤、儀表板分析、每日記錄（Journal）、提醒推播」等功能，採離線優先（IndexedDB）並可與 Supabase 雲端同步與 Google 試算表增量同步。可安裝為桌面/手機 App，並具備推播與自動更新 Service Worker。

## 功能總覽

- 今日練習：快速調整每個習慣的今日數量（+1／-1／自訂），複製昨日進度、刪除單日記錄。
- 習慣管理：新增／編輯／刪除、排序、分類、顏色、是否顯示於儀表板、是否允許提醒。
- 目標追蹤：總量／每日／週末加權三種模式，計算進度、剩餘量與建議每日量，自動偵測是否落後。
- 儀表板：每週趨勢折線圖、Top 任務圓環（PolarArea）、連續天數（Streak），並可篩選期間與直接修改／刪除資料列。
- 每日記錄（Journal）：支援心情、標籤、置頂、全文搜尋；提供模板套用、編輯與刪除。
- 提醒推播：自訂規則（名稱、時間、僅未完成、靜音日），支援 Web Push 測試（本機與伺服器）。
- 設定中心：Email/密碼或 Google OAuth 登入，顯示帳號；連結 Google Drive 資料夾，建立／更新／重新命名／刪除試算表；選擇要匯出的習慣；獨立管理 Journal 試算表。
- 同步與備份：
  - 本機 IndexedDB（Dexie）持久化。
  - Supabase 雲端快照（practice_state_snapshots）＋ Edge Function（sync-practice）雙向同步。
  - Google 試算表增量同步：任務、每日記錄、Journal 皆可逐步更新（sync-sheets、sync-journal）。

## 技術與架構

- 前端：Vite + React 18 + TypeScript、Zustand、Dexie（IndexedDB）、Tailwind CSS、Chart.js/react-chartjs-2、vite-plugin-pwa。
- 後端／雲端：Supabase（Auth、Postgres、Row Level Security、Edge Functions）。
  - Edge Functions：
    - `sync-practice`：處理 pending operations，整併至雲端快照。
    - `export-sheets`／`sync-sheets`：匯出與增量同步「習慣/紀錄」到 Google 試算表。
    - `export-journal`／`sync-journal`：建立 Journal 試算表與增量同步內容。
    - `register-push`／`send-push`：註冊 Web Push 訂閱、伺服器推播。
    - `rename-sheet`／`delete-sheet`：Drive 上檔案更名／刪除。
- PWA：可安裝、快取、推播；`client/src/sw.ts` 處理 push 與通知點擊；`vite-plugin-pwa` 自動產生 manifest 與 Service Worker。
- 資料表（Dexie）：tasks、records、goals、journal、widgets、templates、settings、operations、categories、sheets、sheetOps。
- 測試：Vitest + Testing Library（範例於 `client/src/test`）。

## 專案結構（重點）

```
client/
  src/
    pages/           # Today, Tasks, Goals, Dashboard, Journal, Reminders, Settings, Auth
    store/           # Zustand store（含同步、快照、Dexie 交易）
    services/        # Supabase 與 Google Sheets 同步邏輯
    lib/             # Dexie、Supabase client、Chart 設定
    utils/           # 計算工具（進度、Streak、合計等）
    hooks/           # 初始化、外觀、Auto/Sheet/Journal 同步生命週期
    layout & components/  # 版面與共用元件（側欄、Modal、Toast 等）
    sw.ts            # Service Worker（推播/安裝/啟用）
  public/            # PWA icons
  .env.example       # 前端環境變數樣板
  vite.config.ts     # 含 PWA 設定

supabase/
  functions/         # Edge Functions（Deno）
  sql/schema.sql     # 資料表與 RLS 政策

scripts/
  deploy_all.ps1     # 一鍵部署（Supabase Functions + 前端 + Firebase Hosting）
```

## 環境變數與設定

前端（`client/.env.local`）

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_VAPID_PUBLIC_KEY=
```

Edge Functions 祕密（於 Supabase 設定）

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
```

- 產生 VAPID 金鑰（本機一次即可）：
  - `npx web-push generate-vapid-keys`（或安裝 `web-push` 套件）
  - 公鑰填入 `VITE_VAPID_PUBLIC_KEY` 與 `VAPID_PUBLIC_KEY`，私鑰填入 `VAPID_PRIVATE_KEY`（只在 Edge Function 使用）。
- Google OAuth（登入與 API 使用）：
  - 啟用 Scopes：
    - `openid email profile`
    - `https://www.googleapis.com/auth/drive.file`
    - `https://www.googleapis.com/auth/drive.metadata.readonly`
    - `https://www.googleapis.com/auth/spreadsheets`
  - 重新導向網址（Redirect URI）：
    - 開發：`http://localhost:5173/auth/callback`
    - 正式：`https://你的網域/auth/callback`

## Supabase 初始化

1) 建立專案並取得 `VITE_SUPABASE_URL` 與 `VITE_SUPABASE_ANON_KEY`。
2) 匯入資料表與 RLS：在 Supabase SQL 介面執行 `supabase/sql/schema.sql`。
3) 設定 Edge Functions 祕密：`SUPABASE_URL`、`SUPABASE_ANON_KEY`、`VAPID_PUBLIC_KEY`、`VAPID_PRIVATE_KEY`。
4) 部署 Functions：
   - `export-journal`、`sync-journal`、`rename-sheet`、`delete-sheet`、`export-sheets`、`sync-sheets`、`sync-practice`、`register-push`、`send-push`。
   - 可使用腳本：`scripts/deploy_all.ps1`（會自動 link、set secrets、deploy）。

## 本機開發與建置

```bash
cd client
npm install
npm run dev       # 啟動開發伺服器（http://localhost:5173）
npm run test      # 執行 Vitest 測試
npm run lint      # 執行 ESLint 檢查
npm run build     # 產生 PWA 與靜態資源
npm run preview   # 本機預覽產出
```

需求：Node.js 18+、npm。若未設定 Supabase 變數，仍可離線使用（快照/同步/推播/Sheets 相關功能會停用）。

## Firebase Hosting（選用）

- 調整 `firebase.json` 與 `.firebaserc` 中的專案名稱（或使用預設）。
- 登入與部署：

```bash
firebase login
cd client && npm run build && cd ..
firebase deploy --only hosting --project <your-project>
```

或直接使用 `scripts/deploy_all.ps1 -SupabaseRef <ref> -FirebaseProject <project>` 一鍵部署。

## 使用指引（快速上手）

1) 登入：至登入頁以 Email/密碼或 Google 登入；設定頁會顯示目前帳號。
2) 新增習慣：到「習慣」頁新增，設定分類/顏色/是否提醒/是否顯示於儀表板。
3) 今日記錄：到「今日」頁按 +/− 或自訂數量，必要時可複製昨日進度。
4) 目標與分析：建立目標（可選模式與目標量），到「儀表板」觀察趨勢、Top 與 Streak。
5) 提醒推播：在「提醒」頁新增規則並允許通知；可做本機與伺服器推播測試。
6) Sheets 匯出：在「設定」頁連結 Google，選擇資料夾與要匯出的習慣，建立/更新試算表；Journal 亦可獨立管理。

## 注意事項

- PWA 推播：Android/桌機 Chrome 可直接收到；iOS 需使用 Safari 並「加入主畫面」（iOS 16.4+ 支援 Web Push）。
- 離線優先：未登入或離線時資料保存在本機 IndexedDB；登入後背景自動同步至 Supabase，並定期嘗試增量同步至 Google 試算表。
- 亂碼問題：若看到中文亂碼，請確保檔案編碼為 UTF-8。

## 授權

本專案未特別標示授權條款；如需用途或授權調整，請於 Issue 討論。

