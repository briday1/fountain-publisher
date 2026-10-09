import { test } from "node:test";
import assert from "node:assert/strict";
import { testDB, request } from "./test-db.mjs";
import {
  billingConfigured,
  billingCatalog,
  approvedPrice,
  syncBilling,
  billingRoutes,
  TEST_PLANS,
} from "./billing.mjs";
import { accountBilling } from "./billing-mode.mjs";
import { premium } from "./accounts.mjs";
const live = {
  APP_ORIGIN: "https://writeshape.com",
  BILLING_MODE: "live",
  LIVE_BILLING_APPROVED: "true",
  STRIPE_LIVE_SECRET_KEY: "sk_live_fixture",
  STRIPE_LIVE_WEBHOOK_SECRET: "whsec_live",
  STRIPE_LIVE_PRODUCT_ID: "prod_live",
  STRIPE_LIVE_MONTHLY_PRICE_ID: "price_month",
  STRIPE_LIVE_YEARLY_PRICE_ID: "price_year",
};
test("live billing requires explicit activation, separate keys and approved distinct live catalog", () => {
  assert.equal(billingConfigured(live), true);
  for (const field of Object.keys(live))
    assert.equal(
      billingConfigured({ ...live, [field]: undefined }),
      false,
      field,
    );
  for (const change of [
    { LIVE_BILLING_APPROVED: "false" },
    { STRIPE_LIVE_SECRET_KEY: "sk_test_wrong" },
    { STRIPE_LIVE_MONTHLY_PRICE_ID: TEST_PLANS.monthly.id },
    { STRIPE_LIVE_YEARLY_PRICE_ID: "price_month" },
  ])
    assert.equal(billingConfigured({ ...live, ...change }), false);
});
test("sandbox access never becomes live access; live reconciliation uses only live customer and columns", async () => {
  const env = { ...testDB(), ...live };
  const until = Math.floor(Date.now() / 1000) + 86400;
  env.sql
    .prepare(
      "INSERT INTO accounts(id,email,created,stripe_customer,billing_status,premium_until,live_stripe_customer) VALUES('a','a@example.test',1,'cus_test','active',?,'cus_live')",
    )
    .run(until);
  let raw = env.sql.prepare("SELECT * FROM accounts WHERE id='a'").get();
  assert.equal(premium(raw), true);
  assert.equal(premium(accountBilling(raw, env)), false);
  const seen = [];
  const stripe = {
    subscriptions: {
      async *list(args) {
        seen.push(args.customer);
      },
    },
    invoices: { async *list() {} },
  };
  await syncBilling("a", env, stripe);
  raw = env.sql.prepare("SELECT * FROM accounts WHERE id='a'").get();
  assert.equal(raw.billing_status, "active");
  assert.equal(raw.premium_until, until);
  assert.equal(raw.billing_version, 0);
  assert.equal(raw.live_billing_version, 1);
  await billingRoutes(request("/api/billing/status"), env, raw, stripe);
  assert.deepEqual(seen, ["cus_live", "cus_live"]);
});
test("live price checks reject test product, mode and price even if amount matches", () => {
  const catalog = billingCatalog(live),
    plan = catalog.plans.monthly;
  const price = {
    id: plan.id,
    livemode: true,
    active: true,
    currency: "usd",
    unit_amount: 599,
    type: "recurring",
    billing_scheme: "per_unit",
    product: catalog.product,
    recurring: { interval: "month", interval_count: 1, usage_type: "licensed" },
  };
  assert.equal(approvedPrice(price, plan, catalog), true);
  for (const change of [
    { livemode: false },
    { id: TEST_PLANS.monthly.id },
    { product: "prod_VJvvBIU1Uuy6RQ" },
    { unit_amount: 801 },
  ])
    assert.equal(approvedPrice({ ...price, ...change }, plan, catalog), false);
});
