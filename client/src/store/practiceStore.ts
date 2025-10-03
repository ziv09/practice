import Dexie from "dexie";
import { create } from "zustand";
import { nanoid } from "nanoid";
import { devtools } from "zustand/middleware";
import dayjs from "dayjs";
import { db } from "../lib/db";
import type {
  AppSettings,
  DailyRecord,
  DashboardWidget,
  JournalEntry,
  JournalTemplate,
  PracticeGoal,
  PracticeTask,
  PracticeStateSnapshot,
  ReminderRule
} from "../types";
import { buildRecordKey } from "../utils/practice";

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
    name: "每日省思",
    description: "快速記錄今日心得、感恩與提醒",
    fields: [
      {
        id: "gratitude",
        label: "感恩",
        placeholder: "感謝的人事物",
        required: false
      },
      {
        id: "insight",
        label: "心得",
        placeholder: "今日修行的收穫或調整",
        required: true
      },
      {
        id: "reminder",
        label: "提醒",
        placeholder: "明日可優化的重點",
        required: false
      }
    ]
  }
];

function createId(prefix: string) {
  try {
    return `${prefix}-${crypto.randomUUID()}`;
  } catch (error) {
    return `${prefix}-${nanoid()}`;
  }
}

type PracticeStore = {
  ready: boolean;
  tasks: PracticeTask[];
  records: DailyRecord[];
  goals: PracticeGoal[];
  journalEntries: JournalEntry[];
  widgets: DashboardWidget[];
  journalTemplates: JournalTemplate[];
  settings: AppSettings;
  loadInitialData: () => Promise<void>;
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

function withDevtools<T extends PracticeStore>(initializer: (set: any, get: any) => T) {
  return devtools(initializer, { name: "practice-store" });
}

export const usePracticeStore = create<PracticeStore>()(
  withDevtools((set, get) => ({
    ready: false,
    tasks: [],
    records: [],
    goals: [],
    journalEntries: [],
    widgets: [],
    journalTemplates: [],
    settings: defaultSettings,
    async loadInitialData() {
      const [tasks, records, goals, journalEntries, widgets, templates, settings] = await Promise.all([
        db.tasks.orderBy("order").toArray(),
        db.records.toArray(),
        db.goals.toArray(),
        db.journal.toArray(),
        db.widgets.toArray(),
        db.templates.toArray(),
        db.settings.get(SETTINGS_ID)
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
        settings: persistedSettings
      });
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
      return id;
    },
    async updateTask(id, update) {
      await db.tasks.update(id, update);
      set({ tasks: get().tasks.map((task) => (task.id === id ? { ...task, ...update } : task)) });
    },
    async reorderTasks(ids) {
      const current = get().tasks;
      const updated = ids.map((id, index) => ({
        ...(current.find((t) => t.id === id) as PracticeTask),
        order: index
      }));
      await db.tasks.bulkPut(updated);
      set({ tasks: updated });
    },
    async addDailyRecord(input) {
      const id = buildRecordKey(input.taskId, input.date);
      const payload: DailyRecord = {
        ...input,
        id,
        lastModified: dayjs().toISOString()
      };
      await db.records.put(payload);
      const filtered = get().records.filter((record) => record.taskId !== input.taskId || record.date !== input.date);
      set({ records: [...filtered, payload] });
    },
    async bulkUpsertDailyRecords(records) {
      const stamped = records.map((record) => ({
        ...record,
        id: buildRecordKey(record.taskId, record.date),
        lastModified: dayjs().toISOString()
      }));
      await db.records.bulkPut(stamped);
      const map = new Map<string, DailyRecord>();
      [...get().records, ...stamped].forEach((record) => map.set(buildRecordKey(record.taskId, record.date), record));
      set({ records: Array.from(map.values()) });
    },
    async addGoal(input) {
      const id = input.id ?? createId("goal");
      const payload: PracticeGoal = {
        ...input,
        id,
        createdAt: dayjs().toISOString()
      };
      await db.goals.put(payload);
      set({ goals: [...get().goals, payload] });
      return id;
    },
    async updateGoal(id, update) {
      await db.goals.update(id, update);
      set({ goals: get().goals.map((goal) => (goal.id === id ? { ...goal, ...update } : goal)) });
    },
    async removeGoal(id) {
      await db.goals.delete(id);
      set({ goals: get().goals.filter((goal) => goal.id !== id) });
    },
    async addJournalEntry(input) {
      const id = input.id ?? createId("journal");
      const now = dayjs().toISOString();
      const payload: JournalEntry = {
        ...input,
        id,
        createdAt: now,
        updatedAt: now
      };
      await db.journal.put(payload);
      set({ journalEntries: [...get().journalEntries, payload] });
      return id;
    },
    async updateJournalEntry(id, update) {
      const now = dayjs().toISOString();
      await db.journal.update(id, { ...update, updatedAt: now });
      set({
        journalEntries: get().journalEntries.map((entry) =>
          entry.id === id ? { ...entry, ...update, updatedAt: now } : entry
        )
      });
    },
    async removeJournalEntry(id) {
      await db.journal.delete(id);
      set({ journalEntries: get().journalEntries.filter((entry) => entry.id !== id) });
    },
    async setWidgets(widgets) {
      await db.widgets.clear();
      await db.widgets.bulkPut(widgets);
      set({ widgets });
    },
    async updateSettings(update) {
      const nextSettings = { ...get().settings, ...update, id: SETTINGS_ID };
      await db.settings.put(nextSettings);
      set({ settings: nextSettings });
    },
    async updateReminderRules(rules) {
      const nextSettings = {
        ...get().settings,
        reminder: { ...get().settings.reminder, rules },
        id: SETTINGS_ID
      };
      await db.settings.put(nextSettings);
      set({ settings: nextSettings });
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
        db.transaction("rw", db.tasks, db.records, db.goals, db.journal, db.widgets, db.templates, db.settings, async () => {
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
        })
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
  }))
);
