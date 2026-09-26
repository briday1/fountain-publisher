import { useEffect, useState } from "react";
import { accountRequest } from "./WriteShapeAccount";
type Code = {
  id: string;
  label: string;
  durationDays: number;
  expiresAt: number;
  maxRedemptions: number;
  revokedAt: number | null;
  redemptions: number;
};
const date = (seconds: number) => new Date(seconds * 1000).toLocaleDateString();
export function AccessCodes({
  owner,
  until,
  refresh,
}: {
  owner: boolean;
  until: number;
  refresh: () => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [codes, setCodes] = useState<Code[]>([]);
  const [created, setCreated] = useState("");
  const [revoke, setRevoke] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  async function load() {
    try {
      setCodes((await accountRequest("/api/access-codes")).codes);
      setLoadError("");
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : "Could not load access codes.",
      );
    }
  }
  useEffect(() => {
    if (owner) void load();
  }, [owner]);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setNotice("");
    try {
      await action();
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : "The code could not be updated.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="account-section"
      id="account-access"
      aria-labelledby="account-access-title"
    >
      <h3 id="account-access-title">Complimentary Premium</h3>
      <p>
        Access codes add Premium for a limited time. No payment or automatic
        renewal is attached to a code. Existing subscriptions remain separate.
      </p>
      {until > Date.now() / 1000 && (
        <p>
          Complimentary access through <strong>{date(until)}</strong>.
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const result = await accountRequest("/api/access-codes/redeem", {
              code,
            });
            setCode("");
            await refresh();
            setNotice(
              `Code redeemed. Complimentary Premium through ${date(result.expiresAt)}.`,
            );
          });
        }}
      >
        <label>
          Access code
          <input
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            minLength={8}
            maxLength={48}
            required
          />
        </label>
        <button disabled={busy}>Redeem code</button>
      </form>
      {notice && <p role="status">{notice}</p>}
      {owner && (
        <details className="access-code-manager">
          <summary>Manage complimentary access codes</summary>
          <p>
            Choose how long access lasts after redemption, when the code stops
            accepting new redemptions, and how many accounts may use it.
            Different codes do not add their durations together.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const data = new FormData(form);
              void run(async () => {
                const result = await accountRequest("/api/access-codes", {
                  label: data.get("label"),
                  code: data.get("customCode"),
                  durationDays: Number(data.get("durationDays")),
                  maxRedemptions: Number(data.get("maxRedemptions")),
                  expiresAt: Math.floor(
                    new Date(String(data.get("expiresAt"))).getTime() / 1000,
                  ),
                });
                setCreated(result.code);
                form.reset();
                await load();
                setNotice(
                  "Code created. Save it now; the full code is shown only once.",
                );
              });
            }}
          >
            <label>
              Label
              <input
                name="label"
                required
                maxLength={80}
                placeholder="Early readers"
              />
            </label>
            <label>
              Custom code (optional)
              <input
                name="customCode"
                autoComplete="off"
                autoCapitalize="characters"
                pattern="[A-Za-z0-9-]{8,48}"
                placeholder="Leave blank to generate"
              />
            </label>
            <div className="access-code-fields">
              <label>
                Access days
                <input
                  name="durationDays"
                  type="number"
                  required
                  min={1}
                  max={3650}
                  defaultValue={30}
                />
              </label>
              <label>
                Maximum accounts
                <input
                  name="maxRedemptions"
                  type="number"
                  required
                  min={1}
                  max={10000}
                  defaultValue={1}
                />
              </label>
            </div>
            <label>
              Redeem before (your local time)
              <input name="expiresAt" type="datetime-local" required />
            </label>
            <button disabled={busy}>Create access code</button>
          </form>
          {created && (
            <div className="account-included">
              <label>
                New code — save before closing
                <input
                  readOnly
                  value={created}
                  onFocus={(e) => e.target.select()}
                />
              </label>
              <button onClick={() => setCreated("")}>Hide saved code</button>
            </div>
          )}
          {loadError && (
            <p role="status">
              {loadError}{" "}
              <button onClick={() => void load()}>Retry access codes</button>
            </p>
          )}
          <ul className="access-code-list">
            {codes.map((c) => (
              <li key={c.id}>
                <strong>{c.label}</strong>
                <span>
                  {c.durationDays} days · {c.redemptions}/{c.maxRedemptions}{" "}
                  redeemed · Redeem before {date(c.expiresAt)}
                </span>
                {c.revokedAt ? (
                  <span>Revoked</span>
                ) : revoke === c.id ? (
                  <div>
                    <p>
                      Revoke this code and end all complimentary access it
                      granted? Paid subscriptions and other grants remain
                      active.
                    </p>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await accountRequest("/api/access-codes/revoke", {
                            id: c.id,
                          });
                          setRevoke(null);
                          await load();
                          await refresh();
                          setNotice("Code revoked.");
                        })
                      }
                    >
                      Confirm revocation
                    </button>
                    <button disabled={busy} onClick={() => setRevoke(null)}>
                      Keep code
                    </button>
                  </div>
                ) : (
                  <button disabled={busy} onClick={() => setRevoke(c.id)}>
                    Revoke {c.label}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {!loadError && !codes.length && <p>No access codes created.</p>}
        </details>
      )}
    </section>
  );
}
