import { useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { usePracticeStore } from "../store/practiceStore";

export function useAutoSyncLifecycle() {
  const syncNow = usePracticeStore((s) => s.syncNow);
  useEffect(() => {
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
      window.dispatchEvent(new Event("sheet-sync-request"));
    }, 10 * 60 * 1000);

    return () => {
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.clearInterval(interval);
    };
  }, [syncNow]);
}

