// ============================================================================
// create-checkout - Supabase Edge Function
// Phase 2B checkout hardening
//
// Compatibility:
// - clients send { plan: "monthly" | "annual" | "lifetime" }; an old { price_id }
//   must name a legacy price of the same plan
//
// Security:
// - only the price holding the plan's lookup key is accepted server-side
// - Stripe price/product state and tier metadata are revalidated server-side
// - caller identity comes only from the verified Supabase JWT
//
// 2026-11-07: { immediate_start: true } (the buyer's "start my plan right away"
// box) is saved on the new subscription's metadata. manage-subscription reads
// it: with it, an EU withdrawal refunds the unused part; without it, all of it.
// It records the buyer's request only and authorizes nothing.
//
// 2026-11-14 (owner): the prices are found by their Stripe lookup key
// (jyson_monthly / jyson_annual / jyson_lifetime) and must carry the matching
// tier_id metadata, and their amount must equal the admin panel's price
// (app_config 'prices') - a new price in Stripe takes over by moving the lookup
// key to it. { plan: "lifetime" } is a one-time payment, sold only while
// public.offer_status() says the launch offer is open. A Jyson discount code the
// account saved (public.checkout_discount) becomes a Stripe coupon on the
// checkout; stripe-webhook marks it used when the checkout completes.
// ============================================================================

import { createClient } from "npm:@supabase/supabase-js@2.95.0";
import Stripe from "npm:stripe@22.6.0";

// No paid sales until the seller is registered (owner, 7 Nov 2026). Accounts use Free or the free trial meanwhile.
// Flip to true at launch (and checkout_open in the admin panel, which the site and the app read).
const SALES_OPEN = false;

const ACCOUNT_PAGE_URL = "https://get-jyson.netlify.app/account";
const WEBSITE_ORIGIN = "https://get-jyson.netlify.app";

const PLANS = {
  monthly: { lookupKey: "jyson_monthly", tierId: "monthly", mode: "subscription", interval: "month" },
  annual: { lookupKey: "jyson_annual", tierId: "annual", mode: "subscription", interval: "year" },
  lifetime: { lookupKey: "jyson_lifetime", tierId: "lifetime", mode: "payment", interval: null },
} as const;

type PlanId = keyof typeof PLANS;

// The prices made before the lookup keys (2 / 20 EUR): an old open checkout made with them is still recognised.
const LEGACY_PRICES: Record<string, PlanId> = {
  price_1UCPzSJ78TGxjoZzD8Pc4ppZ: "monthly",
  price_1UD87kJ78TGxjoZzyIHNEkQG: "annual",
};

function planOfPrice(price: Stripe.Price | null | undefined): PlanId | null {
  if (!price) return null;
  for (const [plan, config] of Object.entries(PLANS)) if (price.lookup_key === config.lookupKey) return plan as PlanId;
  return LEGACY_PRICES[price.id] ?? null;
}

type Discount = { code: string; kind: "percent" | "amount"; value: number };

const corsHeaders = {
  "Access-Control-Allow-Origin": WEBSITE_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2026-08-26.dahlia",
  timeout: 20000,
  maxNetworkRetries: 1,
});

class CheckoutError extends Error {
  status: number;
  constructor(message: string, status = 409) { super(message); this.status = status; }
}

type Attempt = {
  id: string;
  startedAt: number;
  plan: PlanId;
  code?: string | null;
  customerParams: Stripe.CustomerCreateParams;
  sessionParams?: Stripe.Checkout.SessionCreateParams;
  sessionId?: string;
};

// Bound every scan. Incomplete Stripe reads must never authorize a new checkout.
async function listAll<T extends { id: string }>(fetchPage: (cursor?: string) => Promise<{ data: T[]; has_more: boolean }>) {
  const rows: T[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 5; page++) {
    const result = await fetchPage(cursor);
    rows.push(...result.data);
    if (!result.has_more) return rows;
    if (!result.data.length) break;
    cursor = result.data[result.data.length - 1].id;
  }
  throw new CheckoutError("Could not verify existing billing state. Try again later.", 503);
}

function assertOwner(session: Stripe.Checkout.Session, customerId: string, userId: string, mode?: string) {
  const customer = typeof session.customer === "string" ? session.customer : session.customer?.id;
  const modeOk = mode ? session.mode === mode : session.mode === "subscription" || session.mode === "payment";
  if (customer !== customerId || session.client_reference_id !== userId || !modeOk) {
    throw new CheckoutError("Existing checkout requires billing support.");
  }
}

// The one active price with this plan's lookup key, checked against its tier metadata and the admin panel's price.
async function currentPrice(plan: PlanId, prices: Record<string, unknown>): Promise<Stripe.Price> {
  const expected = PLANS[plan];
  const found = await stripe.prices.list({ lookup_keys: [expected.lookupKey], active: true, limit: 2, expand: ["data.product"] });
  if (found.data.length !== 1) {
    console.error(`create-checkout: ${found.data.length} active prices for ${expected.lookupKey}`);
    throw new CheckoutError("This plan is temporarily unavailable", 503);
  }
  const price = found.data[0];
  const shapeOk = expected.mode === "subscription"
    ? price.type === "recurring" && price.recurring?.interval === expected.interval && price.recurring.interval_count === 1
    : price.type === "one_time";
  let product: Stripe.Product | null = null;
  if (price.product && typeof price.product !== "string" && !price.product.deleted) product = price.product;
  else if (typeof price.product === "string") {
    const fetched = await stripe.products.retrieve(price.product);
    if (!fetched.deleted) product = fetched;
  }
  const metadataTier = price.metadata?.tier_id || product?.metadata?.tier_id;
  const listed = Number(prices[plan]);
  const currency = String(prices.currency || "EUR").toLowerCase();
  const amountOk = Number.isFinite(listed) && listed > 0 && price.unit_amount === Math.round(listed * 100) && price.currency === currency;
  if (!shapeOk || !product || !product.active || metadataTier !== expected.tierId) {
    console.error(`create-checkout: the ${plan} price is not usable (shape ${shapeOk}, tier ${metadataTier ?? "missing"})`);
    throw new CheckoutError("This plan is temporarily unavailable", 503);
  }
  if (!amountOk) {
    console.error(`create-checkout: the ${plan} price in Stripe differs from the admin panel's price`);
    throw new CheckoutError("Prices are being updated - try again a little later.", 503);
  }
  return price;
}

// A saved Jyson code as a Stripe coupon (made once; the id names the code and its value, so a changed code gets a new one).
async function couponFor(discount: Discount, currency: string): Promise<string> {
  const value = discount.kind === "percent" ? `${discount.value}pct` : `${Math.round(discount.value * 100)}${currency}`;
  const id = `jyson-${discount.code}-${value}`.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 120);
  try {
    const coupon = await stripe.coupons.retrieve(id);
    if (!coupon.valid) throw new CheckoutError("Your discount code can't be used right now - contact support.", 409);
    return coupon.id;
  } catch (error) {
    if (error instanceof CheckoutError) throw error;
    if ((error as { code?: string }).code !== "resource_missing") throw error;
  }
  const coupon = await stripe.coupons.create({
    id, duration: "once", name: `Jyson code ${discount.code}`.slice(0, 40), metadata: { jyson_code: discount.code },
    ...(discount.kind === "percent"
      ? { percent_off: discount.value }
      : { amount_off: Math.round(discount.value * 100), currency }),
  }, { idempotencyKey: `jyson-coupon-${id}` });
  return coupon.id;
}

function assertRetryWindow(attempt: Attempt) {
  // Stripe can prune idempotency keys after 24h. Never repeat an ambiguous
  // create outside a conservative window; a lost response requires recovery.
  if (!Number.isFinite(attempt.startedAt) || Date.now() - attempt.startedAt >= 23 * 3600000) {
    throw new CheckoutError("An earlier checkout needs billing support before retrying.");
  }
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(PLANS, value);
}

// { plan } only; an old client's { price_id } must name a legacy price of the same plan.
function resolveRequestedPlan(body: Record<string, unknown>): PlanId | null {
  const requestedPlan = body.plan;
  const requestedPrice = body.price_id;
  if (!isPlanId(requestedPlan)) {
    return requestedPlan === undefined && typeof requestedPrice === "string" ? LEGACY_PRICES[requestedPrice] ?? null : null;
  }
  if (requestedPrice !== undefined && LEGACY_PRICES[String(requestedPrice)] !== requestedPlan) return null;
  return requestedPlan;
}

async function databaseAnswers(timeoutMs = 4000): Promise<boolean> {
  try {
    const probe = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const answer = probe.from("app_config").select("key").eq("key", "prices").maybeSingle().then(({ error }) => !error);
    const late = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs));
    return await Promise.race([answer, late]);
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }
  if (!SALES_OPEN) {
    return jsonResponse({ error: "Paid plans are not on sale yet. Use Free or the free trial on your account page meanwhile." }, 403);
  }
  // Circuit breaker (master plan, section 8): when the database doesn't answer within 4 s, no new payment starts - a
  // checkout opened now could not be recorded or reconciled. Nothing is charged; the buyer is told to try again soon.
  if (!(await databaseAnswers())) {
    return jsonResponse({ error: "Payments are paused for a moment while our servers recover. Nothing was charged - try again in a few minutes." }, 503);
  }

  let admin: ReturnType<typeof createClient> | undefined;
  let ownerId: string | undefined;
  let token: string | undefined;
  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonResponse({ error: "Invalid checkout body" }, 400);
    }
    const plan = resolveRequestedPlan(body);
    if (!plan) {
      return jsonResponse({ error: "Unknown or unsupported Jyson plan" }, 400);
    }
    const immediateStart = body.immediate_start === true;

    // Verify the authenticated caller using their own Authorization header.
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseAsUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userError } = await supabaseAsUser.auth.getUser();
    if (userError || !userData?.user) {
      return jsonResponse({ error: "Not authenticated" }, 401);
    }
    const user = userData.user;
    // New purchases require independent server-controlled evidence. Metadata
    // and client-supplied consent flags cannot authorize Checkout creation.
    const { data: legal, error: legalError } = await supabaseAsUser.rpc("get_legal_acceptance_status");
    if (legalError || !legal) return jsonResponse({ error: "Could not verify Terms confirmation. Try again later." }, 503);
    if (legal.accepted !== true) return jsonResponse({ error: "Confirm the current Terms in your account before starting checkout." }, 403);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    admin = supabaseAdmin;
    ownerId = user.id;
    const { data: claim, error: claimError } = await admin.rpc("claim_checkout", { p_user_id: user.id });
    if (claimError || !claim) throw new Error("Checkout claim failed");
    if (claim.state === "busy") return jsonResponse({ error: "Checkout is already being prepared. Try again in a moment." }, 409);
    if (claim.state !== "claimed" || !claim.token) throw new Error("Invalid checkout claim");
    token = claim.token;
    let attempt: Attempt | null = claim.attempt?.id ? claim.attempt : null;
    const save = async (next: Attempt | null, customerId: string | null = null) => {
      const { error } = await supabaseAdmin.rpc("save_checkout_attempt", {
        p_user_id: user.id, p_token: token, p_attempt: next ?? {}, p_customer_id: customerId,
      });
      if (error) throw new Error("Checkout snapshot commit failed");
      attempt = next;
    };

    // Server-side price validation: only the price holding this plan's lookup key, with the matching tier
    // metadata and the admin panel's amount, can reach the checkout - whatever the client sent.
    const { data: config, error: configError } = await supabaseAdmin.from("app_config").select("value").eq("key", "prices").maybeSingle();
    if (configError || !config?.value) return jsonResponse({ error: "This plan is temporarily unavailable" }, 503);
    const listedPrices = config.value as Record<string, unknown>;
    const currency = String(listedPrices.currency || "EUR").toLowerCase();
    const price = await currentPrice(plan, listedPrices);
    if (plan === "lifetime") {
      const { data: offer, error: offerError } = await supabaseAdmin.rpc("offer_status");
      if (offerError || offer?.lifetime?.open !== true) {
        return jsonResponse({ error: "The lifetime offer is closed (sold out or ended)." }, 409);
      }
    }

    const { data: entitlement, error: entitlementError } = await supabaseAdmin
      .from("entitlements")
      .select("stripe_customer_id,tier_id,tier_source")
      .eq("id", user.id)
      .maybeSingle();

    if (entitlementError || !entitlement) {
      console.error("create-checkout: failed to load entitlement row", entitlementError?.message);
      return jsonResponse({ error: "Could not prepare checkout" }, 500);
    }

    // Avoid accidentally creating multiple concurrent paid subscriptions.
    // Changing between monthly/annual should be handled later by a dedicated
    // subscription-management flow instead of creating a second subscription.
    if (
      entitlement.tier_source === "stripe" &&
      (entitlement.tier_id === "monthly" || entitlement.tier_id === "annual")
    ) {
      return jsonResponse(
        { error: "An active Jyson subscription already exists for this account" },
        409,
      );
    }
    if (entitlement.tier_source === "stripe" && entitlement.tier_id === "lifetime") {
      return jsonResponse({ error: "This account already has lifetime - there is nothing more to buy." }, 409);
    }

    // A discount code this account saved and has not used yet (the newest); it rides on the attempt below.
    const { data: saved, error: savedError } = await supabaseAdmin.rpc("checkout_discount", { p_user_id: user.id });
    if (savedError) return jsonResponse({ error: "Could not prepare checkout" }, 500);
    const discount: Discount | null = saved && (saved.kind === "percent" || saved.kind === "amount") && Number(saved.value) > 0
      ? { code: String(saved.code), kind: saved.kind, value: Number(saved.value) } : null;
    const code = discount?.code ?? null;

    let customerId: string | null = entitlement.stripe_customer_id;
    let open: Stripe.Checkout.Session[] = [];
    if (customerId) {
      const subscriptions = await listAll<Stripe.Subscription>((cursor) => stripe.subscriptions.list({
        customer: customerId!, status: "all", limit: 100, ...(cursor ? { starting_after: cursor } : {}),
      }));
      if (subscriptions.some((s) => !["canceled", "incomplete_expired"].includes(s.status))) {
        throw new CheckoutError("A subscription already exists. Manage it instead of starting another.");
      }
      open = (await listAll<Stripe.Checkout.Session>((cursor) => stripe.checkout.sessions.list({
        customer: customerId!, status: "open", limit: 100, ...(cursor ? { starting_after: cursor } : {}),
      }))).filter((s) => s.mode === "subscription" || (s.mode === "payment" && s.metadata?.jyson_plan === "lifetime"));
      if (open.length > 1) throw new CheckoutError("Multiple existing checkouts require billing support.");
      for (const session of open) assertOwner(session, customerId, user.id);
    }

    // Adopt a single pre-migration open checkout, or recover a response lost
    // after Stripe created our session but before its ID was committed.
    if (open.length) {
      const session = open[0];
      if (attempt && session.id !== attempt.sessionId && session.metadata?.checkout_attempt !== attempt.id) {
        throw new CheckoutError("Another unfinished checkout requires billing support.");
      }
      if (!attempt) {
        const lines = await stripe.checkout.sessions.listLineItems(session.id, { limit: 2 });
        const previousPlan = lines.data.length === 1 && !lines.has_more && lines.data[0].quantity === 1
          ? planOfPrice(lines.data[0].price) : null;
        if (!previousPlan) throw new CheckoutError("Existing checkout uses an unsupported plan.");
        await save({ id: crypto.randomUUID(), startedAt: Date.now(), plan: previousPlan, customerParams: {}, sessionId: session.id });
      } else if (!attempt.sessionId) {
        await save({ ...attempt, sessionId: session.id });
      }
    }

    if (attempt?.sessionId) {
      let session = await stripe.checkout.sessions.retrieve(attempt.sessionId);
      assertOwner(session, customerId!, user.id, PLANS[attempt.plan].mode);
      if (session.status === "complete" && session.mode === "payment") {
        throw new CheckoutError("Your lifetime purchase went through - refresh your plan in a moment.");
      } else if (session.status === "complete") {
        const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
        if (!subscriptionId) throw new CheckoutError("Previous checkout is still being processed.");
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const customer = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
        if (customer !== customerId || !["canceled", "incomplete_expired"].includes(subscription.status)) {
          throw new CheckoutError("Previous checkout is complete. Manage the existing subscription.");
        }
      } else if (session.status === "open") {
        if (attempt.plan === plan && (attempt.code ?? null) === code) {
          if (!session.url) throw new CheckoutError("Checkout is temporarily unavailable.", 502);
          return jsonResponse({ url: session.url });
        }
        // Renew/fence ownership before the external mutation. Stripe expiration
        // wins or completion wins; never start the replacement on ambiguity.
        await save(attempt);
        session = await stripe.checkout.sessions.expire(session.id);
        if (session.status !== "expired") throw new CheckoutError("Previous checkout could not be closed.");
      } else if (session.status !== "expired") {
        throw new CheckoutError("Previous checkout status is unavailable.", 503);
      }
      await save(null);
    }

    if (!attempt) {
      await save({ id: crypto.randomUUID(), startedAt: Date.now(), plan, code,
        customerParams: { ...(user.email ? { email: user.email } : {}), metadata: { supabase_uid: user.id } },
      });
    }
    // An unresolved old-plan create must be recovered with its original exact
    // parameters, never with the newly clicked plan's parameters.
    assertRetryWindow(attempt!);
    if (!customerId) {
      await save(attempt);
      const customer = await stripe.customers.create(attempt!.customerParams, {
        idempotencyKey: `jyson-customer-${attempt!.id}`,
      });
      customerId = customer.id;
      await save(attempt, customerId);
    }
    if (!attempt!.sessionParams) {
      const original = PLANS[attempt!.plan];
      // A recovered older attempt keeps its own plan and code, never the newly clicked ones.
      const attemptPrice = attempt!.plan === plan ? price : await currentPrice(attempt!.plan, listedPrices);
      const attemptDiscount = (attempt!.code ?? null) === code ? discount : null;
      const coupon = attemptDiscount ? await couponFor(attemptDiscount, currency) : null;
      const startNow = {
        supabase_uid: user.id,
        immediate_start_requested: immediateStart ? "true" : "false",
        immediate_start_requested_at: immediateStart ? new Date().toISOString() : "",
      };
      const common = {
        customer: customerId, client_reference_id: user.id,
        line_items: [{ price: attemptPrice.id, quantity: 1 }],
        // Collect a billing address and keep it on the bound Stripe Customer
        // for later subscription invoices. Only new snapshots get this policy;
        // ambiguous retries must keep their original idempotency parameters.
        billing_address_collection: "required" as const,
        customer_update: { address: "auto" as const },
        success_url: `${ACCOUNT_PAGE_URL}?checkout=success`, cancel_url: `${ACCOUNT_PAGE_URL}?checkout=cancelled`,
        metadata: {
          jyson_plan: attempt!.plan, supabase_uid: user.id, checkout_attempt: attempt!.id,
          ...(coupon && attemptDiscount ? { jyson_code: attemptDiscount.code } : {}),
        },
        ...(coupon ? { discounts: [{ coupon }] } : {}),
        integration_identifier: `jyson-checkout-${Array.from(crypto.getRandomValues(new Uint8Array(8)), (n) => String.fromCharCode(97 + n % 26)).join("")}`,
        // Existing production workaround: Managed Payments requires tax codes.
        managed_payments: { enabled: false },
      };
      const sessionParams: Stripe.Checkout.SessionCreateParams = original.mode === "subscription"
        // The buyer's start-now request travels with the subscription (EU withdrawal refunds).
        ? { ...common, mode: "subscription", subscription_data: { metadata: startNow } }
        // Lifetime: one payment, with an invoice as the receipt; the request travels with the payment.
        : { ...common, mode: "payment", payment_intent_data: { metadata: { ...startNow, jyson_plan: "lifetime" } },
            invoice_creation: { enabled: true, invoice_data: { metadata: { supabase_uid: user.id, jyson_plan: "lifetime" } } } };
      await save({ ...attempt!, sessionParams });
    }
    if (attempt!.sessionParams!.customer !== customerId) throw new Error("Checkout customer changed");
    await save(attempt);
    const createdSession = await stripe.checkout.sessions.create(attempt!.sessionParams!, {
      idempotencyKey: `jyson-checkout-${attempt!.id}`,
    });
    const attemptMode = PLANS[attempt!.plan].mode;
    assertOwner(createdSession, customerId!, user.id, attemptMode);
    await save({ ...attempt!, sessionId: createdSession.id });
    const session = await stripe.checkout.sessions.retrieve(createdSession.id);
    assertOwner(session, customerId!, user.id, attemptMode);
    // A recovered create may return a historical complete/expired snapshot.
    // Retrieve on the next request rather than return an obsolete cached URL.
    if (attempt!.plan !== plan || (attempt!.code ?? null) !== code || session.status !== "open" || !session.url) {
      throw new CheckoutError("Earlier checkout recovered. Retry to continue with the selected plan.");
    }
    return jsonResponse({ url: session.url });
  } catch (err) {
    if (err instanceof CheckoutError) return jsonResponse({ error: err.message }, err.status);
    console.error("create-checkout: billing preparation failed");
    return jsonResponse({ error: "Could not start checkout" }, 500);
  } finally {
    if (admin && ownerId && token) {
      const { error } = await admin.rpc("release_checkout", { p_user_id: ownerId, p_token: token });
      if (error) console.error("create-checkout: lease release failed; bounded expiry will recover it");
    }
  }
});
