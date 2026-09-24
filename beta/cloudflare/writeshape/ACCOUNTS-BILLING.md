# WriteShape accounts and Stripe test billing

The site remains private behind the existing Cloudflare Access application. Brian must explicitly approve the finished implementation and launch before anyone beyond the authorized private tester may access the app or any real customer may be charged. This implementation does not enable public launch, Google consent configuration, or real payments. The separate official Stripe plugin task provisioned only the approved sandbox catalog described below; no connected Checkout has been tested here. Fountain Publisher's provider configuration and deployment are unchanged.

## What is implemented

- A verified Access owner gets a stable account whose ID is the existing document owner subject. The additive accounts.sql migration does not update or delete items.
- Google OpenID Connect provides signup/sign-in, or explicit linking to the currently authenticated account. Email alone never merges identities. Linking requires the matching verified email. Use a separate WriteShape Google Cloud project and OAuth client; never reuse the Fountain Publisher consent setup.
- Authorization-code exchange with state, nonce, PKCE, signature/issuer/audience/expiry verification. OAuth attempts are single use and expire after ten minutes. Sessions are random opaque tokens, stored only as SHA-256 hashes in D1, with Secure/HttpOnly/SameSite=Lax cookies and a seven-day expiry. Login rotates the browser session; logout revokes it.
- Editable display name, verified email display, and account/billing status. Google is the only new signup provider implemented; no password signup or email delivery service is claimed.
- /api/account returns server entitlements. The old VITE_PRIVATE_TEST_PREMIUM build flag is no longer used. Private owner Premium is assigned only through verified Access identity. Cloud writes require Premium on the server; existing files remain readable by their owner after cancellation, so the editor can download local copies.
- Stripe SDK creates account-owned hosted Checkout and customer portal sessions. Checkout accepts only `monthly` or `yearly`, resolves the approved sandbox Price ID on the server, and validates the retrieved price’s product, active/test state, USD amount, interval, interval count, per-unit licensed billing, and absence of quantity transforms/trial days. No browser-supplied customer/account/price is trusted. A pending Checkout attempt persists its plan and reuses the exact Stripe parameters and idempotency key. Changing plans first expires the previous open Checkout, then uses a compare-and-swap to rotate the account’s attempt. Completed Checkout blocks replacement even if subscription reconciliation has not caught up; concurrent tabs cannot intentionally leave separate monthly/yearly Checkouts open. A transient expired Checkout URL from a racing tab cannot be paid. No schema migration was needed for this change. Existing subscriptions route to portal management rather than another Checkout.
- Raw-body Stripe webhook signature verification (five-minute timestamp tolerance), test-mode enforcement, duplicate-event records, canonical Stripe state reconciliation, and optimistic version checks for concurrent events. Payment failures/past_due suspend Premium; active renewals restore it; trialing never grants Premium because no trial is approved; scheduled cancellation keeps access through the valid period; canceled, unpaid, incomplete, expired, or paused subscriptions do not grant access. No grace period or trial offer is invented.
- No scripts are sent to Stripe or Google. Account changes and navigation flush the local draft; identity changes clear cloud associations, leaving writing intact. D1 managed encryption at rest and HTTPS are used, not end-to-end encryption.

## External setup still required

1. Create a dedicated WriteShape Google Cloud OAuth web client. Configure its own consent screen and tester list. Add the exact redirect URI `https://writeshape.com/api/auth/google/callback`. Scopes are `openid email profile` only; no Drive permissions. Provision `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` as Worker secrets. `APP_ORIGIN` is fixed in the WriteShape config. While private, sign in through Access first and use **Account → Link Google sign-in** with the matching Google email; this preserves the existing library identity before any future launch.
2. The user-requested official Stripe implementation planner is complete and accepted: hosted Checkout recurring freemium upgrade plus Customer Portal. The SDK remains pinned to API version `2026-08-26.dahlia`, which supports flexible billing; Checkout explicitly sets `subscription_data.billing_mode.type=flexible`. Subscription item period fields are read, with older subscription-level fallback. Webhook snapshots are used only to identify the mapped customer; entitlement comes from freshly retrieved canonical subscriptions, with a database version guard against concurrent stale writes.
3. Approved sandbox catalog (created and reread by the separate official plugin task, active and `livemode=false`):
   - Product `prod_VJvvBIU1Uuy6RQ` — WriteShape Premium.
   - Monthly USD $8: `price_1UJI3mCoZzTH3rR02FrxECSY`.
   - Yearly USD $80: `price_1UJI3rCoZzTH3rR0fHBGdUzU`.
   Nonsecret `STRIPE_MONTHLY_PRICE_ID` and `STRIPE_YEARLY_PRICE_ID` are configured in `wrangler.writeshape.json` and must match the explicit server allowlist. `BILLING_MODE` remains unset. Still required: configure a sandbox Customer Portal using Brian’s eventual cancellation policy, provision matching `STRIPE_SECRET_KEY` (`sk_test_…`) and `STRIPE_WEBHOOK_SECRET` (`whsec_…`) through secure Worker-secret input, and set `BILLING_MODE=test` only when ready for connected sandbox testing. Hosted Checkout does not need a publishable key. No credentials were read, provisioned, or printed in this review, and no Stripe account API calls were made.
4. Register snapshot webhook events at `/api/billing/webhook` for `customer.subscription.created`, `.updated`, `.deleted`, `.paused`, `.resumed`, `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `invoice.paid`, `invoice.payment_failed`, and `invoice.payment_action_required`, using API version `2026-08-26.dahlia`. The current whole-site Access policy blocks Stripe's external delivery. Do not remove it: test through Stripe CLI forwarding to an isolated local Worker, or obtain explicit approval for a narrowly scoped webhook-only ingress. No Access exception was created here.
5. Run connected sandbox signup/linking, monthly/yearly Checkout, 3DS/declines, renewal, cancellation/resubscription, payment-failure/recovery, portal invoice history, reversed/parallel events, and webhook-retry tests after provisioning. Fixture tests cover ownership, signatures, event replays/retries, stale-state races, old/new subscriptions, invalid prices, trial rejection, plan changes, and concurrent Checkout attempts. Local fixtures are not evidence these external flows work. Public launch requires a separate decision, verified Google configuration, connected payment testing, and deliberate Access changes. `PUBLIC_LAUNCH` remains unset; do not enable it merely to test billing. Live-mode Stripe secrets are intentionally rejected by this code.

## Remaining policy decisions and invoice scope

Pricing is approved only for sandbox work. Tax treatment/collection, cancellation timing, refunds, retry/recovery-email behavior, and any future grace period remain undecided. No trial is offered. The current conservative fixture entitlement rule denies Premium while `past_due`; that is an implementation default for the private sandbox, not an approved customer-facing grace/cancellation policy. Scheduled cancellation retains an otherwise active entitlement until its recorded effective end. Private tester Premium remains independent of all subscription states.

Recurring subscriptions generate invoices automatically. Customer Portal is the intended place for invoice history/downloads once its configuration is ready. No separate one-off Invoicing workflow or manual collection was requested or implemented. Read access to owned scripts and local downloads remain available after cancellation; paid writes/features require server entitlement. The owner-only Access gate is unchanged, Google public sign-in is not connected, and live-mode Stripe keys/events are rejected.

## Operations

Apply the additive schema before deploying account code:

```sh
npx wrangler d1 execute writeshape-documents --remote --config wrangler.writeshape.json --file cloudflare/writeshape/accounts.sql
npm run build:writeshape
node --test cloudflare/writeshape/*.test.mjs
npm test
npx wrangler deploy --config wrangler.writeshape.json
```

Secrets must be provisioned through Wrangler secret input or the Cloudflare dashboard, never committed, printed in task messages, or placed in Vite variables. This module has no live-billing fallback. A checkout return URL never grants access; verified canonical server billing state does. `/api/billing/refresh` reconciles the authenticated account if a webhook is delayed.

## Primary references consulted

- [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect)
- [Stripe Checkout session creation](https://docs.stripe.com/api/checkout/sessions/create)
- [Stripe webhook signatures and delivery](https://docs.stripe.com/webhooks)
- [Stripe subscription lifecycle webhooks](https://docs.stripe.com/billing/subscriptions/webhooks)

- [Stripe flexible billing default from 2025-09-30.clover](https://docs.stripe.com/changelog/clover/2025-09-30/billing-mode-default-flexible)
- [Expire a Stripe Checkout session](https://docs.stripe.com/api/checkout/sessions/expire)
- [Subscription invoices](https://docs.stripe.com/billing/invoices/subscription)
- [Customer Portal integration](https://docs.stripe.com/customer-management/integrate-customer-portal)
