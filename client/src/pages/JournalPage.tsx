import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import dayjs from "dayjs";
import { FiPlusCircle, FiBookmark, FiTrash2, FiEdit2 } from "react-icons/fi";
import clsx from "clsx";
import { usePracticeStore } from "../store/practiceStore";

const journalSchema = z.object({
  date: z.string(),
  content: z.string().min(1, "內容不可空白"),
  mood: z.enum(["peaceful", "joyful", "tired", "grateful", "custom"]).optional(),
  tags: z.string().optional(),
  pin: z.boolean()
});

type JournalFormValues = z.infer<typeof journalSchema>;

const moodLabel: Record<NonNullable<JournalFormValues["mood"]>, string> = {
  peaceful: "平靜",
  joyful: "喜悅",
  tired: "疲憊",
  grateful: "感恩",
  custom: "自訂"
};

function JournalPage() {
  const journalEntries = usePracticeStore((state) =>
    [...state.journalEntries].sort((a, b) => {
      if (a.pin && !b.pin) return -1;
      if (!a.pin && b.pin) return 1;
      return b.date.localeCompare(a.date);
    })
  );
  const journalTemplates = usePracticeStore((state) => state.journalTemplates);
  const addJournalEntry = usePracticeStore((state) => state.addJournalEntry);
  const updateJournalEntry = usePracticeStore((state) => state.updateJournalEntry);
  const removeJournalEntry = usePracticeStore((state) => state.removeJournalEntry);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(journalTemplates[0]?.id ?? null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors }
  } = useForm<JournalFormValues>({
    resolver: zodResolver(journalSchema),
    defaultValues: {
      date: dayjs().format("YYYY-MM-DD"),
      content: "",
      mood: "peaceful",
      tags: "",
      pin: false
    }
  });

  const filteredEntries = useMemo(() => {
    if (!search) return journalEntries;
    const keyword = search.toLowerCase();
    return journalEntries.filter((entry) =>
      entry.content.toLowerCase().includes(keyword) || entry.tags.some((tag) => tag.toLowerCase().includes(keyword))
    );
  }, [journalEntries, search]);

  function applyTemplate(templateId: string) {
    setSelectedTemplate(templateId);
    const template = journalTemplates.find((item) => item.id === templateId);
    if (!template) return;
    const scaffold = template.fields.map((field) => `${field.label}：`).join("\n\n");
    setValue("content", scaffold);
  }

  async function onSubmit(values: JournalFormValues) {
    const tags = values.tags ? values.tags.split(",").map((tag) => tag.trim()).filter(Boolean) : [];
    await addJournalEntry({
      date: values.date,
      content: values.content,
      mood: values.mood,
      tags,
      pin: values.pin,
      attachments: []
    });
    reset();
    setShowForm(false);
  }

  function startEdit(entryId: string) {
    const entry = journalEntries.find((item) => item.id === entryId);
    if (!entry) return;
    setEditingId(entryId);
    reset({
      date: entry.date,
      content: entry.content,
      mood: entry.mood,
      tags: entry.tags.join(","),
      pin: entry.pin
    });
    setShowForm(true);
  }

  async function handleSaveEdit(entryId: string, values: JournalFormValues) {
    const tags = values.tags ? values.tags.split(",").map((tag) => tag.trim()).filter(Boolean) : [];
    await updateJournalEntry(entryId, {
      date: values.date,
      content: values.content,
      mood: values.mood,
      tags,
      pin: values.pin
    });
    setEditingId(null);
    reset();
    setShowForm(false);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">修行記事</h2>
            <p className="text-sm text-slate-500">記錄每日心得、感恩與提醒</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="搜尋內容或標籤"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-primary px-3 py-2 text-sm font-semibold text-primary"
              onClick={() => {
                reset();
                setEditingId(null);
                setShowForm((prev) => !prev);
              }}
            >
              <FiPlusCircle /> {showForm ? "取消" : "新增記事"}
            </button>
          </div>
        </div>
      </section>

      {showForm && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h3 className="text-lg font-semibold">{editingId ? "編輯記事" : "新增記事"}</h3>
          <form
            className="mt-4 grid gap-4 sm:grid-cols-2"
            onSubmit={handleSubmit((values) => (editingId ? handleSaveEdit(editingId, values) : onSubmit(values)))}
          >
            <div>
              <label className="block text-xs text-slate-500">日期</label>
              <input type="date" className="w-full rounded-lg border border-slate-200 px-3 py-2" {...register("date")} />
            </div>
            <div>
              <label className="block text-xs text-slate-500">心情</label>
              <select className="w-full rounded-lg border border-slate-200 px-3 py-2" {...register("mood")}>
                {Object.entries(moodLabel).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-slate-500">文章內容</label>
              <textarea
                rows={6}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
                placeholder="輸入今日心得"
                {...register("content")}
              />
              {errors.content && <p className="mt-1 text-xs text-rose-500">{errors.content.message}</p>}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-slate-500">標籤（以逗號分隔）</label>
              <input className="w-full rounded-lg border border-slate-200 px-3 py-2" {...register("tags")} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register("pin")} /> 置頂顯示
            </label>
            <div className="sm:col-span-2">
              <label className="block text-xs text-slate-500">套用模板</label>
              <div className="flex flex-wrap gap-2">
                {journalTemplates.map((template) => (
                  <button
                    type="button"
                    key={template.id}
                    className={clsx(
                      "rounded-lg border px-3 py-1 text-sm",
                      selectedTemplate === template.id ? "border-primary text-primary" : "border-slate-200 text-slate-600"
                    )}
                    onClick={() => applyTemplate(template.id)}
                  >
                    {template.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2 flex justify-end gap-3">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600"
                onClick={() => {
                  reset();
                  setEditingId(null);
                  setShowForm(false);
                }}
              >
                取消
              </button>
              <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">
                {editingId ? "保存變更" : "新增記事"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="space-y-4">
        {filteredEntries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
            找不到符合的記事。
          </div>
        ) : (
          filteredEntries.map((entry) => (
            <article key={entry.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <header className="mb-3 flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500">{dayjs(entry.date).format("YYYY 年 MM 月 DD 日 dddd")}</p>
                  {entry.tags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-primary">
                      {entry.tags.map((tag) => (
                        <span key={`${entry.id}-${tag}`} className="rounded-full bg-primary/10 px-2 py-0.5">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  {entry.pin && (
                    <span className="inline-flex items-center gap-1 text-primary">
                      <FiBookmark /> 置頂
                    </span>
                  )}
                  {entry.mood && <span>{moodLabel[entry.mood]}</span>}
                  <button
                    type="button"
                    className="rounded-full border border-slate-200 p-2 text-slate-500 hover:border-primary hover:text-primary"
                    onClick={() => startEdit(entry.id)}
                    aria-label="編輯"
                  >
                    <FiEdit2 />
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-slate-200 p-2 text-slate-500 hover:border-primary hover:text-primary"
                    onClick={() => updateJournalEntry(entry.id, { pin: !entry.pin })}
                  >
                    {entry.pin ? "取消置頂" : "設為置頂"}
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-rose-200 p-2 text-rose-500 hover:border-rose-400"
                    onClick={() => removeJournalEntry(entry.id)}
                    aria-label="刪除"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </header>
              <p className="whitespace-pre-line text-slate-700">{entry.content}</p>
            </article>
          ))
        )}
      </section>
    </div>
  );
}

export default JournalPage;
