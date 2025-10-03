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
  SyncStatus
} from "../types";
import { buildRecordKey } from "../utils/practice";
import {
  fetchRemoteSnapshot,
  pushPendingOperations,
  upsertRemoteSnapshot
} from "../services/supabaseSync";

const DEFAULT_COLOR_PALETTE = [
  "#0284c7",
  "#ca8a04",
  "#22c55e",
  "#a855f7",
  "#fb7185",
  "#f97316"
];

const SETTINGS_ID = "app-settings";

const defaultSettings: AppSettings = {
  id: SETTINGS_ID,
  appearance: {
    theme: "auto",
    accentColor: "#a855f7",
    cardStyle: "comfortable",
    fontScale: 1
  },
  reminder: {
    enabled: false,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    rules: [],
    pushEndpoint: undefined,
    lastNotificationDate: undefined
  },
  sync: {
    enableSync: false,
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
    name: "Daily Reflection",
    description: "Quickly capture gratitude, insights, and reminders.",
    fields: [
      {
        id: "gratitude",
        label: "Gratitude",
        placeholder: "People or things you are thankful for",
        required: false
      },
      {
        id: "insight",
        label: "Insight",
        placeholder: "Today's key learnings or adjustments",
        required: true
      },
      {
        id: "reminder",
        label: "Reminder",
        placeholder: "Focus points for tomorrow",
        required: false
      }
    ]
  }
];

function createId(prefix: string) {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return `${prefix}-${crypto.randomUUID()}`;
    }
  } catch (error) {
    // ignore runtime errors and fall back to nanoid
  }
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
  settings: AppSettings;
  pendingOperations: PendingOperation[];
  loadInitialData: () => Promise<void>;
  setUser: (userId: string | null, opts?: { forceReload?: boolean }) => Promise<void>;
  syncNow: (options?: { push?: boolean; pull?: boolean }) => Promise<void>;
  addTask: (input: Omit<PracticeTask, "id"> & { id?: string }) => Promise<string>;
  updateTask: (id: string, update: Partial<PracticeTask>) => Promise<void>;
  reorderTasks: (ids: string[]) => Promise<void>;
  addDailyRecord: (input: Omit<DailyRecord, "id" | "lastModified">) => Promise<void>;
  bulkUpsertDailyRecords: (records: Omit<DailyRecord, "lastModified">[]) => Promise<void>;
  addGoal: (input: Omit<PracticeGoal, "id" | "createdAt"> & { id?: string }) => Promise<string>;
  updateGoal: (id: string, update: Partial<PracticeGoal>) => Promise<void>;
  removeGoal: (id: string) => Promise<void>;
  addJournalEntry: (input: Omit<JournalEntry, "id" | "createdAt" | "updatedAt"> & { id?: string }) => Promise<string>;
  updateJournalEntry: (id: string, update: Partial<JournalEntry>) => Promise<void>;
  removeJournalEntry: (id: string) => Promise<void>;
  setWidgets: (widgets: DashboardWidget[]) => Promise<void>;
  updateSettings: (update: Partial<AppSettings>) => Promise<void>;
  updateReminderRules: (rules: ReminderRule[]) => Promise<void>;
  exportSnapshot: () => Promise<PracticeStateSnapshot>;
  importSnapshot: (snapshot: PracticeStateSnapshot) => Promise<void>;
};

export const usePracticeStore = create<PracticeStore>()(
  devtools((set, get) => {
    const registerOperation = async (type: PendingOperationType, payload: unknown) => {
      const state = get();
      if (!state.settings.sync.enableSync || !state.userId) {
        return;
      }

      const operation: PendingOperation = {
        id: createId("op"),
        userId: state.userId,
        type,
        payload,
        createdAt: nowIso()
      };
      await db.operations.put(operation);
      set({ pendingOperations: [...state.pendingOperations, operation] });
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
      settings: defaultSettings,
      pendingOperations: [],
      async loadInitialData() {
        const [
          tasks,
          records,
          goals,
          journalEntries,
          widgets,
          templates,
          settings,
          operations
        ] = await Promise.all([
          db.tasks.orderBy("order").toArray(),
          db.records.toArray(),
          db.goals.toArray(),
          db.journal.toArray(),
          db.widgets.toArray(),
          db.templates.toArray(),
          db.settings.get(SETTINGS_ID),
          db.operations.toArray()
        ]);

        const shouldSeedTemplates = templates.length === 0;
        if (shouldSeedTemplates) {
          await db.templates.bulkPut(seededJournalTemplates);
        }

        const persistedSettings = settings ?? defaultSettings;
        if (!settings) {
          await db.settings.put(persistedSettings);
        }

        set({
          ready: true,
          tasks,
          records,
          goals,
          journalEntries,
          widgets,
          journalTemplates: shouldSeedTemplates ? seededJournalTemplates : templates,
          settings: persistedSettings,
          pendingOperations: operations
        });
      },
      async setUser(userId, opts) {
        if (!get().ready) {
          await get().loadInitialData();
        }
        set({ userId });
        if (!userId || !get().settings.sync.enableSync) {
          return;
        }
        if (opts?.forceReload || !get().settings.sync.lastSyncedAt) {
          await get().syncNow({ push: false, pull: true });
        }
      },
      async syncNow(options) {
        const { userId, pendingOperations } = get();
        if (!userId || !get().settings.sync.enableSync) {
          return;
        }

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
              const localSnapshot = await get().exportSnapshot();
              await upsertRemoteSnapshot(userId, localSnapshot);
            }
          } else if (config.push) {
            const localSnapshot = await get().exportSnapshot();
            await upsertRemoteSnapshot(userId, localSnapshot);
          }

          const timestamp = nowIso();
          const current = get().settings;
          const nextSettings: AppSettings = {
            ...current,
            sync: { ...current.sync, lastSyncedAt: timestamp, lastError: undefined }
          };
          await db.settings.put(nextSettings);
          set({ settings: nextSettings, syncStatus: "idle" });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const current = get().settings;
          const nextSettings: AppSettings = {
            ...current,
            sync: { ...current.sync, lastError: message }
          };
          await db.settings.put(nextSettings);
          set({ syncStatus: "error", syncError: message, settings: nextSettings });
        }
      },
      async addTask(input) {
        const id = input.id ?? createId("task");
        const color =
          input.color ?? DEFAULT_COLOR_PALETTE[Math.floor(Math.random() * DEFAULT_COLOR_PALETTE.length)];
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
        return id;
      },
      async updateTask(id, update) {
        await db.tasks.update(id, update);
        set({ tasks: get().tasks.map((task) => (task.id === id ? { ...task, ...update } : task)) });
        const task = get().tasks.find((item) => item.id === id);
        if (task) {
          await registerOperation("task.upsert", task);
        }
      },
      async reorderTasks(ids) {
        const current = get().tasks;
        const updated = ids.map((taskId, index) => ({
          ...(current.find((t) => t.id === taskId) as PracticeTask),
          order: index
        }));
        await db.tasks.bulkPut(updated);
        set({ tasks: updated });
        await registerOperation("task.upsert", updated);
      },
      async addDailyRecord(input) {
        const id = buildRecordKey(input.taskId, input.date);
        const payload: DailyRecord = {
          ...input,
          id,
          lastModified: nowIso()
        };
        await db.records.put(payload);
        const filtered = get().records.filter((record) => record.taskId !== input.taskId || record.date !== input.date);
        set({ records: [...filtered, payload] });
        await registerOperation("record.upsert", payload);
      },
      async bulkUpsertDailyRecords(records) {
        const stamped = records.map((record) => ({
          ...record,
          id: buildRecordKey(record.taskId, record.date),
          lastModified: nowIso()
        }));
        await db.records.bulkPut(stamped);
        const map = new Map<string, DailyRecord>();
        [...get().records, ...stamped].forEach((record) => map.set(buildRecordKey(record.taskId, record.date), record));
        set({ records: Array.from(map.values()) });
        await registerOperation("record.upsert", stamped);
      },
      async addGoal(input) {
        const id = input.id ?? createId("goal");
        const payload: PracticeGoal = {
          ...input,
          id,
          createdAt: nowIso()
        };
        await db.goals.put(payload);
        set({ goals: [...get().goals, payload] });
        await registerOperation("goal.upsert", payload);
        return id;
      },
      async updateGoal(id, update) {
        await db.goals.update(id, update);
        set({ goals: get().goals.map((goal) => (goal.id === id ? { ...goal, ...update } : goal)) });
        const goal = get().goals.find((item) => item.id === id);
        if (goal) {
          await registerOperation("goal.upsert", goal);
        }
      },
      async removeGoal(id) {
        await db.goals.delete(id);
        set({ goals: get().goals.filter((goal) => goal.id !== id) });
        await registerOperation("goal.delete", { id });
      },
      async addJournalEntry(input) {
        const id = input.id ?? createId("journal");
        const now = nowIso();
        const payload: JournalEntry = {
          ...input,
          id,
          createdAt: now,
          updatedAt: now
        };
        await db.journal.put(payload);
        set({ journalEntries: [...get().journalEntries, payload] });
        await registerOperation("journal.upsert", payload);
        return id;
      },
      async updateJournalEntry(id, update) {
        const existing = get().journalEntries.find((item) => item.id === id);
        if (!existing) {
          return;
        }
        const updatedEntry: JournalEntry = { ...existing, ...update, updatedAt: nowIso() };
        await db.journal.put(updatedEntry);
        set({
          journalEntries: get().journalEntries.map((entry) => (entry.id === id ? updatedEntry : entry))
        });
        await registerOperation("journal.upsert", updatedEntry);
      },
      async removeJournalEntry(id) {
        await db.journal.delete(id);
        set({ journalEntries: get().journalEntries.filter((entry) => entry.id !== id) });
        await registerOperation("journal.delete", { id });
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
        if (nextSettings.sync.enableSync && get().userId) {
          await get().syncNow();
        }
      },
      async updateReminderRules(rules) {
        const current = get().settings;
        const nextSettings: AppSettings = {
          ...current,
          reminder: { ...current.reminder, rules },
          id: SETTINGS_ID
        };
        await db.settings.put(nextSettings);
        set({ settings: nextSettings });
        await registerOperation("settings.update", nextSettings);
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
            async () => {
              await Promise.all([
                db.tasks.clear(),
                db.records.clear(),
                db.goals.clear(),
                db.journal.clear(),
                db.widgets.clear(),
                db.templates.clear(),
                db.settings.clear()
              ]);
              await Promise.all([
                db.tasks.bulkPut(snapshot.tasks),
                db.records.bulkPut(snapshot.records),
                db.goals.bulkPut(snapshot.goals),
                db.journal.bulkPut(snapshot.journalEntries),
                db.widgets.bulkPut(snapshot.widgets),
                db.templates.bulkPut(snapshot.journalTemplates),
                db.settings.put({ ...snapshot.settings, id: SETTINGS_ID })
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
          settings: { ...snapshot.settings, id: SETTINGS_ID }
        });
      }
    };
  }, { name: "practice-store" })
);
