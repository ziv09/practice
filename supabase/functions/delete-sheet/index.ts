import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

async function deleteDriveFile(accessToken: string, fileId: string) {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}`;
  const resp = await fetch(url, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } });
  if (!resp.ok) throw new Error(`drive delete failed: ${resp.status}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { accessToken, spreadsheetId } = (await req.json()) as {
      accessToken?: string;
      spreadsheetId?: string;
    };
    if (!accessToken || !spreadsheetId)
      return new Response(JSON.stringify({ success: false, message: "missing params" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    await deleteDriveFile(accessToken, spreadsheetId);
    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, message: String(e) }), { status: 500, headers: corsHeaders });
  }
});
