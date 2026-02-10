import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.94.1";
import { UAParser } from "npm:ua-parser-js@1.0.35";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { status: 200, headers: corsHeaders });
    }

    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            throw new Error('Missing Authorization header');
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

        if (userError || !user) {
            return new Response(JSON.stringify({ error: "Unauthorized", details: userError }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const { action, sessionId } = await req.json();

        if (action === 'get-sessions') {
            // Use RPC call to bypass Schema restrictions
            // The auth schema is not exposed to PostgREST, so we use a SECURITY DEFINER function
            const { data: sessions, error } = await supabaseAdmin
                .rpc('get_user_sessions', { target_user_id: user.id });

            if (error) {
                console.error("Database error fetching sessions:", error);
                throw new Error(`Database error: ${error.message}`);
            }

            // Parse UA strings
            const friendlySessions = (sessions || []).map((s: any) => {
                let deviceName = 'Unknown Device';
                let deviceType = 'desktop'; // default

                // Handle empty UA
                if (s.user_agent) {
                    try {
                        const parser = new UAParser(s.user_agent);
                        const browser = parser.getBrowser();
                        const os = parser.getOS();
                        const device = parser.getDevice();

                        const browserName = browser.name || 'Unknown Browser';
                        const osName = os.name || '';

                        if (device.type === 'mobile' || device.type === 'tablet') {
                            deviceType = 'mobile';
                            deviceName = `${browserName} on ${device.vendor || ''} ${device.model || 'Device'}`;
                        } else {
                            deviceName = `${browserName} on ${osName}`;
                        }
                        // Cleanup extra spaces
                        deviceName = deviceName.replace(/\s+/g, ' ').trim();
                    } catch (e) {
                        console.error("Error parsing UA:", e);
                        deviceName = s.user_agent; // Fallback
                    }
                }

                return {
                    id: s.id,
                    created_at: s.created_at,
                    updated_at: s.updated_at,
                    device_name: deviceName,
                    device_type: deviceType, // 'mobile' or 'desktop' for icon selection
                    ip: s.ip,
                    is_current: false // Will be determined on client side
                };
            });

            return new Response(JSON.stringify({ sessions: friendlySessions }), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });

        } else if (action === 'revoke-session') {
            if (!sessionId) {
                throw new Error("Missing sessionId");
            }

            // Security check: Ensure session belongs to user via RPC
            const { error } = await supabaseAdmin
                .rpc('revoke_user_session', { target_session_id: sessionId, target_user_id: user.id });

            if (error) throw error;

            return new Response(JSON.stringify({ success: true }), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        throw new Error(`Unknown action: ${action}`);

    } catch (error: any) {
        console.error("Session Manager Error:", error);
        return new Response(JSON.stringify({ error: error.message, stack: error.stack }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
