// ============================================================================
// delete-account - Supabase Edge Function (14 Nov 2026)
//
// Privacy said "full account deletion requires server-side coordination so active billing and legally required records
// are handled correctly; this remains a pre-launch blocker". This is it:
//   1. who asks comes only from their verified Supabase JWT, and the body must say {"confirm": "DELETE MY ACCOUNT"};
//   2. an active Stripe subscription is cancelled first (at once, nothing more is charged); if Stripe can't be reached,
//      NOTHING is deleted (503) - an account must never vanish while it still pays;
//   3. public.forget_account removes what has no foreign key (the review, codes used, trial history, the name in the
//      testers list and feature rules); deleting the auth user then cascades to the profile, entitlements, checkout
//      attempts, legal acceptances and pairing tokens.
// Stripe keeps its own billing records (tax and fraud rules), as Privacy says. Admin accounts are refused (409).
// ============================================================================

import { createClient } from "npm:@supabase/supabase-js@2.95.0";
import Stripe from "npm:stripe@22.6.0";

const CONFIRM = "DELETE MY ACCOUNT";
const LIVE_STATUSES = new Set(["active", "trialing", "past_due", "unpaid", "incomplete"]);
const ALLOWED_ORIGINS = new Set(["https://get-jyson.netlify.app"]);

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  return ALLOWED_ORIGINS.has(origin)
    ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "authorization, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" }
    : {};
}

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders(req) } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return json(req, { error: "Sign in first." }, 401);
  let body: { confirm?: unknown } = {};
  try { body = await req.json(); } catch { /* checked below */ }
  if (body.confirm !== CONFIRM) return json(req, { error: `Confirm with "${CONFIRM}".` }, 400);

  const url = Deno.env.get("SUPABASE_URL")!;
  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: { persistSession: false } });
  const { data: who, error: whoError } = await asUser.auth.getUser(jwt);
  if (whoError || !who?.user?.id) return json(req, { error: "Your sign-in has expired - sign in again." }, 401);
  const userId = who.user.id;

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: isAdmin, error: adminError } = await admin.rpc("account_is_admin", { target: userId });
  if (adminError) return json(req, { error: "Could not check the account - nothing was deleted. Try again later." }, 503);
  if (isAdmin) return json(req, { error: "This account is an admin account and is removed by hand." }, 409);

  // 2. billing first: an account must never vanish while a subscription still charges it
  const { data: ent, error: entError } = await admin.from("entitlements")
    .select("stripe_subscription_id, stripe_subscription_status").eq("id", userId).maybeSingle();
  if (entError) return json(req, { error: "Could not check your plan - nothing was deleted. Try again later." }, 503);
  const subscription = ent?.stripe_subscription_id;
  if (subscription && LIVE_STATUSES.has(String(ent?.stripe_subscription_status || ""))) {
    try {
      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { httpClient: Stripe.createFetchHttpClient() });
      const current = await stripe.subscriptions.retrieve(subscription);
      if (current.status !== "canceled") await stripe.subscriptions.cancel(subscription, { prorate: false });
    } catch {
      return json(req, { error: "Could not cancel your subscription with Stripe - nothing was deleted. Try again later." }, 503);
    }
  }

  // 3. what has no foreign key, then the auth user (which cascades to the rest)
  const { error: forgetError } = await admin.rpc("forget_account", { target: userId });
  if (forgetError) return json(req, { error: "Could not delete your data - nothing more was changed. Try again later." }, 503);
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) return json(req, { error: "Your data was removed, but the sign-in could not be deleted - try again." }, 503);
  return json(req, { deleted: true });
});
