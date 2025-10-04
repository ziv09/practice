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
  // 1 -> A
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - m) / 26);
  }
  return s;
}

async function getSpreadsheet(accessToken: string, spreadsheetId: string) {
  const resp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}` , {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!resp.ok) throw new Error(`get spreadsheet failed: ${resp.status}`);
  return await resp.json();
}

async function addSheet(accessToken: string, spreadsheetId: string, title: string) {
  const resp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title } } }] })
  });
  if (!resp.ok) throw new Error(`add sheet failed: ${resp.status}`);
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

async function valuesGet(accessToken: string, spreadsheetId: string, range: string) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!resp.ok) throw new Error(`values get failed: ${resp.status}`);
  const json = await resp.json();
  return (json.values ?? []) as string[][];
}

async function ensureMonthSheet(accessToken: string, spreadsheetId: string, monthTitle: string, days: number) {
  const meta = await getSpreadsheet(accessToken, spreadsheetId);
  const has = (meta.sheets ?? []).some((s: any) => s.properties?.title === monthTitle);
  if (!has) await addSheet(accessToken, spreadsheetId, monthTitle);
  const header = ["項目", ...Array.from({ length: days }, (_, i) => String(i + 1)), "taskId(hidden)"];
  const endCol = colIndexToLetter(header.length);
  await valuesUpdate(accessToken, spreadsheetId, `${monthTitle}!A1:${endCol}1`, [header]);
}

serve(async (req) => {
  try {
    const { accessToken, spreadsheetId, taskIds = [], operations = [] } = (await req.json()) as {
      accessToken?: string;
      spreadsheetId?: string;
      taskIds?: string[];
      operations?: Array<{ type: string; payload: any }>;
    };
    if (!accessToken) return new Response(JSON.stringify({ success: false, message: "missing accessToken" }), { status: 400 });
    if (!spreadsheetId) return new Response(JSON.stringify({ success: false, message: "missing spreadsheetId" }), { status: 400 });

    // Group record ops by month
    const recordOps = operations.filter((o) => o.type === "record.upsert" || o.type === "record.delete");
    const byMonth = new Map<string, any[]>();
    for (const op of recordOps) {
      const list = Array.isArray(op.payload) ? op.payload : [op.payload];
      for (const r of list) {
        if (!r?.date || !r?.taskId) continue;
        if (!taskIds.includes(r.taskId)) continue;
        const month = getMonthTitleFromDate(r.date);
        const arr = byMonth.get(month) ?? [];
        arr.push({ type: op.type, record: r });
        byMonth.set(month, arr);
      }
    }

    for (const [monthTitle, ops] of byMonth.entries()) {
      const days = monthDaysFromDate(ops[0].record.date);
      await ensureMonthSheet(accessToken, spreadsheetId, monthTitle, days);

      // Build row map by taskId
      const endCol = colIndexToLetter(days + 2); // A + days + hidden col
      const rows = await valuesGet(accessToken, spreadsheetId, `${monthTitle}!A2:${endCol}1000`);
      // rows start at A2; hidden col index = days + 2
      const hiddenIndex = days + 2 - 1; // zero-based within rows array
      const map = new Map<string, number>(); // taskId -> rowIndex (1-based in sheet)
      rows.forEach((row, i) => {
        const tid = row[hiddenIndex];
        if (tid) map.set(tid, i + 2); // adjust because started from row 2
      });

      // append rows when needed
      const newRows: any[][] = [];
      const ensured = new Set<string>();
      for (const it of ops) {
        const tid = it.record.taskId as string;
        if (!map.has(tid) && !ensured.has(tid)) {
          // Append a new row with hidden taskId; name left blank for now
          const row = new Array(days + 2).fill("");
          row[0] = it.record.taskName ?? ""; // optional
          row[days + 1] = tid; // hidden
          newRows.push(row);
          ensured.add(tid);
        }
      }
      if (newRows.length) {
        await valuesUpdate(accessToken, spreadsheetId, `${monthTitle}!A${rows.length + 2}`, newRows);
        // refresh mapping after append
        const total = rows.length + newRows.length;
        const fresh = await valuesGet(accessToken, spreadsheetId, `${monthTitle}!A2:${endCol}${total + 1}`);
        fresh.forEach((row, i) => {
          const tid = row[hiddenIndex];
          if (tid) map.set(tid, i + 2);
        });
      }

      // Apply cell updates
      for (const it of ops) {
        const tid = it.record.taskId as string;
        const day = Number(String(it.record.date).slice(-2));
        const colIndex = 1 + day; // A=1, day starts at B=2
        const rowNumber = map.get(tid);
        if (!rowNumber) continue;
        const colLetter = colIndexToLetter(colIndex);
        const range = `${monthTitle}!${colLetter}${rowNumber}`;
        const value = it.type === "record.delete" ? [[""]] : [[String(it.record.count ?? 0)]];
        await valuesUpdate(accessToken, spreadsheetId, range, value);
      }
    }

    // handle task deletion: best-effort - not implemented for all months to limit API cost
    // could be expanded to scan months if needed.

    return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, message: String(e) }), { status: 500 });
  }
});

