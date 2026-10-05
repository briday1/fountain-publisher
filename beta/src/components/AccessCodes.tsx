import { useState } from "react";
import { accountRequest } from "./WriteShapeAccount";

type Code = {
  id: string;
  label: string;
  durationDays: number | null;
  expiresAt: number;
  maxRedemptions: number;
  revokedAt: number | null;
  redemptions: number;
};
const date = (seconds: number) => new Date(seconds * 1000).toLocaleDateString();

export function AccessCodes({ refresh }: { refresh: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="account-code-entry">
      <button
        className="account-code-toggle"
        aria-expanded={open}
        aria-controls="redeem-premium-code"
        onClick={() => {
          setOpen(!open);
          setNotice("");
        }}
      >
        Have a code?
      </button>
      {open && (
        <form
          id="redeem-premium-code"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy || !code.trim()) return;
            setBusy(true);
            setNotice("");
            try {
              await accountRequest("/api/access-codes/redeem", {
                code: code.trim(),
              });
              await refresh();
              setCode("");
              setOpen(false);
              setNotice("Premium activated.");
            } catch (error) {
              setNotice(
                error instanceof Error
                  ? error.message
                  : "Could not apply this code. Try again.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Premium code
            <input
              autoFocus
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={50}
              required
              disabled={busy}
            />
          </label>
          <button className="primary" disabled={busy || !code.trim()}>
            {busy ? "Applying…" : "Apply code"}
          </button>
        </form>
      )}
      {notice && <p role="status">{notice}</p>}
    </div>
  );
}

// Owner-only administration stays separate from the recipient's account flow.
export function AccessCodeManager({
  refresh,
}: {
  refresh: () => Promise<void>;
}) {
  const [codes, setCodes] = useState<Code[]>([]);
  const [created, setCreated] = useState("");
  const [revoke, setRevoke] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [duration, setDuration] = useState("30");
  async function load() {
    try {
      setCodes((await accountRequest("/api/access-codes")).codes);
      setLoadError("");
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Could not load codes.",
      );
    }
  }
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      await action();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not update this code.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <details
      className="account-section access-code-manager"
      onToggle={(e) => {
        if (e.currentTarget.open) void load();
      }}
    >
      <summary>Manage codes</summary>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const data = new FormData(form);
          void run(async () => {
            const deadline = String(data.get("expiresAt") || "");
            const result = await accountRequest("/api/access-codes", {
              label: data.get("label"),
              code: data.get("customCode"),
              durationDays:
                duration === "indefinite"
                  ? null
                  : Number(
                      duration === "custom"
                        ? data.get("durationDays")
                        : duration,
                    ),
              maxRedemptions: Number(data.get("maxRedemptions")),
              expiresAt: deadline
                ? Math.floor(new Date(deadline).getTime() / 1000)
                : Math.floor(Date.now() / 1000) + 365 * 86400,
            });
            setCreated(result.code);
            form.reset();
            setDuration("30");
            await load();
          });
        }}
      >
        <label>
          Name
          <input
            name="label"
            required
            maxLength={80}
            placeholder="Early readers"
          />
        </label>
        <label>
          Premium lasts
          <select
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          >
            <option value="7">7 days</option>
            <option value="30">30 days</option>
            <option value="90">90 days</option>
            <option value="365">1 year</option>
            <option value="indefinite">No end date</option>
            <option value="custom">Custom duration</option>
          </select>
        </label>
        {duration === "custom" && (
          <label>
            Days
            <input
              name="durationDays"
              type="number"
              required
              min={1}
              max={3650}
              defaultValue={30}
            />
          </label>
        )}
        <details className="access-code-options">
          <summary>More options</summary>
          <label>
            Custom code
            <input
              name="customCode"
              autoComplete="off"
              autoCapitalize="characters"
              pattern="[A-Za-z0-9-]{8,48}"
              placeholder="Generate automatically"
            />
          </label>
          <label>
            Accounts allowed
            <input
              name="maxRedemptions"
              type="number"
              required
              min={1}
              max={10000}
              defaultValue={1}
            />
          </label>
          <label>
            Claim by
            <input name="expiresAt" type="datetime-local" />
          </label>
        </details>
        <p className="muted">
          One account · claim within a year, unless changed above. Premium
          starts when claimed.
        </p>
        <button disabled={busy}>Create code</button>
      </form>
      {created && (
        <div className="account-included">
          <label>
            New code
            <input
              readOnly
              value={created}
              onFocus={(e) => e.target.select()}
            />
          </label>
          <p>Save this code to share it. It is shown only once.</p>
          <button onClick={() => setCreated("")}>Done</button>
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
      {loadError && (
        <p role="status">
          {loadError} <button onClick={() => void load()}>Retry</button>
        </p>
      )}
      <ul className="access-code-list">
        {codes.map((c) => (
          <li key={c.id}>
            <strong>{c.label}</strong>
            <span>
              {c.durationDays === null
                ? "No end date"
                : `${c.durationDays} days`}{" "}
              · {c.redemptions}/{c.maxRedemptions} claimed
            </span>
            <span className="muted">Claim by {date(c.expiresAt)}</span>
            {c.revokedAt ? (
              <span>Revoked</span>
            ) : revoke === c.id ? (
              <div>
                <p>Revoke this code and the Premium access it granted?</p>
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
                  Revoke code
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
      {!loadError && !codes.length && <p>No codes yet.</p>}
    </details>
  );
}
