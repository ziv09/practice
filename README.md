# Practice PWA

一個針對功課管理設計的 PWA Web App，提供每日功課紀錄、目標追蹤、視覺化面板、心得記事、提醒與雲端同步能力。前端支援離線使用與 IndexedDB 快取，並預留與 Supabase (PostgreSQL) 的遠端同步管線。

## 主要特色

- 功課管理：自訂名稱、分類、單位、顏色、提醒參與與儀表板顯示。
- 今日紀錄：快速加減、自訂輸入、一鍵套用昨日數據，附目標進度條與建議量。
- 目標追蹤：支援多目標排程、進度落後提醒與建議每日完成量。
- 儀表板：折線圖、占比、連續紀錄等元件可自由新增、排序與移除。
- 修行記事：模板、標籤、置頂與全文搜尋，支援同步排隊與分享。
- 提醒設定：多時段提醒、僅未完成才通知、每週靜音日與推播測試。
- 同步管理：Supabase 使用者 ID 綁定、離線作業佇列、手動觸發同步、狀態與錯誤提示。
- 匯出／匯入：一鍵匯出 JSON 備份並可匯入還原。
- PWA 能力：可加入主畫面、離線瀏覽、Service Worker 自動更新與測試通知。

## 技術棧

- Vite + React 18 + TypeScript
- Zustand 與 Dexie 建立本地資料層（IndexedDB）
- Supabase JS SDK（遠端快照、Edge Function 介接預留）
- Tailwind CSS + React Icons UI 結構
- Day.js（主要在頁面計算日期）、Chart.js / react-chartjs-2 視覺化
- vitest + Testing Library 建立單元測試基礎
- vite-plugin-pwa 產生 Manifest 與 Service Worker

## 環境變數

複製 `.env.example` 為 `.env.local`（或 `.env.development`）：

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

若未填入，App 仍可離線運作，但遠端同步與 Google Sheets 相關功能會保持停用。

## 開發指令

```bash
cd client
npm install
npm run dev       # 啟動開發伺服器
npm run test      # 執行 vitest 單元測試
npm run lint      # 執行 ESLint 檢查
npm run build     # 建置 PWA
npm run preview   # 預覽產線版
```

## 專案結構

```
client/
  ├─ src/
  │   ├─ pages/                # 各主要頁面 (今日、功課、目標、儀表板、記事、提醒、設定)
  │   ├─ store/                # Zustand store（含離線佇列、Supabase 同步）
  │   ├─ services/             # Supabase 同步服務、API 封裝
  │   ├─ lib/                  # Dexie、Supabase client、Chart 設定
  │   ├─ utils/                # 資料計算與共用工具
  │   ├─ hooks/                # 共用自訂 Hook
  │   ├─ layout/components/    # 版面與通用元件
  │   └─ sw.ts                 # 自訂 Service Worker 邏輯
  ├─ public/                   # PWA icons 與靜態資源
  ├─ .env.example              # 參考環境變數
  ├─ vite.config.ts            # Vite + PWA 設定
  └─ tsconfig*.json            # TypeScript 設定
```

## 待辦 / 後續擴充

- Supabase Schema 與 Edge Function (`sync-practice`) 實作
- Google Sheets 匯出排程與分享視圖
- 使用者登入流程（Supabase Auth 或自建）與權限控管
- 推播伺服器排程與提醒落地
- Onboarding Flow、E2E 測試與 PWA 實機驗證

## 注意事項

- PWA 推播需使用者加入主畫面並授權通知，正式排程仍需後端搭配。
- 匯出檔案為 JSON，可在設定頁匯入還原資料。
- 未設定 Supabase 時，啟用同步仍會保留離線佇列但不會真正上傳。
