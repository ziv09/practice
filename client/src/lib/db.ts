import Dexie, { Table } from "dexie";
import type {
  PracticeTask,
  DailyRecord,
  PracticeGoal,
  JournalEntry,
  DashboardWidget,
  AppSettings,
  JournalTemplate
} from "../types";

const DB_VERSION = 1;

export class PracticeDatabase extends Dexie {
  tasks!: Table<PracticeTask, string>;
  records!: Table<DailyRecord, string>;
  goals!: Table<PracticeGoal, string>;
  journal!: Table<JournalEntry, string>;
  widgets!: Table<DashboardWidget, string>;
  templates!: Table<JournalTemplate, string>;
  settings!: Table<AppSettings, string>;

  constructor() {
    super("practice-db");
    this.version(DB_VERSION).stores({
      tasks: "id, order, category, isActive",
      records: "id, date, taskId",
      goals: "id, taskId, endDate",
      journal: "id, date, tags",
      widgets: "id, type",
      templates: "id",
      settings: "&id"
    });
  }
}

export const db = new PracticeDatabase();
