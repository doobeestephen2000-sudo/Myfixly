import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const invalidCredentials = () => new Response(
  JSON.stringify({ error: "Incorrect email/phone number or password." }),
  { status: 401, headers: corsHeaders },
);

function phoneCandidates(value: string): string[] {
  const raw = value.trim();
  const digits = raw.replace(/\D/g, "");
  const candidates = new Set([raw, digits]);
  if (/^0\d{10}$/.test(digits)) candidates.add(`+234${digits.slice(1)}`);
  if (/^234\d{10}$/.test(digits)) candidates.add(`+${digits}`);
  if (/^\+234\d{10}$/.test(raw)) candidates.add(`0${digits.slice(3)}`);
  return [...candidates];
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  try {
    const { phone, password } = await request.json();
    if (typeof phone !== "string" || !phone.trim() || typeof password !== "string" || !password) {
      return invalidCredentials();
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    if (!supabaseUrl || !serviceRoleKey || !publishableKey) {
      console.error("Phone login is not configured.");
      return new Response(JSON.stringify({ error: "Authentication is temporarily unavailable." }), { status: 503, headers: corsHeaders });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const { data: matches, error: lookupError } = await admin
      .from("profiles")
      .select("email")
      .in("phone", phoneCandidates(phone))
      .limit(2);

    // The identical response for no/ambiguous account or wrong password avoids
    // exposing which phone numbers are registered.
    if (lookupError || !matches || matches.length !== 1 || !matches[0].email) return invalidCredentials();

    const auth = createClient(supabaseUrl, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await auth.auth.signInWithPassword({ email: matches[0].email, password });
    if (error || !data.session) return invalidCredentials();

    return new Response(JSON.stringify({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    }), { headers: corsHeaders });
  } catch (error) {
    console.error("Phone login failed", error);
    return invalidCredentials();
  }
});
