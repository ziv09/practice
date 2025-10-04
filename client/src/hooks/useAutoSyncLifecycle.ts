import { useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { usePracticeStore } from "../store/practiceStore";
import { db } from "../lib/db";
import { fetchUserSheets, getGoogleAccessToken, syncSheetsIncremental } from "../services/sheetSync";

export function useAutoSyncLifecycle() {
  const syncNow = usePracticeStore((s) => s.syncNow);
  const getState = usePracticeStore;

  useEffect(() => {
    // 嘗試要求持久化存儲，降低被回收風險
    (navigator as any).storage?.persist?.();

    const handleOnline = () => {
      void syncNow({ push: true, pull: true });
    };
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        void syncNow({ push: true, pull: false });
      }
    };
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);

    const interval = window.setInterval(() => {
      void syncNow({ push: true, pull: false });
      void flushSheetOps();
    }, 10 * 60 * 1000);

    const handlePageHide = async (event: PageTransitionEvent | any) => {
      try {
        const { pendingOperations, userId } = getState.getState();
        if (!navigator.onLine || !pendingOperations.length || !supabase || !userId) return;
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return;
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
        if (!supabaseUrl) return;
        await fetch(`${supabaseUrl}/functions/v1/sync-practice`, {
          method: "POST",
          keepalive: true,
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ operations: pendingOperations })
        });
      } catch (e) {
        // 有未送出的情況下提醒使用者
        const { pendingOperations } = getState.getState();
        if (pendingOperations.length) {
          event.returnValue = "仍有資料未同步，確定要離開？";
        }
      }
    };
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handlePageHide as any);
    window.addEventListener("sheet-sync-request", flushSheetOps as any);

    return () => {
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.clearInterval(interval);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handlePageHide as any);
      window.removeEventListener("sheet-sync-request", flushSheetOps as any);
    };
  }, [syncNow]);
}

async function flushSheetOps() {
  try {
    if (!navigator.onLine || !supabase) return;
    const token = await getGoogleAccessToken();
    if (!token) return;
    const sheets = await fetchUserSheets();
    if (!sheets.length) return;
    const ops = await db.sheetOps.toArray();
    if (!ops.length) return;

    // Send the same batch to all sheets; delete only if all succeed
    for (const sheet of sheets) {
      const filtered = ops.filter((op: any) => {
        if (op.type.startsWith("task")) {
          // For task ops, apply if this sheet tracks the task
          const id = (op.payload?.id ?? op.payload?.taskId ?? op.payload?.[0]?.taskId) as string | undefined;
          return id ? sheet.taskIds.includes(id) : true;
        }
        if (op.type.startsWith("record")) {
          const p = op.payload;
          if (Array.isArray(p)) return p.some((r) => sheet.taskIds.includes(r.taskId));
          return p?.taskId ? sheet.taskIds.includes(p.taskId) : true;
        }
        return false;
      });
      if (!filtered.length) continue;
      await syncSheetsIncremental({ accessToken: token, spreadsheetId: sheet.spreadsheetId, taskIds: sheet.taskIds, operations: filtered });
    }

    await db.sheetOps.clear();
    window.dispatchEvent(new CustomEvent("app-toast", { detail: { type: "success", message: "表單已同步" } }));
  } catch (e) {
    // show one-time toast; keep queue for retry
    window.dispatchEvent(new CustomEvent("app-toast", { detail: { type: "error", message: "表單同步失敗，稍後將自動重試" } }));
  }
}
