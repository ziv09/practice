import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

serve(async (req) => {
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: auth } }
    });
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes.user) return new Response("unauthorized", { status: 401 });
    const userId = userRes.user.id;

    const { subscription } = await req.json();
    if (!subscription) return new Response("bad request", { status: 400 });

    const { error } = await supabase.from("user_push_subscriptions").upsert({
      user_id: userId,
      subscription,
      created_at: new Date().toISOString()
    });
    if (error) throw error;
    return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, message: String(e) }), { status: 500 });
  }
});

