/* deno-lint-ignore-file no-explicit-any */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js";
import webpush from "npm:web-push";

type SnapshotRow = { user_id: string; snapshot: any };

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("Missing SUPABASE_URL / SERVICE_ROLE_KEY");
if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) throw new Error("Missing VAPID keys");

webpush.setVapidDetails("mailto:admin@example.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

function getZonedNow(timeZone: string) {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short"
    });
    const parts = fmt.formatToParts(new Date());
    const map: Record<string, string> = {};
    parts.forEach((p) => (map[p.type] = p.value));
    const yyyy = map.year;
    const mm = map.month;
    const dd = map.day;
    const HH = map.hour;
    const MM = map.minute;
    const weekdayShort = map.weekday; // Sun..Sat
    const weekdayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekdayShort);
    return { time: `${HH}:${MM}`, date: `${yyyy}-${mm}-${dd}`, weekdayIndex };
  } catch (_) {
    const d = new Date();
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const HH = String(d.getUTCHours()).padStart(2, "0");
    const MM = String(d.getUTCMinutes()).padStart(2, "0");
    const weekdayIndex = d.getUTCDay();
    return { time: `${HH}:${MM}`, date: `${yyyy}-${mm}-${dd}`, weekdayIndex };
  }
}

function timeHits(ruleTime: string, nowTime: string) {
  const [rh, rm] = (ruleTime ?? "").split(":").map((n) => parseInt(n, 10));
  const [nh, nm] = (nowTime ?? "").split(":").map((n) => parseInt(n, 10));
  if ([rh, rm, nh, nm].some((v) => Number.isNaN(v))) return false;
  if (rh !== nh) return false;
  return Math.abs(nm - rm) <= 1; // ±1 分鐘容錯
}

function countTodayTotal(records: any[], today: string) {
  return (records ?? [])
    .filter((r) => r?.date === today)
    .reduce((acc: number, r: any) => acc + (Number(r?.count ?? 0) || 0), 0);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    let from = 0;
    const size = 500;
    let processed = 0;
    let notified = 0;

    for (;;) {
      const { data, error } = await supabase
        .from("practice_state_snapshots")
        .select("user_id,snapshot")
        .contains("snapshot", { settings: { reminder: { enabled: true } } })
        .range(from, from + size - 1);
      if (error) throw error;
      const rows = (data ?? []) as SnapshotRow[];
      if (!rows.length) break;

      for (const row of rows) {
        processed += 1;
        const snap = row.snapshot ?? {};
        const settings = snap?.settings ?? {};
        const reminder = settings?.reminder ?? {};
        const rules: any[] = Array.isArray(reminder?.rules) ? reminder.rules : [];
        const timeZone: string = reminder?.timezone || "Asia/Taipei";
        const now = getZonedNow(timeZone);

        // 防重：同一天已發送則跳過（簡易版）
        if (reminder?.lastNotificationDate === now.date) continue;

        let match = false;
        for (const rule of rules) {
          if (!rule?.enabled) continue;
          const quietDays = Array.isArray(rule?.quietDays) ? rule.quietDays : [];
          if (quietDays.includes(now.weekdayIndex)) continue;
          const rt = String(rule?.time ?? "");
          if (!rt.includes(":")) continue;
          if (!timeHits(rt, now.time)) continue;
          const total = countTodayTotal(snap?.records ?? [], now.date);
          if (rule?.onlyWhenIncomplete && total > 0) continue;
          match = true;
          break;
        }
        if (!match) continue;

        // 取得推播訂閱
        const { data: subRow, error: selErr } = await supabase
          .from("user_push_subscriptions")
          .select("subscription")
          .eq("user_id", row.user_id)
          .maybeSingle();
        if (selErr) {
          console.warn("subscription select err", selErr.message);
          continue;
        }
        const subscription = (subRow as any)?.subscription;
        if (!subscription) continue;

        try {
          await webpush.sendNotification(
            subscription,
            JSON.stringify({ title: "Practice 提醒", body: "記錄今日練習吧！" })
          );
          notified += 1;
          // 更新 lastNotificationDate
          const nextSettings = {
            ...settings,
            reminder: { ...(settings?.reminder ?? {}), lastNotificationDate: now.date }
          };
          const nextSnapshot = { ...snap, settings: nextSettings };
          const { error: upErr } = await supabase
            .from("practice_state_snapshots")
            .upsert(
              { user_id: row.user_id, snapshot: nextSnapshot, updated_at: new Date().toISOString() },
              { onConflict: "user_id" }
            );
          if (upErr) console.warn("update snapshot error", upErr.message);
        } catch (e) {
          console.warn("webpush send error", String(e));
        }
      }

      from += rows.length;
      if (rows.length < size) break;
    }

    return new Response(JSON.stringify({ success: true, processed, notified }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, message: String(e) }), {
      status: 500,
      headers: corsHeaders
    });
  }
});

