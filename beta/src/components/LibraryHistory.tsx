import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Download,
  History,
  RotateCcw,
  RefreshCw,
  FileText,
} from "lucide-react";
import {
  libraryRequest,
  formatBytes,
  formatModified,
  LibraryError,
} from "../storage/writeshapeLibrary";
import type { LibraryFile, LibraryVersion } from "../storage/writeshapeLibrary";
import { downloadFile } from "../storage/files";
export function LibraryHistory({
  file,
  canWrite,
  onBack,
  onOpen,
  onChanged,
}: {
  file: LibraryFile;
  canWrite: boolean;
  onBack: () => void;
  onOpen: (file: LibraryFile) => Promise<void>;
  onChanged: () => void;
}) {
  const [versions, setVersions] = useState<LibraryVersion[]>([]);
  const [current, setCurrent] = useState(file);
  const [selected, setSelected] = useState<string>();
  const [preview, setPreview] = useState<LibraryVersion>();
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setConfirm(false);
    libraryRequest(`/${file.id}/versions`)
      .then((data) => {
        if (!active) return;
        setVersions(data.versions);
        setCurrent(data.file);
        setSelected((id) =>
          data.versions.some((v: LibraryVersion) => v.id === id)
            ? id
            : data.versions[0]?.id,
        );
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
  useEffect(() => {
    let active = true;
    setPreview(undefined);
    setConfirm(false);
    if (selected)
      libraryRequest(`/${file.id}/versions/${encodeURIComponent(selected)}`)
        .then((data) => {
          if (active) setPreview(data);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [file.id, selected]);
  async function restore() {
    if (!preview) return;
    setBusy(true);
    setError("");
    try {
      const restored = await libraryRequest(`/${file.id}/restore`, {
        versionId: preview.id,
        revision: current.revision,
      });
      setNotice(
        `Version ${preview.revision} restored as version ${restored.revision}. Your open draft is unchanged.`,
      );
      setSelected(restored.versionId);
      setReload((n) => n + 1);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Restore failed.");
      if (e instanceof LibraryError && e.code === "REVISION_CONFLICT")
        setConfirm(false);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="library-history" aria-label="Cloud version history">
      <div className="library-history-heading">
        <button onClick={onBack} disabled={busy}>
          <ArrowLeft size={16} />
          Back to files
        </button>
        <div>
          <h3>{file.name}</h3>
          <span>Version history</span>
        </div>
        <button
          className="icon-button"
          aria-label="Refresh versions"
          disabled={busy || loading}
          onClick={() => setReload((n) => n + 1)}
        >
          <RefreshCw size={16} />
        </button>
      </div>
      {error && (
        <div className="library-message library-error" role="alert">
          <strong>Could not complete the request</strong>
          <span>{error}</span>
          <button disabled={busy} onClick={() => setReload((n) => n + 1)}>
            Refresh versions
          </button>
        </div>
      )}
      {notice && (
        <div className="library-message" role="status">
          {notice}
        </div>
      )}
      <div className="library-history-body">
        <nav
          className="library-version-list"
          aria-label="Saved versions"
          aria-busy={loading}
        >
          <div className="library-list-label">
            <History size={15} />
            {loading
              ? "Loading versions…"
              : `${versions.length} saved ${versions.length === 1 ? "version" : "versions"}`}
          </div>
          {versions.map((v) => (
            <button
              key={v.id}
              disabled={busy || loading}
              aria-current={selected === v.id ? "true" : undefined}
              onClick={() => {
                setSelected(v.id);
                setError("");
              }}
            >
              <span>
                <strong>Version {v.revision}</strong>
                {v.current && <small>Current</small>}
              </span>
              <time dateTime={v.savedAt}>{formatModified(v.savedAt)}</time>
              <span className="library-version-size">
                {formatBytes(v.bytes)}
              </span>
            </button>
          ))}
          <p>
            Earlier saves from before version history was enabled are not
            available. Saved versions are kept.
          </p>
        </nav>
        <div className="library-version-preview" aria-busy={!preview}>
          <div className="library-preview-heading">
            <FileText size={18} />
            <div>
              <strong>
                {preview ? `Version ${preview.revision}` : "Loading preview…"}
              </strong>
              <span>{preview ? formatModified(preview.savedAt) : ""}</span>
            </div>
            {preview && (
              <button
                className="icon-button"
                title="Download this version"
                aria-label="Download this version"
                onClick={() =>
                  downloadFile(
                    preview.content || "",
                    `${preview.name.replace(/\.fountain$/i, "")}-v${preview.revision}.fountain`,
                  )
                }
              >
                <Download size={17} />
              </button>
            )}
          </div>
          <pre tabIndex={0} aria-label="Version content">
            {preview?.content ?? "Loading saved content…"}
          </pre>
          {preview && (
            <small className="library-version-id">
              Version ID: {preview.id}
            </small>
          )}
        </div>
      </div>
      <div className="library-history-footer">
        {confirm ? (
          <div
            className="library-restore-confirm"
            role="group"
            aria-label="Confirm restore"
          >
            <p>
              Restore version {preview?.revision} as a new version? Current
              version {current.revision} and all history will be kept. Your open
              draft stays unchanged.
            </p>
            <div>
              <button disabled={busy} onClick={() => setConfirm(false)}>
                Cancel
              </button>
              <button
                className="primary"
                disabled={busy || loading}
                onClick={() => void restore()}
              >
                {busy ? "Restoring…" : "Confirm restore"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <p>
              {canWrite
                ? "Restoring saves a new version. Nothing is erased."
                : "Your versions are available to read and download. Premium is required to restore."}
            </p>
            <div>
              <button
                disabled={
                  busy ||
                  loading ||
                  !preview ||
                  versions.find((v) => v.id === preview.id)?.current ||
                  !canWrite
                }
                onClick={() => setConfirm(true)}
              >
                <RotateCcw size={15} />
                Restore as new version
              </button>
              <button
                className="primary"
                disabled={busy || loading}
                onClick={() => {
                  setBusy(true);
                  void libraryRequest("/" + file.id)
                    .then(onOpen)
                    .catch((e) => {
                      setError(e.message);
                      setBusy(false);
                    });
                }}
              >
                Open current file
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
