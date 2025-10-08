import { useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { db } from "../lib/db";
import { fetchUserJournalSheets, getGoogleAccessToken, syncJournalIncremental } from "../services/sheetSync";

export function useJournalSheetSyncLifecycle() {
  useEffect(() => {
    async function flushJournalOps() {
      try {
        if (!navigator.onLine || !supabase) return;
        const token = await getGoogleAccessToken();
        const sheets = await fetchUserJournalSheets();
        if (!sheets.length || !token) return;
        const ops = await db.sheetOps.toArray();
        const journalOps = ops.filter((op: any) => op.type?.startsWith("journal"));
        if (!journalOps.length) return;
        for (const sheet of sheets as any[]) {
          await syncJournalIncremental({ accessToken: token, spreadsheetId: sheet.spreadsheetId, operations: journalOps as any });
        }
      } catch (e) {
        // ignore to avoid blocking lifecycle
        console.warn(e);
      }
    }

    const interval = window.setInterval(() => {
      void flushJournalOps();
    }, 10 * 60 * 1000);

    window.addEventListener("sheet-sync-request", flushJournalOps as any);
    return () => {
      window.removeEventListener("sheet-sync-request", flushJournalOps as any);
      window.clearInterval(interval);
    };
  }, []);
}

