import { useEffect, useState } from "react";
import {
  ArrowLeft,
  LockKeyhole,
  Share2,
  FileText,
  RefreshCw,
} from "lucide-react";
import {
  cloudRequest,
  libraryRequest,
  formatModified,
} from "../storage/writeshapeLibrary";
import type { LibraryFile } from "../storage/writeshapeLibrary";
type Share = {
  id: string;
  recipientEmail: string;
  role?: "read-only" | "read-write";
  createdAt: string;
  revokedAt: string | null;
};
export function LibrarySharing({
  file,
  onBack,
  backLabel = "Back to files",
}: {
  file: LibraryFile;
  onBack: () => void;
  backLabel?: string;
}) {
  const [shares, setShares] = useState<Share[]>([]),
    [enabled, setEnabled] = useState(false),
    [reason, setReason] = useState("");
  const [collaboration, setCollaboration] = useState(false);
  const [role, setRole] = useState("read-only");
  const [email, setEmail] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    libraryRequest(`/${file.id}/shares`)
      .then((data) => {
        if (active) {
          setShares(data.shares);
          setCollaboration(!!data.canCollaborate);
          setEnabled(data.canShare);
          setReason(data.reason || "");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [file.id, reload]);
  async function change(path: string, body: unknown) {
    setBusy(true);
    setError("");
    try {
      await libraryRequest(`/${file.id}/shares` + path, body);
      setEmail("");
      setReload((n) => n + 1);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Sharing could not be updated.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="library-sharing" aria-label="File sharing">
      <div className="library-history-heading">
        <button disabled={busy} onClick={onBack}>
          <ArrowLeft size={16} />
          {backLabel}
        </button>
        <div>
          <h3>{file.name}</h3>
          <span>Manage access</span>
        </div>
        <Share2 size={19} />
      </div>
      <div className="library-sharing-content">
        <div className="library-sharing-intro">
          <LockKeyhole size={28} />
          <h3>Share this document</h3>
          <p>
            Give a verified WriteShape account access to this document. Your
            folders and version history stay private. You can revoke access at
            any time. People who can edit share the document owner’s Premium
            access.
          </p>
        </div>
        {error && (
          <div className="library-message library-error" role="alert">
            {error}
          </div>
        )}
        {!enabled && !loading && (
          <div className="library-message" role="status">
            {reason ||
              "External sharing is unavailable during the private pilot."}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void change("", { email: email.trim(), role });
          }}
        >
          <label>
            Recipient email
            <input
              type="email"
              autoComplete="off"
              aria-label="Recipient email"
              required
              value={email}
              disabled={!enabled || busy || loading}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="writer@example.com"
            />
          </label>
          {collaboration ? (
            <label>
              Access
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                disabled={busy || loading}
              >
                <option value="read-only">Can view</option>
                <option value="read-write">Can edit</option>
              </select>
            </label>
          ) : (
            <span className="library-share-role">Can view</span>
          )}
          <button
            className="primary"
            disabled={!enabled || busy || loading || !email.trim()}
          >
            Share file
          </button>
        </form>
        <p className="library-sharing-note">
          The recipient must already have a verified account. No email
          invitation or public link is created.
        </p>
        <h4>People with access</h4>
        {loading ? (
          <p>Loading access…</p>
        ) : shares.filter((s) => !s.revokedAt).length ? (
          shares
            .filter((s) => !s.revokedAt)
            .map((s) => (
              <div className="library-share-row" key={s.id}>
                <div>
                  <strong>{s.recipientEmail}</strong>
                  <small>
                    {s.role === "read-write" ? "Can edit" : "Can view"} · Shared{" "}
                    {formatModified(s.createdAt)}
                  </small>
                </div>
                <button
                  disabled={busy}
                  onClick={() => void change(`/${s.id}/revoke`, {})}
                >
                  Revoke access
                </button>
              </div>
            ))
        ) : (
          <p className="library-sharing-note">
            Only you have access to this file.
          </p>
        )}
      </div>
    </section>
  );
}
export function SharedWithMe({
  onOpenLive,
}: {
  onOpenLive?: (id: string) => Promise<void>;
}) {
  const [data, setData] = useState<any>(),
    [preview, setPreview] = useState<any>(),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setPreview(undefined);
    setError("");
    cloudRequest("/api/shared")
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reload]);
  return (
    <section className="library-sharing" aria-label="Shared with me">
      <div className="library-history-heading">
        <div>
          <h3>Shared with me</h3>
          <span>Documents shared with your verified account</span>
        </div>
        <button
          className="icon-button"
          disabled={loading || busy}
          aria-label="Refresh shared files"
          onClick={() => setReload((n) => n + 1)}
        >
          <RefreshCw size={17} />
        </button>
      </div>
      {error && (
        <div className="library-message library-error" role="alert">
          {error}
        </div>
      )}
      {preview ? (
        <div className="library-version-preview">
          <button onClick={() => setPreview(undefined)}>
            <ArrowLeft size={16} />
            Back to shared files
          </button>
          <h3>{preview.name}</h3>
          <p>
            {preview.readOnly ? "Can view" : "Can edit"} · Current version{" "}
            {preview.revision} · {formatModified(preview.updated)}
          </p>
          {preview.liveId && onOpenLive && (
            <button
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void onOpenLive(preview.liveId)
                  .catch((e) => setError(String(e)))
                  .finally(() => setBusy(false));
              }}
            >
              Open document
            </button>
          )}
          <pre tabIndex={0} aria-label="Shared screenplay">
            {preview.content}
          </pre>
        </div>
      ) : loading ? (
        <div className="library-empty">Loading shared files…</div>
      ) : !data?.canReadShared ? (
        <div className="library-empty">
          <LockKeyhole size={32} />
          <strong>Sharing is not available yet</strong>
          <p>
            {data?.reason ||
              "External sharing is unavailable during the private pilot."}
          </p>
        </div>
      ) : data.shares.length ? (
        <div className="library-shared-list">
          {data.shares.map((s: any) => (
            <button
              key={s.shareId}
              disabled={busy}
              onClick={() => {
                setBusy(true);
                setError("");
                cloudRequest("/api/shared/" + s.shareId)
                  .then(setPreview)
                  .catch((e) => setError(e.message))
                  .finally(() => setBusy(false));
              }}
            >
              <FileText size={23} />
              <span>
                <strong>{s.name}</strong>
                <small>
                  {s.role === "read-write" ? "Can edit" : "Can view"} · Updated{" "}
                  {formatModified(s.updated)}
                </small>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="library-empty">
          <Share2 size={32} />
          <strong>No shared screenplays yet</strong>
          <p>Files shared with your verified account will appear here.</p>
        </div>
      )}
    </section>
  );
}
