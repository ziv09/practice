function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 py-10">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">隱私權政策</h1>
        <p className="mt-2 text-sm text-slate-500">最後更新：2025-01-01</p>
      </header>

      <section className="space-y-3 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">一、簡介</h2>
        <p className="text-slate-700">
          Practice（以下稱「本服務」）是一個習慣練習管理的 PWA 應用程式，提供今日記錄、習慣管理、目標追蹤、儀表板分析、日誌、提醒推播與 Google 試算表匯出／同步等功能。我們重視您的個人資料與隱私，並依本政策說明資料的蒐集、使用、保存與保護方式。
        </p>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">二、我們蒐集與處理之資料類型</h2>
        <ul className="list-disc space-y-2 pl-6 text-slate-700">
          <li>
            帳號與驗證資料：若您使用 Email/密碼或 Google 登入，我們會透過 Supabase Auth 處理登入驗證相關資訊（如 Email、使用者識別碼）。
          </li>
          <li>
            使用內容資料：您於本服務新增的習慣、每日記錄、目標、日誌與看板設定等，將以離線優先方式儲存在您裝置的 IndexedDB，並在登入後以快照形式同步至 Supabase 資料庫。
          </li>
          <li>
            推播訂閱資料：當您啟用 Web Push 時，會保存推播訂閱資訊（endpoint、公鑰等）以提供提醒功能。
          </li>
          <li>
            Google API 資料：在您同意授權後，本服務會使用 Google Drive / Sheets API 建立、更新或刪除您的試算表檔案與內容；僅於相關功能被操作時使用。
          </li>
        </ul>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">三、資料使用目的</h2>
        <ul className="list-disc space-y-2 pl-6 text-slate-700">
          <li>提供並維護本服務之核心功能（記錄、同步、匯出、提醒）。</li>
          <li>改善使用體驗與可靠度（例如離線優先、背景同步與重試機制）。</li>
          <li>在您授權下，與 Google 試算表進行匯出或增量同步。</li>
        </ul>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">四、第三方服務</h2>
        <ul className="list-disc space-y-2 pl-6 text-slate-700">
          <li>Supabase：提供使用者驗證、資料庫與 Edge Functions（同步、推播註冊等）。</li>
          <li>Google APIs：Drive / Sheets 用於建立、更新與刪除試算表；授權由您主動同意並可隨時撤回。</li>
          <li>Firebase Hosting：用於前端靜態網站託管與 PWA 發佈。</li>
        </ul>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">五、Cookie 與本機儲存</h2>
        <p className="text-slate-700">
          本服務會使用瀏覽器本機儲存（IndexedDB、LocalStorage）以提供離線使用與狀態保存；並可能使用必要 Cookie 以維持登入狀態。本服務不使用第三方廣告 Cookie。
        </p>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">六、資料保存與刪除</h2>
        <ul className="list-disc space-y-2 pl-6 text-slate-700">
          <li>本機資料：儲存在您的裝置 IndexedDB，可由您清除瀏覽資料或重設應用程式刪除。</li>
          <li>雲端快照：登入後會以快照方式保存於 Supabase（僅與您的帳號綁定）。您可透過刪除帳號或聯絡我們請求刪除。</li>
          <li>Google 試算表：您可於設定頁刪除連結並同步刪除雲端檔案；刪除試算表不會影響您在本服務內的核心資料。</li>
        </ul>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">七、您的權利</h2>
        <p className="text-slate-700">
          您可隨時查詢、更正或刪除您的資料；若欲撤回 Google 授權，可至 Google 帳戶安全性頁面管理第三方存取。若需協助，請與我們聯絡。
        </p>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">八、國際傳輸與資訊安全</h2>
        <p className="text-slate-700">
          服務使用之雲端基礎設施可能位於不同地區。我們採取合理的技術與組織措施保護資料，但網路傳輸無法保證絕對安全。
        </p>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">九、未成年人保護</h2>
        <p className="text-slate-700">
          若您為未成年人，請在法定代理人（監護人）同意與指導下使用本服務。
        </p>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">十、政策變更</h2>
        <p className="text-slate-700">
          我們可能因功能或法規調整更新本政策，將於本頁公布最新版本與生效日期。
        </p>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">聯絡方式</h2>
        <p className="text-slate-700">
          若您對本政策有任何疑問或請求，請聯絡我們：
          <br />
          Email：請提供您的聯絡 Email（可告知我們代為更新）
        </p>
      </section>
    </div>
  );
}

export default PrivacyPolicyPage;

