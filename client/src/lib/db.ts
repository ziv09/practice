import Dexie, { Table } from "dexie";
import type {
  PracticeTask,
  DailyRecord,
  PracticeGoal,
  JournalEntry,
  DashboardWidget,
  AppSettings,
  JournalTemplate,
  PendingOperation,
  Category
} from "../types";

const DB_NAME = "practice-db";

export class PracticeDatabase extends Dexie {
  tasks!: Table<PracticeTask, string>;
  records!: Table<DailyRecord, string>;
  goals!: Table<PracticeGoal, string>;
  journal!: Table<JournalEntry, string>;
  widgets!: Table<DashboardWidget, string>;
  templates!: Table<JournalTemplate, string>;
  settings!: Table<AppSettings, string>;
  operations!: Table<PendingOperation, string>;
  categories!: Table<Category, string>;
  sheets!: Table<any, string>;
  sheetOps!: Table<any, string>;

  constructor() {
    super(DB_NAME);
    this.version(1).stores({
      tasks: "id, order, category, isActive",
      records: "id, date, taskId",
      goals: "id, taskId, endDate",
      journal: "id, date, tags",
      widgets: "id, type",
      templates: "id",
      settings: "&id"
    });

    this.version(2)
      .stores({
        tasks: "id, order, category, isActive",
        records: "id, date, taskId",
        goals: "id, taskId, endDate",
        journal: "id, date, tags",
        widgets: "id, type",
        templates: "id",
        settings: "&id",
        operations: "id, type, createdAt"
      })
      .upgrade(async (trans) => {
        await trans.table("operations").clear();
      });

    this.version(3)
      .stores({
        tasks: "id, order, category, isActive",
        records: "id, date, taskId",
        goals: "id, taskId, endDate",
        journal: "id, date, tags",
        widgets: "id, type",
        templates: "id",
        settings: "&id",
        operations: "id, type, createdAt",
        categories: "id, name"
      })
      .upgrade(async (trans) => {
        // no-op for now
      });

    this.version(4)
      .stores({
        tasks: "id, order, category, isActive",
        records: "id, date, taskId",
        goals: "id, taskId, endDate",
        journal: "id, date, tags",
        widgets: "id, type",
        templates: "id",
        settings: "&id",
        operations: "id, type, createdAt",
        categories: "id, name",
        sheets: "id, spreadsheetId, title",
        sheetOps: "id, type, createdAt"
      })
      .upgrade(async (_trans) => {
        // initialize new stores
      });
  }
}

export const db = new PracticeDatabase();

