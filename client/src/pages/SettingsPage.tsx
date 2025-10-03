import { useEffect, useRef, useState } from "react";
import { usePracticeStore } from "../store/practiceStore";
import type { SyncSettings } from "../types";
import { supabase } from "../lib/supabaseClient";

function SettingsPage() {
  const settings = usePracticeStore((state) => state.settings);
  const updateSettings = usePracticeStore((state) => state.updateSettings);
  const exportSnapshot = usePracticeStore((state) => state.exportSnapshot);
  const importSnapshot = usePracticeStore((state) => state.importSnapshot);
  const setUser = usePracticeStore((state) => state.setUser);
  const syncStatus = usePracticeStore((state) => state.syncStatus);
  const syncError = usePracticeStore((state) => state.syncError);
  const pendingOperations = usePracticeStore((state) => state.pendingOperations);
  const syncNow = usePracticeStore((state) => state.syncNow);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        setUser(data.session.user.id, { forceReload: true });
        setUserEmail(data.session.user.email ?? null);
      }
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          setUser(session.user.id, { forceReload: true });
          setUserEmail(session.user.email ?? null);
        } else {
          setUser(null);
          setUserEmail(null);
        }
      });
    })();
  }, [setUser]);

  async function handleSyncChange(update: Partial<SyncSettings>) {
    await updateSettings({ sync: { ...settings.sync, ...update } });
    setMessage("同步設定已更新");
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
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleGoogleConnect() {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        scopes: "openid email profile https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets",
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });
  }

  async function handleSignOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setMessage("已登出");
  }

  const pendingCount = pendingOperations.length;

  return (
    <div className="space-y-6">
      {message && (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>
      )}

      <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">帳號</h2>
        <div className="mt-3 flex items-center gap-3 text-sm text-slate-600">
          <span>Google：{userEmail ?? "未連結"}</span>
          <button
            type="button"
            className="rounded-lg border border-primary px-3 py-1 text-sm text-primary"
            onClick={handleGoogleConnect}
          >
            連結 Google
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-3 py-1 text-sm text-slate-600"
            onClick={handleSignOut}
          >
            登出
          </button>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">同步設定（Supabase）</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={settings.sync.enableSync}
              onChange={(event) => handleSyncChange({ enableSync: event.target.checked })}
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
            <label className="block text-xs text-slate-500">分表策略（Google 匯出時使用）</label>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
              value={settings.sync.strategy}
              onChange={(event) => handleSyncChange({ strategy: event.target.value as SyncSettings["strategy"] })}
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
            onClick={() => syncNow()}
            disabled={!settings.sync.enableSync}
          >
            立即同步
          </button>
        </div>
        {syncError && <p className="mt-2 text-sm text-rose-500">同步錯誤：{syncError}</p>}
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">匯出 / 匯入</h2>
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
    </div>
  );
}

export default SettingsPage;
