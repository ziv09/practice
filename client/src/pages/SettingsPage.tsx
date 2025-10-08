import { useEffect, useState } from "react";
import { usePracticeStore } from "../store/practiceStore";
import { supabase } from "../lib/supabaseClient";
import Modal from "../components/Modal";
import {
  deleteUserSheet,
  exportOrUpdateSheet,
  fetchUserSheets,
  getGoogleAccessToken,
  listDriveFolders,
  upsertUserSheet,
  fetchUserJournalSheets,
  upsertUserJournalSheet,
  deleteUserJournalSheet,
  exportOrUpdateJournal,
  renameRemoteSheet,
  updateUserJournalSheetTitle,
  updateUserSheetTitle,
  deleteRemoteSheet
} from "../services/sheetSync";

function SettingsPage() {
  const setUser = usePracticeStore((s) => s.setUser);
  const tasks = usePracticeStore((s) => s.tasks);
  const exportSnapshot = usePracticeStore((s) => s.exportSnapshot);

  const [message, setMessage] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [sheets, setSheets] = useState<any[]>([]);
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [newSheetTitle, setNewSheetTitle] = useState("Practice-{date}");
  const [newSheetFolder, setNewSheetFolder] = useState<{ id: string; name: string } | null>(null);
  const [newSheetTaskIds, setNewSheetTaskIds] = useState<string[]>([]);

  const [journalSheets, setJournalSheets] = useState<any[]>([]);
  const [loadingJournalSheets, setLoadingJournalSheets] = useState(false);
  const [newJournalTitle, setNewJournalTitle] = useState("Journal-{date}");
  const [newJournalFolder, setNewJournalFolder] = useState<{ id: string; name: string } | null>(null);

  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [folderListing, setFolderListing] = useState<Array<{ id: string; name: string; parents?: string[] }>>([]);
  const [folderPickTarget, setFolderPickTarget] = useState<"sheet" | "journal">("sheet");

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
      await loadJournalSheets();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function loadJournalSheets() {
    try {
      setLoadingJournalSheets(true);
      const list = await fetchUserJournalSheets();
      setJournalSheets(list as any);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingJournalSheets(false);
    }
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

  async function openFolderPicker() {
    try {
      const token = await getGoogleAccessToken();
      if (!token) {
        setMessage("請先登入 Google");
        return;
      }
      const files = await listDriveFolders(token, "root");
      setFolderListing(files);
      setFolderPickTarget("sheet");
      setFolderModalOpen(true);
    } catch (e) {
      console.error(e);
      setMessage("載入雲端資料夾失敗");
    }
  }

  async function openJournalFolderPicker() {
    try {
      const token = await getGoogleAccessToken();
      if (!token) {
        setMessage("請先登入 Google");
        return;
      }
      const files = await listDriveFolders(token, "root");
      setFolderListing(files);
      setFolderPickTarget("journal");
      setFolderModalOpen(true);
    } catch (e) {
      console.error(e);
      setMessage("載入雲端資料夾失敗");
    }
  }

  async function handleCreateOrUpdateSheet() {
    try {
      const token = await getGoogleAccessToken();
      if (!token) {
        setMessage("請先登入 Google");
        return;
      }
      const selected = newSheetTaskIds;
      if (selected.length === 0) {
        setMessage("請至少選擇一項習慣");
        return;
      }
      const selectedTasks = tasks
        .filter((t) => selected.includes(t.id))
        .map((t) => ({ id: t.id, name: t.name }));
      const snapshot = await exportSnapshot();
      const resp = await exportOrUpdateSheet({
        accessToken: token,
        folderId: newSheetFolder?.id,
        title: newSheetTitle,
        taskIds: selected,
        tasks: selectedTasks,
        snapshot
      });
      const spreadsheetId = resp.spreadsheetId;
      await upsertUserSheet({ title: newSheetTitle, spreadsheetId, folderId: newSheetFolder?.id, taskIds: selected });
      await loadSheets();
      setMessage("已建立或更新試算表");
    } catch (e) {
      console.error(e);
      setMessage("建立或更新試算表失敗");
    }
  }

  async function handleCreateOrUpdateJournal() {
    try {
      const token = await getGoogleAccessToken();
      if (!token) {
        setMessage("請先登入 Google");
        return;
      }
      const resp = await exportOrUpdateJournal({ accessToken: token, folderId: newJournalFolder?.id, title: newJournalTitle });
      const spreadsheetId = resp.spreadsheetId;
      const existing = journalSheets.find((j: any) => j.spreadsheetId === spreadsheetId || j.title === newJournalTitle);
      await upsertUserJournalSheet({ id: existing?.id, title: newJournalTitle, spreadsheetId, folderId: newJournalFolder?.id });
      await loadJournalSheets();
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
        <h2 className="text-lg font-semibold">帳戶</h2>
        <div className="mt-3 flex items-center gap-3 text-sm text-slate-600">
          <span>Google：{userEmail ?? "未登入"}</span>
          <button type="button" className="rounded-lg border border-primary px-3 py-1 text-sm text-primary" onClick={handleGoogleConnect}>
            連結 Google
          </button>
          <button type="button" className="rounded-lg border border-slate-200 px-3 py-1 text-sm text-slate-600" onClick={handleSignOut}>
            登出
          </button>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">Sheet 匯出</h2>
        <p className="text-sm text-slate-500">選擇資料夾與要匯出的習慣。建立或更新試算表；之後新增/刪除會自動同步。</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-xs text-slate-500">標題模板</label>
            <input className="w-full rounded-lg border border-slate-200 px-3 py-2" value={newSheetTitle} onChange={(e) => setNewSheetTitle(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-slate-500">匯出資料夾（選填）</label>
            <div className="flex items-center gap-2">
              <input className="w-full rounded-lg border border-slate-200 px-3 py-2" readOnly value={newSheetFolder?.name ?? "（未選擇）"} />
              <button type="button" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" onClick={openFolderPicker}>選擇</button>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500">要匯出的習慣項目</label>
            <div className="max-h-48 overflow-auto rounded-lg border border-slate-200 p-2">
              {tasks.length === 0 && <p className="text-sm text-slate-500">尚無習慣，請先新增</p>}
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
              建立／更新
            </button>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">已管理的試算表</h3>
          {loadingSheets ? (
            <p className="text-sm text-slate-500">載入中...</p>
          ) : sheets.length === 0 ? (
            <p className="text-sm text-slate-500">尚未建立</p>
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
                      className="rounded-lg border border-slate-200 px-3 py-1 text-slate-700"
                      onClick={async () => {
                        try {
                          const next = window.prompt("重新命名（Drive 檔名 + DB title）", s.title);
                          if (!next || next === s.title) return;
                          const token = await getGoogleAccessToken();
                          if (!token) { setMessage("請先登入 Google"); return; }
                          await renameRemoteSheet({ accessToken: token, spreadsheetId: s.spreadsheetId, title: next });
                          await updateUserSheetTitle(s.id, next);
                          await loadSheets();
                          setMessage("已完成重新命名");
                        } catch (e) {
                          console.error(e);
                          setMessage("重新命名失敗");
                        }
                      }}
                    >
                      重新命名
                    </button>
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

      <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">日誌匯出</h2>
        <p className="text-sm text-slate-500">建立或沿用日誌試算表，系統會自動同步每日記錄。</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-xs text-slate-500">標題模板</label>
            <input className="w-full rounded-lg border border-slate-200 px-3 py-2" value={newJournalTitle} onChange={(e) => setNewJournalTitle(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-slate-500">匯出資料夾（選填）</label>
            <div className="flex items-center gap-2">
              <input className="w-full rounded-lg border border-slate-200 px-3 py-2" readOnly value={newJournalFolder?.name ?? "（未選擇）"} />
              <button type="button" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" onClick={openJournalFolderPicker}>選擇</button>
            </div>
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button type="button" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white" onClick={handleCreateOrUpdateJournal}>建立／更新</button>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">已管理的日誌試算表</h3>
          {loadingJournalSheets ? (
            <p className="text-sm text-slate-500">載入中...</p>
          ) : journalSheets.length === 0 ? (
            <p className="text-sm text-slate-500">尚未建立</p>
          ) : (
            <ul className="divide-y">
              {journalSheets.map((s: any) => (
                <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{s.title}</p>
                    <p className="text-xs text-slate-500">{s.spreadsheetId}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-slate-200 px-3 py-1 text-slate-700"
                      onClick={async () => {
                        try {
                          const next = window.prompt("重新命名（Drive 檔名 + DB title）", s.title);
                          if (!next || next === s.title) return;
                          const token = await getGoogleAccessToken();
                          if (!token) { setMessage("請先登入 Google"); return; }
                          await renameRemoteSheet({ accessToken: token, spreadsheetId: s.spreadsheetId, title: next });
                          await updateUserJournalSheetTitle(s.id, next);
                          await loadJournalSheets();
                          setMessage("已完成重新命名");
                        } catch (e) {
                          console.error(e);
                          setMessage("重新命名失敗");
                        }
                      }}
                    >
                      重新命名
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-rose-200 px-3 py-1 text-rose-600"
                      onClick={async () => {
                        try {
                          if (!window.confirm("確定要刪除？（會嘗試刪除雲端檔案與 DB 記錄）")) return;
                          const token = await getGoogleAccessToken();
                          if (token) {
                            try { await deleteRemoteSheet({ accessToken: token, spreadsheetId: s.spreadsheetId }); } catch (e) { console.warn(e); }
                          }
                          await deleteUserJournalSheet(s.id);
                          await loadJournalSheets();
                        } catch (e) {
                          console.error(e);
                        }
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
                if (folderPickTarget === "journal") setNewJournalFolder({ id: f.id, name: f.name });
                else setNewSheetFolder({ id: f.id, name: f.name });
                setFolderModalOpen(false);
              }}
            >
              <span>{f.name}</span>
              <span className="text-xs text-slate-400">{f.id}</span>
            </button>
          ))}
          {folderListing.length === 0 && <p className="text-sm text-slate-500">沒有可用資料夾，請重試</p>}
        </div>
      </Modal>
    </div>
  );
}

export default SettingsPage;
