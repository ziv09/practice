function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 py-10">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">服務條款</h1>
        <p className="mt-2 text-sm text-slate-500">最後更新：2025-01-01</p>
      </header>

      <section className="space-y-3 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">一、接受條款</h2>
        <p className="text-slate-700">
          使用 Practice（以下稱「本服務」）即表示您同意遵守本條款與相關政策（包含隱私權政策）。若您不同意，請停止使用本服務。
        </p>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">二、服務內容</h2>
        <p className="text-slate-700">
          本服務提供習慣練習管理、今日記錄、目標追蹤、儀表板分析、日誌、提醒推播，以及與 Google 試算表的匯出／同步等功能。功能可能持續更新或調整。
        </p>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">三、帳號與安全</h2>
        <ul className="list-disc space-y-2 pl-6 text-slate-700">
          <li>您應妥善保管登入憑證，不得轉讓、出租或與第三人共用。</li>
          <li>若發現未經授權之使用，請立即通知我們，以協助處理。</li>
        </ul>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">四、使用規範</h2>
        <ul className="list-disc space-y-2 pl-6 text-slate-700">
          <li>不得以任何方式干擾、破壞或迴避本服務之安全機制。</li>
          <li>不得進行違反法令、侵權或有害之行為。</li>
          <li>使用 Google APIs 時，應遵循 Google 服務條款與授權範圍。</li>
        </ul>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">五、資料與內容</h2>
        <ul className="list-disc space-y-2 pl-6 text-slate-700">
          <li>您保有於本服務所新增資料之權利；本服務僅於提供功能之必要範圍內處理與同步。</li>
          <li>刪除「試算表連結」與雲端檔案不會刪除您在本服務中的核心資料。</li>
        </ul>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">六、免責聲明</h2>
        <p className="text-slate-700">
          本服務依「現況」提供，不保證無錯誤或不間斷。因系統、網路、第三方服務（如 Supabase、Google APIs、Firebase）之故障或限制而導致之損害，本服務不負賠償責任。
        </p>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">七、終止與變更</h2>
        <p className="text-slate-700">
          若您違反本條款，本服務得暫停或終止您之使用權。服務與條款得於必要時修訂或終止，將以本頁公告為準。
        </p>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">八、準據法與管轄</h2>
        <p className="text-slate-700">
          本條款以中華民國（臺灣）法律為準據法，因本服務所生之爭議，以臺灣臺北地方法院為第一審管轄法院。
        </p>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">聯絡方式</h2>
        <p className="text-slate-700">
          若您對本條款有任何疑問，請聯絡我們：
          <br />
          Email：請提供您的聯絡 Email（可告知我們代為更新）
        </p>
      </section>
    </div>
  );
}

export default TermsPage;

