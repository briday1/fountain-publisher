import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Download,
  History,
  RefreshCw,
  FileText,
} from "lucide-react";
import {
  libraryRequest,
  formatBytes,
  formatModified,
} from "../storage/writeshapeLibrary";
import type { LibraryFile, LibraryVersion } from "../storage/writeshapeLibrary";
import { VersionReview } from "./VersionReview";
import { VersionComparison } from "./VersionComparison";
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
  const [baseline, setBaseline] = useState<LibraryVersion>();
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [reload, setReload] = useState(0);
  const [retention, setRetention] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    libraryRequest(`/${file.id}/versions`)
      .then((data) => {
        if (!active) return;
        setVersions(data.versions);
        setCurrent(data.file);
        setRetention(data.historyMode === "rolling" ? data.historyLimit : null);
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
    setBaseline(undefined);
    setComparisonLoading(!!selected);
    if (selected)
      libraryRequest(`/${file.id}/versions/${encodeURIComponent(selected)}`)
        .then(async (data: LibraryVersion) => {
          if (!active) return;
          setPreview(data);
          const latest = await libraryRequest(`/${file.id}`);
          if (active) {
            setCurrent(latest);
            setBaseline({
              id: `${latest.id}:${latest.revision}`,
              revision: latest.revision,
              name: latest.name,
              content: latest.content,
              current: true,
              savedAt: latest.updated,
              bytes: latest.bytes,
            });
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        })
        .finally(() => {
          if (active) setComparisonLoading(false);
        });
    return () => {
      active = false;
    };
  }, [file.id, selected, versions]);
  async function saveReview(content: string) {
    const saved = await libraryRequest("", {
      ...current,
      content,
      kind: "file",
    });
    setNotice(
      `Saved as version ${saved.revision}. Your open draft is unchanged.`,
    );
    setSelected(saved.versionId);
    setReload((n) => n + 1);
    onChanged();
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
      {retention !== null && (
        <p className="library-message">
          Your current file and its newest {retention} previous versions are
          kept. Older versions expire as you save. Download any version you want
          to keep longer.
        </p>
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
                    `${preview.name.replace(/\.(fountain|md|markdown)$/i, "")}-v${preview.revision}${/\.(md|markdown)$/i.test(preview.name) ? ".md" : ".fountain"}`,
                  )
                }
              >
                <Download size={17} />
              </button>
            )}
          </div>
          {preview && !comparisonLoading ? (
            <VersionComparison
              novel={/\.(md|markdown)$/i.test(preview.name)}
              key={`${preview.id}:${baseline?.id || "first"}`}
              older={preview.content ?? ""}
              newer={baseline?.content ?? ""}
              olderLabel={`Version ${preview.revision} · ${formatModified(preview.savedAt)}`}
              newerLabel={`Current version ${baseline?.revision || current.revision}`}
            />
          ) : (
            <p role="status">Loading saved comparison…</p>
          )}
          {preview && (
            <small className="library-version-id">
              Version ID: {preview.id}
            </small>
          )}
        </div>
      </div>
      <div className="library-history-footer">
        <p>
          Compare with the current version, choose what to keep, and save a new
          version.
        </p>
        <button
          className="primary"
          disabled={
            busy ||
            loading ||
            comparisonLoading ||
            !preview ||
            !baseline ||
            preview.id === baseline.id ||
            !canWrite
          }
          onClick={() => setReviewing(true)}
        >
          See changes
        </button>
        <button
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
      {reviewing && preview && baseline && (
        <VersionReview
          novel={/\.(md|markdown)$/i.test(preview.name)}
          older={preview.content || ""}
          current={baseline.content || ""}
          olderLabel={`Version ${preview.revision}`}
          onSave={saveReview}
          onClose={() => setReviewing(false)}
        />
      )}
    </section>
  );
}
