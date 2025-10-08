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
    console.error("讀取雲端快照失敗", error);
    throw new Error(error.message);
  }

  if (!data?.snapshot) return undefined;

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
    console.error("上傳雲端快照失敗", error);
    throw new Error(error.message);
  }
}

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

export async function pushPendingOperations(userId: string, operations: PendingOperation[]): Promise<void> {
  if (!supabase) return;
  const chunkSize = 200;
  const chunks: PendingOperation[][] = [];
  for (let i = 0; i < operations.length; i += chunkSize) {
    chunks.push(operations.slice(i, i + chunkSize));
  }
  for (const chunk of chunks) {
    let attempt = 0;
    // 重試：指數退避
    for (;;) {
      const { error } = await supabase.functions.invoke(SYNC_FUNCTION, { body: { userId, operations: chunk } });
      if (!error) break;
      attempt += 1;
      if (attempt >= 3) {
        console.error("推送同步作業失敗", error);
        throw new Error(error.message);
      }
      await sleep(1000 * Math.pow(2, attempt - 1));
    }
  }
  return;
}
