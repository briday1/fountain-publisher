// Live activation is independent of opening the site and requires an explicit flag.
export const billingMode = (env) =>
  env.BILLING_MODE === "live" ? "live" : "test";
export function billingColumns(env) {
  const prefix = billingMode(env) === "live" ? "live_" : "";
  return {
    customer: prefix + "stripe_customer",
    status: prefix + "billing_status",
    until: prefix + "premium_until",
    cancel: prefix + "cancel_at_period_end",
    version: prefix + "billing_version",
  };
}
export function accountBilling(account, env) {
  if (!account || billingMode(env) !== "live") return account;
  return {
    ...account,
    stripe_customer: account.live_stripe_customer || null,
    billing_status: account.live_billing_status || "none",
    premium_until: account.live_premium_until || 0,
    cancel_at_period_end: account.live_cancel_at_period_end || 0,
    billing_version: account.live_billing_version || 0,
  };
}
