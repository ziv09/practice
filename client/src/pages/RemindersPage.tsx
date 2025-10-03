import { useMemo, useState } from "react";
import { FiPlusCircle, FiBell, FiTrash2 } from "react-icons/fi";
import clsx from "clsx";
import { usePracticeStore } from "../store/practiceStore";
import type { ReminderRule } from "../types";

const WEEKDAY_LABEL = ["日", "一", "二", "三", "四", "五", "六"];

function createRuleId() {
  try {
    return crypto.randomUUID();
  } catch (error) {
    return `rule-${Date.now()}`;
  }
}

async function ensureNotificationPermission() {
  if (!("Notification" in window)) {
    alert("瀏覽器不支援通知");
    return false;
  }
  const result = await Notification.requestPermission();
  if (result !== "granted") {
    alert("尚未授權通知，請到系統設定開啟");
    return false;
  }
  return true;
}

function RemindersPage() {
  const reminder = usePracticeStore((state) => state.settings.reminder);
  const updateSettings = usePracticeStore((state) => state.updateSettings);
  const updateRules = usePracticeStore((state) => state.updateReminderRules);
  const [newRule, setNewRule] = useState({
    label: "每日提醒",
    time: "20:00",
    onlyWhenIncomplete: true
  });

  const sortedRules = useMemo(
    () => [...reminder.rules].sort((a, b) => a.time.localeCompare(b.time)),
    [reminder.rules]
  );

  async function handleToggleReminder(enabled: boolean) {
    const granted = enabled ? await ensureNotificationPermission() : true;
    if (!granted) return;
    await updateSettings({ reminder: { ...reminder, enabled } });
  }

  async function handleAddRule() {
    if (!newRule.time) {
      alert("請選擇時間");
      return;
    }
    const rule: ReminderRule = {
      id: createRuleId(),
      label: newRule.label,
      time: newRule.time,
      enabled: true,
      onlyWhenIncomplete: newRule.onlyWhenIncomplete,
      quietDays: [],
      channel: "web-push"
    };
    await updateRules([...reminder.rules, rule]);
    setNewRule({ label: "每日提醒", time: "20:00", onlyWhenIncomplete: true });
  }

  async function handleUpdateRule(ruleId: string, update: Partial<ReminderRule>) {
    await updateRules(reminder.rules.map((rule) => (rule.id === ruleId ? { ...rule, ...update } : rule)));
  }

  async function handleToggleWeek(ruleId: string, day: number) {
    const rule = reminder.rules.find((item) => item.id === ruleId);
    if (!rule) return;
    const quietDays = rule.quietDays.includes(day)
      ? rule.quietDays.filter((item) => item !== day)
      : [...rule.quietDays, day];
    await handleUpdateRule(ruleId, { quietDays });
  }

  async function handleRemoveRule(ruleId: string) {
    await updateRules(reminder.rules.filter((rule) => rule.id !== ruleId));
  }

  async function handleTestNotification() {
    const granted = await ensureNotificationPermission();
    if (!granted) return;
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "SHOW_TEST_NOTIFICATION" });
    } else {
      new Notification("Practice 提醒", {
        body: "這是測試通知，記得填寫今日功課喔！",
        icon: "/pwa-192x192.png"
      });
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">每日提醒</h2>
            <p className="text-sm text-slate-500">設定固定時間提醒，確保每日填寫紀錄。</p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={reminder.enabled} onChange={(event) => handleToggleReminder(event.target.checked)} />
            啟用提醒
          </label>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-slate-500">提醒名稱</label>
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
                value={newRule.label}
                onChange={(event) => setNewRule({ ...newRule, label: event.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500">提醒時間</label>
              <input
                type="time"
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
                value={newRule.time}
                onChange={(event) => setNewRule({ ...newRule, time: event.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={newRule.onlyWhenIncomplete}
                onChange={(event) => setNewRule({ ...newRule, onlyWhenIncomplete: event.target.checked })}
              />
              僅在功課未完成時提醒
            </label>
          </div>
          <button
            type="button"
            className="self-end rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
            onClick={handleAddRule}
            disabled={!reminder.enabled}
          >
            <FiPlusCircle className="mr-1 inline" /> 新增時間
          </button>
        </div>
      </section>

      <section className="space-y-4">
        {sortedRules.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
            尚未設定提醒時間。
          </div>
        ) : (
          sortedRules.map((rule) => (
            <article key={rule.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">{rule.label}</h3>
                  <p className="text-sm text-slate-500">
                    {rule.time}・
                    {rule.onlyWhenIncomplete ? "未完成才提醒" : "每日提醒"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={(event) => handleUpdateRule(rule.id, { enabled: event.target.checked })}
                    />
                    啟用
                  </label>
                  <button
                    type="button"
                    className="rounded-full border border-rose-200 p-2 text-rose-500 hover:border-rose-400"
                    onClick={() => handleRemoveRule(rule.id)}
                    aria-label="刪除提醒"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-600">
                {WEEKDAY_LABEL.map((label, index) => (
                  <button
                    key={`${rule.id}-${index}`}
                    type="button"
                    className={clsx(
                      "rounded-full border px-3 py-1",
                      rule.quietDays.includes(index)
                        ? "border-slate-200 bg-slate-100 text-slate-400"
                        : "border-primary/40 text-primary"
                    )}
                    onClick={() => handleToggleWeek(rule.id, index)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </article>
          ))
        )}
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">推播測試</h2>
        <p className="text-sm text-slate-500">
          PWA 需加入主畫面並授權通知後才會收到推播。伺服器排程需另外部署。
        </p>
        <div className="mt-3 flex gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-primary px-3 py-2 text-sm font-semibold text-primary"
            onClick={handleTestNotification}
          >
            <FiBell /> 測試通知
          </button>
        </div>
      </section>
    </div>
  );
}

export default RemindersPage;
