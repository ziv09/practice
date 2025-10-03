import { useEffect, useRef, useState } from "react";
import { usePracticeStore } from "../store/practiceStore";
import type { AppearanceSettings, SyncSettings } from "../types";

function SettingsPage() {
  const settings = usePracticeStore((state) => state.settings);
  const updateSettings = usePracticeStore((state) => state.updateSettings);
  const exportSnapshot = usePracticeStore((state) => state.exportSnapshot);
  const importSnapshot = usePracticeStore((state) => state.importSnapshot);
  const userId = usePracticeStore((state) => state.userId);
  const setUser = usePracticeStore((state) => state.setUser);
  const syncStatus = usePracticeStore((state) => state.syncStatus);
  const syncError = usePracticeStore((state) => state.syncError);
  const pendingOperations = usePracticeStore((state) => state.pendingOperations);
  const syncNow = usePracticeStore((state) => state.syncNow);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [userIdInput, setUserIdInput] = useState(userId ?? "");
  const [linking, setLinking] = useState(false);
  const pendingCount = pendingOperations.length;

  useEffect(() => {
    setUserIdInput(userId ?? "");
  }, [userId]);

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

  async function handleLinkUser() {
    const trimmed = userIdInput.trim();
    if (!trimmed) {
      setMessage("請輸入使用者 ID");
      return;
    }
    try {
      setLinking(true);
      await setUser(trimmed, { forceReload: true });
      setMessage("已更新使用者 ID");
      if (!settings.sync.enableSync) {
        await handleSyncChange({ enableSync: true });
      }
    } catch (error) {
      console.error(error);
      setMessage("設定使用者 ID 失敗");
    } finally {
      setLinking(false);
    }
  }

  async function handleSyncToggle(checked: boolean) {
    if (checked && !userIdInput.trim()) {
      setMessage("請先設定使用者 ID 再啟用同步");
      return;
    }
    await handleSyncChange({ enableSync: checked });
    if (checked && userIdInput.trim()) {
      await syncNow();
    }
  }

  async function handleManualSync() {
    await syncNow();
    setMessage("已觸發同步");
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
        <h2 className="text-lg font-semibold">同步設定（Supabase）</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-xs text-slate-500">使用者 ID</label>
            <div className="mt-1 flex gap-2">
              <input
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2"
                value={userIdInput}
                onChange={(event) => setUserIdInput(event.target.value)}
                placeholder="輸入 Supabase 使用者 UUID"
              />
              <button
                type="button"
                className="rounded-lg border border-primary px-3 py-2 text-sm font-semibold text-primary disabled:opacity-60"
                onClick={handleLinkUser}
                disabled={linking}
              >
                {linking ? "連結中..." : "儲存"}
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">此 ID 用於辨識雲端帳號，需與 Supabase Auth 一致。</p>
          </div>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={settings.sync.enableSync}
              onChange={(event) => handleSyncToggle(event.target.checked)}
            />
            啟用雲端同步
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
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-600">
          <span>狀態：{syncStatus === "idle" ? "待命" : syncStatus === "syncing" ? "同步中" : syncStatus === "error" ? "錯誤" : "離線"}</span>
          {pendingCount > 0 && <span>待送作業：{pendingCount}</span>}
          {settings.sync.lastSyncedAt && <span>最後同步：{settings.sync.lastSyncedAt}</span>}
          <button
            type="button"
            className="rounded-lg border border-primary px-3 py-1 text-sm text-primary disabled:opacity-60"
            onClick={handleManualSync}
            disabled={!settings.sync.enableSync}
          >
            立即同步
          </button>
        </div>
        {syncError && <p className="mt-2 text-sm text-rose-500">同步錯誤：{syncError}</p>}
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
