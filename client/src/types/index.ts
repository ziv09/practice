export type UUID = string;

export type PracticeCategory = string;

export type PracticeTask = {
  id: UUID;
  name: string;
  category: PracticeCategory;
  color: string;
  isActive: boolean;
  allowReminder: boolean;
  includeInDashboard: boolean;
  order: number;
};

export type DailyRecord = {
  id: UUID;
  date: string; // ISO date yyyy-MM-dd
  taskId: UUID;
  count: number;
  note?: string;
  lastModified: string; // ISO datetime
};

export type GoalComputationMode = "total" | "daily" | "weighted";

export type PracticeGoal = {
  id: UUID;
  taskId: UUID;
  name: string;
  startDate: string;
  endDate: string;
  targetCount: number;
  mode: GoalComputationMode;
  weekendMultiplier?: number;
  createdAt: string;
};

export type JournalEntry = {
  id: UUID;
  date: string;
  content: string;
  mood?: "peaceful" | "joyful" | "tired" | "grateful" | "custom";
  tags: string[];
  pin: boolean;
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string;
};

export type Attachment = {
  id: UUID;
  type: "photo" | "audio" | "link";
  url: string;
  description?: string;
};

export type ReminderChannel = "web-push" | "email" | "line" | "none";

export type ReminderRule = {
  id: UUID;
  label: string;
  time: string; // HH:mm
  enabled: boolean;
  onlyWhenIncomplete: boolean;
  quietDays: number[]; // 0 (Sun) - 6 (Sat)
  extraMessage?: string;
  channel: ReminderChannel;
};

export type ReminderSettings = {
  enabled: boolean;
  timezone: string;
  rules: ReminderRule[];
  lastNotificationDate?: string;
  pushEndpoint?: string;
};

export type DashboardWidgetType =
  | "weekly-progress"
  | "monthly-heatmap"
  | "goal-tracking"
  | "top-tasks"
  | "streak";

export type DashboardWidget = {
  id: UUID;
  type: DashboardWidgetType;
  title: string;
  taskIds: UUID[];
  options: Record<string, unknown>;
  order: number;
};

export type AppearanceSettings = {
  theme: "auto" | "light" | "dark";
  accentColor: string;
  cardStyle: "comfortable" | "compact";
  fontScale: 0.875 | 1 | 1.125 | 1.25;
};

export type SyncSettings = {
  enableSync: boolean;
  includeJournal: boolean;
  range: "all" | "30d" | "90d" | "365d";
  strategy: "single-sheet" | "weekly" | "monthly" | "yearly";
  template: string;
  lastSyncedAt?: string;
  lastError?: string;
};

export type AppSettings = {
  id: string;
  appearance: AppearanceSettings;
  reminder: ReminderSettings;
  sync: SyncSettings;
  onboardingCompleted: boolean;
};

export type JournalTemplateField = {
  id: UUID;
  label: string;
  placeholder?: string;
  required: boolean;
};

export type JournalTemplate = {
  id: UUID;
  name: string;
  description?: string;
  fields: JournalTemplateField[];
};

export type Category = {
  id: UUID;
  name: string;
  createdAt: string;
};

export type PracticeStateSnapshot = {
  tasks: PracticeTask[];
  records: DailyRecord[];
  goals: PracticeGoal[];
  journalEntries: JournalEntry[];
  widgets: DashboardWidget[];
  journalTemplates: JournalTemplate[];
  settings: AppSettings;
  categories: Category[];
  version: number;
};

export type PendingOperationType =
  | "task.upsert"
  | "task.delete"
  | "record.upsert"
  | "record.delete"
  | "goal.upsert"
  | "goal.delete"
  | "journal.upsert"
  | "journal.delete"
  | "widget.upsert"
  | "settings.update";

export type PendingOperation = {
  id: UUID;
  userId?: UUID;
  type: PendingOperationType;
  payload: unknown;
  createdAt: string;
  syncedAt?: string;
};

export type SyncStatus = "idle" | "syncing" | "offline" | "error";

export type RemoteSnapshot = {
  snapshot: PracticeStateSnapshot;
  updatedAt: string;
};

// Sheet sync types
export type SheetConfig = {
  id: UUID;
  title: string;
  spreadsheetId: string;
  folderId?: string;
  taskIds: UUID[];
  createdAt: string;
  updatedAt: string;
};

export type SheetOperationType =
  | "task.upsert"
  | "task.delete"
  | "record.upsert"
  | "record.delete";

export type SheetOperation = {
  id: UUID;
  type: SheetOperationType;
  payload: unknown;
  createdAt: string;
};
