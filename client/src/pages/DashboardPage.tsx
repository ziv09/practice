import React, { useMemo, useState } from "react";
import { nanoid } from "nanoid";
import dayjs from "dayjs";
import { Line, PolarArea } from "react-chartjs-2";
import { FiPlusCircle, FiTrash2, FiArrowUp, FiArrowDown } from "react-icons/fi";
import { usePracticeStore } from "../store/practiceStore";
import { sumDaily, getStreak } from "../utils/practice";
import "../lib/chart";

const WIDGET_PRESETS = [
  { type: "weekly-progress" as const, title: "每週進度" },
  { type: "top-tasks" as const, title: "熱門功課" },
  { type: "streak" as const, title: "連續天數" }
];

function DashboardPage() {
  const widgets = usePracticeStore((state) => [...state.widgets].sort((a, b) => a.order - b.order));
  const tasks = usePracticeStore((state) => state.tasks);
  const records = usePracticeStore((state) => state.records);
  const setWidgets = usePracticeStore((state) => state.setWidgets);

  async function handleAddWidget(type: (typeof WIDGET_PRESETS)[number]["type"], title: string) {
    const next = [
      ...widgets,
      { id: nanoid(), type, title, taskIds: tasks.map((t) => t.id), options: {}, order: widgets.length }
    ];
    await setWidgets(next);
  }
  async function handleRemoveWidget(id: string) {
    await setWidgets(widgets.filter((w) => w.id !== id).map((w, i) => ({ ...w, order: i })));
  }
  async function handleMoveWidget(id: string, direction: "up" | "down") {
    const currentIndex = widgets.findIndex((w) => w.id === id);
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= widgets.length) return;
    const reordered = [...widgets];
    const [item] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, item);
    await setWidgets(reordered.map((w, i) => ({ ...w, order: i })));
  }

  const weeklyLabels = useMemo(() => {
    const today = dayjs();
    return Array.from({ length: 7 }).map((_, i) => today.subtract(6 - i, "day").format("MM/DD"));
  }, []);
  const weeklyCounts = useMemo(() => {
    const today = dayjs();
    return Array.from({ length: 7 }).map((_, i) => sumDaily(records, today.subtract(6 - i, "day").format("YYYY-MM-DD")));
  }, [records]);
  const topTaskData = useMemo(() => {
    const totals = tasks.map((task) => ({ task, total: records.filter((r) => r.taskId === task.id).reduce((a, r) => a + r.count, 0) }));
    return totals.filter((x) => x.total > 0);
  }, [records, tasks]);
  const streakStats = useMemo(() => {
    const today = dayjs().format("YYYY-MM-DD");
    return tasks.map((task) => ({ task, streak: getStreak(records, task.id, today) }));
  }, [records, tasks]);

  function renderWidget(widgetId: string, type: string) {
    switch (type) {
      case "weekly-progress":
        return (
          <Line data={{ labels: weeklyLabels, datasets: [{ label: "每週趨勢", data: weeklyCounts, backgroundColor: "rgba(168,85,247,.3)", borderColor: "#a855f7", tension: .4, fill: true }] }} options={{ plugins:{ legend:{ display:false }}, scales:{ y:{ beginAtZero:true, ticks:{ stepSize:1 }}}}} />
        );
      case "top-tasks":
        return topTaskData.length === 0 ? (
          <p className="text-sm text-slate-500">尚無資料。</p>
        ) : (
          <PolarArea data={{ labels: topTaskData.map((i)=>i.task.name), datasets:[{ label:"總量", data: topTaskData.map((i)=>i.total), backgroundColor: topTaskData.map((i)=>i.task.color ?? "#a855f7")}] }} />
        );
      case "streak":
        return (
          <ul className="space-y-2 text-sm text-slate-600">
            {streakStats.map(({ task, streak }) => (
              <li key={`${widgetId}-${task.id}`} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span>{task.name}</span>
                <span>{streak} 天</span>
              </li>
            ))}
          </ul>
        );
      default:
        return <p className="text-sm text-slate-500">未知類型：{type}</p>;
    }
  }

  // 資料管理區
  const addDailyRecord = usePracticeStore((s) => s.addDailyRecord);
  const removeDailyRecord = usePracticeStore((s) => s.removeDailyRecord);
  const [taskId, setTaskId] = useState<string>("");
  const [start, setStart] = useState(dayjs().subtract(30, "day").format("YYYY-MM-DD"));
  const [end, setEnd] = useState(dayjs().format("YYYY-MM-DD"));
  const filtered = useMemo(() => {
    const id = taskId || tasks[0]?.id || "";
    return records.filter((r) => (!id || r.taskId === id) && r.date >= start && r.date <= end).sort((a, b) => b.date.localeCompare(a.date));
  }, [records, taskId, start, end, tasks]);
  async function handleEditRecord(r: { taskId: string; date: string; count: number }) {
    const value = window.prompt("輸入自訂", String(r.count));
    if (value === null) return;
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return alert("請輸入數字");
    await addDailyRecord({ taskId: r.taskId, date: r.date, count: Math.max(0, parsed) });
  }
  async function handleDeleteRecord(r: { taskId: string; date: string }) {
    await removeDailyRecord(r.taskId, r.date);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">儀表板</h2>
            <p className="text-sm text-slate-500">選擇要顯示的資料，打造儀表板。</p>
          </div>
          <div className="flex items-center gap-2">
            {WIDGET_PRESETS.map((preset) => (
              <button
                key={preset.type}
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border border-primary px-3 py-2 text-sm font-semibold text-primary"
                onClick={() => handleAddWidget(preset.type, preset.title)}
              >
                <FiPlusCircle /> {preset.title}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {widgets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">尚無小工具。</div>
        ) : (
          widgets.map((widget) => (
            <article key={widget.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <header className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">{widget.title}</h3>
                  <p className="text-xs text-slate-500">類型：{widget.type}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" className="rounded-full border border-slate-200 p-2 text-slate-500 hover:border-primary hover:text-primary" onClick={() => handleMoveWidget(widget.id, "up")} aria-label="上移"><FiArrowUp /></button>
                  <button type="button" className="rounded-full border border-slate-200 p-2 text-slate-500 hover:border-primary hover:text-primary" onClick={() => handleMoveWidget(widget.id, "down")} aria-label="下移"><FiArrowDown /></button>
                  <button type="button" className="rounded-full border border-rose-200 p-2 text-rose-500 hover:border-rose-400" onClick={() => handleRemoveWidget(widget.id)} aria-label="刪除"><FiTrash2 /></button>
                </div>
              </header>
              <div className="min-h-[200px]">{renderWidget(widget.id, widget.type)}</div>
            </article>
          ))
        )}
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">資料管理</h2>
        <div className="grid gap-3 sm:grid-cols-3 mt-3">
          <div>
            <label className="block text-xs text-slate-500">功課</label>
            <select className="w-full rounded-lg border border-slate-200 px-3 py-2" value={taskId} onChange={(e) => setTaskId(e.target.value)}>
              <option value="">（未選擇）</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500">開始</label>
            <input className="w-full rounded-lg border border-slate-200 px-3 py-2" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-slate-500">結束</label>
            <input className="w-full rounded-lg border border-slate-200 px-3 py-2" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
        <div className="mt-4">
          {filtered.length === 0 ? (
            <p className="text-sm text-slate-500">這段期間沒有資料</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="px-2 py-2">日期</th>
                    <th className="px-2 py-2">功課</th>
                    <th className="px-2 py-2">數量</th>
                    <th className="px-2 py-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const t = tasks.find((x) => x.id === r.taskId);
                    return (
                      <tr key={r.id} className="border-t">
                        <td className="px-2 py-2">{r.date}</td>
                        <td className="px-2 py-2">{t?.name ?? r.taskId}</td>
                        <td className="px-2 py-2">{r.count}</td>
                        <td className="px-2 py-2">
                          <div className="flex gap-2">
                            <button className="rounded border border-slate-200 px-2 py-1" onClick={() => handleEditRecord(r)}>修改</button>
                            <button className="rounded border border-rose-200 px-2 py-1 text-rose-600" onClick={() => handleDeleteRecord(r)}>刪除</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default DashboardPage;

