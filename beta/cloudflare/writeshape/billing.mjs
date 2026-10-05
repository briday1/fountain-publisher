import Stripe from "stripe";
import {
  accountBilling,
  billingColumns,
  billingMode,
} from "./billing-mode.mjs";
import { HttpError, bodyJson, json, now, sameOrigin } from "./http.mjs";
import { randomToken } from "./accounts.mjs";
import { sendPendingFeedback } from "./cancellation-feedback.mjs";

// Explicit catalogs; live activation requires separate credentials and approval.
export const TEST_PLANS = Object.freeze({
  monthly: Object.freeze({
    id: "price_1UJI3mCoZzTH3rR02FrxECSY",
    amount: 800,
    interval: "month",
  }),
  yearly: Object.freeze({
    id: "price_1UJI3rCoZzTH3rR0fHBGdUzU",
    amount: 8000,
    interval: "year",
  }),
});
const TEST_PRODUCT = "prod_VJvvBIU1Uuy6RQ";
export function billingCatalog(env = {}) {
  const live = billingMode(env) === "live";
  return {
    livemode: live,
    product: live ? env.STRIPE_LIVE_PRODUCT_ID : TEST_PRODUCT,
    plans: live
      ? {
          monthly: {
            ...TEST_PLANS.monthly,
            id: env.STRIPE_LIVE_MONTHLY_PRICE_ID,
          },
          yearly: { ...TEST_PLANS.yearly, id: env.STRIPE_LIVE_YEARLY_PRICE_ID },
        }
      : TEST_PLANS,
  };
}
const billingSecret = (env) =>
  billingMode(env) === "live"
    ? env.STRIPE_LIVE_SECRET_KEY
    : env.STRIPE_SECRET_KEY;
const webhookSecret = (env) =>
  billingMode(env) === "live"
    ? env.STRIPE_LIVE_WEBHOOK_SECRET
    : env.STRIPE_WEBHOOK_SECRET;
export const billingConfigured = (env) => {
  if (
    env.APP_ORIGIN !== "https://writeshape.com" ||
    !/^whsec_/.test(webhookSecret(env) || "")
  )
    return false;
  if (env.BILLING_MODE === "test")
    return (
      /^sk_test_/.test(billingSecret(env) || "") &&
      env.STRIPE_MONTHLY_PRICE_ID === TEST_PLANS.monthly.id &&
      env.STRIPE_YEARLY_PRICE_ID === TEST_PLANS.yearly.id
    );
  const catalog = billingCatalog(env);
  return (
    env.BILLING_MODE === "live" &&
    env.LIVE_BILLING_APPROVED === "true" &&
    /^sk_live_/.test(billingSecret(env) || "") &&
    /^prod_[A-Za-z0-9]+$/.test(catalog.product || "") &&
    Object.values(catalog.plans).every(
      (p) =>
        /^price_[A-Za-z0-9]+$/.test(p.id || "") &&
        !Object.values(TEST_PLANS).some((t) => t.id === p.id),
    ) &&
    catalog.plans.monthly.id !== catalog.plans.yearly.id
  );
};
export function approvedPrice(price, plan, catalog = billingCatalog()) {
  return (
    !!plan &&
    price?.id === plan.id &&
    price.livemode === catalog.livemode &&
    price.active === true &&
    price.currency === "usd" &&
    price.unit_amount === plan.amount &&
    price.type === "recurring" &&
    price.billing_scheme === "per_unit" &&
    !price.transform_quantity &&
    price.recurring?.interval === plan.interval &&
    price.recurring.interval_count === 1 &&
    price.recurring.usage_type === "licensed" &&
    !price.recurring.trial_period_days &&
    (typeof price.product === "string" ? price.product : price.product?.id) ===
      catalog.product
  );
}
export const stripeClient = (env) =>
  new Stripe(billingSecret(env), {
    apiVersion: "2026-08-26.dahlia",
    httpClient: Stripe.createFetchHttpClient(),
    maxNetworkRetries: 2,
  });
const objectId = (value) => (typeof value === "string" ? value : value?.id);
export function paidInvoiceFor(sub, catalog = billingCatalog()) {
  const invoice = sub.latest_invoice;
  return (
    !!invoice &&
    typeof invoice === "object" &&
    invoice.livemode === catalog.livemode &&
    invoice.status === "paid" &&
    invoice.amount_remaining === 0 &&
    objectId(invoice.customer) === objectId(sub.customer) &&
    objectId(
      invoice.parent?.subscription_details?.subscription ||
        invoice.subscription,
    ) === sub.id
  );
}
const cancellationScheduled = (sub) =>
  !!sub && (!!sub.cancel_at_period_end || Number(sub.cancel_at) > now());
export function subscriptionState(
  sub,
  previousUntil = 0,
  catalog = billingCatalog(),
) {
  const allItems = sub.items?.data || [];
  const items = allItems.filter(
    (item) =>
      item.quantity === 1 &&
      Object.values(catalog.plans).some((plan) =>
        approvedPrice(item.price, plan, catalog),
      ),
  );
  const end = Math.max(
    0,
    ...items.map((item) =>
      Number(item.current_period_end || sub.current_period_end || 0),
    ),
  );
  const enabled =
    sub.livemode === catalog.livemode &&
    !sub.pause_collection &&
    ["active", "past_due"].includes(sub.status) &&
    items.length === 1 &&
    allItems.length === 1 &&
    !sub.items?.has_more &&
    Number.isFinite(end) &&
    end > now();
  // A future subscription period alone is not evidence of payment. In particular,
  // a failed plan change must never extend the previously paid access window.
  const paidEnd =
    sub.status === "active" &&
    paidInvoiceFor(sub, catalog) &&
    !sub.has_unpaid_invoices
      ? Math.max(
          0,
          ...(sub.latest_invoice.lines?.data || [])
            .filter(
              (line) =>
                objectId(
                  line.parent?.subscription_item_details?.subscription ||
                    line.subscription,
                ) === sub.id &&
                Object.values(catalog.plans).some(
                  (p) =>
                    p.id ===
                    objectId(line.pricing?.price_details?.price || line.price),
                ) &&
                line.amount >= 0 &&
                Number.isFinite(line.period?.end),
            )
            .map((line) => line.period.end),
        )
      : 0;
  const until = enabled
    ? Math.min(end, sub.cancel_at || end, Math.max(paidEnd, previousUntil))
    : 0;
  return {
    status: sub.status || "none",
    until,
    plan:
      items.length === 1
        ? Object.keys(catalog.plans).find(
            (key) => catalog.plans[key].id === items[0].price.id,
          )
        : null,
    periodEnd: Number.isFinite(end) ? end : 0,
    cancel: cancellationScheduled(sub),
  };
}
export async function subscriptionsFor(
  customer,
  stripe,
  catalog = billingCatalog(),
) {
  const subscriptions = [];
  for await (const sub of stripe.subscriptions.list({
    customer,
    status: "all",
    limit: 100,
    expand: ["data.latest_invoice"],
  })) {
    if (sub.livemode !== catalog.livemode)
      throw new HttpError(503, "Unexpected Stripe subscription mode.");
    // Outstanding invoices must not fund a later change through unpaid credits.
    sub.has_unpaid_invoices = false;
    for await (const invoice of stripe.invoices.list({
      customer,
      subscription: sub.id,
      limit: 100,
    })) {
      if (invoice.livemode !== catalog.livemode)
        throw new HttpError(503, "Unexpected Stripe invoice mode.");
      if (
        ["open", "uncollectible"].includes(invoice.status) &&
        invoice.amount_remaining > 0
      )
        sub.has_unpaid_invoices = true;
    }
    subscriptions.push(sub);
  }
  return subscriptions;
}
export async function syncBilling(accountId, env, stripe) {
  const catalog = billingCatalog(env),
    columns = billingColumns(env);
  // Read version BEFORE remote state, then CAS. Overlapping events cannot apply an older fetch last.
  for (let retry = 0; retry < 4; retry++) {
    const account = accountBilling(
      await env.DB.prepare("SELECT * FROM accounts WHERE id=?")
        .bind(accountId)
        .first(),
      env,
    );
    if (!account?.stripe_customer) return [];
    const subscriptions = await subscriptionsFor(
      account.stripe_customer,
      stripe,
      catalog,
    );
    const states = subscriptions.map((sub) =>
      subscriptionState(
        sub,
        ["active", "past_due"].includes(account.billing_status)
          ? account.premium_until
          : 0,
        catalog,
      ),
    );
    const entitled = states
      .filter((s) => s.until > now())
      .sort((a, b) => b.until - a.until)[0];
    const pending = states.find((s) =>
      ["past_due", "unpaid", "incomplete", "paused"].includes(s.status),
    );
    const state = entitled ||
      pending ||
      states[0] || { status: "none", until: 0, cancel: false };
    const result = await env.DB.prepare(
      `UPDATE accounts SET ${columns.status}=?,${columns.until}=?,${columns.cancel}=?,${columns.version}=${columns.version}+1 WHERE id=? AND ${columns.version}=?`,
    )
      .bind(
        state.status,
        state.until,
        Number(state.cancel),
        accountId,
        account.billing_version,
      )
      .run();
    if (result.meta.changes) return subscriptions;
  }
  throw new HttpError(503, "Subscription sync is busy. Please retry.");
}
export async function stripeWebhook(request, env, stripe) {
  if (!billingConfigured(env))
    throw new HttpError(503, "Billing is not configured yet.");
  stripe ||= stripeClient(env);
  const catalog = billingCatalog(env),
    columns = billingColumns(env);
  if (request.method !== "POST") throw new HttpError(405, "Use POST.");
  const raw = await request.text();
  if (raw.length > 1000000) throw new HttpError(413, "Event too large.");
  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      raw,
      request.headers.get("Stripe-Signature") || "",
      webhookSecret(env),
      300,
      Stripe.createSubtleCryptoProvider(),
    );
  } catch {
    throw new HttpError(400, "Invalid Stripe signature.");
  }
  if (event.livemode !== catalog.livemode || event.account)
    throw new HttpError(400, "Unexpected Stripe event mode or account.");
  if (
    await env.DB.prepare("SELECT id FROM billing_events WHERE id=?")
      .bind(event.id)
      .first()
  )
    return json({ received: true });
  const relevant =
    event.type.startsWith("customer.subscription.") ||
    [
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
      "invoice.paid",
      "invoice.payment_failed",
      "invoice.payment_action_required",
    ].includes(event.type);
  if (relevant) {
    const customer = event.data.object.customer;
    const customerId = typeof customer === "string" ? customer : customer?.id;
    if (customerId) {
      const account = await env.DB.prepare(
        `SELECT id FROM accounts WHERE ${columns.customer}=?`,
      )
        .bind(customerId)
        .first();
      // Ownership comes only from our customer mapping, never client_reference_id or webhook metadata.
      if (account) await syncBilling(account.id, env, stripe);
    }
  }
  await env.DB.prepare(
    "INSERT OR IGNORE INTO billing_events (id,processed) VALUES (?,?)",
  )
    .bind(event.id, now())
    .run();
  return json({ received: true });
}
export function billingSummary(subscriptions, catalog = billingCatalog()) {
  const current = subscriptions.filter(
    (s) => !["canceled", "incomplete_expired"].includes(s.status),
  );
  const sub = current[0] || subscriptions[0];
  const state = sub ? subscriptionState(sub, 0, catalog) : null;
  const canChange =
    current.length === 1 &&
    sub.status === "active" &&
    !!state.plan &&
    paidInvoiceFor(sub, catalog) &&
    !sub.has_unpaid_invoices &&
    !sub.pending_update &&
    !sub.schedule &&
    !cancellationScheduled(sub);
  return {
    subscriptionId: sub?.id || null,
    status: sub?.status || "none",
    plan: state?.plan || null,
    periodEnd: state?.periodEnd || 0,
    cancelAtPeriodEnd: cancellationScheduled(sub),
    cancelAt:
      sub?.cancel_at || (sub?.cancel_at_period_end ? state?.periodEnd : 0) || 0,
    invoiceStatus:
      typeof sub?.latest_invoice === "object"
        ? sub.latest_invoice?.status
        : null,
    hasSubscription: current.length > 0,
    canChange,
    canCancel: current.length === 1 && !cancellationScheduled(sub),
    changeReason: canChange
      ? ""
      : cancellationScheduled(sub)
        ? "Cancellation is scheduled. Manage billing to keep your subscription before changing plans."
        : sub?.schedule || sub?.pending_update
          ? "A subscription change is already pending. Manage billing to review it."
          : current.length > 1
            ? "More than one subscription needs review in billing."
            : "Resolve any outstanding payment in billing before changing plans.",
  };
}
async function portalConfiguration(
  stripe,
  allowChange,
  catalog = billingCatalog(),
) {
  // Explicit per-session configuration; never inherit an unrelated default portal.
  // Versions are immutable. Concurrent calls use the same idempotency key.
  const version =
    "writeshape-account-v4-" +
    (catalog.livemode ? "live-" : "test-") +
    (allowChange ? "change-" : "manage-") +
    catalog.product;
  for (const plan of Object.values(catalog.plans)) {
    if (!approvedPrice(await stripe.prices.retrieve(plan.id), plan, catalog))
      throw new HttpError(503, "The billing catalog needs attention.");
  }
  let config;
  for await (const item of stripe.billingPortal.configurations.list({
    active: true,
    limit: 100,
  })) {
    if (
      item.livemode === catalog.livemode &&
      item.metadata?.writeshape_version === version
    ) {
      config = item;
      break;
    }
  }
  const features = {
    customer_update: { enabled: false },
    invoice_history: { enabled: true },
    payment_method_update: { enabled: true },
    subscription_cancel: {
      enabled: true,
      mode: "at_period_end",
      proration_behavior: "none",
      cancellation_reason: { enabled: false, options: ["unused", "other"] },
    },
    subscription_update: {
      enabled: allowChange,
      default_allowed_updates: ["price"],
      products: [
        {
          product: catalog.product,
          adjustable_quantity: { enabled: false },
          prices: Object.values(catalog.plans).map((p) => p.id),
        },
      ],
      proration_behavior: "always_invoice",
      schedule_at_period_end: { conditions: [] },
    },
  };
  if (!config)
    config = await stripe.billingPortal.configurations.create(
      {
        name: catalog.livemode
          ? "WriteShape account"
          : "WriteShape sandbox account",
        metadata: { writeshape_version: version },
        business_profile: {
          headline: catalog.livemode
            ? "Manage your WriteShape subscription"
            : "Manage your WriteShape test subscription",
        },
        default_return_url: "https://writeshape.com/?account=billing",
        login_page: { enabled: false },
        features,
      },
      { idempotencyKey: version },
    );
  config = await stripe.billingPortal.configurations.retrieve(config.id, {
    expand: ["features.subscription_update.products"],
  });
  // Refuse a drifted configuration rather than silently expose additional prices.
  const f = config.features;
  const prices =
    f?.subscription_update?.products?.flatMap((p) =>
      p.product === catalog.product ? p.prices : ["invalid"],
    ) || [];
  if (
    config.livemode !== catalog.livemode ||
    !config.active ||
    !f?.subscription_cancel?.enabled ||
    f.subscription_cancel.mode !== "at_period_end" ||
    f.subscription_cancel.proration_behavior !== "none" ||
    !!f.subscription_update?.enabled !== allowChange ||
    f.subscription_update?.proration_behavior !== "always_invoice" ||
    f.subscription_update?.default_allowed_updates?.join() !== "price" ||
    prices.length !== 2 ||
    !Object.values(catalog.plans).every((p) => prices.includes(p.id))
  )
    throw new HttpError(
      503,
      "Subscription management needs configuration. Your subscription is unchanged.",
    );
  return config.id;
}
export async function billingRoutes(request, env, account, stripe, ctx) {
  const path = new URL(request.url).pathname;
  account = accountBilling(account, env);
  const catalog = billingCatalog(env),
    columns = billingColumns(env);
  const attemptsTable = catalog.livemode
    ? "live_checkout_attempts"
    : "checkout_attempts";
  if (
    ![
      "/api/billing/checkout",
      "/api/billing/portal",
      "/api/billing/refresh",
      "/api/billing/status",
      "/api/billing/cancel",
    ].includes(path)
  )
    return null;
  if (
    path === "/api/billing/status"
      ? request.method !== "GET"
      : request.method !== "POST"
  )
    throw new HttpError(405, "Unsupported method.");
  if (request.method === "POST") sameOrigin(request);
  if (!account)
    throw new HttpError(401, "Sign in before managing a subscription.");
  if (!billingConfigured(env))
    throw new HttpError(503, "Billing is not configured yet.");
  stripe ||= stripeClient(env);
  if (path === "/api/billing/refresh") {
    await syncBilling(account.id, env, stripe);
    return json({ ok: true });
  }
  if (path === "/api/billing/status") {
    const subscriptions = account.stripe_customer
      ? await subscriptionsFor(account.stripe_customer, stripe, catalog)
      : [];
    return json(billingSummary(subscriptions, catalog));
  }
  if (path === "/api/billing/cancel") {
    const data = await bodyJson(request);
    if (
      typeof data.requestId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        data.requestId,
      ) ||
      (data.reason !== undefined &&
        (typeof data.reason !== "string" || data.reason.length > 3000))
    )
      throw new HttpError(
        400,
        "Please try again with a reason of 3,000 characters or fewer.",
      );
    const subscriptions = await syncBilling(account.id, env, stripe);
    const summary = billingSummary(subscriptions, catalog);
    const current = subscriptions.find(
      (sub) => sub.id === summary.subscriptionId,
    );
    if (
      !current ||
      !summary.hasSubscription ||
      objectId(current.customer) !== account.stripe_customer ||
      !summary.plan ||
      (!summary.canCancel && !summary.cancelAtPeriodEnd)
    )
      throw new HttpError(
        409,
        "There is no subscription available to cancel. Refresh your account.",
      );
    // Persist optional feedback before the provider call; retrying never creates another notice.
    if (!summary.cancelAtPeriodEnd) {
      await env.DB.prepare(
        `INSERT OR IGNORE INTO cancellation_feedback(id,account_id,subscription_id,billing_mode,reason,created)
         VALUES(?,?,?,?,?,?)`,
      )
        .bind(
          data.requestId,
          account.id,
          current.id,
          billingMode(env),
          (data.reason || "").trim(),
          now(),
        )
        .run();
      const updated = await stripe.subscriptions.update(
        current.id,
        {
          cancel_at_period_end: true,
          proration_behavior: "none",
        },
        {
          idempotencyKey: `writeshape-cancel-${billingMode(env)}-${account.id}-${current.id}-${data.requestId}`,
        },
      );
      if (
        updated.id !== current.id ||
        updated.livemode !== catalog.livemode ||
        objectId(updated.customer) !== account.stripe_customer ||
        !cancellationScheduled(updated)
      )
        throw new HttpError(
          502,
          "Could not confirm cancellation. Please refresh your account and try again.",
        );
      Object.assign(current, updated);
    }
    await env.DB.prepare(
      "UPDATE cancellation_feedback SET confirmed_at=COALESCE(confirmed_at,?) WHERE id=? AND account_id=? AND subscription_id=? AND billing_mode=?",
    )
      .bind(now(), data.requestId, account.id, current.id, billingMode(env))
      .run();
    // The provider confirmed cancellation; never turn an email failure into a cancellation failure.
    await env.DB.prepare(
      `UPDATE accounts SET ${columns.cancel}=1,${columns.version}=${columns.version}+1 WHERE id=?`,
    )
      .bind(account.id)
      .run();
    const delivery = sendPendingFeedback(env).catch(() => {
      console.error(
        JSON.stringify({ event: "cancellation_feedback_delivery_pending" }),
      );
    });
    if (ctx?.waitUntil) ctx.waitUntil(delivery);
    else await delivery;
    return json({ ok: true, billing: billingSummary(subscriptions, catalog) });
  }
  if (path === "/api/billing/portal") {
    if (!account.stripe_customer)
      throw new HttpError(409, "No billing account exists yet.");
    const body = await bodyJson(request);
    const intent = body.intent || "manage";
    if (!["manage", "change", "cancel"].includes(intent))
      throw new HttpError(400, "Choose a billing action.");
    const subscriptions = await syncBilling(account.id, env, stripe);
    const summary = billingSummary(subscriptions, catalog);
    const current = subscriptions.find(
      (sub) => sub.id === summary.subscriptionId,
    );
    if (intent === "change" && !summary.canChange)
      throw new HttpError(409, summary.changeReason);
    if (intent === "cancel" && !summary.canCancel)
      throw new HttpError(
        409,
        "There is no subscription to cancel. Refresh the account page.",
      );
    const configuration = await portalConfiguration(
      stripe,
      summary.canChange,
      catalog,
    );
    const flow =
      intent === "change"
        ? {
            type: "subscription_update",
            subscription_update: { subscription: current.id },
          }
        : intent === "cancel"
          ? {
              type: "subscription_cancel",
              subscription_cancel: { subscription: current.id },
            }
          : null;
    const portal = await stripe.billingPortal.sessions.create({
      customer: account.stripe_customer,
      configuration,
      return_url: env.APP_ORIGIN + "/?account=billing",
      ...(flow
        ? {
            flow_data: {
              ...flow,
              after_completion: {
                type: "redirect",
                redirect: { return_url: env.APP_ORIGIN + "/?account=billing" },
              },
            },
          }
        : {}),
    });
    if (
      portal.livemode !== catalog.livemode ||
      portal.customer !== account.stripe_customer
    )
      throw new HttpError(502, "Unexpected portal response.");
    if (new URL(portal.url).origin !== "https://billing.stripe.com")
      throw new HttpError(502, "Unexpected billing URL.");
    return json({ url: portal.url });
  }
  const body = await bodyJson(request);
  const selection = body?.plan;
  if (!Object.hasOwn(catalog.plans, selection))
    throw new HttpError(400, "Choose monthly or yearly billing.");
  const plan = catalog.plans[selection];
  const price = await stripe.prices.retrieve(plan.id);
  if (!approvedPrice(price, plan, catalog))
    throw new HttpError(
      503,
      "The configured price does not match the approved plan.",
    );
  if (!account.stripe_customer) {
    const customer = await stripe.customers.create(
      { email: account.email, metadata: { writeshape_account: account.id } },
      {
        idempotencyKey:
          "writeshape-" + billingMode(env) + "-customer-" + account.id,
      },
    );
    if (customer.livemode !== catalog.livemode)
      throw new HttpError(503, "Unexpected Stripe customer mode.");
    await env.DB.prepare(
      `UPDATE accounts SET ${columns.customer}=? WHERE id=? AND ${columns.customer} IS NULL`,
    )
      .bind(customer.id, account.id)
      .run();
    account = accountBilling(
      await env.DB.prepare("SELECT * FROM accounts WHERE id=?")
        .bind(account.id)
        .first(),
      env,
    );
  }
  const subscriptions = await syncBilling(account.id, env, stripe);
  if (
    subscriptions.some(
      (sub) => !["canceled", "incomplete_expired"].includes(sub.status),
    )
  )
    throw new HttpError(
      409,
      "A subscription already exists. Use Manage subscription to update it.",
    );
  // One persisted attempt per account across tabs/plans. Plan is encoded in the
  // token, so retries always use the exact original Stripe parameters. A plan
  // change must expire the previous session before atomically replacing it.
  // No schema change is required; the existing token is opaque to other code.
  for (let retry = 0; retry < 5; retry++) {
    await env.DB.prepare(
      `INSERT INTO ${attemptsTable} (account_id,token,expires) VALUES (?,?,?) ON CONFLICT(account_id) DO UPDATE SET token=excluded.token,expires=excluded.expires WHERE ${attemptsTable}.expires<=?`,
    )
      .bind(account.id, selection + ":" + randomToken(), now() + 3600, now())
      .run();
    const attempt = await env.DB.prepare(
      `SELECT * FROM ${attemptsTable} WHERE account_id=?`,
    )
      .bind(account.id)
      .first();
    const priorPlan = catalog.plans[attempt.token.split(":")[0]];
    if (!priorPlan)
      throw new HttpError(
        409,
        "A previous checkout is pending. Retry after it expires.",
      );
    if (
      priorPlan.id !== plan.id &&
      !approvedPrice(
        await stripe.prices.retrieve(priorPlan.id),
        priorPlan,
        catalog,
      )
    )
      throw new HttpError(
        503,
        "The previous price no longer matches the approved plan.",
      );
    // Reconcile again after reserving/reusing the attempt. An earlier Checkout
    // may have completed while this request was fetching price/customer data.
    const current = await syncBilling(account.id, env, stripe);
    if (
      current.some(
        (sub) => !["canceled", "incomplete_expired"].includes(sub.status),
      )
    )
      throw new HttpError(
        409,
        "A subscription already exists. Use Manage subscription to update it.",
      );
    const checkout = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        customer: account.stripe_customer,
        line_items: [{ price: priorPlan.id, quantity: 1 }],
        client_reference_id: account.id,
        subscription_data: {
          billing_mode: { type: "flexible" },
          metadata: { writeshape_account: account.id },
        },
        success_url: env.APP_ORIGIN + "/?account=billing",
        cancel_url:
          env.APP_ORIGIN + "/?account=billing-cancelled&plan=" + selection,
        expires_at: attempt.expires,
      },
      {
        idempotencyKey:
          "writeshape-" + billingMode(env) + "-checkout-" + attempt.token,
      },
    );
    if (
      checkout.livemode !== catalog.livemode ||
      checkout.customer !== account.stripe_customer ||
      !checkout.id ||
      checkout.mode !== "subscription"
    )
      throw new HttpError(502, "Unexpected checkout response.");
    if (priorPlan.id !== plan.id) {
      // The original idempotent response may be cached as open after another
      // request expired/completed it. Always retrieve live status before rotate.
      let latest = await stripe.checkout.sessions.retrieve(checkout.id);
      if (
        latest.livemode !== catalog.livemode ||
        latest.customer !== account.stripe_customer
      )
        throw new HttpError(502, "Unexpected checkout response.");
      if (latest.status === "open") {
        try {
          latest = await stripe.checkout.sessions.expire(checkout.id);
        } catch {
          latest = await stripe.checkout.sessions.retrieve(checkout.id);
        }
      }
      if (latest.status !== "expired")
        throw new HttpError(
          409,
          "Checkout is completing. Refresh subscription status before starting another.",
        );
      await env.DB.prepare(
        `UPDATE ${attemptsTable} SET token=?,expires=? WHERE account_id=? AND token=? AND expires=?`,
      )
        .bind(
          selection + ":" + randomToken(),
          now() + 3600,
          account.id,
          attempt.token,
          attempt.expires,
        )
        .run();
      continue;
    }
    const latest = await stripe.checkout.sessions.retrieve(checkout.id);
    if (
      latest.livemode !== catalog.livemode ||
      latest.customer !== account.stripe_customer ||
      latest.status !== "open" ||
      !latest.url
    )
      throw new HttpError(
        409,
        "Checkout changed in another tab. Retry or refresh subscription status.",
      );
    if (new URL(latest.url).origin !== "https://checkout.stripe.com")
      throw new HttpError(502, "Unexpected checkout response.");
    return json({ url: latest.url });
  }
  throw new HttpError(
    409,
    "Billing selection changed in another tab. Please retry.",
  );
}
