import { useEffect, useState } from "react";
import { usePracticeStore } from "../store/practiceStore";
import type { SyncSettings } from "../types";
import { supabase } from "../lib/supabaseClient";
import Modal from "../components/Modal";
import { deleteUserSheet, exportOrUpdateSheet, fetchUserSheets, getGoogleAccessToken, listDriveFolders, upsertUserSheet } from "../services/sheetSync";

function SettingsPage() {
  const settings = usePracticeStore((s) => s.settings);
  const updateSettings = usePracticeStore((s) => s.updateSettings);
  const exportSnapshot = usePracticeStore((s) => s.exportSnapshot);
  const setUser = usePracticeStore((s) => s.setUser);
  const syncStatus = usePracticeStore((s) => s.syncStatus);
  const syncError = usePracticeStore((s) => s.syncError);
  const pendingOperations = usePracticeStore((s) => s.pendingOperations);
  const syncNow = usePracticeStore((s) => s.syncNow);

  const [message, setMessage] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const tasks = usePracticeStore((s) => s.tasks);
  const [sheets, setSheets] = useState<any[]>([]);
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [newSheetTitle, setNewSheetTitle] = useState("Practice-{date}");
  const [newSheetFolder, setNewSheetFolder] = useState<{ id: string; name: string } | null>(null);
  const [newSheetTaskIds, setNewSheetTaskIds] = useState<string[]>([]);
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [folderListing, setFolderListing] = useState<Array<{ id: string; name: string; parents?: string[] }>>([]);

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
      await loadSheets();
    })();
  }, [setUser]);

  async function loadSheets() {
    try {
      setLoadingSheets(true);
      const list = await fetchUserSheets();
      setSheets(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSheets(false);
    }
  }

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
          "openid email profile https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/spreadsheets",
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });
  }

  async function handleSignOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setMessage("已登出");
  }

  // const pendingCount = pendingOperations.length;

  async function openFolderPicker() {
    try {
      const token = await getGoogleAccessToken();
      if (!token) {
        setMessage("請先以 Google 登入");
        return;
      }
      const files = await listDriveFolders(token, "root");
      setFolderListing(files);
      setFolderModalOpen(true);
    } catch (e) {
      console.error(e);
      setMessage("無法載入雲端硬碟資料夾");
    }
  }

  async function handleCreateOrUpdateSheet() {
    try {
      const token = await getGoogleAccessToken();
      if (!token) {
        setMessage("請先以 Google 登入");
        return;
      }
      const selectedTasks = newSheetTaskIds;
      if (selectedTasks.length === 0) {
        setMessage("請至少選擇一個功課");
        return;
      }
      const resp = await exportOrUpdateSheet({ accessToken: token, folderId: newSheetFolder?.id, title: newSheetTitle, taskIds: selectedTasks });
      const spreadsheetId = resp.spreadsheetId;
      await upsertUserSheet({ title: newSheetTitle, spreadsheetId, folderId: newSheetFolder?.id, taskIds: selectedTasks });
      await loadSheets();
      setMessage("已建立或更新試算表");
    } catch (e) {
      console.error(e);
      setMessage("建立或更新試算表失敗");
    }
  }

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
        <h2 className="text-lg font-semibold">Google 試算表匯出</h2>
        <p className="text-sm text-slate-500">下列選項僅影響匯出到 Google Sheets 的格式與命名，不影響雲端快照同步。</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-slate-500">匯出範圍</label>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
              value={settings.sync.range}
              onChange={(event) => handleSyncChange({ range: event.target.value as SyncSettings["range"] })}
            >
              <option value="30d">近 30 天</option>
              <option value="90d">近 90 天</option>
              <option value="365d">近一年</option>
              <option value="all">全部</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500">匯出策略</label>
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
          <div className="sm:col-span-2">
            <label className="block text-xs text-slate-500">命名模板</label>
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
              value={settings.sync.template}
              onChange={(event) => handleSyncChange({ template: event.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="button"
              className="rounded-lg border border-primary px-3 py-2 text-sm font-semibold text-primary"
            onClick={async () => {
                try {
                  if (!supabase) {
                    setMessage("尚未設定 Supabase，請先完成環境變數");
                    return;
                  }
                  const { data } = await supabase.auth.getSession();
                  const accessToken = data.session?.provider_token;
                  if (!accessToken) {
                    setMessage("請先以 Google 登入");
                    return;
                  }
                  const snapshot = await exportSnapshot();
                  const { data: resp, error } = await supabase.functions.invoke("export-sheets", {
                    body: { accessToken, strategy: settings.sync.strategy, template: settings.sync.template, snapshot }
                  });
                  if (error) throw error;
                  setMessage(resp?.message ?? "已送出匯出請求");
                } catch (e) {
                  console.error(e);
                  setMessage("匯出失敗，請稍後重試");
                }
              }}
            >
              立即匯出
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">Sheet 管理</h2>
        <p className="text-sm text-slate-500">建立或維護欲自動同步的試算表。每月自動分頁，日期橫列、功課直欄。</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-xs text-slate-500">表單名稱模板</label>
            <input className="w-full rounded-lg border border-slate-200 px-3 py-2" value={newSheetTitle} onChange={(e) => setNewSheetTitle(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-slate-500">存放資料夾</label>
            <div className="flex items-center gap-2">
              <input className="w-full rounded-lg border border-slate-200 px-3 py-2" readOnly value={newSheetFolder?.name ?? "（未選擇）"} />
              <button type="button" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" onClick={openFolderPicker}>選擇</button>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500">欲同步的功課</label>
            <div className="max-h-48 overflow-auto rounded-lg border border-slate-200 p-2">
              {tasks.length === 0 && <p className="text-sm text-slate-500">尚無功課，請先新增。</p>}
              {tasks.map((t) => (
                <label key={`sel-${t.id}`} className="mb-1 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={newSheetTaskIds.includes(t.id)}
                    onChange={(e) => {
                      setNewSheetTaskIds((prev) => (e.target.checked ? [...prev, t.id] : prev.filter((x) => x !== t.id)));
                    }}
                  />
                  {t.name}
                </label>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button type="button" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white" onClick={handleCreateOrUpdateSheet}>
              建立／更新試算表
            </button>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">已管理的試算表</h3>
          {loadingSheets ? (
            <p className="text-sm text-slate-500">載入中...</p>
          ) : sheets.length === 0 ? (
            <p className="text-sm text-slate-500">尚未建立。</p>
          ) : (
            <ul className="divide-y">
              {sheets.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{s.title}</p>
                    <p className="text-xs text-slate-500">{s.spreadsheetId}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-rose-200 px-3 py-1 text-rose-600"
                      onClick={async () => {
                        await deleteUserSheet(s.id);
                        await loadSheets();
                      }}
                    >
                      刪除
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <Modal open={folderModalOpen} onClose={() => setFolderModalOpen(false)} title="選擇資料夾" widthClass="max-w-lg">
        <div className="max-h-80 space-y-2 overflow-auto">
          {folderListing.map((f) => (
            <button
              key={f.id}
              type="button"
              className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left text-sm"
              onClick={() => {
                setNewSheetFolder({ id: f.id, name: f.name });
                setFolderModalOpen(false);
              }}
            >
              <span>{f.name}</span>
              <span className="text-xs text-slate-400">{f.id}</span>
            </button>
          ))}
          {folderListing.length === 0 && <p className="text-sm text-slate-500">沒有可用的資料夾或無權限。</p>}
        </div>
      </Modal>
    </div>
  );
}

export default SettingsPage;
