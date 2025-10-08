import Dexie from "dexie";
import { create } from "zustand";
import { nanoid } from "nanoid";
import { devtools } from "zustand/middleware";
import { db } from "../lib/db";
import type {
  AppSettings,
  DailyRecord,
  DashboardWidget,
  JournalEntry,
  JournalTemplate,
  PendingOperation,
  PendingOperationType,
  PracticeGoal,
  PracticeTask,
  PracticeStateSnapshot,
  ReminderRule,
  SyncStatus,
  Category
} from "../types";
import { buildRecordKey } from "../utils/practice";
import type { SheetOperationType } from "../types";
import { fetchRemoteSnapshot, pushPendingOperations, upsertRemoteSnapshot } from "../services/supabaseSync";
import { supabase } from "../lib/supabaseClient";

const DEFAULT_COLOR_PALETTE = ["#0284c7", "#ca8a04", "#22c55e", "#a855f7", "#fb7185", "#f97316"];
const SETTINGS_ID = "app-settings";

const defaultSettings: AppSettings = {
  id: SETTINGS_ID,
  appearance: { theme: "auto", accentColor: "#a855f7", cardStyle: "comfortable", fontScale: 1 },
  reminder: {
    enabled: false,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    rules: [],
    pushEndpoint: undefined,
    lastNotificationDate: undefined
  },
  sync: {
    enableSync: true,
    includeJournal: false,
    range: "90d",
    strategy: "single-sheet",
    template: "Practice-{date}",
    lastError: undefined,
    lastSyncedAt: undefined
  },
  onboardingCompleted: false
};

const seededJournalTemplates: JournalTemplate[] = [
  {
    id: "template-default",
    name: "預設",
    description: "記錄感恩、洞見與提醒",
    fields: [
      { id: "gratitude", label: "感恩", placeholder: "感謝的人事物", required: false },
      { id: "insight", label: "洞見", placeholder: "今日所學或發現", required: true },
      { id: "reminder", label: "提醒", placeholder: "給明天的提示", required: false }
    ]
  }
];

function createId(prefix: string) {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return `${prefix}-${crypto.randomUUID()}`;
    }
  } catch {}
  return `${prefix}-${nanoid()}`;
}

function nowIso() {
  return new Date().toISOString();
}

type PracticeStore = {
  ready: boolean;
  userId: string | null;
  syncStatus: SyncStatus;
  syncError?: string;
  tasks: PracticeTask[];
  records: DailyRecord[];
  goals: PracticeGoal[];
  journalEntries: JournalEntry[];
  widgets: DashboardWidget[];
  journalTemplates: JournalTemplate[];
  categories: Category[];
  settings: AppSettings;
  pendingOperations: PendingOperation[];
  loadInitialData: () => Promise<void>;
  setUser: (userId: string | null, opts?: { forceReload?: boolean }) => Promise<void>;
  syncNow: (options?: { push?: boolean; pull?: boolean }) => Promise<void>;
  addTask: (input: Omit<PracticeTask, "id"> & { id?: string }) => Promise<string>;
  updateTask: (id: string, update: Partial<PracticeTask>) => Promise<void>;
  reorderTasks: (ids: string[]) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
  addDailyRecord: (input: Omit<DailyRecord, "id" | "lastModified">) => Promise<void>;
  removeDailyRecord: (taskId: string, date: string) => Promise<void>;
  bulkUpsertDailyRecords: (records: Omit<DailyRecord, "lastModified">[]) => Promise<void>;
  addGoal: (input: Omit<PracticeGoal, "id" | "createdAt"> & { id?: string }) => Promise<string>;
  updateGoal: (id: string, update: Partial<PracticeGoal>) => Promise<void>;
  removeGoal: (id: string) => Promise<void>;
  addJournalEntry: (
    input: Omit<JournalEntry, "id" | "createdAt" | "updatedAt"> & { id?: string }
  ) => Promise<string>;
  updateJournalEntry: (id: string, update: Partial<JournalEntry>) => Promise<void>;
  removeJournalEntry: (id: string) => Promise<void>;
  setWidgets: (widgets: DashboardWidget[]) => Promise<void>;
  updateSettings: (update: Partial<AppSettings>) => Promise<void>;
  updateReminderRules: (rules: ReminderRule[]) => Promise<void>;
  addCategory: (name: string) => Promise<string>;
  removeCategory: (id: string) => Promise<void>;
  exportSnapshot: () => Promise<PracticeStateSnapshot>;
  importSnapshot: (snapshot: PracticeStateSnapshot) => Promise<void>;
};

export const usePracticeStore = create<PracticeStore>()(
  devtools((set, get) => {
    let syncTimer: number | undefined;
    let sheetTimer: number | undefined;
    const scheduleBackgroundSync = () => {
      // debounce 1.5s
      if (typeof window !== "undefined") {
        if (syncTimer) window.clearTimeout(syncTimer);
        syncTimer = window.setTimeout(() => {
          void get().syncNow({ push: true, pull: false });
        }, 1500);
      }
    };

    const scheduleSheetSync = () => {
      if (typeof window !== "undefined") {
        if (sheetTimer) window.clearTimeout(sheetTimer);
        sheetTimer = window.setTimeout(() => {
          window.dispatchEvent(new Event("sheet-sync-request"));
        }, 1200);
      }
    };

    const registerOperation = async (type: PendingOperationType, payload: unknown) => {
      const state = get();
      if (!state.userId) return;
      const operation: PendingOperation = {
        id: createId("op"),
        userId: state.userId,
        type,
        payload,
        createdAt: nowIso()
      };
      await db.operations.put(operation);
      set({ pendingOperations: [...state.pendingOperations, operation] });
      scheduleBackgroundSync();
    };

    const registerSheetOperation = async (type: SheetOperationType, payload: unknown) => {
      const op = {
        id: createId("shop"),
        type,
        payload,
        createdAt: nowIso()
      };
      await db.sheetOps.put(op as any);
      scheduleSheetSync();
    };

    return {
      ready: false,
      userId: null,
      syncStatus: "idle",
      syncError: undefined,
      tasks: [],
      records: [],
      goals: [],
      journalEntries: [],
      widgets: [],
      journalTemplates: [],
      categories: [],
      settings: defaultSettings,
      pendingOperations: [],
      async loadInitialData() {
        try {
          const [tasks, records, goals, journalEntries, widgets, templates, settings, operations, categories] =
            await Promise.all([
              db.tasks.orderBy("order").toArray(),
              db.records.toArray(),
              db.goals.toArray(),
              db.journal.toArray(),
              db.widgets.toArray(),
              db.templates.toArray(),
              db.settings.get(SETTINGS_ID),
              db.operations.toArray(),
              db.categories.toArray()
            ]);

          const shouldSeedTemplates = templates.length === 0;
          if (shouldSeedTemplates) await db.templates.bulkPut(seededJournalTemplates);
          const persistedSettings = settings ?? defaultSettings;
          if (!settings) await db.settings.put(persistedSettings);

          set({
            ready: true,
            tasks,
            records,
            goals,
            journalEntries,
            widgets,
            journalTemplates: shouldSeedTemplates ? seededJournalTemplates : templates,
            categories,
            settings: persistedSettings,
            pendingOperations: operations
          });
        } catch (e) {
          // Fallback to empty in-memory state to avoid blocking the UI
          console.error("loadInitialData failed", e);
          set({
            ready: true,
            tasks: [],
            records: [],
            goals: [],
            journalEntries: [],
            widgets: [],
            journalTemplates: seededJournalTemplates,
            categories: [],
            settings: defaultSettings,
            pendingOperations: []
          });
        }
      },
      async setUser(userId, opts) {
        if (!get().ready) await get().loadInitialData();
        set({ userId });
        if (!userId) return;
        if (opts?.forceReload || !get().settings.sync.lastSyncedAt) {
          await get().syncNow({ push: false, pull: true });
        }
      },
      async syncNow(options) {
        const { userId, pendingOperations } = get();
        if (!userId) return;

        const config = { push: true, pull: true, ...options };
        set({ syncStatus: "syncing", syncError: undefined });
        try {
          if (config.push && pendingOperations.length > 0) {
            await pushPendingOperations(userId, pendingOperations);
            await db.operations.clear();
            set({ pendingOperations: [] });
          }
          if (config.pull) {
            const remote = await fetchRemoteSnapshot(userId);
            if (remote?.snapshot) {
              await get().importSnapshot(remote.snapshot);
            } else {
              if (supabase) {
                const localSnapshot = await get().exportSnapshot();
                await upsertRemoteSnapshot(userId, localSnapshot);
              }
            }
          } else if (config.push) {
            if (supabase) {
              const localSnapshot = await get().exportSnapshot();
              await upsertRemoteSnapshot(userId, localSnapshot);
            }
          }

          if (supabase) {
            const timestamp = nowIso();
            const current = get().settings;
            const nextSettings: AppSettings = { ...current, sync: { ...current.sync, lastSyncedAt: timestamp, lastError: undefined } };
            await db.settings.put(nextSettings);
            set({ settings: nextSettings, syncStatus: "idle" });
          } else {
            set({ syncStatus: "idle" });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const current = get().settings;
          const nextSettings: AppSettings = { ...current, sync: { ...current.sync, lastError: message } };
          await db.settings.put(nextSettings);
          set({ syncStatus: "error", syncError: message, settings: nextSettings });
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("app-toast", { detail: { type: "error", message: `同步失敗：${message}` } }));
          }
        }
      },
      async addTask(input) {
        const id = input.id ?? createId("task");
        const color = input.color ?? DEFAULT_COLOR_PALETTE[Math.floor(Math.random() * DEFAULT_COLOR_PALETTE.length)];
        const payload: PracticeTask = {
          order: get().tasks.length,
          allowReminder: true,
          includeInDashboard: true,
          isActive: true,
          ...input,
          color,
          id
        };
        await db.tasks.put(payload);
        set({ tasks: [...get().tasks, payload] });
        await registerOperation("task.upsert", payload);
        await registerSheetOperation("task.upsert", payload);
        return id;
      },
      async updateTask(id, update) {
        await db.tasks.update(id, update);
        set({ tasks: get().tasks.map((task) => (task.id === id ? { ...task, ...update } : task)) });
        const task = get().tasks.find((item) => item.id === id);
        if (task) {
          await registerOperation("task.upsert", task);
          await registerSheetOperation("task.upsert", task);
        }
      },
      async reorderTasks(ids) {
        const current = get().tasks;
        const updated = ids.map((taskId, index) => ({ ...(current.find((t) => t.id === taskId) as PracticeTask), order: index }));
        await db.tasks.bulkPut(updated);
        set({ tasks: updated });
        await registerOperation("task.upsert", updated);
      },
      async removeTask(id) {
        await db.transaction("rw", db.tasks, db.records, db.goals, async () => {
          await db.records.where({ taskId: id }).delete();
          await db.goals.where({ taskId: id }).delete();
          await db.tasks.delete(id);
        });
        set({
          tasks: get().tasks.filter((t) => t.id !== id),
          records: get().records.filter((r) => r.taskId !== id),
          goals: get().goals.filter((g) => g.taskId !== id)
        });
        await registerOperation("task.delete", { id });
        await get().syncNow({ push: true, pull: false });
        await registerSheetOperation("task.delete", { id });
      },
      async addDailyRecord(input) {
        const id = buildRecordKey(input.taskId, input.date);
        const payload: DailyRecord = { ...input, id, lastModified: nowIso() };
        await db.records.put(payload);
        const filtered = get().records.filter((record) => record.taskId !== input.taskId || record.date !== input.date);
        set({ records: [...filtered, payload] });
        await registerOperation("record.upsert", payload);
        await registerSheetOperation("record.upsert", payload);
      },
      async removeDailyRecord(taskId, date) {
        const id = buildRecordKey(taskId, date);
        await db.records.delete(id);
        set({ records: get().records.filter((r) => !(r.taskId === taskId && r.date === date)) });
        await registerOperation("record.delete", { id, taskId, date });
        await registerSheetOperation("record.delete", { id, taskId, date });
        await get().syncNow({ push: true, pull: false });
      },
      async bulkUpsertDailyRecords(records) {
        const stamped = records.map((record) => ({ ...record, id: buildRecordKey(record.taskId, record.date), lastModified: nowIso() }));
        await db.records.bulkPut(stamped);
        const map = new Map<string, DailyRecord>();
        [...get().records, ...stamped].forEach((record) => map.set(buildRecordKey(record.taskId, record.date), record));
        set({ records: Array.from(map.values()) });
        await registerOperation("record.upsert", stamped);
        await registerSheetOperation("record.upsert", stamped);
      },
      async addGoal(input) {
        const id = input.id ?? createId("goal");
        const payload: PracticeGoal = { ...input, id, createdAt: nowIso() };
        await db.goals.put(payload);
        set({ goals: [...get().goals, payload] });
        await registerOperation("goal.upsert", payload);
        return id;
      },
      async updateGoal(id, update) {
        await db.goals.update(id, update);
        set({ goals: get().goals.map((goal) => (goal.id === id ? { ...goal, ...update } : goal)) });
        const goal = get().goals.find((item) => item.id === id);
        if (goal) await registerOperation("goal.upsert", goal);
      },
      async removeGoal(id) {
        await db.goals.delete(id);
        set({ goals: get().goals.filter((goal) => goal.id !== id) });
        await registerOperation("goal.delete", { id });
        await get().syncNow({ push: true, pull: false });
      },
      async addJournalEntry(input) {
        const id = input.id ?? createId("journal");
        const now = nowIso();
        const payload: JournalEntry = { ...input, id, createdAt: now, updatedAt: now };
        await db.journal.put(payload);
        set({ journalEntries: [...get().journalEntries, payload] });
        await registerOperation("journal.upsert", payload);
        return id;
      },
      async updateJournalEntry(id, update) {
        const existing = get().journalEntries.find((item) => item.id === id);
        if (!existing) return;
        const updatedEntry: JournalEntry = { ...existing, ...update, updatedAt: nowIso() };
        await db.journal.put(updatedEntry);
        set({ journalEntries: get().journalEntries.map((entry) => (entry.id === id ? updatedEntry : entry)) });
        await registerOperation("journal.upsert", updatedEntry);
      },
      async removeJournalEntry(id) {
        await db.journal.delete(id);
        set({ journalEntries: get().journalEntries.filter((entry) => entry.id !== id) });
        await registerOperation("journal.delete", { id });
        await get().syncNow({ push: true, pull: false });
      },
      async setWidgets(widgets) {
        await db.widgets.clear();
        await db.widgets.bulkPut(widgets);
        set({ widgets });
        await registerOperation("widget.upsert", widgets);
      },
      async updateSettings(update) {
        const current = get().settings;
        const nextSettings: AppSettings = {
          ...current,
          ...update,
          appearance: { ...current.appearance, ...(update?.appearance ?? {}) },
          reminder: { ...current.reminder, ...(update?.reminder ?? {}) },
          sync: { ...current.sync, ...(update?.sync ?? {}) },
          id: SETTINGS_ID
        };
        await db.settings.put(nextSettings);
        set({ settings: nextSettings });
        await registerOperation("settings.update", nextSettings);
        if (get().userId) {
          await get().syncNow();
        }
      },
      async updateReminderRules(rules) {
        const current = get().settings;
        const nextSettings: AppSettings = { ...current, reminder: { ...current.reminder, rules }, id: SETTINGS_ID } as AppSettings;
        await db.settings.put(nextSettings);
        set({ settings: nextSettings });
        await registerOperation("settings.update", nextSettings);
      },
      async addCategory(name) {
        const id = createId("cat");
        const item: Category = { id, name, createdAt: nowIso() };
        await db.categories.put(item);
        set({ categories: [...get().categories, item] });
        return id;
      },
      async removeCategory(id) {
        const categories = get().categories.filter((c) => c.id !== id);
        await db.categories.delete(id);
        const removed = get().categories.find((c) => c.id === id);
        if (removed) {
          const affected = get().tasks
            .filter((t) => t.category === removed.name)
            .map((t) => ({ ...t, category: "" }));
          if (affected.length) {
            await db.tasks.bulkPut(affected as any);
            set({ tasks: get().tasks.map((t) => (t.category === removed.name ? { ...t, category: "" } : t)) });
          }
        }
        set({ categories });
      },
      async exportSnapshot() {
        const state: PracticeStateSnapshot = {
          tasks: await db.tasks.toArray(),
          records: await db.records.toArray(),
          goals: await db.goals.toArray(),
          journalEntries: await db.journal.toArray(),
          widgets: await db.widgets.toArray(),
          journalTemplates: await db.templates.toArray(),
          settings: (await db.settings.get(SETTINGS_ID)) ?? defaultSettings,
          categories: await db.categories.toArray(),
          version: 1
        };
        return state;
      },
      async importSnapshot(snapshot) {
        await Dexie.waitFor(
          db.transaction(
            "rw",
            db.tasks,
            db.records,
            db.goals,
            db.journal,
            db.widgets,
            db.templates,
            db.settings,
            db.categories,
            async () => {
              await Promise.all([
                db.tasks.clear(),
                db.records.clear(),
                db.goals.clear(),
                db.journal.clear(),
                db.widgets.clear(),
                db.templates.clear(),
                db.settings.clear(),
                db.categories.clear()
              ]);
              await Promise.all([
                db.tasks.bulkPut(snapshot.tasks),
                db.records.bulkPut(snapshot.records),
                db.goals.bulkPut(snapshot.goals),
                db.journal.bulkPut(snapshot.journalEntries),
                db.widgets.bulkPut(snapshot.widgets),
                db.templates.bulkPut(snapshot.journalTemplates),
                db.settings.put({ ...snapshot.settings, id: SETTINGS_ID }),
                db.categories.bulkPut(snapshot.categories ?? [])
              ]);
            }
          )
        );
        set({
          tasks: snapshot.tasks,
          records: snapshot.records,
          goals: snapshot.goals,
          journalEntries: snapshot.journalEntries,
          widgets: snapshot.widgets,
          journalTemplates: snapshot.journalTemplates,
          settings: { ...snapshot.settings, id: SETTINGS_ID },
          categories: snapshot.categories ?? []
        });
      }
    };
  }, { name: "practice-store" })
);
