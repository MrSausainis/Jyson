// manage-subscription - the account page's plan controls.
//
// Actions (POST {action}):
//   status        what the page shows: renewal date, whether withdrawal is open and its refund
//   stop_renewal  cancel at the end of the paid period (access stays until then)
//   resume        undo stop_renewal
//   withdraw      EU 14-day withdrawal: refund, then end the subscription at once
//
// Withdrawal rules (Consumer Rights Directive 2011/83/EU art. 9, 14(3)):
// - open for 14 days from the start of the subscription (the contract), not on renewals;
// - the buyer asked to start at once (checkbox at checkout, saved as
//   subscription metadata immediate_start_requested): the refund is the unused
//   part of the period. Without that request the whole payment comes back;
// - the pro-rata refund is what stops refund abuse: a withdrawal never gives
//   days for free. A customer with 2+ withdrawals in the last 365 days is sent
//   to support instead of the automatic path (the right itself stays).
// Identity, customer, amounts and dates are all server-side; the body only names the action.

import { createClient } from "npm:@supabase/supabase-js@2.95.0";
import Stripe from "npm:stripe@22.6.0";

const ORIGIN = "https://get-jyson.netlify.app";
const WITHDRAW_DAYS = 14;
const AUTO_WITHDRAWALS_PER_YEAR = 2;
const PRICE_TIERS: Record<string, string> = {
  price_1UCPzSJ78TGxjoZzD8Pc4ppZ: "monthly",
  price_1UD87kJ78TGxjoZzyIHNEkQG: "annual",
};
const headers = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2026-08-26.dahlia", timeout: 10000, maxNetworkRetries: 1,
});

class UserError extends Error {
  status: number;
  constructor(message: string, status = 409) { super(message); this.status = status; }
}
const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });

const customerOf = (value: string | { id: string } | null) => typeof value === "string" ? value : value?.id ?? null;
const planItem = (sub: Stripe.Subscription) => sub.items.data.find((item) => Object.hasOwn(PRICE_TIERS, item.price.id));

// The paid part of the subscription's first invoice: amount, currency and the payment intent to refund.
async function firstPayment(sub: Stripe.Subscription) {
  const invoices = await stripe.invoices.list({ subscription: sub.id, limit: 10 });
  const first = invoices.data.filter((i) => i.billing_reason === "subscription_create").at(-1);
  if (!first) throw new UserError("The first payment of this plan could not be found. Email support.");
  const payments = await stripe.invoicePayments.list({ invoice: first.id, status: "paid", limit: 10 });
  const paid = payments.data.find((p) => p.payment?.type === "payment_intent" && p.payment.payment_intent);
  const intent = paid ? customerOf(paid.payment.payment_intent as string | { id: string }) : null;
  return { amount: first.amount_paid, currency: first.currency, intent };
}

// What a withdrawal right now would give back, or why it is not open.
async function withdrawal(sub: Stripe.Subscription, customerId: string) {
  const now = Date.now();
  const until = sub.start_date * 1000 + WITHDRAW_DAYS * 86400000;
  const item = planItem(sub);
  // jyson_withdrawn_at on a still-active subscription means an earlier try stopped
  // between the refund and the cancel: it stays open so a retry can finish it.
  if (!["active", "trialing"].includes(sub.status) || now > until || !item) {
    return { open: false, until, refund: 0, currency: "eur", intent: null as string | null };
  }
  const { amount, currency, intent } = sub.status === "trialing"
    ? { amount: 0, currency: "eur", intent: null }
    : await firstPayment(sub);
  const start = item.current_period_start * 1000, end = item.current_period_end * 1000;
  const unused = end > start ? Math.max(0, Math.min(1, (end - now) / (end - start))) : 0;
  const refund = sub.metadata?.immediate_start_requested === "true" ? Math.floor(amount * unused) : amount;
  // Repeated withdrawals go through support (a person), never refused outright.
  const recent = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 });
  const withdrawals = recent.data.filter((s) => s.id !== sub.id &&
    Number(s.metadata?.jyson_withdrawn_at || 0) > now - 365 * 86400000).length;
  if (withdrawals >= AUTO_WITHDRAWALS_PER_YEAR) {
    return { open: false, until, refund: 0, currency, intent: null, support: true };
  }
  return { open: true, until, refund, currency, intent };
}

async function view(sub: Stripe.Subscription, customerId: string) {
  const item = planItem(sub);
  const w = await withdrawal(sub, customerId);
  return {
    plan: item ? PRICE_TIERS[item.price.id] : null,
    status: sub.status,
    cancel_at_period_end: Boolean(sub.cancel_at_period_end || sub.cancel_at),
    current_period_end: item ? new Date(item.current_period_end * 1000).toISOString() : null,
    can_withdraw: w.open,
    withdraw_until: new Date(w.until).toISOString(),
    withdraw_needs_support: Boolean((w as { support?: boolean }).support),
    refund_cents: w.refund,
    currency: w.currency,
  };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (origin && origin !== ORIGIN) return json({ error: "Origin not allowed" }, 403);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return new Response(null, { status: 405, headers: { ...headers, Allow: "POST, OPTIONS" } });
  const authorization = req.headers.get("Authorization") || "";
  if (!/^Bearer \S+$/i.test(authorization)) return json({ error: "Please sign in again." }, 401);
  let action: unknown;
  try { action = (await req.json())?.action; } catch { return json({ error: "Invalid request." }, 400); }
  if (!["status", "stop_renewal", "resume", "withdraw"].includes(action as string)) return json({ error: "Unknown action." }, 400);

  try {
    const asUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await asUser.auth.getUser();
    if (authError || !authData?.user) return json({ error: "Please sign in again." }, 401);
    const user = authData.user;
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: row, error } = await admin.from("entitlements")
      .select("id,stripe_customer_id,stripe_subscription_id").eq("id", user.id).maybeSingle();
    if (error) return json({ error: "Billing details are temporarily unavailable." }, 503);
    if (!row?.stripe_customer_id || !row.stripe_subscription_id) throw new UserError("There is no paid plan on this account.");
    const customerId = row.stripe_customer_id;
    let sub = await stripe.subscriptions.retrieve(row.stripe_subscription_id);
    if (customerOf(sub.customer) !== customerId) throw new UserError("This plan needs support before it can be changed.");

    if (action === "stop_renewal" || action === "resume") {
      if (!["active", "trialing"].includes(sub.status)) throw new UserError("This plan is not active.");
      sub = await stripe.subscriptions.update(sub.id, { cancel_at_period_end: action === "stop_renewal" });
    } else if (action === "withdraw") {
      const w = await withdrawal(sub, customerId);
      if ((w as { support?: boolean }).support) {
        throw new UserError("Please email jysenai.support@gmail.com to withdraw; we handle repeated withdrawals by hand.");
      }
      if (!w.open) throw new UserError("The 14 days to withdraw have passed. You can still stop renewal.");
      let refunded = 0;
      if (w.refund > 0) {
        if (!w.intent) throw new UserError("The payment could not be found. Email support.");
        // A retry after a lost response reuses the refund already made for this subscription.
        const existing = (await stripe.refunds.list({ payment_intent: w.intent, limit: 20 })).data
          .find((r) => r.metadata?.jyson_withdraw === sub.id && r.status !== "failed" && r.status !== "canceled");
        const refund = existing ?? await stripe.refunds.create({
          payment_intent: w.intent, amount: w.refund, reason: "requested_by_customer",
          metadata: { jyson_withdraw: sub.id, supabase_uid: user.id },
        }, { idempotencyKey: `jyson-withdraw-${sub.id}` });
        refunded = refund.amount;
      }
      await stripe.subscriptions.update(sub.id, { metadata: { jyson_withdrawn_at: String(Date.now()) } });
      // The stripe-webhook sees the deletion and sets the account back to Free.
      await stripe.subscriptions.cancel(sub.id, { prorate: false, invoice_now: false });
      return json({ withdrawn: true, refund_cents: refunded, currency: w.currency });
    }
    return json(await view(sub, customerId));
  } catch (err) {
    if (err instanceof UserError) return json({ error: err.message }, err.status);
    console.error("manage-subscription failed", action);
    return json({ error: "Billing is not reachable right now. Try again in a moment." }, 503);
  }
});
