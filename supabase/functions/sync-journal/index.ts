/* deno-lint-ignore-file no-explicit-any */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

function getMonthTitleFromDate(dateStr: string) {
  const d = new Date(dateStr);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthDaysFromDate(dateStr: string) {
  const d = new Date(dateStr);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  return new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
}

function colIndexToLetter(n: number) {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - m) / 26);
  }
  return s;
}

async function valuesUpdate(accessToken: string, spreadsheetId: string, range: string, values: any[][]) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`;
  const resp = await fetch(url, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ range, majorDimension: "ROWS", values })
  });
  if (!resp.ok) throw new Error(`values update failed: ${resp.status}`);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const { accessToken, spreadsheetId, operations = [] } = (await req.json()) as {
      accessToken?: string;
      spreadsheetId?: string;
      operations?: Array<{ type: string; payload: any }>;
    };
    if (!accessToken) return new Response(JSON.stringify({ success: false, message: "missing accessToken" }), { status: 400 });
    if (!spreadsheetId) return new Response(JSON.stringify({ success: false, message: "missing spreadsheetId" }), { status: 400 });

    // Group journal ops by month
    const journalOps = operations.filter((o) => o.type === "journal.upsert" || o.type === "journal.delete");
    const byMonth = new Map<string, any[]>();
    for (const op of journalOps) {
      const r = op.payload;
      if (!r?.date) continue;
      const month = getMonthTitleFromDate(r.date);
      const arr = byMonth.get(month) ?? [];
      arr.push({ type: op.type, entry: r });
      byMonth.set(month, arr);
    }

    for (const [monthTitle, ops] of byMonth.entries()) {
      const days = monthDaysFromDate(ops[0].entry.date);
      // Ensure header: row 1 dates, row 2 label "記事"
      const header = ["", ...Array.from({ length: days }, (_, i) => String(i + 1))];
      const endCol = colIndexToLetter(header.length);
      await valuesUpdate(accessToken, spreadsheetId, `${monthTitle}!A1:${endCol}1`, [header]);
      await valuesUpdate(accessToken, spreadsheetId, `${monthTitle}!A2:A2`, [["記事"]]);

      // Apply per-day updates on row 2
      // Combine multiple entries per day with newlines
      const dayMap = new Map<number, string>();
      for (const it of ops) {
        const day = Number(String(it.entry.date).slice(-2));
        const prev = dayMap.get(day) ?? "";
        if (it.type === "journal.delete") {
          dayMap.set(day, "");
        } else {
          const content = String(it.entry.content ?? "");
          dayMap.set(day, prev ? `${prev}\n${content}` : content);
        }
      }
      for (const [day, value] of dayMap.entries()) {
        const colIndex = 1 + day; // A=1, day=>B start
        const colLetter = colIndexToLetter(colIndex);
        const range = `${monthTitle}!${colLetter}2`;
        await valuesUpdate(accessToken, spreadsheetId, range, [[value]]);
      }
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, message: String(e) }), { status: 500, headers: corsHeaders });
  }
});
