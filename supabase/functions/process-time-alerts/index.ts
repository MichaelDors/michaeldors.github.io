import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESENDAPP");

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function sendResendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) throw new Error("RESENDAPP not configured");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Cadence <team@cadence.michaeldors.com>",
      to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend failed: ${res.status} ${text}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const now = new Date();
  const windowMinutes = 60;
  const windowEnd = new Date(now.getTime() + windowMinutes * 60 * 1000);

  console.log("⏰ process-time-alerts running", { now: now.toISOString(), windowEnd: windowEnd.toISOString() });

  // Load pending alerts
  const { data: alerts, error: alertsError } = await supabaseAdmin
    .from("set_time_alerts")
    .select("id, set_id, team_id, time_type, time_id, offset_days, sent_at")
    .eq("enabled", true)
    .is("sent_at", null);

  if (alertsError) {
    console.error("Error loading set_time_alerts", alertsError);
    return new Response(JSON.stringify({ error: "failed_to_load_alerts" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!alerts || alerts.length === 0) {
    console.log("No pending alerts");
    return new Response(JSON.stringify({ ok: true, processed: 0 }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const serviceIds = alerts.filter(a => a.time_type === "service").map(a => a.time_id);
  const rehearsalIds = alerts.filter(a => a.time_type === "rehearsal").map(a => a.time_id);
  const setIds = Array.from(new Set(alerts.map(a => a.set_id)));

  const [servicesRes, rehearsalsRes, setsRes] = await Promise.all([
    serviceIds.length
      ? supabaseAdmin.from("service_times").select("id, set_id, service_time").in("id", serviceIds)
      : Promise.resolve({ data: [], error: null }),
    rehearsalIds.length
      ? supabaseAdmin.from("rehearsal_times").select("id, set_id, rehearsal_date, rehearsal_time").in("id", rehearsalIds)
      : Promise.resolve({ data: [], error: null }),
    setIds.length
      ? supabaseAdmin.from("sets").select("id, title, scheduled_date, team_id").in("id", setIds)
      : Promise.resolve({ data: [], error: null }),
  ] as const);

  if (servicesRes.error || rehearsalsRes.error || setsRes.error) {
    console.error("Error loading related rows", { servicesRes, rehearsalsRes, setsRes });
    return new Response(JSON.stringify({ error: "failed_to_load_related" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const servicesById = new Map(servicesRes.data?.map((r: any) => [r.id, r]));
  const rehearsalsById = new Map(rehearsalsRes.data?.map((r: any) => [r.id, r]));
  const setsById = new Map(setsRes.data?.map((r: any) => [r.id, r]));

  type DueAlert = typeof alerts[number] & { eventTs: Date; set: any };
  const dueAlerts: DueAlert[] = [];

  for (const alert of alerts) {
    const set = setsById.get(alert.set_id);
    if (!set) continue;

    let eventDateTime: Date | null = null;

    if (alert.time_type === "service") {
      const st = servicesById.get(alert.time_id);
      if (!st || !set.scheduled_date || !st.service_time) continue;
      eventDateTime = new Date(`${set.scheduled_date}T${st.service_time}`);
    } else {
      const rt = rehearsalsById.get(alert.time_id);
      if (!rt || !rt.rehearsal_date || !rt.rehearsal_time) continue;
      eventDateTime = new Date(`${rt.rehearsal_date}T${rt.rehearsal_time}`);
    }

    if (isNaN(eventDateTime!.getTime())) continue;

    const triggerTime = new Date(eventDateTime!.getTime() + alert.offset_days * 24 * 60 * 60 * 1000);

    if (triggerTime <= windowEnd && triggerTime >= now) {
      dueAlerts.push({ ...(alert as any), eventTs: eventDateTime!, set });
    }
  }

  if (dueAlerts.length === 0) {
    console.log("No alerts in this window");
    return new Response(JSON.stringify({ ok: true, processed: 0 }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`Found ${dueAlerts.length} due alerts`);

  // Group due alerts by set for recipient lookup
  const dueSetIds = Array.from(new Set(dueAlerts.map(a => a.set_id)));

  const [setAssignmentsRes, songAssignmentsRes] = await Promise.all([
    supabaseAdmin
      .from("set_assignments")
      .select("set_id, person_id, person_email, pending_invite_id")
      .in("set_id", dueSetIds),
    supabaseAdmin
      .from("song_assignments")
      .select("set_song:set_song_id(set_id), person_id, person_email, pending_invite_id")
      .in("set_song.set_id", dueSetIds),
  ] as const);

  if (setAssignmentsRes.error || songAssignmentsRes.error) {
    console.error("Error loading assignments", { setAssignmentsRes, songAssignmentsRes });
    return new Response(JSON.stringify({ error: "failed_to_load_assignments" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Build recipients per set (unique by person / invite / email)
  type Recipient = { person_id: string | null; pending_invite_id: string | null; person_email: string | null };
  const recipientsBySet = new Map<string, Recipient[]>();

  const addRecipient = (setId: string, r: Recipient) => {
    const key = r.person_id
      ? `person:${r.person_id}`
      : r.pending_invite_id
      ? `invite:${r.pending_invite_id}`
      : r.person_email
      ? `email:${r.person_email.toLowerCase()}`
      : null;
    if (!key) return;

    let bucket = recipientsBySet.get(setId);
    if (!bucket) {
      bucket = [];
      recipientsBySet.set(setId, bucket);
      (bucket as any)._keys = new Set<string>();
    }
    const keys: Set<string> = (bucket as any)._keys;
    if (keys.has(key)) return;
    keys.add(key);
    bucket.push(r);
  };

  (setAssignmentsRes.data || []).forEach((a: any) => {
    addRecipient(a.set_id, {
      person_id: a.person_id ?? null,
      pending_invite_id: a.pending_invite_id ?? null,
      person_email: a.person_email ?? null,
    });
  });

  (songAssignmentsRes.data || []).forEach((a: any) => {
    if (!a.set_song?.set_id) return;
    addRecipient(a.set_song.set_id, {
      person_id: a.person_id ?? null,
      pending_invite_id: a.pending_invite_id ?? null,
      person_email: a.person_email ?? null,
    });
  });

  // Resolve emails from profiles / pending_invites
  const allPersonIds = Array.from(
    new Set(
      Array.from(recipientsBySet.values())
        .flat()
        .map(r => r.person_id)
        .filter(Boolean) as string[],
    ),
  );
  const allInviteIds = Array.from(
    new Set(
      Array.from(recipientsBySet.values())
        .flat()
        .map(r => r.pending_invite_id)
        .filter(Boolean) as string[],
    ),
  );

  const [profilesRes, invitesRes] = await Promise.all([
    allPersonIds.length
      ? supabaseAdmin.from("profiles").select("id, email, full_name").in("id", allPersonIds)
      : Promise.resolve({ data: [], error: null }),
    allInviteIds.length
      ? supabaseAdmin.from("pending_invites").select("id, email, full_name").in("id", allInviteIds)
      : Promise.resolve({ data: [], error: null }),
  ] as const);

  const profilesById = new Map(profilesRes.data?.map((p: any) => [p.id, p]));
  const invitesById = new Map(invitesRes.data?.map((i: any) => [i.id, i]));

  let sentCount = 0;

  for (const alert of dueAlerts) {
    const set = alert.set;
    const setRecipients = recipientsBySet.get(alert.set_id) || [];
    if (!setRecipients.length) {
      console.log("No recipients for set", alert.set_id);
      continue;
    }

    const subjectPrefix = alert.time_type === "service" ? "Service reminder" : "Rehearsal reminder";
    const subject = `${subjectPrefix}: ${set.title || "Untitled set"}`;

    const eventStr = alert.eventTs.toLocaleString();

    for (const r of setRecipients) {
      let email = r.person_email?.toLowerCase() || null;
      let name: string | null = null;

      if (!email && r.person_id) {
        const profile = profilesById.get(r.person_id);
        email = profile?.email?.toLowerCase() ?? null;
        name = profile?.full_name ?? null;
      }

    if (!email && r.pending_invite_id) {
      const inv = invitesById.get(r.pending_invite_id);
      email = inv?.email?.toLowerCase() ?? null;
      name = name || (inv?.full_name ?? null);
    }

      if (!email) continue;

      const greetingName = name ? ` ${name}` : "";
      const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${subject}</title>
  </head>
  <body>
    <p>Hey${greetingName},</p>
    <p>This is a reminder for the ${alert.time_type === "service" ? "service" : "rehearsal"} in the set <strong>${set.title ||
        "Untitled set"}</strong> at <strong>${eventStr}</strong>.</p>
    <p>Open Cadence to see your full schedule and details.</p>
  </body>
</html>`;

      try {
        await sendResendEmail(email, subject, html);
        sentCount++;
      } catch (err) {
        console.error("Failed to send reminder email", err);
      }
    }

    // Mark alert as sent so it doesn't fire again
    const { error: updateError } = await supabaseAdmin
      .from("set_time_alerts")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", alert.id);

    if (updateError) {
      console.error("Failed to mark alert as sent", updateError);
    }
  }

  return new Response(JSON.stringify({ ok: true, processed: dueAlerts.length, emailsSent: sentCount }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
