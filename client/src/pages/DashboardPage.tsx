import { useMemo } from "react";
import { nanoid } from "nanoid";
import dayjs from "dayjs";
import { Line, PolarArea } from "react-chartjs-2";
import { FiPlusCircle, FiTrash2, FiArrowUp, FiArrowDown } from "react-icons/fi";
import { usePracticeStore } from "../store/practiceStore";
import { sumDaily, getStreak } from "../utils/practice";
import "../lib/chart";

const WIDGET_PRESETS = [
  {
    type: "weekly-progress" as const,
    title: "本週總覽"
  },
  {
    type: "top-tasks" as const,
    title: "功課占比"
  },
  {
    type: "streak" as const,
    title: "連續紀錄"
  }
];

function DashboardPage() {
  const widgets = usePracticeStore((state) => [...state.widgets].sort((a, b) => a.order - b.order));
  const tasks = usePracticeStore((state) => state.tasks);
  const records = usePracticeStore((state) => state.records);
  const setWidgets = usePracticeStore((state) => state.setWidgets);

  async function handleAddWidget(type: (typeof WIDGET_PRESETS)[number]["type"], title: string) {
    const next = [
      ...widgets,
      {
        id: nanoid(),
        type,
        title,
        taskIds: tasks.map((task) => task.id),
        options: {},
        order: widgets.length
      }
    ];
    await setWidgets(next);
  }

  async function handleRemoveWidget(id: string) {
    await setWidgets(widgets.filter((widget) => widget.id !== id).map((widget, index) => ({ ...widget, order: index })));
  }

  async function handleMoveWidget(id: string, direction: "up" | "down") {
    const currentIndex = widgets.findIndex((widget) => widget.id === id);
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= widgets.length) return;
    const reordered = [...widgets];
    const [item] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, item);
    await setWidgets(reordered.map((widget, index) => ({ ...widget, order: index })));
  }

  const weeklyLabels = useMemo(() => {
    const today = dayjs();
    return Array.from({ length: 7 })
      .map((_, index) => today.subtract(6 - index, "day"))
      .map((day) => day.format("MM/DD"));
  }, []);

  const weeklyCounts = useMemo(() => {
    const today = dayjs();
    return Array.from({ length: 7 }).map((_, index) => {
      const date = today.subtract(6 - index, "day").format("YYYY-MM-DD");
      return sumDaily(records, date);
    });
  }, [records]);

  const topTaskData = useMemo(() => {
    const totals = tasks.map((task) => ({
      task,
      total: records
        .filter((record) => record.taskId === task.id)
        .reduce((acc, record) => acc + record.count, 0)
    }));
    return totals.filter((item) => item.total > 0);
  }, [records, tasks]);

  const streakStats = useMemo(() => {
    const today = dayjs().format("YYYY-MM-DD");
    return tasks.map((task) => ({
      task,
      streak: getStreak(records, task.id, today)
    }));
  }, [records, tasks]);

  function renderWidget(widgetId: string, type: string) {
    switch (type) {
      case "weekly-progress":
        return (
          <Line
            data={{
              labels: weeklyLabels,
              datasets: [
                {
                  label: "完成次數",
                  data: weeklyCounts,
                  backgroundColor: "rgba(168, 85, 247, 0.3)",
                  borderColor: "#a855f7",
                  tension: 0.4,
                  fill: true
                }
              ]
            }}
            options={{
              plugins: {
                legend: { display: false }
              },
              scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 } }
              }
            }}
          />
        );
      case "top-tasks":
        return topTaskData.length === 0 ? (
          <p className="text-sm text-slate-500">尚未有歷史資料。</p>
        ) : (
          <PolarArea
            data={{
              labels: topTaskData.map((item) => item.task.name),
              datasets: [
                {
                  label: "累積",
                  data: topTaskData.map((item) => item.total),
                  backgroundColor: topTaskData.map((item) => item.task.color ?? "#a855f7")
                }
              ]
            }}
          />
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
        return <p className="text-sm text-slate-500">尚未支援的元件：{type}</p>;
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">自訂面板</h2>
        <p className="text-sm text-slate-500">選擇想要呈現的卡片，後續可調整順序。</p>
        <div className="mt-3 flex flex-wrap gap-3">
          {WIDGET_PRESETS.map((preset) => (
            <button
              key={preset.type}
              type="button"
              onClick={() => handleAddWidget(preset.type, preset.title)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:border-primary hover:text-primary"
            >
              <FiPlusCircle /> 加入 {preset.title}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {widgets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
            尚未選擇元件，點擊上方按鈕加入。
          </div>
        ) : (
          widgets.map((widget) => (
            <article key={widget.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <header className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">{widget.title}</h3>
                  <p className="text-xs text-slate-500">類型：{widget.type}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-slate-200 p-2 text-slate-500 hover:border-primary hover:text-primary"
                    onClick={() => handleMoveWidget(widget.id, "up")}
                    aria-label="上移"
                  >
                    <FiArrowUp />
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-slate-200 p-2 text-slate-500 hover:border-primary hover:text-primary"
                    onClick={() => handleMoveWidget(widget.id, "down")}
                    aria-label="下移"
                  >
                    <FiArrowDown />
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-rose-200 p-2 text-rose-500 hover:border-rose-400"
                    onClick={() => handleRemoveWidget(widget.id)}
                    aria-label="移除"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </header>
              <div className="min-h-[200px]">{renderWidget(widget.id, widget.type)}</div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}

export default DashboardPage;
