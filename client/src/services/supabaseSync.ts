import type { PracticeStateSnapshot, PendingOperation } from "../types";
import { supabase } from "../lib/supabaseClient";

const SNAPSHOT_TABLE = "practice_state_snapshots";
const SYNC_FUNCTION = "sync-practice";

export async function fetchRemoteSnapshot(userId: string) {
  if (!supabase) return undefined;
  const { data, error } = await supabase
    .from(SNAPSHOT_TABLE)
    .select("snapshot, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("取得遠端快照失敗", error);
    throw new Error(error.message);
  }

  if (!data?.snapshot) {
    return undefined;
  }

  return {
    snapshot: data.snapshot as PracticeStateSnapshot,
    updatedAt: data.updated_at as string
  };
}

export async function upsertRemoteSnapshot(userId: string, snapshot: PracticeStateSnapshot) {
  if (!supabase) return;
  const { error } = await supabase.from(SNAPSHOT_TABLE).upsert(
    {
      user_id: userId,
      snapshot,
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id" }
  );

  if (error) {
    console.error("上傳遠端快照失敗", error);
    throw new Error(error.message);
  }
}

export async function pushPendingOperations(userId: string, operations: PendingOperation[]) {
  if (!supabase) return { success: false, message: "Supabase 尚未初始化" };
  const { data, error } = await supabase.functions.invoke(SYNC_FUNCTION, {
    body: { userId, operations }
  });

  if (error) {
    console.error("傳送同步作業失敗", error);
    throw new Error(error.message);
  }

  return data as { success: boolean; message?: string };
}
