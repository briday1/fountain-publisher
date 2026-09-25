import { useCallback, useEffect, useRef, useState } from "react";
import { isWriteShape } from "../product";
import { Modal } from "./Modal";
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
  };
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
export function WriteShapeAccount({
  state,
  error,
  refresh,
  beforeNavigate,
  onClose,
}: {
  state: AccountState;
  error: string;
  refresh: () => Promise<void>;
  beforeNavigate: () => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(state.account?.displayName || "");
  useEffect(
    () => setName(state.account?.displayName || ""),
    [state.account?.id, state.account?.displayName],
  );
  const [notice, setNotice] = useState("");
  const [billingPlan, setBillingPlan] = useState<"monthly" | "yearly">(
    "monthly",
  );
  const [busy, setBusy] = useState(false);
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
  const account = state.account;
  return (
    <Modal
      title="Your WriteShape account"
      className="writeshape-account"
      onClose={onClose}
    >
      {(error || notice) && <p role="status">{notice || error}</p>}
      {account ? (
        <>
          <p>
            Signed in as <strong>{account.email}</strong>
          </p>
          <p>
            {account.privateTester
              ? "Private tester · Premium included"
              : state.premium
                ? "Premium"
                : "Free"}
          </p>
          <form
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
              Display name{" "}
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
              />
            </label>
            <button disabled={busy}>Save profile</button>
          </form>
          {account.googleLinked ? (
            <p>Google sign-in is linked to this account.</p>
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
                Link your matching Google account to keep the same cloud
                library.
              </p>
            </>
          )}
        </>
      ) : (
        <>
          <p>
            Create an account or sign in with Google to manage your profile and
            subscription. You can keep writing and saving locally without
            signing in.
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
      {!state.googleAvailable && <p>Google sign-in is not available yet.</p>}
      <hr />
      <h3>Subscription</h3>
      {!state.billingAvailable ? (
        <p>
          Sandbox checkout is not connected yet. Subscriptions are not available
          for purchase.
        </p>
      ) : (
        <p>
          Stripe test billing only. No real payments. The private pilot remains
          limited to the authorized tester.
        </p>
      )}
      {account?.billingStatus && account.billingStatus !== "none" && (
        <p>
          Billing status: {account.billingStatus.replaceAll("_", " ")}
          {account.cancelAtPeriodEnd && account.premiumUntil > 0
            ? ` · Cancels at the end of the current period (${new Date(account.premiumUntil * 1000).toLocaleDateString()})`
            : ""}
          .
        </p>
      )}
      <fieldset disabled={busy || !account || !state.billingAvailable}>
        <legend>Premium sandbox plan</legend>
        <label>
          <input
            type="radio"
            name="billing-plan"
            value="monthly"
            checked={billingPlan === "monthly"}
            onChange={() => setBillingPlan("monthly")}
          />
          Monthly · USD $8/month
        </label>
        <label>
          <input
            type="radio"
            name="billing-plan"
            value="yearly"
            checked={billingPlan === "yearly"}
            onChange={() => setBillingPlan("yearly")}
          />
          Yearly · USD $80/year
        </label>
      </fieldset>
      <button
        disabled={
          busy ||
          !account ||
          !state.billingAvailable ||
          (!!account &&
            !["none", "canceled", "incomplete_expired"].includes(
              account.billingStatus,
            ))
        }
        onClick={() =>
          void run(() =>
            navigate("/api/billing/checkout", { plan: billingPlan }),
          )
        }
      >
        Try Premium checkout (test)
      </button>
      <button
        disabled={busy || !state.portalAvailable}
        onClick={() => void run(() => navigate("/api/billing/portal"))}
      >
        Manage subscription
      </button>
      <p>
        Manage your subscription and invoice history in the Stripe customer
        portal.
      </p>
      {state.billingAvailable && (
        <button
          disabled={busy || !account}
          onClick={() =>
            void run(async () => {
              await accountRequest("/api/billing/refresh", {});
              await refresh();
              setNotice("Subscription status refreshed.");
            })
          }
        >
          Refresh subscription status
        </button>
      )}
      <p>
        Cancellation keeps your scripts intact. You can open existing cloud
        files and download local copies; new cloud saves require Premium.
      </p>
      {account && (
        <button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await beforeNavigate();
              await accountRequest("/api/auth/logout", {});
              if (state.privateMode) {
                location.assign("/cdn-cgi/access/logout");
              } else {
                await refresh();
                onClose();
              }
            })
          }
        >
          Sign out
        </button>
      )}
      <p>
        Your current draft stays on this device when you sign in or manage
        billing.
      </p>
    </Modal>
  );
}
