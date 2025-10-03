import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import dayjs from "dayjs";
import { FiTrash2, FiPlusCircle } from "react-icons/fi";
import { usePracticeStore } from "../store/practiceStore";
import { calculateGoalProgress } from "../utils/practice";

const goalSchema = z.object({
  name: z.string().min(1, "請輸入名稱"),
  taskId: z.string().min(1, "請選擇功課"),
  startDate: z.string(),
  endDate: z.string(),
  targetCount: z.number().min(1, "目標需大於 0"),
  mode: z.enum(["total", "daily", "weighted"]),
  weekendMultiplier: z.number().min(1).max(5).optional()
});

type GoalFormValues = z.infer<typeof goalSchema>;

function GoalsPage() {
  const tasks = usePracticeStore((state) => state.tasks);
  const goals = usePracticeStore((state) => state.goals);
  const records = usePracticeStore((state) => state.records);
  const addGoal = usePracticeStore((state) => state.addGoal);
  const updateGoal = usePracticeStore((state) => state.updateGoal);
  const removeGoal = usePracticeStore((state) => state.removeGoal);
  const [showForm, setShowForm] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<GoalFormValues>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      name: "",
      startDate: dayjs().format("YYYY-MM-DD"),
      endDate: dayjs().add(30, "day").format("YYYY-MM-DD"),
      targetCount: 100,
      mode: "total",
      weekendMultiplier: 1
    }
  });

  const goalStats = useMemo(() => {
    const today = dayjs().format("YYYY-MM-DD");
    return goals.map((goal) => ({
      goal,
      progress: calculateGoalProgress(goal, records, today)
    }));
  }, [goals, records]);

  async function onSubmit(values: GoalFormValues) {
    await addGoal({
      ...values,
      targetCount: values.targetCount,
      weekendMultiplier: values.mode === "weighted" ? values.weekendMultiplier ?? 2 : undefined
    });
    reset();
    setShowForm(false);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">進行中目標</h2>
            <p className="text-sm text-slate-500">追蹤各功課的達成率與建議進度</p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-primary px-3 py-2 text-sm font-semibold text-primary"
            onClick={() => setShowForm((prev) => !prev)}
          >
            <FiPlusCircle /> {showForm ? "取消新增" : "新增目標"}
          </button>
        </div>
        {goalStats.length === 0 && !showForm && (
          <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">尚未設定目標，點擊右上角開始。</p>
        )}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {goalStats.map(({ goal, progress }) => {
            const task = tasks.find((item) => item.id === goal.taskId);
            const percent = Math.round(progress.progress * 100);
            return (
              <article key={goal.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800">{goal.name}</h3>
                    <p className="text-sm text-slate-500">
                      功課：{task?.name ?? "已刪除"}（{goal.startDate} ~ {goal.endDate}）
                    </p>
                    <p className="text-xs text-slate-400">
                      目標 {goal.targetCount} {task?.unit ?? "次"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="rounded-full border border-slate-200 p-2 text-xs text-rose-500 hover:border-rose-400"
                    onClick={() => removeGoal(goal.id)}
                    aria-label="刪除目標"
                  >
                    <FiTrash2 />
                  </button>
                </div>
                <div className="mt-4 h-2 w-full rounded-full bg-slate-200">
                  <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, percent)}%` }} />
                </div>
                <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
                  <span>已完成 {progress.totalCompleted}</span>
                  <span>剩餘 {progress.left}</span>
                  <span>建議每日 {Number.isFinite(progress.suggestedDaily) ? Math.ceil(progress.suggestedDaily) : 0}</span>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {showForm && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold">新增目標</h2>
          <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label className="block text-xs text-slate-500">目標名稱</label>
              <input className="w-full rounded-lg border border-slate-200 px-3 py-2" {...register("name")} />
              {errors.name && <p className="mt-1 text-xs text-rose-500">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-xs text-slate-500">對應功課</label>
              <select className="w-full rounded-lg border border-slate-200 px-3 py-2" {...register("taskId")}>
                <option value="">選擇功課</option>
                {tasks.map((task) => (
                  <option value={task.id} key={task.id}>
                    {task.name}
                  </option>
                ))}
              </select>
              {errors.taskId && <p className="mt-1 text-xs text-rose-500">{errors.taskId.message}</p>}
            </div>
            <div>
              <label className="block text-xs text-slate-500">開始日期</label>
              <input type="date" className="w-full rounded-lg border border-slate-200 px-3 py-2" {...register("startDate")} />
            </div>
            <div>
              <label className="block text-xs text-slate-500">結束日期</label>
              <input type="date" className="w-full rounded-lg border border-slate-200 px-3 py-2" {...register("endDate")} />
            </div>
            <div>
              <label className="block text-xs text-slate-500">目標總量</label>
              <input
                type="number"
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
                {...register("targetCount", { valueAsNumber: true })}
              />
              {errors.targetCount && <p className="mt-1 text-xs text-rose-500">{errors.targetCount.message}</p>}
            </div>
            <div>
              <label className="block text-xs text-slate-500">計算方式</label>
              <select className="w-full rounded-lg border border-slate-200 px-3 py-2" {...register("mode")}>
                <option value="total">固定總量</option>
                <option value="daily">每日平均</option>
                <option value="weighted">週末加權</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-slate-500">週末加權（僅加權模式）</label>
              <input
                type="number"
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
                {...register("weekendMultiplier", { valueAsNumber: true })}
              />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-3">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600"
                onClick={() => {
                  reset();
                  setShowForm(false);
                }}
              >
                取消
              </button>
              <button
                type="submit"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
              >
                建立目標
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}

export default GoalsPage;
