import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { FiEdit2, FiArrowUp, FiArrowDown, FiCheck, FiX, FiTrash2 } from "react-icons/fi";
import clsx from "clsx";
import { usePracticeStore } from "../store/practiceStore";
import type { PracticeTask } from "../types";

const taskSchema = z.object({
  name: z.string().min(1, "不可空白"),
  category: z.string().min(1, "請輸入分類"),
  color: z.string().regex(/^#/, "請輸入色碼"),
  allowReminder: z.boolean(),
  includeInDashboard: z.boolean()
});

type TaskFormValues = z.infer<typeof taskSchema>;

function TasksPage() {
  const tasks = usePracticeStore((state) => [...state.tasks].sort((a, b) => a.order - b.order));
  const addTask = usePracticeStore((state) => state.addTask);
  const updateTask = usePracticeStore((state) => state.updateTask);
  const reorderTasks = usePracticeStore((state) => state.reorderTasks);
  const removeTask = usePracticeStore((state) => state.removeTask);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<TaskFormValues | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      name: "",
      category: "",
      color: "#a855f7",
      allowReminder: true,
      includeInDashboard: true
    }
  });

  async function onSubmit(values: TaskFormValues) {
    await addTask({
      ...values,
      order: tasks.length,
      isActive: true
    } as unknown as PracticeTask);
    reset();
  }

  function handleEdit(task: PracticeTask) {
    setEditingId(task.id);
    setEditValues({
      name: task.name,
      category: String(task.category ?? ""),
      color: task.color,
      allowReminder: task.allowReminder,
      includeInDashboard: task.includeInDashboard
    });
  }

  function handleCancelEdit() {
    setEditingId(null);
    setEditValues(null);
  }

  async function handleSaveEdit(task: PracticeTask) {
    if (!editValues) return;
    const result = taskSchema.safeParse(editValues);
    if (!result.success) {
      window.alert(result.error.issues.map((issue) => issue.message).join("\n"));
      return;
    }
    await updateTask(task.id, result.data as Partial<PracticeTask>);
    handleCancelEdit();
  }

  async function handleDelete(task: PracticeTask) {
    const ok = window.confirm(`確定要刪除「${task.name}」？此操作會一併刪除其相關紀錄與目標。`);
    if (!ok) return;
    await removeTask(task.id);
  }

  async function moveTask(task: PracticeTask, direction: "up" | "down") {
    const currentIndex = tasks.findIndex((item) => item.id === task.id);
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= tasks.length) return;
    const reordered = [...tasks];
    const [item] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, item);
    await reorderTasks(reordered.map((t) => t.id));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <section className="space-y-4">
        {tasks.map((task) => {
          const isEditing = editingId === task.id;
          return (
            <article key={task.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <header className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold" style={{ color: task.color }}>
                    {task.name}
                  </h3>
                  <p className="text-sm text-slate-500">分類：{String(task.category || "未分類")}</p>
                  <p className="text-xs text-slate-400">
                    {task.allowReminder ? "提醒已啟用" : "提醒未啟用"}／
                    {task.includeInDashboard ? "儀表板顯示" : "儀表板隱藏"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-slate-200 p-2 text-slate-500 hover:border-primary hover:text-primary"
                    onClick={() => moveTask(task, "up")}
                    aria-label="上移"
                  >
                    <FiArrowUp />
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-slate-200 p-2 text-slate-500 hover:border-primary hover:text-primary"
                    onClick={() => moveTask(task, "down")}
                    aria-label="下移"
                  >
                    <FiArrowDown />
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-rose-200 p-2 text-rose-500 hover:border-rose-400"
                    onClick={() => handleDelete(task)}
                    aria-label="刪除"
                  >
                    <FiTrash2 />
                  </button>
                  <button
                    type="button"
                    className={clsx(
                      "rounded-full border border-slate-200 p-2",
                      isEditing ? "border-primary text-primary" : "text-slate-500 hover:border-primary hover:text-primary"
                    )}
                    onClick={() => (isEditing ? handleCancelEdit() : handleEdit(task))}
                    aria-label="編輯"
                  >
                    <FiEdit2 />
                  </button>
                </div>
              </header>
              {isEditing && editValues && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs text-slate-500">名稱</label>
                    <input
                      className="w-full rounded-lg border border-slate-200 px-3 py-2"
                      value={editValues.name}
                      onChange={(event) => setEditValues({ ...editValues, name: event.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500">分類</label>
                    <input
                      className="w-full rounded-lg border border-slate-200 px-3 py-2"
                      value={editValues.category}
                      onChange={(event) => setEditValues({ ...editValues, category: event.target.value })}
                      placeholder="例如：持咒、抄經、禪修..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500">顏色</label>
                    <input
                      type="color"
                      className="h-10 w-full cursor-pointer rounded-lg border border-slate-200"
                      value={editValues.color}
                      onChange={(event) => setEditValues({ ...editValues, color: event.target.value })}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editValues.allowReminder}
                      onChange={(event) => setEditValues({ ...editValues, allowReminder: event.target.checked })}
                    />
                    啟用提醒
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editValues.includeInDashboard}
                      onChange={(event) => setEditValues({ ...editValues, includeInDashboard: event.target.checked })}
                    />
                    顯示在儀表板
                  </label>
                  <div className="col-span-full flex justify-end gap-2">
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600"
                      onClick={handleCancelEdit}
                    >
                      <FiX /> 取消
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white"
                      onClick={() => handleSaveEdit(task)}
                    >
                      <FiCheck /> 儲存
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </section>
      <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">新增功課</h2>
        <form className="mt-4 space-y-3" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="block text-xs text-slate-500">名稱</label>
            <input className="w-full rounded-lg border border-slate-200 px-3 py-2" {...register("name")} />
            {errors.name && <p className="mt-1 text-xs text-rose-500">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-xs text-slate-500">分類</label>
            <input className="w-full rounded-lg border border-slate-200 px-3 py-2" {...register("category")} placeholder="例如：持咒、抄經、禪修..." />
            {errors.category && <p className="mt-1 text-xs text-rose-500">{errors.category.message}</p>}
          </div>
          <div>
            <label className="block text-xs text-slate-500">顏色</label>
            <input type="color" className="h-10 w-full cursor-pointer rounded-lg border border-slate-200" {...register("color")} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("allowReminder")} defaultChecked /> 啟用提醒
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("includeInDashboard")} defaultChecked /> 顯示在儀表板
          </label>
          <button
            type="submit"
            className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white shadow hover:bg-primary/90"
          >
            新增功課
          </button>
        </form>
      </aside>
    </div>
  );
}

export default TasksPage;
