// supabase/functions/notify-assignments/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.94.1";

// Supabase env (these are auto-injected when you deploy the function)
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Resend API key (your secret is named RESENDAPP)
const RESEND_API_KEY = Deno.env.get("RESENDAPP");

// Set up Supabase admin client (service role, ignore RLS)
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// CORS headers for browser-based calls
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type RecipientInput = {
    key: string;
    person_id: string | null;
    pending_invite_id: string | null;
    person_email: string | null;
};

type RequestBody = {
    setId: string;
    teamId: string;
    mode: "per_set" | "per_song";
    recipients: RecipientInput[];
};

async function sendResendEmail(
    to: string,
    subject: string,
    html: string,
): Promise<{ success: boolean; error?: string }> {
    if (!RESEND_API_KEY) {
        const error = "RESENDAPP (Resend API key) is not set in function env";
        console.error("❌", error);
        return { success: false, error };
    }

    console.log(`📧 Sending email to ${to} via Resend...`);

    try {
        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${RESEND_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from: "Cadence <team@cadence.michaeldors.com>", // TODO: Change to your actual domain/sender
                to,
                subject,
                html,
            }),
        });

        const responseText = await res.text();
        console.log(`📧 Resend API response status: ${res.status}`);

        if (!res.ok) {
            console.error("❌ Resend API error:", res.status, responseText);
            return { success: false, error: `Resend failed with status ${res.status}: ${responseText}` };
        }

        const responseData = JSON.parse(responseText);
        console.log(`✅ Email sent successfully to ${to}, Resend ID: ${responseData.id || "unknown"}`);
        return { success: true };
    } catch (err) {
        const error = `Failed to send email: ${err instanceof Error ? err.message : String(err)}`;
        console.error("❌", error);
        return { success: false, error };
    }
}

serve(async (req) => {
    console.log("🚀 notify-assignments function called");
    console.log("📋 Request method:", req.method);
    console.log("📋 Request URL:", req.url);

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        console.log("🕊️ CORS preflight handled");
        return new Response("ok", { status: 200, headers: corsHeaders });
    }

    if (req.method !== "POST") {
        return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    // Check RESENDAPP secret
    if (!RESEND_API_KEY) {
        console.error("❌ RESENDAPP secret is not set!");
        return new Response(
            JSON.stringify({ error: "RESENDAPP secret not configured" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }
    console.log("✅ RESENDAPP secret found (length:", RESEND_API_KEY.length, ")");

    let body: RequestBody;
    try {
        body = await req.json();
        console.log("📦 Request body parsed:", JSON.stringify(body, null, 2));
    } catch (err) {
        console.error("❌ Failed to parse JSON:", err);
        return new Response(
            JSON.stringify({ error: "Invalid JSON", details: String(err) }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    const { setId, teamId, mode, recipients } = body || {};

    if (!setId || !teamId || !Array.isArray(recipients) || recipients.length === 0) {
        console.error("❌ Missing or invalid payload:", { setId, teamId, recipientsLength: recipients?.length });
        return new Response(
            JSON.stringify({ error: "Missing or invalid payload", received: { setId, teamId, recipientsLength: recipients?.length } }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    if (mode !== "per_set" && mode !== "per_song") {
        console.error("❌ Invalid mode:", mode);
        return new Response(
            JSON.stringify({ error: "Invalid mode", received: mode }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    console.log(`📋 Processing ${recipients.length} recipients for set ${setId} (mode: ${mode})`);

    // Load the set (for title/date/context)
    console.log("🔍 Loading set from database...");
    const { data: set, error: setError } = await supabaseAdmin
        .from("sets")
        .select("id, title, scheduled_date, team_id, is_published")
        .eq("id", setId)
        .single();

    if (setError || !set) {
        console.error("❌ Error loading set:", setError);
        return new Response(
            JSON.stringify({ error: "Failed to load set", details: setError?.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    console.log("✅ Set loaded:", { id: set.id, title: set.title, scheduled_date: set.scheduled_date, is_published: set.is_published });

    // Only send notifications for published sets
    if (set.is_published !== true) {
        console.log("⏭️ Skipping assignment notifications: set is not published", {
            setId,
            is_published: set.is_published,
        });
        return new Response(
            JSON.stringify({ 
                message: "Notifications skipped: set is not published",
                skipped: true 
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    if (set.team_id !== teamId) {
        console.warn("⚠️ Team mismatch:", { expected: set.team_id, got: teamId });
        return new Response(
            JSON.stringify({ error: "Team mismatch" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    // Enforce per-team daily email limit (if columns exist)
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    let effectiveLimit: number | null = null;

    try {
        console.log("🔍 Loading team email limits...");
        const { data: team, error: teamError } = await supabaseAdmin
            .from("teams")
            .select("id, daily_email_limit, daily_email_count, daily_email_count_date")
            .eq("id", teamId)
            .maybeSingle();

        if (teamError) {
            // If the columns don't exist yet, fail open (no limit) but log once
            if (
                teamError.message?.includes("column \"daily_email_limit\"") ||
                teamError.message?.includes("daily_email_count") ||
                teamError.message?.includes("daily_email_count_date")
            ) {
                console.warn("ℹ️ daily_email_* columns not found on teams; skipping email limit enforcement");
            } else {
                console.error("❌ Error loading team for email limits:", teamError);
            }
        } else if (team) {
            const limit = typeof team.daily_email_limit === "number" ? team.daily_email_limit : 500; // generous default
            let count = typeof team.daily_email_count === "number" ? team.daily_email_count : 0;
            let countDate: string | null = team.daily_email_count_date ?? null;

            // Reset counter if it's a different day
            if (countDate !== today) {
                count = 0;
                countDate = today;
            }

            const toSend = recipients.length;
            const newCount = count + toSend;

            effectiveLimit = limit;

            if (newCount > limit) {
                console.warn("⚠️ Team daily email limit exceeded", {
                    teamId,
                    limit,
                    currentCount: count,
                    attemptedToSend: toSend,
                });

                return new Response(
                    JSON.stringify({
                        error: "daily_email_limit_exceeded",
                        message: "This team has reached its daily email limit. Please contact support if you think this is a mistake.",
                        details: { limit, currentCount: count, attemptedToSend: toSend },
                    }),
                    { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
                );
            }

            // Best-effort update of the new count; not perfectly atomic but fine at low volumes
            const { error: updateTeamError } = await supabaseAdmin
                .from("teams")
                .update({
                    daily_email_count: newCount,
                    daily_email_count_date: today,
                })
                .eq("id", teamId);

            if (updateTeamError) {
                console.error("❌ Failed to update team daily email count:", updateTeamError);
            } else {
                console.log("✅ Updated team daily email count", { teamId, newCount, limit });
            }
        }
    } catch (limitErr) {
        console.error("❌ Unexpected error while enforcing email limits:", limitErr);
    }

    // Resolve all recipient emails in as few queries as possible
    const personIds = Array.from(
        new Set(
            recipients
                .map((r) => r.person_id)
                .filter((id): id is string => !!id),
        ),
    );
    const pendingInviteIds = Array.from(
        new Set(
            recipients
                .map((r) => r.pending_invite_id)
                .filter((id): id is string => !!id),
        ),
    );

    console.log(`🔍 Resolving ${personIds.length} person IDs and ${pendingInviteIds.length} pending invite IDs...`);

    const profilesById = new Map<string, { email: string | null; full_name: string | null }>();
    const invitesById = new Map<string, { email: string | null; full_name: string | null }>();

    // Fetch profiles
    if (personIds.length > 0) {
        console.log("🔍 Fetching profiles...");
        const { data: profiles, error: profilesError } = await supabaseAdmin
            .from("profiles")
            .select("id, email, full_name")
            .in("id", personIds);

        if (profilesError) {
            console.error("❌ Error loading profiles:", profilesError);
        } else {
            console.log(`✅ Loaded ${profiles?.length || 0} profiles`);
            for (const p of profiles || []) {
                profilesById.set(p.id, {
                    email: p.email ?? null,
                    full_name: p.full_name ?? null,
                });
            }
        }
    }

    // Fetch pending_invites
    if (pendingInviteIds.length > 0) {
        console.log("🔍 Fetching pending invites...");
        const { data: invites, error: invitesError } = await supabaseAdmin
            .from("pending_invites")
            .select("id, email, full_name")
            .in("id", pendingInviteIds);

        if (invitesError) {
            console.error("❌ Error loading pending_invites:", invitesError);
        } else {
            console.log(`✅ Loaded ${invites?.length || 0} pending invites`);
            for (const inv of invites || []) {
                invitesById.set(inv.id, {
                    email: inv.email ?? null,
                    full_name: inv.full_name ?? null,
                });
            }
        }
    }

    const subjectBase =
        mode === "per_set"
            ? `You've been scheduled for "${set.title || "a set"}"`
            : `You've been added to songs in "${set.title || "a set"}"`;

    const dateStr = set.scheduled_date
        ? new Date(set.scheduled_date).toLocaleString()
        : "";

    const results: { key: string; to?: string; status: "sent" | "skipped"; reason?: string; error?: string }[] = [];

    // Process each recipient
    console.log(`📧 Processing ${recipients.length} recipients...`);
    for (const r of recipients) {
        try {
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

            if (!email) {
                console.warn(`⚠️ Skipping recipient with no resolvable email:`, r);
                results.push({
                    key: r.key,
                    status: "skipped",
                    reason: "no_email",
                });
                continue;
            }

            const subject = subjectBase;
            const greetingName = name ? ` ${name}` : "";
            const whenText = dateStr ? ` on ${dateStr}` : "";

            const mainLine =
                mode === "per_set"
                    ? `You've been scheduled for the set <span class=\"highlight\">${set.title || "Untitled set"}</span>${whenText}.`
                    : `You've been added to new songs in the set <span class=\"highlight\">${set.title || "Untitled set"}</span>${whenText}.`;

            const finePrint =
                mode === "per_set"
                    ? "You can view your schedule, roles, and songs in Cadence."
                    : "You can see your updated songs and roles in Cadence.";

            const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${subject}</title>
    <meta name="color-scheme" content="light dark" />
    <style>
      :root {
        color-scheme: light dark;
      }
      /* Default = light mode */
      body {
        margin: 0;
        padding: 0;
        background: #f3f4f6;
        font-family: -apple-system, BlinkMacSystemFont, "Google Sans Flex", "Segoe UI", sans-serif;
        color: #111827;
      }
      .wrapper {
        padding: 32px 16px;
      }
      .card {
        width: 100%;
        max-width: 520px;
        background: #ffffff;
        border-radius: 32px;
        border: 1px solid rgba(15, 23, 42, 0.12);
      }
      .card-inner {
        padding: 32px 32px 24px 32px;
        text-align: left;
      }
      .card-footer {
        padding: 4px 32px 32px 32px;
      }
      .eyebrow {
        margin: 0 0 12px 0;
        font-size: 13px;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-weight: 600;
      }
      .title {
        margin: 0 0 12px 0;
        font-size: 24px;
        line-height: 1.3;
        color: #111827;
        font-weight: 700;
      }
      .body-copy {
        margin: 0;
        font-size: 15px;
        line-height: 1.6;
        color: #374151;
      }
      .fine-print {
        margin: 0;
        font-size: 13px;
        line-height: 1.6;
        color: #6b7280;
      }
      .highlight {
        color: #ff7b51;
        font-weight: 600;
      }
      /* Button styles matching app */
      .btn {
        border: none;
        border-radius: 96px;
        padding: 12px 24px;
        cursor: pointer;
        font-size: 15px;
        font-weight: 600;
        text-decoration: none;
        display: inline-block;
        /* Simulating ::before inner shadow */
        box-shadow: inset 0 1.5px 0 rgba(255, 255, 255, 0.3), inset 0 0 18px rgba(255, 255, 255, 0.3);
        position: relative;
      }
      .btn.primary {
        background-color: #ff7b51;
        /* Simulating ::after gradient sheen using background-image on top of color */
        background-image: linear-gradient(to bottom right, rgba(255, 255, 255, 0.2), transparent);
        color: #0a0a0a;
        border: 1px solid #ff7b51;
      }

      /* Dark mode overrides */
      @media (prefers-color-scheme: dark) {
        body {
          background: #0a0a0a;
          color: #ffffff;
        }
        .card {
          background: #151515;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .eyebrow {
          color: #a0a0a0;
        }
        .title {
          color: #ffffff;
        }
        .body-copy {
          color: #e5e5e5;
        }
        .fine-print {
          color: #a0a0a0;
        }
      }
    </style>
  </head>
  <body>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
      <tr>
        <td align="center" class="wrapper">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" class="card">
            <tr>
              <td class="card-inner">
                <p class="eyebrow">
                  Cadence
                </p>

                <h1 class="title">
                  ${mode === "per_set" ? "You've been scheduled" : "You've got new songs"}
                </h1>
                <p class="body-copy">
                  Hey${greetingName},<br /><br />
                  ${mainLine}
                </p>
                <p style="margin: 24px 0 0 0;">
                  <a
                    href="https://michaeldors.com/cadence"
                    class="btn primary"
                    style="
                      border: none;
                      border-radius: 96px;
                      padding: 12px 24px;
                      cursor: pointer;
                      font-size: 15px;
                      font-weight: 600;
                      text-decoration: none;
                      display: inline-block;
                      background-color: #ff7b51;
                      background-image: linear-gradient(to bottom right, rgba(255, 255, 255, 0.2), transparent);
                      box-shadow: inset 0 1.5px 0 rgba(255, 255, 255, 0.3), inset 0 0 18px rgba(255, 255, 255, 0.3);
                      color: #0a0a0a;
                    "
                  >
                    Open Cadence
                  </a>
                </p>
              </td>
            </tr>
            <tr>
              <td class="card-footer">
                <p class="fine-print">
                  ${finePrint}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

            const emailResult = await sendResendEmail(email, subject, html);

            if (emailResult.success) {
                results.push({
                    key: r.key,
                    to: email,
                    status: "sent",
                });
            } else {
                results.push({
                    key: r.key,
                    to: email,
                    status: "skipped",
                    reason: "resend_error",
                    error: emailResult.error,
                });
            }
        } catch (err) {
            console.error("❌ Failed to process recipient", r, err);
            results.push({
                key: r.key,
                status: "skipped",
                reason: "error",
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }

    const sentCount = results.filter(r => r.status === "sent").length;
    const skippedCount = results.filter(r => r.status === "skipped").length;
    console.log(`✅ Completed: ${sentCount} sent, ${skippedCount} skipped`);

    return new Response(
        JSON.stringify({
            ok: true,
            setId,
            mode,
            results,
            summary: { sent: sentCount, skipped: skippedCount },
        }),
        {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
    );
});
