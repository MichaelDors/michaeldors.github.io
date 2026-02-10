import { createClient } from "npm:@supabase/supabase-js@2.94.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("---------------- AI CHART INVOCATION ----------------");
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const body = await req.json();
    const { song_id, resource_id, prompt, model } = body || {};

    if (!song_id) throw new Error("Missing song_id");
    if (!prompt) throw new Error("Missing prompt");
    console.log("AI chart request", { song_id, resource_id, model });

    const token = authHeader.replace("Bearer ", "");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: authHeader } },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) throw new Error("Auth failed");
    console.log("AI chart user", { id: user.id });

    const { data: song, error: songError } = await supabaseClient
      .from("songs")
      .select("id, team_id")
      .eq("id", song_id)
      .single();

    if (songError || !song) {
      throw new Error("Song not found");
    }
    console.log("AI chart song", { team_id: song.team_id });

    const { data: member } = await supabaseClient
      .from("team_members")
      .select("role, is_owner, can_manage")
      .eq("team_id", song.team_id)
      .eq("user_id", user.id)
      .single();

    if (!member) {
      throw new Error("Not authorized");
    }
    console.log("AI chart membership", { role: member?.role });

    const { data: team, error: teamError } = await supabaseClient
      .from("teams")
      .select("ai_enabled")
      .eq("id", song.team_id)
      .single();

    if (teamError) throw teamError;
    if (!team?.ai_enabled) {
      return new Response(
        JSON.stringify({ error: "AI is disabled for this team." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }
    console.log("AI chart team ai_enabled", { ai_enabled: team.ai_enabled });

    const openRouterApiKey = Deno.env.get("OPENROUTER_KEY");
    if (!openRouterApiKey) throw new Error("Missing OPENROUTER_KEY");

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openRouterApiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://michaeldors.com",
      },
      body: JSON.stringify({
        model: model || "tngtech/deepseek-r1t2-chimera:free",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI chart OpenRouter error", response.status, errText);
      throw new Error(`OpenRouter Error: ${errText}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || "";
    if (!content) throw new Error("No content returned from AI");
    console.log("AI chart response received", { length: content.length });

    return new Response(
      JSON.stringify({ content, resource_id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("AI chart error", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
