import { useMemo, useState } from "react";
import dayjs from "dayjs";
import { usePracticeStore } from "../store/practiceStore";

function RecordsPage() {
  const tasks = usePracticeStore((s) => s.tasks);
  const records = usePracticeStore((s) => s.records);
  const addDailyRecord = usePracticeStore((s) => s.addDailyRecord);
  const removeDailyRecord = usePracticeStore((s) => s.removeDailyRecord);

  const [taskId, setTaskId] = useState<string>("");
  const [start, setStart] = useState(dayjs().subtract(30, "day").format("YYYY-MM-DD"));
  const [end, setEnd] = useState(dayjs().format("YYYY-MM-DD"));

  const filtered = useMemo(() => {
    const id = taskId || tasks[0]?.id || "";
    return records
      .filter((r) => (!id || r.taskId === id) && r.date >= start && r.date <= end)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [records, taskId, start, end, tasks]);

  async function handleEdit(r: { taskId: string; date: string; count: number; note?: string }) {
    const value = window.prompt("輸入數量", String(r.count));
    if (value === null) return;
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return alert("請輸入數字");
    await addDailyRecord({ taskId: r.taskId, date: r.date, count: Math.max(0, parsed), note: r.note });
  }

  async function handleDelete(r: { taskId: string; date: string }) {
    const ok = window.confirm(`確定刪除 ${r.date} 的紀錄？`);
    if (!ok) return;
    await removeDailyRecord(r.taskId, r.date);
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-xs text-slate-500">功課</label>
            <select className="w-full rounded-lg border border-slate-200 px-3 py-2" value={taskId} onChange={(e) => setTaskId(e.target.value)}>
              <option value="">（全部）</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500">起</label>
            <input className="w-full rounded-lg border border-slate-200 px-3 py-2" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-slate-500">迄</label>
            <input className="w-full rounded-lg border border-slate-200 px-3 py-2" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        {filtered.length === 0 ? (
          <p className="text-sm text-slate-500">區間內無紀錄。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="px-2 py-2">日期</th>
                  <th className="px-2 py-2">功課</th>
                  <th className="px-2 py-2">數量</th>
                  <th className="px-2 py-2">備註</th>
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
                      <td className="px-2 py-2">{r.note ?? ""}</td>
                      <td className="px-2 py-2">
                        <div className="flex gap-2">
                          <button className="rounded border border-slate-200 px-2 py-1" onClick={() => handleEdit(r)}>編輯</button>
                          <button className="rounded border border-rose-200 px-2 py-1 text-rose-600" onClick={() => handleDelete(r)}>刪除</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default RecordsPage;

