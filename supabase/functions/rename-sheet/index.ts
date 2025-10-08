import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

async function renameDriveFile(accessToken: string, fileId: string, name: string) {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}`;
  const resp = await fetch(url, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name })
  });
  if (!resp.ok) throw new Error(`drive rename failed: ${resp.status}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { accessToken, spreadsheetId, title } = (await req.json()) as {
      accessToken?: string;
      spreadsheetId?: string;
      title?: string;
    };
    if (!accessToken || !spreadsheetId || !title)
      return new Response(JSON.stringify({ success: false, message: "missing params" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    await renameDriveFile(accessToken, spreadsheetId, title);
    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, message: String(e) }), { status: 500, headers: corsHeaders });
  }
});
