import { useRef, useState } from "react";
import { usePracticeStore } from "../store/practiceStore";
import type { AppearanceSettings, SyncSettings } from "../types";

function SettingsPage() {
  const settings = usePracticeStore((state) => state.settings);
  const updateSettings = usePracticeStore((state) => state.updateSettings);
  const exportSnapshot = usePracticeStore((state) => state.exportSnapshot);
  const importSnapshot = usePracticeStore((state) => state.importSnapshot);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleAppearanceChange(update: Partial<AppearanceSettings>) {
    await updateSettings({ appearance: { ...settings.appearance, ...update } });
    setMessage("外觀設定已更新");
  }

  async function handleSyncChange(update: Partial<SyncSettings>) {
    await updateSettings({ sync: { ...settings.sync, ...update } });
    setMessage("同步設定已更新");
  }

  async function handleToggleOnboarding() {
    await updateSettings({ onboardingCompleted: !settings.onboardingCompleted });
  }

  async function handleExport() {
    try {
      setExporting(true);
      const snapshot = await exportSnapshot();
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `practice-backup-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage("匯出完成");
    } catch (error) {
      console.error(error);
      setMessage("匯出失敗，請稍後再試");
    } finally {
      setExporting(false);
    }
  }

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      await importSnapshot(json);
      setMessage("匯入成功");
    } catch (error) {
      console.error(error);
      setMessage("匯入失敗，檔案格式不正確");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>
      )}

      <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">外觀設定</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-slate-500">主題</label>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
              value={settings.appearance.theme}
              onChange={(event) => handleAppearanceChange({ theme: event.target.value as AppearanceSettings["theme"] })}
            >
              <option value="auto">跟隨系統</option>
              <option value="light">淺色</option>
              <option value="dark">深色</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500">字體大小</label>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
              value={settings.appearance.fontScale}
              onChange={(event) =>
                handleAppearanceChange({ fontScale: Number(event.target.value) as AppearanceSettings["fontScale"] })
              }
            >
              <option value={0.875}>小</option>
              <option value={1}>一般</option>
              <option value={1.125}>大</option>
              <option value={1.25}>更大</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500">卡片樣式</label>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
              value={settings.appearance.cardStyle}
              onChange={(event) =>
                handleAppearanceChange({ cardStyle: event.target.value as AppearanceSettings["cardStyle"] })
              }
            >
              <option value="comfortable">舒適</option>
              <option value="compact">緊湊</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500">重點色</label>
            <input
              type="color"
              className="h-10 w-full cursor-pointer rounded-lg border border-slate-200"
              value={settings.appearance.accentColor}
              onChange={(event) => handleAppearanceChange({ accentColor: event.target.value })}
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">匯出 / 匯入</h2>
        <p className="text-sm text-slate-500">將所有功課、紀錄、目標、記事與設定打包備份。</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? "匯出中..." : "匯出 JSON"}
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600"
            onClick={() => fileInputRef.current?.click()}
          >
            匯入 JSON
          </button>
          <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleImport} />
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">同步設定（Google 功能預留）</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={settings.sync.enableSync}
              onChange={(event) => handleSyncChange({ enableSync: event.target.checked })}
            />
            啟用雲端同步（開發中）
          </label>
          <div>
            <label className="block text-xs text-slate-500">同步範圍</label>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
              value={settings.sync.range}
              onChange={(event) => handleSyncChange({ range: event.target.value as SyncSettings["range"] })}
              disabled={!settings.sync.enableSync}
            >
              <option value="30d">近 30 天</option>
              <option value="90d">近 90 天</option>
              <option value="365d">近一年</option>
              <option value="all">全部</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500">分表策略</label>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
              value={settings.sync.strategy}
              onChange={(event) => handleSyncChange({ strategy: event.target.value as SyncSettings["strategy"] })}
              disabled={!settings.sync.enableSync}
            >
              <option value="single-sheet">同一張</option>
              <option value="weekly">每週</option>
              <option value="monthly">每月</option>
              <option value="yearly">每年</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500">命名模板</label>
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
              value={settings.sync.template}
              onChange={(event) => handleSyncChange({ template: event.target.value })}
              disabled={!settings.sync.enableSync}
            />
          </div>
        </div>
        {settings.sync.lastError && <p className="mt-2 text-sm text-rose-500">上次錯誤：{settings.sync.lastError}</p>}
        {settings.sync.lastSyncedAt && <p className="mt-1 text-xs text-slate-400">最後同步：{settings.sync.lastSyncedAt}</p>}
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">系統其他</h2>
        <div className="mt-4 space-y-3 text-sm text-slate-600">
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-4 py-2"
            onClick={handleToggleOnboarding}
          >
            {settings.onboardingCompleted ? "重新啟動新手教學" : "標記新手教學為完成"}
          </button>
        </div>
      </section>
    </div>
  );
}

export default SettingsPage;
