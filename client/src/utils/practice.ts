import dayjs from "dayjs";
import type { DailyRecord, PracticeGoal } from "../types";

export function buildRecordKey(taskId: string, date: string) {
  return `${taskId}-${date}`;
}

export function getRecordForDate(records: DailyRecord[], taskId: string, date: string) {
  return records.find((record) => record.taskId === taskId && record.date === date);
}

export function sumRecords(records: DailyRecord[], taskId: string, startDate: string, endDate: string) {
  return records
    .filter((record) => record.taskId === taskId && record.date >= startDate && record.date <= endDate)
    .reduce((acc, record) => acc + record.count, 0);
}

export type GoalProgress = {
  goalId: string;
  progress: number;
  totalCompleted: number;
  left: number;
  suggestedDaily: number;
  isBehind: boolean;
};

export function calculateGoalProgress(goal: PracticeGoal, records: DailyRecord[], today: string): GoalProgress {
  const start = dayjs(goal.startDate);
  const end = dayjs(goal.endDate);
  const current = dayjs(today);
  const totalDays = end.diff(start, "day") + 1;
  const elapsedDays = Math.max(0, Math.min(totalDays, current.diff(start, "day") + 1));
  const completed = sumRecords(records, goal.taskId, goal.startDate, today);
  const progress = Math.min(1, completed / goal.targetCount);
  const left = Math.max(0, goal.targetCount - completed);
  const suggestedDaily = left / Math.max(1, totalDays - elapsedDays);
  const expectedByToday = (goal.targetCount / totalDays) * elapsedDays;
  const isBehind = completed < expectedByToday * 0.95;

  return {
    goalId: goal.id,
    progress,
    totalCompleted: completed,
    left,
    suggestedDaily,
    isBehind
  };
}

export function sumDaily(records: DailyRecord[], date: string) {
  return records.filter((record) => record.date === date).reduce((acc, record) => acc + record.count, 0);
}

export function getStreak(records: DailyRecord[], taskId: string, upToDate: string) {
  let streak = 0;
  let current = dayjs(upToDate);
  while (true) {
    const date = current.format("YYYY-MM-DD");
    const record = getRecordForDate(records, taskId, date);
    if (record && record.count > 0) {
      streak += 1;
      current = current.subtract(1, "day");
    } else {
      break;
    }
  }
  return streak;
}
