import { AccessCodes } from "./AccessCodes";
import { useCallback, useEffect, useRef, useState } from "react";
import { isWriteShape } from "../product";
import { Modal } from "./Modal";
import { BillingPlanChoice, type BillingPlan } from "./BillingPlanChoice";
export interface AccountState {
  account: null | {
    id: string;
    email: string;
    displayName: string;
    privateTester: boolean;
    googleLinked: boolean;
    billingStatus: string;
    cancelAtPeriodEnd: boolean;
    premiumUntil: number;
    complimentaryUntil?: number;
  };
  billingMode?: "test" | "live";
  accessCodesAvailable?: boolean;
  manageAccessCodes?: boolean;
  premium: boolean;
  googleAvailable: boolean;
  billingAvailable: boolean;
  portalAvailable: boolean;
  privateMode: boolean;
}
export const emptyAccount: AccountState = {
  account: null,
  premium: false,
  googleAvailable: false,
  billingAvailable: false,
  portalAvailable: false,
  privateMode: true,
};
export async function accountRequest(path: string, body?: unknown) {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.headers.get("Content-Type")?.includes("application/json"))
    throw new Error("Your sign-in needs refreshing. Your local draft is safe.");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Account request failed.");
  return data;
}
export function useWriteShapeAccount() {
  const [state, setState] = useState<AccountState>(emptyAccount);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    if (!isWriteShape) return;
    const requestId = ++generation.current;
    try {
      const data = await accountRequest("/api/account");
      if (requestId === generation.current) {
        setState(data);
        setError("");
      }
    } catch (e) {
      if (requestId === generation.current) {
        setState(emptyAccount);
        setError(e instanceof Error ? e.message : "Account unavailable.");
      }
    }
  }, []);
  useEffect(() => {
    if (!isWriteShape) return;
    void refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(onVisible, 60000);
    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [refresh]);
  return { state, error, refresh };
}
export interface BillingSummary {
  status: string;
  plan: BillingPlan | null;
  periodEnd: number;
  cancelAtPeriodEnd: boolean;
  cancelAt: number;
  invoiceStatus: string | null;
  hasSubscription: boolean;
  canChange: boolean;
  canCancel: boolean;
  changeReason: string;
}
const dateLabel = (seconds: number) =>
  new Date(seconds * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
export function WriteShapeAccount({
  state,
  error,
  refresh,
  beforeNavigate,
  onClose,
  initialPlan = "monthly",
}: {
  state: AccountState;
  error: string;
  refresh: () => Promise<void>;
  beforeNavigate: () => Promise<void>;
  onClose: () => void;
  initialPlan?: BillingPlan;
}) {
  const account = state.account;
  const testBilling = state.billingMode !== "live";
  const [name, setName] = useState(account?.displayName || "");
  useEffect(
    () => setName(account?.displayName || ""),
    [account?.id, account?.displayName],
  );
  const [notice, setNotice] = useState("");
  const [billingPlan, setBillingPlan] = useState<BillingPlan>(initialPlan);
  const [busy, setBusy] = useState(false);
  const [billing, setBilling] = useState<BillingSummary | null>(null);
  const [billingError, setBillingError] = useState("");
  const [loading, setLoading] = useState(false);
  const generation = useRef(0);
  const loadBilling = useCallback(async () => {
    const current = ++generation.current;
    if (!account || !state.billingAvailable) {
      setBilling(null);
      return;
    }
    setLoading(true);
    try {
      const result = await accountRequest("/api/billing/status");
      if (generation.current === current) {
        setBilling(result);
        setBillingError("");
      }
    } catch (e) {
      if (generation.current === current) {
        setBilling(null);
        setBillingError(
          e instanceof Error ? e.message : "Billing details unavailable.",
        );
      }
    } finally {
      if (generation.current === current) setLoading(false);
    }
  }, [account?.id, state.billingAvailable]);
  useEffect(() => {
    void loadBilling();
    const visible = () => {
      if (document.visibilityState === "visible") void loadBilling();
    };
    window.addEventListener("focus", visible);
    document.addEventListener("visibilitychange", visible);
    return () => {
      generation.current++;
      window.removeEventListener("focus", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [
    loadBilling,
    account?.billingStatus,
    account?.cancelAtPeriodEnd,
    account?.premiumUntil,
  ]);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setNotice("");
    try {
      await action();
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : "Could not complete the request.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function navigate(path: string, body: unknown = {}) {
    await beforeNavigate();
    const result = await accountRequest(path, body);
    const url = new URL(result.url);
    if (
      ![
        "https://accounts.google.com",
        "https://checkout.stripe.com",
        "https://billing.stripe.com",
      ].includes(url.origin)
    )
      throw new Error("The service returned an unexpected destination.");
    location.assign(url.href);
  }
  const manage = (intent: "manage" | "change" | "cancel") =>
    void run(() => navigate("/api/billing/portal", { intent }));
  const status = billing?.status || account?.billingStatus || "none";
  const hasSubscription =
    billing?.hasSubscription ??
    !["none", "canceled", "incomplete_expired"].includes(status);
  const end = billing?.cancelAt || billing?.periodEnd || 0;
  const disabled = busy || loading;
  return (
    <Modal
      title="Account"
      eyebrow="WRITESHAPE"
      className="writeshape-account"
      wide
      onClose={onClose}
    >
      <div className="account-heading">
        <div>
          <h3>{account?.displayName || "Your writing, your account"}</h3>
          <p>{account?.email || "Sign in to manage your account."}</p>
        </div>
        <span className="account-badge">
          {account?.privateTester
            ? "Private tester"
            : state.premium
              ? "Premium"
              : "Free"}
        </span>
      </div>
      <nav className="account-nav" aria-label="Account sections">
        <a href="#account-subscription">Plan & billing</a>
        <a href="#account-profile">Profile & sign-in</a>
        {account && state.accessCodesAvailable && (
          <a href="#account-access">Access codes</a>
        )}
      </nav>
      {(error || notice) && (
        <p className="account-notice" role="status">
          {notice || error}
        </p>
      )}
      <section
        className="account-section"
        id="account-subscription"
        aria-labelledby="account-plan-title"
      >
        <div className="account-section-title">
          <h3 id="account-plan-title">Plan & billing</h3>
          {testBilling && <span className="account-badge">Test mode</span>}
        </div>
        {testBilling && (
          <p>
            No real payments.{" "}
            {state.privateMode
              ? "Only approved email addresses can access this private pilot."
              : "Billing is currently in test mode."}
          </p>
        )}
        {account?.privateTester && (
          <div className="account-included">
            <strong>Premium is included for you</strong>
            <p>
              Your private-tester access does not require a subscription. A
              subscription is separate; canceling it will not remove your tester
              access.
            </p>
          </div>
        )}
        {loading && <p role="status">Checking subscription details…</p>}
        {billingError && (
          <p role="status" className="account-notice">
            {billingError}{" "}
            <button
              disabled={busy || loading}
              onClick={() => void loadBilling()}
            >
              Retry billing details
            </button>
          </p>
        )}
        {!state.billingAvailable && (
          <p>
            {testBilling ? "Test checkout" : "Checkout"} is currently
            unavailable. Your writing and existing account access are unchanged.
          </p>
        )}
        {account && (
          <dl className="account-facts">
            <div>
              <dt>Access</dt>
              <dd>
                {account.privateTester
                  ? "Premium · included for private testing"
                  : state.premium
                    ? "Premium"
                    : "Free · local writing and saves"}
              </dd>
            </div>
            <div>
              <dt>Subscription</dt>
              <dd>
                {status === "none"
                  ? "No subscription"
                  : status.replaceAll("_", " ")}
                {billing?.cancelAtPeriodEnd ? " · cancellation scheduled" : ""}
              </dd>
            </div>
            {billing?.plan && (
              <div>
                <dt>Current billing period</dt>
                <dd>
                  {billing.plan === "yearly"
                    ? "Yearly · $80 USD / year"
                    : "Monthly · $8 USD / month"}
                </dd>
              </div>
            )}
            {end > 0 && (
              <div>
                <dt>
                  {billing?.cancelAtPeriodEnd
                    ? "Subscription ends"
                    : status === "active"
                      ? "Current period ends"
                      : "Last billing period ended"}
                </dt>
                <dd>{dateLabel(end)}</dd>
              </div>
            )}
            {billing?.invoiceStatus && (
              <div>
                <dt>Latest invoice</dt>
                <dd>{billing.invoiceStatus.replaceAll("_", " ")}</dd>
              </div>
            )}
          </dl>
        )}
        {hasSubscription ? (
          <>
            <div className="account-actions">
              <button
                className="primary"
                disabled={disabled || !state.portalAvailable}
                onClick={() => manage("manage")}
              >
                Manage billing
              </button>
              <button
                disabled={
                  disabled || !billing?.canChange || !state.portalAvailable
                }
                onClick={() => manage("change")}
              >
                Change monthly / yearly
              </button>
              {billing?.canCancel && (
                <button
                  disabled={disabled || !state.portalAvailable}
                  onClick={() => manage("cancel")}
                >
                  Cancel subscription
                </button>
              )}
            </div>
            {!billing?.canChange && billing?.changeReason && (
              <p>{billing.changeReason}</p>
            )}
            <p>
              Stripe shows the amount and timing before you confirm a change.
              Cancellation takes effect at the end of the billing period
              {end ? ` (${dateLabel(end)})` : ""}. Your documents are not
              deleted. After paid access ends, you can still open and download
              existing cloud files; new cloud saves need Premium.
            </p>
          </>
        ) : (
          <>
            <h4>
              {testBilling
                ? account?.privateTester
                  ? "Optional sandbox subscription"
                  : "Premium test subscription"
                : "Premium subscription"}
            </h4>
            <BillingPlanChoice
              value={billingPlan}
              onChange={setBillingPlan}
              disabled={disabled || !account || !state.billingAvailable}
            />
            <p className="account-selection">
              Selected for checkout:{" "}
              <strong>
                {billingPlan === "yearly"
                  ? "$80 USD billed annually"
                  : "$8 USD billed monthly"}
              </strong>
              . This does not change your current access.
            </p>
            <button
              className="primary"
              disabled={
                disabled || !account || !state.billingAvailable || !billing
              }
              onClick={() =>
                void run(() =>
                  navigate("/api/billing/checkout", { plan: billingPlan }),
                )
              }
            >
              Continue to {billingPlan}
              {testBilling ? " test" : ""} checkout
            </button>
            {state.portalAvailable && (
              <button disabled={disabled} onClick={() => manage("manage")}>
                Invoices & payment methods
              </button>
            )}
          </>
        )}
        {state.billingAvailable && account && (
          <button
            className="account-refresh"
            disabled={disabled}
            onClick={() =>
              void run(async () => {
                await accountRequest("/api/billing/refresh", {});
                await refresh();
                await loadBilling();
                setNotice("Subscription status refreshed.");
              })
            }
          >
            Refresh billing status
          </button>
        )}
      </section>
      {account && state.accessCodesAvailable && (
        <AccessCodes
          owner={!!state.manageAccessCodes}
          until={account.complimentaryUntil || 0}
          refresh={refresh}
        />
      )}
      <section className="account-section" aria-label="Support">
        <h3>Support</h3>
        <p>
          <a href="mailto:support@writeshape.com">support@writeshape.com</a>
        </p>
        <p>
          This support inbox is being set up. Delivery has not been verified
          yet.
        </p>
      </section>
      <section
        className="account-section"
        id="account-profile"
        aria-labelledby="account-profile-title"
      >
        <h3 id="account-profile-title">Profile & sign-in</h3>
        {account ? (
          <>
            <form
              className="account-profile-form"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  await accountRequest("/api/account/profile", {
                    displayName: name,
                  });
                  await refresh();
                  setNotice("Profile saved.");
                });
              }}
            >
              <label>
                Display name
                <input
                  autoComplete="nickname"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                />
              </label>
              <button disabled={busy}>Save profile</button>
            </form>
            {account.googleLinked ? (
              <p>Google sign-in is linked.</p>
            ) : (
              <>
                <button
                  disabled={busy || !state.googleAvailable}
                  onClick={() =>
                    void run(() => navigate("/api/auth/google/start"))
                  }
                >
                  Link Google sign-in
                </button>
                <p>
                  Use the Google account matching your verified email. Drive
                  storage is connected separately in Files → Google Drive.
                </p>
              </>
            )}
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await beforeNavigate();
                  await accountRequest("/api/auth/logout", {});
                  if (state.privateMode)
                    location.assign("/cdn-cgi/access/logout");
                  else {
                    await refresh();
                    onClose();
                  }
                })
              }
            >
              Sign out
            </button>
          </>
        ) : (
          <>
            <p>
              Sign in with your approved email to manage your profile and test
              subscription.
            </p>
            <button
              className="primary"
              disabled={busy || !state.googleAvailable}
              onClick={() => void run(() => navigate("/api/auth/google/start"))}
            >
              Continue with Google
            </button>
          </>
        )}
        {!state.googleAvailable && (
          <p>Google sign-in is currently unavailable.</p>
        )}
      </section>
      <footer className="account-footer">
        <p>
          Your drafts are saved on this device before leaving for Google or
          Stripe.
        </p>
        <button onClick={onClose}>Back to writing</button>
      </footer>
    </Modal>
  );
}
