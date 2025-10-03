import { describe, expect, it } from "vitest";
import { usePracticeStore } from "../store/practiceStore";

describe("practice store", () => {
  it("初始化時應該有預設設定", () => {
    const settings = usePracticeStore.getState().settings;
    expect(settings.appearance.theme).toBe("auto");
    expect(settings.reminder.enabled).toBe(false);
  });
});
