import { documentFilename } from "../core/documentFormat";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  ChevronRight,
  Folder,
  FolderPlus,
  FileText,
  Search,
  RefreshCw,
  HardDrive,
  History,
  Cloud,
  ArrowRight,
  Share2,
} from "lucide-react";
import { Modal } from "./Modal";
import { LibrarySharing, SharedWithMe } from "./LibrarySharing";
import { LibraryHistory } from "./LibraryHistory";
import {
  libraryRequest,
  formatBytes,
  formatModified,
  sortedLibraryItems,
} from "../storage/writeshapeLibrary";
import type { LibraryFile, StorageUsage } from "../storage/writeshapeLibrary";
import "./writeshape-library.css";
export { libraryRequest, LibraryError } from "../storage/writeshapeLibrary";
export type { LibraryFile } from "../storage/writeshapeLibrary";
export function WriteShapeLibrary({
  mode,
  name,
  captureSave,
  onOpen,
  onClose,
  initialFile,
  embedded = false,
  onBusyChange,
}: {
  mode: "open" | "save";
  name: string;
  captureSave: () => { content: string; onSaved: (item: LibraryFile) => void };
  onOpen: (item: LibraryFile) => Promise<void>;
  onClose: () => void;
  initialFile?: LibraryFile;
  embedded?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [parent, setParent] = useState(initialFile?.parent || "");
  const [breadcrumbs, setBreadcrumbs] = useState<
    { id: string; name: string }[]
  >([]);
  const [items, setItems] = useState<LibraryFile[]>([]),
    [usage, setUsage] = useState<StorageUsage>();
  const [selected, setSelected] = useState<string | undefined>(initialFile?.id),
    [history, setHistory] = useState<LibraryFile>();
  const [sharing, setSharing] = useState<LibraryFile>();
  const [shared, setShared] = useState(false);
  const [query, setQuery] = useState(""),
    [sort, setSort] = useState("name");
  const [filename, setFilename] = useState(
    name.replace(/\.[^.]+$/, "") +
      (/\.(md|markdown)$/i.test(name) ? ".md" : ".fountain"),
  );
  const [folder, setFolder] = useState(""),
    [newFolder, setNewFolder] = useState(false);
  const [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [canWrite, setCanWrite] = useState(false),
    [reload, setReload] = useState(0);
  useEffect(() => {
    onBusyChange?.(busy);
    return () => onBusyChange?.(false);
  }, [busy, onBusyChange]);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const rows = useRef(new Map<string, HTMLDivElement>());
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setItems([]);
    libraryRequest("?parent=" + encodeURIComponent(parent))
      .then((data) => {
        if (!active) return;
        setItems(data.items);
        setBreadcrumbs(data.breadcrumbs);
        setUsage(data.usage);
        setCanWrite(data.canWrite);
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
  }, [parent, reload]);
  const visible = useMemo(
    () => sortedLibraryItems(items, query, sort),
    [items, query, sort],
  );
  const choice = items.find((item) => item.id === selected);
  function navigate(id: string) {
    setParent(id);
    setSelected(undefined);
    setQuery("");
    setNewFolder(false);
    setError("");
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The request could not finish.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function open(item: LibraryFile) {
    if (item.kind === "folder") {
      navigate(item.id);
      return;
    }
    await run(async () => {
      const content = await libraryRequest("/" + item.id);
      if (!active.current) return;
      await onOpen(content);
      onClose();
    });
  }
  async function save() {
    await run(async () => {
      const actual = documentFilename(filename, name);
      if (!filename.trim()) throw new Error("Choose a filename.");
      const captured = captureSave();
      const result = await libraryRequest("", {
        name: actual,
        parent,
        kind: "file",
        content: captured.content,
      });
      captured.onSaved(result);
      onClose();
    });
  }
  const heading = mode === "save" ? "Save to your library" : "Your library";
  const content = (
    <div className="library-shell">
      <aside
        className="library-sidebar"
        aria-label="Library locations and storage"
      >
        <div className="library-sidebar-label">WORKSPACE</div>
        <button
          className="library-location"
          aria-current={!parent && !shared ? "page" : undefined}
          disabled={busy}
          onClick={() => {
            setHistory(undefined);
            setSharing(undefined);
            setShared(false);
            navigate("");
          }}
        >
          <Cloud size={18} />
          <span>My documents</span>
        </button>
        <button
          className="library-location"
          aria-current={shared ? "page" : undefined}
          onClick={() => {
            setShared(true);
            setHistory(undefined);
            setSharing(undefined);
          }}
        >
          <Share2 size={18} />
          <span>Shared with me</span>
        </button>
        <div className="library-storage" aria-label="Storage usage">
          <HardDrive size={19} />
          <span className="library-sidebar-label">STORAGE</span>
          {usage ? (
            <>
              <strong>
                {formatBytes(usage.usedBytes)} <small>used</small>
              </strong>
              <span className="library-allowance">
                {usage.quotaBytes === null
                  ? "Unlimited"
                  : `of ${formatBytes(usage.quotaBytes)}`}
              </span>
              {usage.quotaBytes !== null && (
                <meter
                  min={0}
                  max={Math.max(usage.quotaBytes, 1)}
                  value={Math.min(
                    usage.usedBytes,
                    Math.max(usage.quotaBytes, 1),
                  )}
                  aria-label="Storage used"
                />
              )}
              <dl>
                <div>
                  <dt>Current scripts</dt>
                  <dd>{formatBytes(usage.currentBytes)}</dd>
                </div>
                <div>
                  <dt>Version history</dt>
                  <dd>{formatBytes(usage.historyBytes)}</dd>
                </div>
              </dl>
              <p>
                {usage.fileCount} {usage.fileCount === 1 ? "file" : "files"} ·{" "}
                {usage.folderCount}{" "}
                {usage.folderCount === 1 ? "folder" : "folders"}
                <br />
                {usage.versionCount} prior{" "}
                {usage.versionCount === 1 ? "version" : "versions"}
              </p>
              <small>Usage includes current scripts and saved versions.</small>
            </>
          ) : (
            <p>Loading usage…</p>
          )}
        </div>
      </aside>
      <div className="library-main">
        {shared ? (
          <SharedWithMe />
        ) : sharing ? (
          <LibrarySharing file={sharing} onBack={() => setSharing(undefined)} />
        ) : history ? (
          <LibraryHistory
            file={history}
            canWrite={canWrite}
            onBack={() => setHistory(undefined)}
            onOpen={async (item) => {
              await onOpen(item);
              onClose();
            }}
            onChanged={() => setReload((n) => n + 1)}
          />
        ) : (
          <>
            <div className="library-pathbar">
              <button
                className="icon-button"
                aria-label="Up one folder"
                disabled={busy || loading || !parent}
                onClick={() => navigate(breadcrumbs.at(-2)?.id || "")}
              >
                <ArrowUp size={17} />
              </button>
              <nav aria-label="Folder path">
                <button disabled={busy} onClick={() => navigate("")}>
                  My documents
                </button>
                {breadcrumbs.map((crumb, index) => (
                  <span key={crumb.id}>
                    <ChevronRight size={13} />
                    <button
                      disabled={busy}
                      aria-current={
                        index === breadcrumbs.length - 1 ? "page" : undefined
                      }
                      onClick={() => navigate(crumb.id)}
                    >
                      {crumb.name}
                    </button>
                  </span>
                ))}
              </nav>
              <button
                className="icon-button"
                aria-label="Refresh library"
                disabled={busy || loading}
                onClick={() => setReload((n) => n + 1)}
              >
                <RefreshCw size={16} />
              </button>
            </div>
            <div className="library-tools">
              <label className="library-search">
                <Search size={16} />
                <input
                  aria-label="Search this folder"
                  placeholder="Search this folder"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelected(undefined);
                  }}
                />
              </label>
              <label className="library-sort">
                <span>Sort</span>
                <select
                  aria-label="Sort files"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="name">Name</option>
                  <option value="updated">Last modified</option>
                  <option value="size">Size</option>
                </select>
              </label>
              <button
                disabled={busy || loading || !canWrite}
                onClick={() => setNewFolder((v) => !v)}
              >
                <FolderPlus size={16} />
                <span>New folder</span>
              </button>
            </div>
            {newFolder && (
              <form
                className="library-new-folder"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    const result = await libraryRequest("", {
                      kind: "folder",
                      name: folder.trim(),
                      parent,
                    });
                    setFolder("");
                    setNewFolder(false);
                    setSelected(result.id);
                    setReload((n) => n + 1);
                  });
                }}
              >
                <input
                  autoFocus
                  aria-label="Folder name"
                  placeholder="Folder name"
                  maxLength={160}
                  required
                  value={folder}
                  onChange={(e) => setFolder(e.target.value)}
                />
                <button disabled={busy || !folder.trim()} className="primary">
                  Create folder
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setNewFolder(false)}
                >
                  Cancel
                </button>
              </form>
            )}
            {error && (
              <div className="library-message library-error" role="alert">
                <strong>Your writing is safe</strong>
                <span>{error}</span>
              </div>
            )}
            <div className="library-column-head" aria-hidden="true">
              <span>Name</span>
              <span>Modified</span>
              <span>Size</span>
            </div>
            <div
              className="library-files"
              role="listbox"
              aria-label="Files and folders"
              aria-busy={loading}
            >
              {loading ? (
                <div className="library-empty">
                  <RefreshCw size={25} />
                  <strong>Loading your library…</strong>
                </div>
              ) : visible.length ? (
                visible.map((item, index) => (
                  <div
                    key={item.id}
                    ref={(el) => {
                      if (el) rows.current.set(item.id, el);
                      else rows.current.delete(item.id);
                    }}
                    role="option"
                    aria-selected={selected === item.id}
                    aria-label={`${item.kind === "folder" ? "Folder" : /\.(md|markdown)$/i.test(item.name) ? "Markdown file" : "Fountain file"}: ${item.name}`}
                    tabIndex={
                      selected === item.id || (!selected && index === 0)
                        ? 0
                        : -1
                    }
                    className="library-file-row"
                    onClick={() => !busy && setSelected(item.id)}
                    onDoubleClick={() => {
                      if (!busy) void open(item);
                    }}
                    onKeyDown={(e) => {
                      if (busy) return;
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void open(item);
                      } else if (e.key === " ") {
                        e.preventDefault();
                        setSelected(item.id);
                      } else if (
                        ["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)
                      ) {
                        e.preventDefault();
                        const next =
                          visible[
                            e.key === "Home"
                              ? 0
                              : e.key === "End"
                                ? visible.length - 1
                                : Math.max(
                                    0,
                                    Math.min(
                                      visible.length - 1,
                                      index + (e.key === "ArrowDown" ? 1 : -1),
                                    ),
                                  )
                          ];
                        setSelected(next.id);
                        rows.current.get(next.id)?.focus();
                      }
                    }}
                  >
                    <div className="library-file-name">
                      {item.kind === "folder" ? (
                        <Folder className="library-folder-icon" size={27} />
                      ) : (
                        <FileText className="library-script-icon" size={25} />
                      )}
                      <span>
                        <strong>{item.name}</strong>
                        <small>
                          {item.kind === "folder"
                            ? "Folder"
                            : `${/\.(md|markdown)$/i.test(item.name) ? "Markdown novel" : "Fountain screenplay"} · v${item.revision}`}
                        </small>
                      </span>
                    </div>
                    <time dateTime={item.updated}>
                      {formatModified(item.updated)}
                    </time>
                    <span className="library-file-size">
                      {item.kind === "folder"
                        ? "—"
                        : formatBytes(item.bytes || 0)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="library-empty">
                  <Folder size={38} />
                  <strong>
                    {query
                      ? "No matching files"
                      : "A little room for your next story"}
                  </strong>
                  <p>
                    {query
                      ? "Try a different name in this folder."
                      : mode === "save"
                        ? "Save your document here, or create a folder to organize your work."
                        : "This folder is empty. Save a document here to start your library."}
                  </p>
                </div>
              )}
            </div>
            <div className="library-selection-bar">
              <span>
                {loading
                  ? "Loading…"
                  : `${visible.length} ${visible.length === 1 ? "item" : "items"}`}
                {query && ` matching “${query}”`}
              </span>
              {choice?.kind === "file" && (
                <div className="library-selection-actions">
                  <button disabled={busy} onClick={() => setSharing(choice)}>
                    <Share2 size={15} />
                    Share
                  </button>
                  <button disabled={busy} onClick={() => setHistory(choice)}>
                    <History size={15} />
                    Version history
                  </button>
                </div>
              )}
            </div>
            <footer className="library-footer">
              {mode === "save" ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void save();
                  }}
                >
                  <label>
                    Save as
                    <input
                      aria-label="Filename"
                      value={filename}
                      maxLength={150}
                      required
                      onChange={(e) => setFilename(e.target.value)}
                    />
                  </label>
                  <button
                    className="primary"
                    disabled={busy || loading || !canWrite || !filename.trim()}
                  >
                    {busy ? "Saving…" : "Save new file"}
                    <ArrowRight size={15} />
                  </button>
                  <small>
                    Saving here creates a new file. Existing files and versions
                    stay intact.
                  </small>
                </form>
              ) : (
                <div className="library-open-actions">
                  <p>
                    {choice?.name ||
                      "Select a file to open, or a folder to browse."}
                  </p>
                  <button
                    className="primary"
                    disabled={busy || loading || !choice}
                    onClick={() => choice && void open(choice)}
                  >
                    {busy
                      ? "Opening…"
                      : choice?.kind === "folder"
                        ? "Open folder"
                        : "Open file"}
                    <ArrowRight size={15} />
                  </button>
                </div>
              )}
              {!canWrite && !loading && (
                <p className="library-readonly">
                  Your library is read only. Open or download your scripts;
                  Premium is required for new saves.
                </p>
              )}
            </footer>
          </>
        )}
      </div>
    </div>
  );
  return embedded ? (
    content
  ) : (
    <Modal
      title={heading}
      eyebrow="WRITESHAPE CLOUD"
      onClose={onClose}
      wide
      className="writeshape-library"
    >
      {content}
    </Modal>
  );
}
