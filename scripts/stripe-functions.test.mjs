// The two billing edge functions run here on Node with a fake Stripe and a fake database (no network): the
// TypeScript is stripped, the npm: imports and Deno are replaced, and Deno.serve's handler gets real Requests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";

const root = new URL("../supabase/functions/", import.meta.url);

async function load(name, { stripe, db, salesOpen = false }) {
  let source = stripTypeScriptTypes(readFileSync(new URL(`${name}/index.ts`, root), "utf8"), { mode: "strip" });
  source = source
    .replace(/^import \{ createClient \} from "npm:@supabase\/supabase-js@[^"]+";$/m, "const { createClient } = globalThis.__fake;")
    .replace(/^import Stripe from "npm:stripe@[^"]+";$/m, "const Stripe = globalThis.__fake.Stripe;");
  if (salesOpen) source = source.replace("const SALES_OPEN = false;", "const SALES_OPEN = true;");
  let handler = null;
  globalThis.Deno = { env: { get: () => "x" }, serve: (h) => { handler = h; } };
  globalThis.__fake = { Stripe: function () { return stripe; }, createClient: () => db };
  await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}#${Math.random()}`);
  return handler;
}

function fakeDb({ row = {}, rpc = {}, tables = {} } = {}) {
  const calls = [];
  const query = (table) => {
    const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: table === "entitlements" ? row : tables[table] ?? null, error: null }) };
    return q;
  };
  return {
    calls,
    from: query,
    auth: { getUser: async () => ({ data: { user: { id: "user-1", email: "a@example.invalid" } }, error: null }) },
    rpc: async (name, args) => {
      calls.push([name, args]);
      const answer = rpc[name];
      return { data: typeof answer === "function" ? answer(args) : answer ?? null, error: null };
    },
  };
}

const LIFETIME_PRICE = { id: "price_life", type: "one_time", lookup_key: "jyson_lifetime", metadata: { tier_id: "lifetime" }, product: "prod_l" };
const MONTHLY_PRICE = { id: "price_m249", type: "recurring", lookup_key: "jyson_monthly", metadata: { tier_id: "monthly" }, product: "prod_m" };

function fakeStripe({ session = {}, subs = [], prices = {} } = {}) {
  return {
    webhooks: { constructEventAsync: async (body) => JSON.parse(body) },
    subscriptions: { list: async () => ({ data: subs, has_more: false }) },
    prices: { retrieve: async (id) => prices[id] },
    products: { retrieve: async (id) => ({ id, active: true, metadata: {} }) },
    checkout: { sessions: { retrieve: async () => session } },
  };
}

const post = (event) => new Request("https://x/", { method: "POST", headers: { "stripe-signature": "t", "content-type": "application/json" }, body: JSON.stringify(event) });
const claim = { claim_stripe_webhook: { state: "claimed", token: "tok" } };
const names = (db) => db.calls.map(([n]) => n);
const finish = (db) => db.calls.find(([n]) => n === "finish_stripe_webhook")?.[1];

test("webhook: a monthly checkout on the new price gives monthly and spends the discount code", async () => {
  const db = fakeDb({ row: { id: "user-1", stripe_customer_id: null }, rpc: claim });
  const sub = { id: "sub_1", status: "active", created: 1, items: { data: [{ price: MONTHLY_PRICE, current_period_end: 1800000000 }] } };
  const handler = await load("stripe-webhook", { db, stripe: fakeStripe({ subs: [sub], prices: { price_m249: MONTHLY_PRICE } }) });
  const res = await handler(post({ id: "evt_1", type: "checkout.session.completed", created: 1, data: { object: {
    id: "cs_1", mode: "subscription", customer: "cus_1", client_reference_id: "user-1", metadata: { jyson_code: "SPRING20" } } } }));
  assert.equal(res.status, 200);
  assert.deepEqual(names(db), ["claim_stripe_webhook", "spend_discount", "finish_stripe_webhook"]);
  assert.equal(finish(db).p_tier_id, "monthly");
  assert.deepEqual(db.calls[1][1], { p_user_id: "user-1", p_code: "SPRING20", p_session: "cs_1" });
});

test("webhook: a legacy-price subscription update still maps to its tier", async () => {
  const legacy = { id: "price_1UD87kJ78TGxjoZzyIHNEkQG", type: "recurring", lookup_key: null, metadata: { tier_id: "annual" }, product: "prod_a" };
  const db = fakeDb({ row: { id: "user-1", stripe_customer_id: "cus_1", stripe_subscription_id: "sub_1" }, rpc: claim });
  const sub = { id: "sub_1", status: "active", created: 1, items: { data: [{ price: legacy, current_period_end: 1800000000 }] } };
  const handler = await load("stripe-webhook", { db, stripe: fakeStripe({ subs: [sub], prices: { [legacy.id]: legacy } }) });
  const res = await handler(post({ id: "evt_2", type: "customer.subscription.updated", created: 1, data: { object: { id: "sub_1", customer: "cus_1" } } }));
  assert.equal(res.status, 200);
  assert.equal(finish(db).p_tier_id, "annual");
  assert.equal(finish(db).p_user_id, null);
});

test("webhook: a paid lifetime checkout grants lifetime with no end", async () => {
  const db = fakeDb({ row: { id: "user-1", stripe_customer_id: null, stripe_subscription_id: null, stripe_subscription_status: null }, rpc: claim });
  const session = { id: "cs_l", mode: "payment", payment_status: "paid", metadata: { jyson_plan: "lifetime" },
    line_items: { data: [{ quantity: 1, price: LIFETIME_PRICE }], has_more: false } };
  const handler = await load("stripe-webhook", { db, stripe: fakeStripe({ session, prices: { price_life: LIFETIME_PRICE } }) });
  const res = await handler(post({ id: "evt_3", type: "checkout.session.completed", created: 1, data: { object: {
    id: "cs_l", mode: "payment", customer: "cus_1", client_reference_id: "user-1", metadata: { jyson_plan: "lifetime" } } } }));
  assert.equal(res.status, 200);
  assert.equal(finish(db).p_tier_id, "lifetime");
  assert.equal(finish(db).p_expires_at, null);
});

test("webhook: an unpaid lifetime waits (lease released, nothing granted); the later payment grants it", async () => {
  const unpaid = { id: "cs_l", mode: "payment", payment_status: "unpaid", metadata: { jyson_plan: "lifetime" },
    line_items: { data: [{ quantity: 1, price: LIFETIME_PRICE }], has_more: false } };
  const event = (type) => post({ id: `evt_${type}`, type, created: 1, data: { object: {
    id: "cs_l", mode: "payment", customer: "cus_1", client_reference_id: "user-1", metadata: { jyson_plan: "lifetime" } } } });
  let db = fakeDb({ row: { id: "user-1", stripe_customer_id: null }, rpc: claim });
  let handler = await load("stripe-webhook", { db, stripe: fakeStripe({ session: unpaid, prices: { price_life: LIFETIME_PRICE } }) });
  let res = await handler(event("checkout.session.completed"));
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "Waiting for the payment");
  assert.deepEqual(names(db), ["claim_stripe_webhook", "release_stripe_webhook"]);
  db = fakeDb({ row: { id: "user-1", stripe_customer_id: null }, rpc: claim });
  handler = await load("stripe-webhook", { db, stripe: fakeStripe({ session: { ...unpaid, payment_status: "paid" }, prices: { price_life: LIFETIME_PRICE } }) });
  res = await handler(event("checkout.session.async_payment_succeeded"));
  assert.equal(res.status, 200);
  assert.equal(finish(db).p_tier_id, "lifetime");
});

test("webhook: other one-time payments (the Support page) and a wrong lifetime price change nothing", async () => {
  let db = fakeDb({ rpc: claim });
  let handler = await load("stripe-webhook", { db, stripe: fakeStripe() });
  let res = await handler(post({ id: "evt_d", type: "checkout.session.completed", created: 1, data: { object: { id: "cs_d", mode: "payment", customer: "cus_9", metadata: {} } } }));
  assert.equal(res.status, 200);
  assert.deepEqual(db.calls, []);
  const wrong = { ...LIFETIME_PRICE, lookup_key: "something_else" };
  db = fakeDb({ row: { id: "user-1", stripe_customer_id: null }, rpc: claim });
  handler = await load("stripe-webhook", { db, stripe: fakeStripe({ session: { id: "cs_l", mode: "payment", payment_status: "paid",
    metadata: { jyson_plan: "lifetime" }, line_items: { data: [{ quantity: 1, price: wrong }], has_more: false } }, prices: { price_life: wrong } }) });
  res = await handler(post({ id: "evt_w", type: "checkout.session.completed", created: 1, data: { object: {
    id: "cs_l", mode: "payment", customer: "cus_1", client_reference_id: "user-1", metadata: { jyson_plan: "lifetime" } } } }));
  assert.equal(res.status, 500);
  assert.ok(!names(db).includes("finish_stripe_webhook"));
  assert.ok(names(db).includes("release_stripe_webhook"));
});

// ---- create-checkout (with SALES_OPEN flipped on in the copy under test only)
const CONFIG = { currency: "EUR", monthly: 2.49, annual: 19.99, lifetime: 16.99 };
function checkoutStripe({ prices, coupons = {}, sessions = [] } = {}) {
  const made = { sessions: [], coupons: [] };
  return {
    made,
    prices: { list: async ({ lookup_keys }) => ({ data: prices.filter((p) => lookup_keys.includes(p.lookup_key)) }) },
    products: { retrieve: async (id) => ({ id, active: true, metadata: {} }) },
    customers: { create: async () => ({ id: "cus_new" }) },
    subscriptions: { list: async () => ({ data: [], has_more: false }) },
    coupons: {
      retrieve: async (id) => { if (coupons[id]) return coupons[id]; const e = new Error("missing"); e.code = "resource_missing"; throw e; },
      create: async (params) => { made.coupons.push(params); return { id: params.id, valid: true }; },
    },
    checkout: { sessions: {
      list: async () => ({ data: sessions, has_more: false }),
      create: async (params) => { made.sessions.push(params); return { id: "cs_new", status: "open", url: "https://checkout/x", mode: params.mode, customer: params.customer, client_reference_id: params.client_reference_id }; },
      retrieve: async () => ({ id: "cs_new", status: "open", url: "https://checkout/x", mode: made.sessions.at(-1).mode, customer: "cus_new", client_reference_id: "user-1" }),
    } },
  };
}
const price = (key, tier, amount, recurring) => ({ id: `price_${key}`, lookup_key: key, unit_amount: amount, currency: "eur", active: true,
  type: recurring ? "recurring" : "one_time", recurring: recurring ? { interval: recurring, interval_count: 1 } : null,
  metadata: { tier_id: tier }, product: { id: `prod_${tier}`, active: true, metadata: {} } });
const ALL = [price("jyson_monthly", "monthly", 249, "month"), price("jyson_annual", "annual", 1999, "year"), price("jyson_lifetime", "lifetime", 1699, null)];
function checkoutDb({ entitlement = { stripe_customer_id: null, tier_id: "free", tier_source: "signup" }, discount = null, offerOpen = true } = {}) {
  return fakeDb({ row: entitlement, tables: { app_config: { value: CONFIG } }, rpc: {
    get_legal_acceptance_status: { accepted: true }, claim_checkout: { state: "claimed", token: "t", attempt: null },
    save_checkout_attempt: true, release_checkout: true, checkout_discount: discount,
    offer_status: { lifetime: { open: offerOpen } } } });
}
const buy = (body) => new Request("https://x/", { method: "POST", headers: { Authorization: "Bearer u", "content-type": "application/json" }, body: JSON.stringify(body) });

test("checkout: closed until launch says so", async () => {
  const handler = await load("create-checkout", { db: checkoutDb(), stripe: checkoutStripe({ prices: ALL }) });
  const res = await handler(buy({ plan: "monthly" }));
  assert.equal(res.status, 403);
  assert.match((await res.json()).error, /not on sale yet/);
});

test("checkout: monthly uses the lookup-key price; a saved code becomes a one-time coupon", async () => {
  const stripe = checkoutStripe({ prices: ALL });
  const handler = await load("create-checkout", { salesOpen: true, db: checkoutDb({ discount: { code: "SPRING20", kind: "percent", value: 20 } }), stripe });
  const res = await handler(buy({ plan: "monthly", immediate_start: true }));
  assert.equal(res.status, 200, JSON.stringify(await res.clone().json()));
  const s = stripe.made.sessions[0];
  assert.equal(s.mode, "subscription");
  assert.deepEqual(s.line_items, [{ price: "price_jyson_monthly", quantity: 1 }]);
  assert.deepEqual(s.discounts, [{ coupon: "jyson-spring20-20pct" }]);
  assert.equal(s.metadata.jyson_code, "SPRING20");
  assert.deepEqual(stripe.made.coupons[0], { id: "jyson-spring20-20pct", duration: "once", name: "Jyson code SPRING20", metadata: { jyson_code: "SPRING20" }, percent_off: 20 });
});

test("checkout: lifetime is a one-time payment while the offer is open, refused when it is closed", async () => {
  const stripe = checkoutStripe({ prices: ALL });
  let handler = await load("create-checkout", { salesOpen: true, db: checkoutDb(), stripe });
  let res = await handler(buy({ plan: "lifetime" }));
  assert.equal(res.status, 200, JSON.stringify(await res.clone().json()));
  assert.equal(stripe.made.sessions[0].mode, "payment");
  assert.equal(stripe.made.sessions[0].metadata.jyson_plan, "lifetime");
  assert.equal(stripe.made.sessions[0].invoice_creation.enabled, true);
  handler = await load("create-checkout", { salesOpen: true, db: checkoutDb({ offerOpen: false }), stripe: checkoutStripe({ prices: ALL }) });
  res = await handler(buy({ plan: "lifetime" }));
  assert.equal(res.status, 409);
});

test("checkout: a Stripe price that differs from the admin panel's price is not sold", async () => {
  const off = [price("jyson_monthly", "monthly", 200, "month")];
  const handler = await load("create-checkout", { salesOpen: true, db: checkoutDb(), stripe: checkoutStripe({ prices: off }) });
  const res = await handler(buy({ plan: "monthly" }));
  assert.equal(res.status, 503);
  assert.match((await res.json()).error, /Prices are being updated/);
});

test("checkout: no price with the lookup key, an unknown plan, or lifetime already owned are refused", async () => {
  let handler = await load("create-checkout", { salesOpen: true, db: checkoutDb(), stripe: checkoutStripe({ prices: [] }) });
  assert.equal((await handler(buy({ plan: "annual" }))).status, 503);
  handler = await load("create-checkout", { salesOpen: true, db: checkoutDb(), stripe: checkoutStripe({ prices: ALL }) });
  assert.equal((await handler(buy({ plan: "forever" }))).status, 400);
  handler = await load("create-checkout", { salesOpen: true, stripe: checkoutStripe({ prices: ALL }),
    db: checkoutDb({ entitlement: { stripe_customer_id: "cus_1", tier_id: "lifetime", tier_source: "stripe" } }) });
  assert.equal((await handler(buy({ plan: "monthly" }))).status, 409);
});
