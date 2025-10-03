import { useMemo } from "react";
import dayjs from "dayjs";
import { FiPlus, FiMinus, FiRefreshCw, FiEdit3 } from "react-icons/fi";
import { usePracticeStore } from "../store/practiceStore";
import { calculateGoalProgress, getRecordForDate, sumDaily } from "../utils/practice";

function TodayPage() {
  const tasks = usePracticeStore((state) => state.tasks.filter((task) => task.isActive));
  const records = usePracticeStore((state) => state.records);
  const goals = usePracticeStore((state) => state.goals);
  const addDailyRecord = usePracticeStore((state) => state.addDailyRecord);
  const bulkUpsertDailyRecords = usePracticeStore((state) => state.bulkUpsertDailyRecords);

  const today = dayjs().format("YYYY-MM-DD");
  const yesterday = dayjs().subtract(1, "day").format("YYYY-MM-DD");

  const todayTotal = useMemo(() => sumDaily(records, today), [records, today]);

  const goalProgress = useMemo(
    () =>
      goals
        .filter((goal) => dayjs(goal.endDate).isSameOrAfter(today))
        .map((goal) => ({
          goal,
          progress: calculateGoalProgress(goal, records, today)
        })),
    [goals, records, today]
  );

  async function handleAdjust(taskId: string, delta: number) {
    const current = getRecordForDate(records, taskId, today);
    const nextCount = Math.max(0, (current?.count ?? 0) + delta);
    await addDailyRecord({ taskId, date: today, count: nextCount, note: current?.note });
  }

  async function handleCustom(taskId: string) {
    const value = window.prompt("輸入數量", String(getRecordForDate(records, taskId, today)?.count ?? 0));
    if (value === null) return;
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      window.alert("請輸入數字");
      return;
    }
    const current = getRecordForDate(records, taskId, today);
    await addDailyRecord({ taskId, date: today, count: Math.max(0, parsed), note: current?.note });
  }

  async function handleNote(taskId: string) {
    const current = getRecordForDate(records, taskId, today);
    const note = window.prompt("輸入今日心得（可留空移除）", current?.note ?? "");
    if (note === null) return;
    await addDailyRecord({ taskId, date: today, count: current?.count ?? 0, note: note || undefined });
  }

  async function handleCopyYesterday() {
    const copyRecords = tasks
      .map((task) => {
        const yesterdayRecord = getRecordForDate(records, task.id, yesterday);
        if (!yesterdayRecord) return undefined;
        return { taskId: task.id, date: today, count: yesterdayRecord.count, note: yesterdayRecord.note };
      })
      .filter(Boolean) as Array<{ taskId: string; date: string; count: number; note?: string }>;
    if (copyRecords.length === 0) {
      window.alert("昨天沒有可套用的紀錄");
      return;
    }
    await bulkUpsertDailyRecords(copyRecords);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-slate-500">{dayjs(today).format("YYYY 年 MM 月 DD 日 dddd")}</p>
            <h2 className="text-2xl font-semibold text-slate-900">今日功課總數 {todayTotal}</h2>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:border-primary hover:text-primary"
            onClick={handleCopyYesterday}
          >
            <FiRefreshCw className="h-4 w-4" /> 套用昨天紀錄
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {tasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
            尚未建立功課，前往「功課管理」新增。
          </div>
        ) : (
          tasks.map((task) => {
            const record = getRecordForDate(records, task.id, today);
            return (
              <article key={task.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold" style={{ color: task.color }}>
                      {task.name}
                    </h3>
                    <p className="text-sm text-slate-500">今日已完成 {record?.count ?? 0} 次</p>
                    {record?.note && <p className="mt-1 text-xs text-slate-500">心得：{record.note}</p>}
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <button
                    type="button"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 text-slate-600 transition hover:border-primary hover:text-primary"
                    onClick={() => handleAdjust(task.id, -1)}
                    aria-label="減少 1"
                  >
                    <FiMinus />
                  </button>
                  <span className="inline-flex min-w-[56px] justify-center text-xl font-semibold">
                    {record?.count ?? 0}
                  </span>
                  <button
                    type="button"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white shadow transition hover:bg-primary/90"
                    onClick={() => handleAdjust(task.id, 1)}
                    aria-label="增加 1"
                  >
                    <FiPlus />
                  </button>
                  <button
                    type="button"
                    className="ml-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:border-primary hover:text-primary"
                    onClick={() => handleCustom(task.id)}
                  >
                    自訂輸入
                  </button>
                  <button
                    type="button"
                    className="ml-2 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:border-primary hover:text-primary"
                    onClick={() => handleNote(task.id)}
                  >
                    <FiEdit3 className="h-4 w-4" /> 記事
                  </button>
                </div>
              </article>
            );
          })
        )}
      </section>

      {goalProgress.length > 0 && (
        <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
          <h3 className="mb-4 text-lg font-semibold">目標追蹤</h3>
          <div className="space-y-4">
            {goalProgress.map(({ goal, progress }) => (
              <div key={goal.id} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-slate-700">{goal.name}</p>
                    <p className="text-slate-500">
                      {progress.totalCompleted}/{goal.targetCount} {goal.mode === "total" ? "累計" : ""}
                      {progress.isBehind ? <span className="ml-2 text-rose-500">進度落後</span> : ""}
                    </p>
                  </div>
                  <span className="text-xs text-slate-500">建議每日 {Number.isFinite(progress.suggestedDaily) ? Math.ceil(progress.suggestedDaily) : 0}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-200">
                  <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, progress.progress * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default TodayPage;

