import { test } from "node:test";
import assert from "node:assert/strict";
import Stripe from "stripe";
import { testDB, request } from "./test-db.mjs";
import {
  TEST_PLANS,
  approvedPrice,
  billingConfigured,
  billingRoutes,
  subscriptionState,
  stripeWebhook,
  syncBilling,
} from "./billing.mjs";
import { premium } from "./accounts.mjs";
const future = () => Math.floor(Date.now() / 1000) + 3600;
const price = (plan = "monthly", extra = {}) => ({
  id: TEST_PLANS[plan].id,
  livemode: false,
  active: true,
  type: "recurring",
  billing_scheme: "per_unit",
  product: "prod_VJvvBIU1Uuy6RQ",
  currency: "usd",
  unit_amount: TEST_PLANS[plan].amount,
  recurring: {
    interval: TEST_PLANS[plan].interval,
    interval_count: 1,
    usage_type: "licensed",
  },
  ...extra,
});
const sub = (status = "active", extra = {}) => ({
  id: "sub_test",
  customer: "cus_alice",
  status,
  livemode: false,
  items: {
    data: [{ price: price(), quantity: 1, current_period_end: future() }],
  },
  ...extra,
});
function setup() {
  const env = {
    ...testDB(),
    APP_ORIGIN: "https://writeshape.com",
    BILLING_MODE: "test",
    STRIPE_SECRET_KEY: "sk_test_fixture",
    STRIPE_WEBHOOK_SECRET: "whsec_fixture",
    STRIPE_MONTHLY_PRICE_ID: TEST_PLANS.monthly.id,
    STRIPE_YEARLY_PRICE_ID: TEST_PLANS.yearly.id,
  };
  env.sql
    .prepare(
      "INSERT INTO accounts (id,email,stripe_customer,created) VALUES (?,?,?,?)",
    )
    .run("alice", "alice@example.test", "cus_alice", 1);
  env.sql
    .prepare(
      "INSERT INTO accounts (id,email,stripe_customer,created) VALUES (?,?,?,?)",
    )
    .run("bob", "bob@example.test", "cus_bob", 1);
  let subscriptions = [];
  const calls = [];
  let listCalls = 0;
  const sessions = new Map();
  const actualStripe = new Stripe("sk_test_fixture");
  const stripe = {
    webhooks: actualStripe.webhooks,
    subscriptions: {
      list: ({ customer }) => {
        listCalls++;
        return (async function* () {
          for (const s of subscriptions) if (s.customer === customer) yield s;
        })();
      },
    },
    prices: {
      retrieve: async (id) =>
        price(id === TEST_PLANS.yearly.id ? "yearly" : "monthly"),
    },
    customers: {
      create: async (...args) => {
        calls.push(["customer", ...args]);
        return { id: "cus_new", livemode: false };
      },
    },
    checkout: {
      sessions: {
        create: async (...args) => {
          calls.push(["checkout", ...args]);
          const key = args[1].idempotencyKey;
          if (!sessions.has(key))
            sessions.set(key, {
              id: "cs_test_" + sessions.size,
              livemode: false,
              mode: "subscription",
              customer: args[0].customer,
              status: "open",
              url: "https://checkout.stripe.com/c/pay/cs_test_" + sessions.size,
            });
          return { ...sessions.get(key) };
        },
        retrieve: async (id) => ({
          ...[...sessions.values()].find((s) => s.id === id),
        }),
        expire: async (id) => {
          const session = [...sessions.values()].find((s) => s.id === id);
          if (session.status !== "open") throw Error("Not open");
          session.status = "expired";
          session.url = null;
          return { ...session };
        },
      },
    },
    billingPortal: {
      sessions: {
        create: async (...args) => {
          calls.push(["portal", ...args]);
          return { url: "https://billing.stripe.com/p/session/test" };
        },
      },
    },
  };
  const account = (id) =>
    env.sql.prepare("SELECT * FROM accounts WHERE id=?").get(id);
  return {
    env,
    stripe,
    calls,
    sessions,
    account,
    setSubscriptions: (s) => (subscriptions = s),
    listCalls: () => listCalls,
  };
}
async function eventRequest(
  event,
  secret = "whsec_fixture",
  timestamp = Math.floor(Date.now() / 1000),
) {
  const raw = JSON.stringify(event);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = Array.from(
    new Uint8Array(
      await crypto.subtle.sign(
        "HMAC",
        key,
        new TextEncoder().encode(timestamp + "." + raw),
      ),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
  return new Request("https://writeshape.com/api/billing/webhook", {
    method: "POST",
    headers: { "Stripe-Signature": `t=${timestamp},v1=${signature}` },
    body: raw,
  });
}
const event = (
  id,
  type = "customer.subscription.updated",
  customer = "cus_alice",
) => ({
  id,
  type,
  livemode: false,
  created: Math.floor(Date.now() / 1000),
  data: { object: { customer, metadata: { writeshape_account: "bob" } } },
});
test("billing refuses live mode, missing settings, and unauthenticated/cross-origin checkout", async () => {
  const f = setup();
  assert.equal(billingConfigured(f.env), true);
  assert.equal(
    billingConfigured({ ...f.env, STRIPE_SECRET_KEY: "sk_live_forbidden" }),
    false,
  );
  assert.equal(
    billingConfigured({ ...f.env, STRIPE_MONTHLY_PRICE_ID: "" }),
    false,
  );
  await assert.rejects(
    () =>
      billingRoutes(
        request("/api/billing/checkout", { plan: "monthly" }),
        f.env,
        null,
        f.stripe,
      ),
    /Sign in/,
  );
  await assert.rejects(
    () =>
      billingRoutes(
        request(
          "/api/billing/checkout",
          { plan: "monthly" },
          "",
          "https://evil.test",
        ),
        f.env,
        f.account("alice"),
        f.stripe,
      ),
    /origin/,
  );
  await assert.rejects(
    () =>
      billingRoutes(
        request("/api/billing/checkout", { plan: "monthly" }),
        { ...f.env, STRIPE_SECRET_KEY: "" },
        f.account("alice"),
        f.stripe,
      ),
    /not configured/,
  );
  assert.equal(f.calls.length, 0);
});
test("checkout and portal use only server-owned customer and configured test price; retries reuse idempotency", async () => {
  const f = setup();
  const data = {
    plan: "monthly",
    customer: "cus_bob",
    account: "bob",
    price: "price_attacker",
    success_url: "https://evil.test",
  };
  await billingRoutes(
    request("/api/billing/checkout", data),
    f.env,
    f.account("alice"),
    f.stripe,
  );
  await billingRoutes(
    request("/api/billing/checkout", data),
    f.env,
    f.account("alice"),
    f.stripe,
  );
  const [a, b] = f.calls;
  assert.equal(a[1].customer, "cus_alice");
  assert.equal(a[1].line_items[0].price, TEST_PLANS.monthly.id);
  assert.equal(a[1].success_url, "https://writeshape.com/?account=billing");
  assert.equal(a[2].idempotencyKey, b[2].idempotencyKey);
  await billingRoutes(
    request("/api/billing/portal", data),
    f.env,
    f.account("alice"),
    f.stripe,
  );
  assert.equal(f.calls.at(-1)[1].customer, "cus_alice");
  assert.equal(premium(f.account("alice")), false);
});
test("existing subscriptions cannot create duplicate checkout; non-test prices are rejected", async () => {
  const f = setup();
  f.setSubscriptions([sub("past_due")]);
  await assert.rejects(
    () =>
      billingRoutes(
        request("/api/billing/checkout", { plan: "monthly" }),
        f.env,
        f.account("alice"),
        f.stripe,
      ),
    /already exists/,
  );
  f.stripe.prices.retrieve = async () => ({
    livemode: true,
    active: true,
    recurring: {},
  });
  await assert.rejects(
    () =>
      billingRoutes(
        request("/api/billing/checkout", { plan: "monthly" }),
        f.env,
        f.account("alice"),
        f.stripe,
      ),
    /test price/,
  );
});
test("verified webhook grants only mapped account; replay is idempotent and metadata is ignored", async () => {
  const f = setup();
  f.setSubscriptions([sub()]);
  const e = event("evt_grant");
  assert.equal(
    (await stripeWebhook(await eventRequest(e), f.env, f.stripe)).status,
    200,
  );
  assert.equal(premium(f.account("alice")), true);
  assert.equal(premium(f.account("bob")), false);
  const calls = f.listCalls();
  await stripeWebhook(await eventRequest(e), f.env, f.stripe);
  assert.equal(f.listCalls(), calls);
  assert.equal(
    f.env.sql.prepare("SELECT count(*) AS n FROM billing_events").get().n,
    1,
  );
});
test("invalid, stale, live and tampered webhook signatures fail without granting access", async () => {
  const f = setup();
  f.setSubscriptions([sub()]);
  await assert.rejects(
    () =>
      eventRequest(event("evt_bad"), "wrong").then((r) =>
        stripeWebhook(r, f.env, f.stripe),
      ),
    /signature/,
  );
  await assert.rejects(
    () =>
      eventRequest(event("evt_stale"), "whsec_fixture", 1).then((r) =>
        stripeWebhook(r, f.env, f.stripe),
      ),
    /signature/,
  );
  await assert.rejects(
    () =>
      eventRequest({ ...event("evt_live"), livemode: true }).then((r) =>
        stripeWebhook(r, f.env, f.stripe),
      ),
    /test events/,
  );
  const signed = await eventRequest(event("evt_tampered"));
  const altered = new Request(signed.url, {
    method: "POST",
    headers: signed.headers,
    body: JSON.stringify(event("evt_other")),
  });
  await assert.rejects(
    () => stripeWebhook(altered, f.env, f.stripe),
    /signature/,
  );
  assert.equal(premium(f.account("alice")), false);
});
test("renewal, cancellation, failed payment and recovery reconcile current Stripe state despite event order", async () => {
  const f = setup();
  f.setSubscriptions([sub("active", { cancel_at_period_end: true })]);
  await stripeWebhook(
    await eventRequest(event("evt_cancel_scheduled")),
    f.env,
    f.stripe,
  );
  assert.equal(premium(f.account("alice")), true);
  assert.equal(f.account("alice").cancel_at_period_end, 1);
  f.setSubscriptions([sub("past_due")]);
  await stripeWebhook(
    await eventRequest(event("evt_failed", "invoice.payment_failed")),
    f.env,
    f.stripe,
  );
  assert.equal(premium(f.account("alice")), false);
  f.setSubscriptions([sub("active")]);
  await stripeWebhook(
    await eventRequest(event("evt_renewed", "invoice.paid")),
    f.env,
    f.stripe,
  );
  assert.equal(premium(f.account("alice")), true);
  f.setSubscriptions([sub("canceled")]);
  await stripeWebhook(
    await eventRequest(event("evt_deleted", "customer.subscription.deleted")),
    f.env,
    f.stripe,
  );
  assert.equal(premium(f.account("alice")), false);
  // Late event snapshot says active, but canonical Stripe state remains canceled.
  await stripeWebhook(
    await eventRequest({ ...event("evt_old", "invoice.paid"), created: 1 }),
    f.env,
    f.stripe,
  );
  assert.equal(premium(f.account("alice")), false);
});
test("unknown price, expiration, incomplete/unpaid/paused status never grants premium", () => {
  for (const status of [
    "incomplete",
    "incomplete_expired",
    "unpaid",
    "paused",
    "canceled",
    "past_due",
    "trialing",
  ])
    assert.equal(subscriptionState(sub(status)).until, 0);
  assert.equal(
    subscriptionState(
      sub("active", {
        items: {
          data: [
            {
              price: price("monthly", { id: "price_other" }),
              quantity: 1,
              current_period_end: future(),
            },
          ],
        },
      }),
    ).until,
    0,
  );
  assert.equal(
    subscriptionState(
      sub("active", {
        items: {
          data: [{ price: price(), quantity: 1, current_period_end: 1 }],
        },
      }),
    ).until,
    0,
  );
  assert.equal(
    subscriptionState(sub("active", { pause_collection: { behavior: "void" } }))
      .until,
    0,
  );
});
test("webhook failures remain retryable and never record a processed event early", async () => {
  const f = setup();
  const list = f.stripe.subscriptions.list;
  f.stripe.subscriptions.list = () => {
    throw Error("network fixture failure");
  };
  await assert.rejects(
    () =>
      eventRequest(event("evt_retry")).then((r) =>
        stripeWebhook(r, f.env, f.stripe),
      ),
    /network/,
  );
  assert.equal(
    f.env.sql.prepare("SELECT count(*) AS n FROM billing_events").get().n,
    0,
  );
  f.stripe.subscriptions.list = list;
  f.setSubscriptions([sub()]);
  await stripeWebhook(await eventRequest(event("evt_retry")), f.env, f.stripe);
  assert.equal(premium(f.account("alice")), true);
});
test("overlapping reconciliations retry stale snapshots before applying entitlement", async () => {
  const f = setup();
  let release;
  const hold = new Promise((r) => (release = r));
  let started;
  const entered = new Promise((r) => (started = r));
  let n = 0;
  f.stripe.subscriptions.list = () => {
    const call = ++n;
    return (async function* () {
      if (call === 1) {
        started();
        await hold;
        yield sub("active");
      } else yield sub("canceled");
    })();
  };
  const older = syncBilling("alice", f.env, f.stripe);
  await entered;
  await syncBilling("alice", f.env, f.stripe);
  release();
  await older;
  assert.equal(premium(f.account("alice")), false);
  assert.equal(n, 3);
});

test("monthly/yearly choice validates the complete approved sandbox price shape", async () => {
  const f = setup();
  for (const bad of [
    { currency: "eur" },
    { unit_amount: 801 },
    { product: "prod_other" },
    { id: TEST_PLANS.yearly.id },
    { livemode: true },
    { active: false },
    {
      recurring: {
        interval: "year",
        interval_count: 1,
        usage_type: "licensed",
      },
    },
    {
      recurring: {
        interval: "month",
        interval_count: 2,
        usage_type: "licensed",
      },
    },
    {
      recurring: {
        interval: "month",
        interval_count: 1,
        usage_type: "metered",
      },
    },
    {
      recurring: {
        interval: "month",
        interval_count: 1,
        usage_type: "licensed",
        trial_period_days: 7,
      },
    },
    { transform_quantity: { divide_by: 2, round: "up" } },
    { billing_scheme: "tiered" },
  ]) {
    assert.equal(
      approvedPrice(price("monthly", bad), TEST_PLANS.monthly),
      false,
    );
    f.stripe.prices.retrieve = async () => price("monthly", bad);
    await assert.rejects(
      () =>
        billingRoutes(
          request("/api/billing/checkout", { plan: "monthly" }),
          f.env,
          f.account("alice"),
          f.stripe,
        ),
      /approved plan/,
    );
  }
  assert.equal(f.calls.length, 0);
  for (const plan of ["weekly", "__proto__", "constructor", null, undefined])
    await assert.rejects(
      () =>
        billingRoutes(
          request("/api/billing/checkout", { plan }),
          f.env,
          f.account("alice"),
          f.stripe,
        ),
      /Choose monthly or yearly/,
    );
});

test("switching plans expires the prior Checkout, retains account ownership, and uses a distinct safe key", async () => {
  const f = setup();
  await billingRoutes(
    request("/api/billing/checkout", { plan: "monthly" }),
    f.env,
    f.account("alice"),
    f.stripe,
  );
  await billingRoutes(
    request("/api/billing/checkout", { plan: "yearly" }),
    f.env,
    f.account("alice"),
    f.stripe,
  );
  const created = f.calls.filter((c) => c[0] === "checkout");
  assert.equal(created.at(-1)[1].line_items[0].price, TEST_PLANS.yearly.id);
  assert.notEqual(
    created[0][2].idempotencyKey,
    created.at(-1)[2].idempotencyKey,
  );
  assert.equal(
    created.at(-1)[1].subscription_data.billing_mode.type,
    "flexible",
  );
  assert.equal(
    created.at(-1)[1].subscription_data.trial_period_days,
    undefined,
  );
  assert.equal(
    [...f.sessions.values()].filter((s) => s.status === "open").length,
    1,
  );
  assert.equal([...f.sessions.values()][0].status, "expired");
  const yearly = sub("active", {
    items: {
      data: [
        { price: price("yearly"), quantity: 1, current_period_end: future() },
      ],
    },
  });
  assert.ok(subscriptionState(yearly).until > 0);
});

test("concurrent conflicting choices and retries leave at most one open Checkout", async () => {
  const f = setup();
  const results = await Promise.allSettled(
    ["monthly", "yearly", "monthly", "yearly"].map((plan) =>
      billingRoutes(
        request("/api/billing/checkout", { plan }),
        f.env,
        f.account("alice"),
        f.stripe,
      ),
    ),
  );
  for (const result of results) {
    if (result.status === "rejected") {
      assert.ok([409, 503].includes(result.reason.status));
      if (result.reason.status === 503)
        assert.match(result.reason.message, /sync is busy/);
    }
  }
  assert.equal(
    [...f.sessions.values()].filter((s) => s.status === "open").length,
    1,
  );
  assert.ok(f.sessions.size <= 4);
});

test("completed Checkout cannot be replaced even before its subscription appears in reconciliation", async () => {
  const f = setup();
  await billingRoutes(
    request("/api/billing/checkout", { plan: "monthly" }),
    f.env,
    f.account("alice"),
    f.stripe,
  );
  [...f.sessions.values()][0].status = "complete";
  await assert.rejects(
    () =>
      billingRoutes(
        request("/api/billing/checkout", { plan: "yearly" }),
        f.env,
        f.account("alice"),
        f.stripe,
      ),
    /Checkout is completing/,
  );
  assert.equal(f.sessions.size, 1);
});

test("no trial entitlement is granted from subscription or cached account; tester access is preserved", () => {
  assert.equal(subscriptionState(sub("trialing")).until, 0);
  assert.equal(
    premium({ billing_status: "trialing", premium_until: future() }),
    false,
  );
  assert.equal(
    premium({
      private_tester: 1,
      billing_status: "trialing",
      premium_until: 0,
    }),
    true,
  );
});

test("old subscription events cannot revoke a newer active subscription", async () => {
  const f = setup();
  f.setSubscriptions([
    sub("canceled", { id: "sub_old" }),
    sub("active", { id: "sub_new" }),
  ]);
  await stripeWebhook(
    await eventRequest(
      event("evt_old_deleted", "customer.subscription.deleted"),
    ),
    f.env,
    f.stripe,
  );
  assert.equal(premium(f.account("alice")), true);
});
