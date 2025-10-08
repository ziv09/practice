/* deno-lint-ignore-file no-explicit-any */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

async function createSpreadsheet(accessToken: string, title: string) {
  const resp = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ properties: { title } })
  });
  if (!resp.ok) throw new Error(`create spreadsheet failed: ${resp.status}`);
  const json = await resp.json();
  return json.spreadsheetId as string;
}

async function moveFileToFolder(accessToken: string, fileId: string, folderId: string) {
  const metaResp = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=parents`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!metaResp.ok) throw new Error(`get parents failed: ${metaResp.status}`);
  const meta = await metaResp.json();
  const prevParents = (meta.parents ?? []).join(",");
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${fileId}`);
  url.searchParams.set("addParents", folderId);
  if (prevParents) url.searchParams.set("removeParents", prevParents);
  const resp = await fetch(url.toString(), { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}` } });
  if (!resp.ok) throw new Error(`move file failed: ${resp.status}`);
}

async function findSpreadsheetByTitle(accessToken: string, title: string) {
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  const q = `name = '${title.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`;
  url.searchParams.set("q", q);
  url.searchParams.set("fields", "files(id,name)");
  url.searchParams.set("pageSize", "10");
  const resp = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!resp.ok) throw new Error(`drive search failed: ${resp.status}`);
  const json = await resp.json();
  const files = (json.files ?? []) as Array<{ id: string; name: string }>;
  return files.length ? files[0].id : undefined;
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

async function getSpreadsheet(accessToken: string, spreadsheetId: string) {
  const resp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
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

function colIndexToLetter(n: number) {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - m) / 26);
  }
  return s;
}

function getMonthTitle(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthDays(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  return new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
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
    const { accessToken, template = "Practice-{date}", spreadsheetId: existingId, folderId, taskIds = [], tasks = [], snapshot } = (await req.json()) as {
      accessToken?: string;
      template?: string;
      spreadsheetId?: string;
      folderId?: string;
      taskIds?: string[];
      tasks?: Array<{ id: string; name: string }>;
      snapshot?: { records?: Array<{ taskId: string; date: string; count?: number }>; tasks?: Array<{ id: string; name: string }> };
    };
    if (!accessToken)
      return new Response(JSON.stringify(\{\ success:\ true,\ spreadsheetId,\ debug:\ \{\ rowsWritten:\ \(taskList\?\.length\ \?\?\ 0\),\ days,\ monthTitle\ }\ }), { status: 400, headers: { "Content-Type": "application/json" } });
    if (!taskIds || taskIds.length === 0)
      return new Response(JSON.stringify({ success: false, message: "missing taskIds" }), { status: 400, headers: { "Content-Type": "application/json" } });

    const date = new Date().toISOString().slice(0, 10);
    const title = template.replace("{date}", date);
    let spreadsheetId = existingId;
    if (!spreadsheetId) {
      spreadsheetId = await findSpreadsheetByTitle(accessToken, title);
    }
    if (!spreadsheetId) {
      spreadsheetId = await createSpreadsheet(accessToken, title);
    }

    if (!existingId && folderId) {
      try { await moveFileToFolder(accessToken, spreadsheetId, folderId); } catch (_) { /* ignore */ }
    }

    // Ensure current month sheet exists with header row
    const monthTitle = getMonthTitle(new Date());
    const meta = await getSpreadsheet(accessToken, spreadsheetId);
    const hasSheet = (meta.sheets ?? []).some((s: any) => s.properties?.title === monthTitle);
    if (!hasSheet) {
      await addSheet(accessToken, spreadsheetId, monthTitle);
    }
    const days = monthDays(new Date());
    const header = ["Item", ...Array.from({ length: days }, (_, i) => String(i + 1)), "taskId(hidden)"];
    const endCol = colIndexToLetter(header.length);
    await valuesUpdate(accessToken, spreadsheetId, `${monthTitle}!A1:${endCol}1`, [header]);

    // Normalize task list: prefer tasks param, fallback to snapshot.tasks filtered by taskIds
    let taskList: Array<{ id: string; name: string }> = Array.isArray(tasks) ? tasks : [];
    if ((!taskList || taskList.length === 0) && snapshot && Array.isArray((snapshot as any).tasks)) {
      const snapTasks = ((snapshot as any).tasks as Array<{ id: string; name: string }>);
      taskList = snapTasks.filter((t) => taskIds.includes(t.id)).map((t) => ({ id: t.id, name: t.name }));
    }

    // Write task rows (Item + hidden taskId)
    if (Array.isArray(taskList) && taskList.length > 0) {
      const rows = taskList.map((t) => {
        const row = new Array(days + 2).fill("");
        row[0] = (t as any).name ?? "";
        row[days + 1] = (t as any).id;
        return row;
      });
      await valuesUpdate(accessToken, spreadsheetId, `${monthTitle}!A2:${endCol}${rows.length + 1}`, rows);
    }

    // If snapshot provided, pre-fill current month values
    if (snapshot && Array.isArray((snapshot as any).records) && taskList.length > 0) {
      const taskIndex: Record<string, number> = {};
      (taskList as any[]).forEach((t, i) => (taskIndex[(t as any).id] = i));
      const values: string[][] = Array.from({ length: (taskList as any[]).length }, () => Array.from({ length: days }, () => ""));
      for (const r of (snapshot as any).records) {
        if (!r?.taskId || !r?.date) continue;
        const idx = taskIndex[r.taskId];
        if (idx === undefined) continue;
        const d = new Date(r.date);
        const title = getMonthTitle(d);
        if (title !== monthTitle) continue;
        const day = d.getUTCDate();
        const prev = Number(values[idx][day - 1] || 0);
        const add = Number(r.count ?? 0);
        const next = prev + (Number.isFinite(add) ? add : 0);
        values[idx][day - 1] = next ? String(next) : "";
      }
      const endDataCol = colIndexToLetter(1 + days);
      if (values.length > 0) {
        await valuesUpdate(accessToken, spreadsheetId, `${monthTitle}!B2:${endDataCol}${values.length + 1}`, values);
      }
    }

    return new Response(JSON.stringify({ success: true, spreadsheetId, message: "撌脣遣蝡??湔閰衣?銵? }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ success: false, message: msg }), { status: 500, headers: corsHeaders });
  }
});
