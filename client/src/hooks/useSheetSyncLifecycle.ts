import { useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { db } from "../lib/db";
import { fetchUserSheets, getGoogleAccessToken, syncSheetsIncremental } from "../services/sheetSync";

export function useSheetSyncLifecycle() {
  useEffect(() => {
    async function flushSheetOps() {
      try {
        if (!navigator.onLine || !supabase) return;
        const accessToken = await getGoogleAccessToken();
        if (!accessToken) return;

        const userSheets = await fetchUserSheets();
        if (!userSheets.length) return;

        const allOps: any[] = await db.sheetOps.toArray();
        const ops = allOps.filter((op) => typeof op?.type === "string" && !String(op.type).startsWith("journal"));
        if (!ops.length) return;

        for (const sheet of userSheets) {
          try {
            await syncSheetsIncremental({
              accessToken,
              spreadsheetId: sheet.spreadsheetId,
              taskIds: sheet.taskIds,
              operations: ops as any
            });
          } catch (e) {
            // keep ops for retry next time
            console.warn("sheet sync failed for", sheet.spreadsheetId, e);
            return;
          }
        }
        // all succeeded: remove processed non-journal ops
        await db.sheetOps.bulkDelete(ops.map((op: any) => op.id));
      } catch (e) {
        console.warn(e);
      }
    }

    const interval = window.setInterval(() => {
      void flushSheetOps();
    }, 10 * 60 * 1000);

    window.addEventListener("sheet-sync-request", flushSheetOps as any);
    return () => {
      window.removeEventListener("sheet-sync-request", flushSheetOps as any);
      window.clearInterval(interval);
    };
  }, []);
}

