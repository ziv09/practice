import { supabase } from "../lib/supabaseClient";
import type { SheetConfig, SheetOperation } from "../types";

export async function getGoogleAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  let { data } = await supabase.auth.getSession();
  let token = (data.session as any)?.provider_token ?? null;
  if (!token) {
    try {
      const { data: refreshed } = await supabase.auth.refreshSession();
      token = (refreshed.session as any)?.provider_token ?? null;
    } catch {
      // ignore
    }
  }
  return token;
}

export async function fetchUserSheets(): Promise<SheetConfig[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("user_sheets").select("id, title, spreadsheet_id, folder_id, task_ids, created_at, updated_at");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    spreadsheetId: row.spreadsheet_id,
    folderId: row.folder_id ?? undefined,
    taskIds: (row.task_ids ?? []) as string[],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

export async function upsertUserSheet(input: { id?: string; title: string; spreadsheetId: string; folderId?: string; taskIds: string[] }) {
  if (!supabase) throw new Error("Supabase not ready");
  const payload = {
    id: input.id,
    title: input.title,
    spreadsheet_id: input.spreadsheetId,
    folder_id: input.folderId ?? null,
    task_ids: input.taskIds
  } as any;
  const { data, error } = await supabase.from("user_sheets").upsert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function deleteUserSheet(id: string) {
  if (!supabase) throw new Error("Supabase not ready");
  try {
    const token = await getGoogleAccessToken();
    const { data: row } = await supabase.from("user_sheets").select("spreadsheet_id").eq("id", id).maybeSingle();
    const spreadsheetId = (row as any)?.spreadsheet_id as string | undefined;
    if (token && spreadsheetId) {
      await supabase.functions.invoke("delete-sheet", { body: { accessToken: token, spreadsheetId } });
    }
  } catch (e) {
    // ignore remote delete error; still remove DB record
    console.warn(e);
  } finally {
    const { error } = await supabase.from("user_sheets").delete().eq("id", id);
    if (error) throw error;
  }
}

export async function updateUserSheetTitle(id: string, title: string) {
  if (!supabase) throw new Error("Supabase not ready");
  const { error } = await supabase.from("user_sheets").update({ title }).eq("id", id);
  if (error) throw error;
}

export async function exportOrUpdateSheet(params: {
  accessToken: string;
  spreadsheetId?: string;
  folderId?: string;
  title: string;
  taskIds: string[];
}) {
  if (!supabase) throw new Error("Supabase not ready");
  const { data, error } = await supabase.functions.invoke("export-sheets", {
    body: {
      accessToken: params.accessToken,
      spreadsheetId: params.spreadsheetId,
      folderId: params.folderId,
      template: params.title,
      taskIds: params.taskIds
    }
  });
  if (error) throw error;
  return data as { success: boolean; spreadsheetId: string; message?: string };
}

export async function syncSheetsIncremental(params: {
  accessToken: string;
  spreadsheetId: string;
  taskIds: string[];
  operations: SheetOperation[];
}) {
  if (!supabase) throw new Error("Supabase not ready");
  const { data, error } = await supabase.functions.invoke("sync-sheets", {
    body: {
      accessToken: params.accessToken,
      spreadsheetId: params.spreadsheetId,
      taskIds: params.taskIds,
      operations: params.operations
    }
  });
  if (error) throw error;
  return data as { success: boolean };
}

// Minimal Drive folder listing for picker
export async function listDriveFolders(accessToken: string, parentId?: string) {
  const qParts = ["mimeType = 'application/vnd.google-apps.folder'", "trashed = false"];
  if (parentId) qParts.push(`'${parentId}' in parents`);
  const q = qParts.join(" and ");
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("q", q);
  url.searchParams.set("fields", "files(id,name,parents)");
  url.searchParams.set("pageSize", "100");
  const resp = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!resp.ok) throw new Error(`drive list failed: ${resp.status}`);
  const json = await resp.json();
  return json.files as Array<{ id: string; name: string; parents?: string[] }>; 
}

export async function renameRemoteSheet(params: { accessToken: string; spreadsheetId: string; title: string }) {
  if (!supabase) throw new Error("Supabase not ready");
  const { data, error } = await supabase.functions.invoke("rename-sheet", {
    body: { accessToken: params.accessToken, spreadsheetId: params.spreadsheetId, title: params.title }
  });
  if (error) throw error;
  return data as { success: boolean };
}

export async function deleteRemoteSheet(params: { accessToken: string; spreadsheetId: string }) {
  if (!supabase) throw new Error("Supabase not ready");
  const { data, error } = await supabase.functions.invoke("delete-sheet", {
    body: { accessToken: params.accessToken, spreadsheetId: params.spreadsheetId }
  });
  if (error) throw error;
  return data as { success: boolean };
}

export async function fetchUserJournalSheets() {
  if (!supabase) return [] as Array<{ id: string; title: string; spreadsheetId: string; folderId?: string; createdAt: string; updatedAt: string }>;
  const { data, error } = await supabase.from("user_journal_sheets").select("id, title, spreadsheet_id, folder_id, created_at, updated_at");
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    title: row.title,
    spreadsheetId: row.spreadsheet_id,
    folderId: row.folder_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

export async function upsertUserJournalSheet(input: { id?: string; title: string; spreadsheetId: string; folderId?: string }) {
  if (!supabase) throw new Error("Supabase not ready");
  const payload: any = { id: input.id, title: input.title, spreadsheet_id: input.spreadsheetId, folder_id: input.folderId ?? null };
  const { data, error } = await supabase.from("user_journal_sheets").upsert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function deleteUserJournalSheet(id: string) {
  if (!supabase) throw new Error("Supabase not ready");
  const { error } = await supabase.from("user_journal_sheets").delete().eq("id", id);
  if (error) throw error;
}

export async function exportOrUpdateJournal(params: { accessToken: string; spreadsheetId?: string; folderId?: string; title: string; }) {
  if (!supabase) throw new Error("Supabase not ready");
  const { data, error } = await supabase.functions.invoke("export-journal", { body: params });
  if (error) throw error;
  return data as { success: boolean; spreadsheetId: string };
}

export async function syncJournalIncremental(params: { accessToken: string; spreadsheetId: string; operations: SheetOperation[]; }) {
  if (!supabase) throw new Error("Supabase not ready");
  const { data, error } = await supabase.functions.invoke("sync-journal", { body: params });
  if (error) throw error;
  return data as { success: boolean };
}
export async function updateUserJournalSheetTitle(id: string, title: string) {
  if (!supabase) throw new Error("Supabase not ready");
  const { error } = await supabase.from("user_journal_sheets").update({ title }).eq("id", id);
  if (error) throw error;
}
