import { describe, expect, it } from "vitest";
import { usePracticeStore } from "../store/practiceStore";

describe("practice store", () => {
  it("初始化時應該有預設設定", () => {
    const state = usePracticeStore.getState();
    expect(state.settings.appearance.theme).toBe("auto");
    expect(state.settings.reminder.enabled).toBe(false);
    expect(state.syncStatus).toBe("idle");
    expect(state.pendingOperations).toHaveLength(0);
  });
});
