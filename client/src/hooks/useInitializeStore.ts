import { useEffect } from "react";
import { usePracticeStore } from "../store/practiceStore";

export function useInitializeStore() {
  const ready = usePracticeStore((state) => state.ready);
  const loadInitialData = usePracticeStore((state) => state.loadInitialData);

  useEffect(() => {
    if (!ready) {
      void loadInitialData();
    }
  }, [ready, loadInitialData]);

  return ready;
}
