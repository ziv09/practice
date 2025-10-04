import { useEffect, useState } from "react";
import { usePracticeStore } from "../store/practiceStore";
import type { SyncSettings } from "../types";
import { supabase } from "../lib/supabaseClient";

function SettingsPage() {
  const settings = usePracticeStore((state) => state.settings);
  const updateSettings = usePracticeStore((state) => state.updateSettings);
  const setUser = usePracticeStore((state) => state.setUser);
  const syncStatus = usePracticeStore((state) => state.syncStatus);
  const syncError = usePracticeStore((state) => state.syncError);
  const pendingOperations = usePracticeStore((state) => state.pendingOperations);
  const syncNow = usePracticeStore((state) => state.syncNow);

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
      supabase.auth.onAuthStateChange(async (_event, session) => {
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
    setMessage("已更新同步設定");
  }

  async function handleGoogleConnect() {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        scopes:
          "openid email profile https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets",
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
      {message && <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}

      <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">帳號</h2>
        <div className="mt-3 flex items-center gap-3 text-sm text-slate-600">
          <span>Google：{userEmail ?? "未登入"}</span>
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
        <h2 className="text-lg font-semibold">外觀設定</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-xs text-slate-500">主題</label>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
              value={settings.appearance.theme}
              onChange={(e) => updateSettings({ appearance: { ...settings.appearance, theme: e.target.value as any } })}
            >
              <option value="auto">自動</option>
              <option value="light">淺色</option>
              <option value="dark">深色</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500">重點色</label>
            <input
              type="color"
              className="h-10 w-full cursor-pointer rounded-lg border border-slate-200"
              value={settings.appearance.accentColor}
              onChange={(e) => updateSettings({ appearance: { ...settings.appearance, accentColor: e.target.value } })}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500">字級</label>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
              value={settings.appearance.fontScale}
              onChange={(e) => updateSettings({ appearance: { ...settings.appearance, fontScale: Number(e.target.value) as any } })}
            >
              <option value={0.875}>小</option>
              <option value={1}>一般</option>
              <option value={1.125}>大</option>
              <option value={1.25}>特大</option>
            </select>
          </div>
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
            <label className="block text-xs text-slate-500">匯出策略（Google 試算表）</label>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
              value={settings.sync.strategy}
              onChange={(event) => handleSyncChange({ strategy: event.target.value as SyncSettings["strategy"] })}
            >
              <option value="single-sheet">單張</option>
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
          <span>
            狀態：{syncStatus === "idle" ? "待機" : syncStatus === "syncing" ? "同步中" : syncStatus === "error" ? "錯誤" : "離線"}
          </span>
          {pendingCount > 0 && <span>待送作業：{pendingCount}</span>}
          {settings.sync.lastSyncedAt && <span>上次同步：{settings.sync.lastSyncedAt}</span>}
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
    </div>
  );
}

export default SettingsPage;
