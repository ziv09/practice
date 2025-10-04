/* deno-lint-ignore-file no-explicit-any */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

type PendingOperation = {
  id: string;
  type: string;
  payload: any;
  createdAt: string;
};

serve(async (req) => {
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: auth } }
    });

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
    }
    const userId = userRes.user.id;

    const body = await req.json().catch(() => ({}));
    const operations: PendingOperation[] = Array.isArray(body.operations) ? body.operations : [];

    // 目前快照
    const { data: snapRow, error: selErr } = await supabase
      .from("practice_state_snapshots")
      .select("snapshot")
      .eq("user_id", userId)
      .maybeSingle();
    if (selErr) throw selErr;

    const snapshot = snapRow?.snapshot ?? {
      tasks: [],
      records: [],
      goals: [],
      journalEntries: [],
      widgets: [],
      journalTemplates: [],
      settings: null,
      categories: [],
      version: 1
    };

    const upsertById = (arr: any[], obj: any) => {
      const i = arr.findIndex((x) => x.id === obj.id);
      if (i >= 0) arr[i] = obj;
      else arr.push(obj);
    };
    const upsertMany = (arr: any[], list: any[]) => list.forEach((o) => upsertById(arr, o));

    for (const op of operations) {
      switch (op.type) {
        case "task.upsert": {
          Array.isArray(op.payload) ? upsertMany(snapshot.tasks, op.payload) : upsertById(snapshot.tasks, op.payload);
          break;
        }
        case "task.delete": {
          snapshot.tasks = snapshot.tasks.filter((x: any) => x.id !== op.payload.id);
          snapshot.records = snapshot.records.filter((r: any) => r.taskId !== op.payload.id);
          snapshot.goals = snapshot.goals.filter((g: any) => g.taskId !== op.payload.id);
          break;
        }
        case "record.upsert": {
          const list = Array.isArray(op.payload) ? op.payload : [op.payload];
          const key = (r: any) => `${r.taskId}-${r.date}`;
          const map = new Map(snapshot.records.map((r: any) => [key(r), r]));
          list.forEach((r) => map.set(key(r), r));
          snapshot.records = Array.from(map.values());
          break;
        }
        case "record.delete": {
          snapshot.records = snapshot.records.filter((r: any) => r.id !== op.payload.id);
          break;
        }
        case "goal.upsert": {
          upsertById(snapshot.goals, op.payload);
          break;
        }
        case "goal.delete": {
          snapshot.goals = snapshot.goals.filter((g: any) => g.id !== op.payload.id);
          break;
        }
        case "journal.upsert": {
          upsertById(snapshot.journalEntries, op.payload);
          break;
        }
        case "journal.delete": {
          snapshot.journalEntries = snapshot.journalEntries.filter((j: any) => j.id !== op.payload.id);
          break;
        }
        case "widget.upsert": {
          const list = Array.isArray(op.payload) ? op.payload : [op.payload];
          list.forEach((w) => upsertById(snapshot.widgets, w));
          break;
        }
        case "settings.update": {
          snapshot.settings = op.payload;
          break;
        }
        default:
          // 未支援的類型先忽略
          break;
      }
    }

    const { error: upErr } = await supabase.from("practice_state_snapshots").upsert(
      {
        user_id: userId,
        snapshot,
        updated_at: new Date().toISOString()
      },
      { onConflict: "user_id" }
    );
    if (upErr) throw upErr;

    return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, message: String(e) }), { status: 500 });
  }
});

