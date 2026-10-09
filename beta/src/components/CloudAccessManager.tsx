import { useState } from "react";
import { accountRequest } from "./WriteShapeAccount";
type Grant = {
  accountId: string;
  email: string;
  displayName: string;
  revokedAt: number | null;
};
export function CloudAccessManager({
  refresh,
}: {
  refresh: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function load() {
    setGrants((await accountRequest("/api/cloud-access")).grants);
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
      await load();
      await refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Invitation could not be updated.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="account-section">
      <button
        disabled={busy}
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          if (!open) void run(async () => {});
        }}
      >
        Cloud storage testing
      </button>
      {open && (
        <>
          <p>
            Invite specific accounts to test WriteShape storage. Premium and
            Premium test codes do not include it. Removing an invitation stops
            new cloud saves and keeps existing files available to download.
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                await accountRequest("/api/cloud-access", { email });
                setEmail("");
              });
            }}
          >
            <label className="field">
              Verified account email
              <input
                type="email"
                required
                value={email}
                disabled={busy}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <button disabled={busy} type="submit">
              Grant storage access
            </button>
          </form>
          {grants.length === 0 && (
            <p>
              No storage invitations yet. Your owner account already has access.
            </p>
          )}
          {grants.map((grant) => (
            <div className="account-section" key={grant.accountId}>
              <strong>{grant.displayName || grant.email}</strong>
              {grant.displayName && <small> {grant.email}</small>}
              {grant.revokedAt ? (
                <span> · Removed</span>
              ) : (
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await accountRequest("/api/cloud-access/revoke", {
                        accountId: grant.accountId,
                      });
                    })
                  }
                >
                  Remove storage access
                </button>
              )}
            </div>
          ))}
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
