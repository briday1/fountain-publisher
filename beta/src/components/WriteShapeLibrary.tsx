import { availableCopyName } from "../storage/copyName";
import { NewFileForm } from "./NewFileForm";
import { downloadLibraryItems } from "../storage/libraryDownloads";
import { documentFilename } from "../core/documentFormat";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  ChevronRight,
  Folder,
  FolderPlus,
  Plus,
  FileText,
  Search,
  RefreshCw,
  HardDrive,
  History,
  Cloud,
  ArrowRight,
  Share2,
  Copy,
  Download,
  MoreHorizontal,
  Pencil,
  FolderInput,
  Trash2,
} from "lucide-react";
import { Menu } from "./Menu";
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
  onOpenLive,
  onClose,
  initialFile,
  embedded = false,
  onBusyChange,
}: {
  mode: "open" | "save";
  name: string;
  captureSave: () => { content: string; onSaved: (item: LibraryFile) => void };
  onOpen: (item: LibraryFile) => Promise<void>;
  onOpenLive?: (id: string) => Promise<void>;
  onClose: () => void;
  initialFile?: LibraryFile;
  embedded?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [management, setManagement] = useState<
    "rename" | "move" | "copy" | "trash"
  >();
  const [context, setContext] = useState<{
    id: string;
    x: number;
    y: number;
  }>();
  const [notice, setNotice] = useState("");
  const [manageName, setManageName] = useState("");
  const [moveParent, setMoveParent] = useState("");
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
  const [newFile, setNewFile] = useState(false);
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
    setChecked(new Set());
    setManagement(undefined);
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
  const choice =
    checked.size > 1
      ? undefined
      : items.find(
          (item) =>
            item.id === (checked.size === 1 ? [...checked][0] : selected),
        );
  const inTrash =
    parent === "__trash__" || breadcrumbs.some((c) => c.id === "__trash__");
  const selection = checked.size
    ? items.filter((item) => checked.has(item.id))
    : choice
      ? [choice]
      : [];
  function dismissActions() {
    setContext(undefined);
  }
  function selectItem(id: string) {
    setSelected(id);
    setChecked(new Set());
    setManagement(undefined);
    dismissActions();
  }
  function navigate(id: string) {
    setParent(id);
    setSelected(undefined);
    setQuery("");
    setNewFolder(false);
    setNewFile(false);
    setChecked(new Set());
    setManagement(undefined);
    setNotice("");
    dismissActions();
    setError("");
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
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
  async function manage(action: "rename" | "move" | "copy" | "trash") {
    if (!choice) return;
    dismissActions();
    setNewFolder(false);
    setNewFile(false);
    setManagement(action);
    setManageName(
      action === "copy" ? availableCopyName(choice, items) : choice.name,
    );
    setMoveParent(action === "copy" ? parent : "");
    if (action === "move" || action === "copy")
      await run(async () => {
        const found: { id: string; name: string }[] = [
          { id: "", name: "My Storage" },
        ];
        const seen = new Set<string>();
        async function visit(id: string, path: string) {
          if (seen.has(id) || found.length > 500)
            throw new Error("Too many folders to list at once.");
          seen.add(id);
          const list = await libraryRequest(
            "?parent=" + encodeURIComponent(id),
          );
          for (const folder of list.items.filter(
            (i: LibraryFile) => i.kind === "folder" && i.id !== choice!.id,
          )) {
            const label = path + folder.name;
            found.push({ id: folder.id, name: label });
            await visit(folder.id, label + " / ");
          }
        }
        await visit("", "");
        setFolders(found);
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
          <span>My Storage</span>
        </button>
        <button
          className="library-location"
          aria-current={shared ? "page" : undefined}
          disabled={busy}
          onClick={() => {
            if (busy) return;
            setShared(true);
            setHistory(undefined);
            setSharing(undefined);
          }}
        >
          <Share2 size={18} />
          <span>Shared with me</span>
        </button>
        <button
          className="library-location"
          aria-current={!shared && parent === "__trash__" ? "page" : undefined}
          disabled={busy}
          onClick={() => {
            setHistory(undefined);
            setSharing(undefined);
            setShared(false);
            navigate("__trash__");
          }}
        >
          <Trash2 size={18} />
          Trash
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
              <details className="library-storage-details">
                <summary>Storage details</summary>
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
                <small>
                  Usage includes current scripts and saved versions.
                </small>
              </details>
            </>
          ) : (
            <p>Loading usage…</p>
          )}
        </div>
      </aside>
      <div className="library-main">
        {shared ? (
          <SharedWithMe onOpenLive={onOpenLive} />
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
                  My Storage
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
                    setChecked(new Set());
                    setManagement(undefined);
                    dismissActions();
                  }}
                />
              </label>
              <button
                className="finder-new"
                disabled={busy || loading || !canWrite || inTrash}
                onClick={() => {
                  setNewFile((v) => !v);
                  setNewFolder(false);
                  setManagement(undefined);
                }}
              >
                <Plus size={16} />
                New
              </button>
              <Menu
                label="Folder actions"
                anchored
                disabled={busy || loading}
                triggerContent={<MoreHorizontal size={19} />}
              >
                <button
                  disabled={!canWrite || inTrash}
                  onClick={() => {
                    setNewFolder(true);
                    setNewFile(false);
                    setManagement(undefined);
                  }}
                >
                  <FolderPlus size={16} />
                  New folder
                </button>
                <button
                  disabled={!visible.length}
                  onClick={() => {
                    setChecked(new Set(visible.map((i) => i.id)));
                    setSelected(undefined);
                    setManagement(undefined);
                  }}
                >
                  Select all
                </button>
                <button
                  disabled={!selection.length}
                  onClick={() => {
                    setChecked(new Set());
                    setSelected(undefined);
                  }}
                >
                  Clear selection
                </button>
                <button
                  disabled={!(selection.length || items.length)}
                  onClick={() =>
                    void run(() =>
                      downloadLibraryItems(
                        selection.length ? selection : items,
                      ),
                    )
                  }
                >
                  <Download size={16} />
                  {selection.length ? "Download selected" : "Download folder"}
                </button>
                <button onClick={() => setReload((n) => n + 1)}>
                  <RefreshCw size={16} />
                  Refresh
                </button>
              </Menu>
            </div>
            {newFile && (
              <NewFileForm
                busy={busy}
                onCancel={() => setNewFile(false)}
                onCreate={(file) =>
                  void run(async () => {
                    if (!canWrite || parent === "__trash__") return;
                    const result = await libraryRequest("", {
                      kind: "file",
                      parent,
                      name: file.name,
                      content: file.content,
                    });
                    if (!active.current) return;
                    setNewFile(false);
                    setReload((value) => value + 1);
                    await onOpen({ ...result, content: file.content });
                    onClose();
                  })
                }
              />
            )}
            {management && choice && (
              <form
                className="library-new-folder"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    const result = await libraryRequest(
                      "/" +
                        choice.id +
                        (management === "copy" ? "/copy" : "/manage"),
                      {
                        action: management,
                        revision: choice.revision,
                        name: manageName,
                        parent: moveParent,
                      },
                    );
                    setSelected(
                      management === "copy" && moveParent === parent
                        ? result.id
                        : undefined,
                    );
                    setChecked(new Set());
                    setNotice(
                      management === "copy"
                        ? `Created “${result.name}”.`
                        : management === "trash"
                          ? `Moved “${choice.name}” to Trash.`
                          : "File updated.",
                    );
                    setManagement(undefined);
                    setReload((n) => n + 1);
                  });
                }}
              >
                {management === "rename" || management === "copy" ? (
                  <label>
                    {management === "copy" ? "Copy name" : "New name"}
                    <input
                      autoFocus
                      aria-label={
                        management === "copy" ? "Copy name" : "New item name"
                      }
                      required
                      maxLength={160}
                      value={manageName}
                      onChange={(e) => setManageName(e.target.value)}
                    />
                  </label>
                ) : management === "move" ? (
                  <label>
                    Destination folder
                    <select
                      aria-label="Destination folder"
                      value={moveParent}
                      onChange={(e) => setMoveParent(e.target.value)}
                    >
                      {folders.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <p>
                    Move “{choice.name}” to Trash? Files can be restored from
                    Trash. A folder and everything inside it will move together.
                  </p>
                )}
                {management === "copy" && (
                  <label>
                    Destination folder
                    <select
                      aria-label="Copy destination folder"
                      disabled={busy}
                      value={moveParent}
                      onChange={(e) => setMoveParent(e.target.value)}
                    >
                      {folders.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <button className="primary" disabled={busy || !canWrite}>
                  {management === "copy"
                    ? "Create copy"
                    : management === "trash"
                      ? "Confirm move to trash"
                      : "Apply"}
                </button>
                <button
                  type="button"
                  onClick={() => setManagement(undefined)}
                  disabled={busy}
                >
                  Cancel
                </button>
              </form>
            )}
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
            {notice && (
              <div className="library-feedback" role="status">
                {notice}
              </div>
            )}
            {error && (
              <div className="library-message library-error" role="alert">
                <strong>Your writing is safe</strong>
                <span>{error}</span>
              </div>
            )}
            <div className="library-column-head">
              <button
                aria-label="Sort by name"
                aria-pressed={sort === "name"}
                onClick={() => setSort("name")}
              >
                Name
              </button>
              <button
                aria-label="Sort by modified"
                aria-pressed={sort === "updated"}
                onClick={() => setSort("updated")}
              >
                Modified
              </button>
              <button
                aria-label="Sort by size"
                aria-pressed={sort === "size"}
                onClick={() => setSort("size")}
              >
                Size
              </button>
              <span />
            </div>
            <div
              className="library-files"
              role="listbox"
              aria-label="Files and folders"
              aria-busy={loading}
              aria-multiselectable={mode === "open"}
              onKeyDown={(e) => {
                if (
                  mode === "open" &&
                  (e.ctrlKey || e.metaKey) &&
                  e.key.toLowerCase() === "a"
                ) {
                  e.preventDefault();
                  setChecked(new Set(visible.map((i) => i.id)));
                  setSelected(undefined);
                }
              }}
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
                    aria-selected={selected === item.id || checked.has(item.id)}
                    aria-label={`${item.kind === "folder" ? "Folder" : /\.(md|markdown)$/i.test(item.name) ? "Markdown file" : "Fountain file"}: ${item.name}`}
                    tabIndex={
                      selected === item.id || (!selected && index === 0)
                        ? 0
                        : -1
                    }
                    className="library-file-row"
                    onClick={(e) => {
                      if (busy) return;
                      if (
                        mode === "open" &&
                        (e.metaKey || e.ctrlKey || e.shiftKey)
                      ) {
                        const next = new Set(
                          checked.size ? checked : selected ? [selected] : [],
                        );
                        if (e.shiftKey && selected) {
                          const start = visible.findIndex(
                            (i) => i.id === selected,
                          );
                          visible
                            .slice(
                              Math.min(start, index),
                              Math.max(start, index) + 1,
                            )
                            .forEach((i) => next.add(i.id));
                        } else
                          next.has(item.id)
                            ? next.delete(item.id)
                            : next.add(item.id);
                        setChecked(next);
                        setManagement(undefined);
                      } else selectItem(item.id);
                    }}
                    onContextMenu={(e) => {
                      if (mode !== "open" || busy) return;
                      e.preventDefault();
                      selectItem(item.id);
                      setContext({ id: item.id, x: e.clientX, y: e.clientY });
                    }}
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
                        selectItem(item.id);
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
                        selectItem(next.id);
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
                        <strong title={item.name}>{item.name}</strong>
                        <small>
                          {item.kind === "folder"
                            ? "Folder"
                            : `${/\.(md|markdown)$/i.test(item.name) ? "Markdown book" : "Fountain screenplay"}`}
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
                    <div
                      className="finder-row-menu"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (selected !== item.id || checked.size)
                          selectItem(item.id);
                      }}
                      onDoubleClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <Menu
                        label={`Actions for ${item.name}`}
                        anchored
                        disabled={busy}
                        restoreFocusOnSelect={false}
                        triggerContent={<MoreHorizontal size={18} />}
                        contextMenu={
                          context?.id === item.id ? context : undefined
                        }
                        onDismiss={() => setContext(undefined)}
                      >
                        <button onClick={() => void open(item)}>
                          <ArrowRight size={16} />
                          {item.kind === "folder" ? "Open folder" : "Open file"}
                        </button>
                        {!inTrash && (
                          <button
                            disabled={!canWrite}
                            onClick={() => void manage("copy")}
                          >
                            <Copy size={16} />
                            Copy
                          </button>
                        )}
                        <button
                          disabled={!canWrite}
                          onClick={() => void manage("rename")}
                        >
                          <Pencil size={16} />
                          Rename
                        </button>
                        <button
                          disabled={!canWrite}
                          onClick={() => void manage("move")}
                        >
                          <FolderInput size={16} />
                          {inTrash ? "Restore / move" : "Move"}
                        </button>
                        <button
                          onClick={() =>
                            void run(() => downloadLibraryItems([item]))
                          }
                        >
                          <Download size={16} />
                          Download
                        </button>
                        {item.kind === "file" && !inTrash && (
                          <>
                            <button onClick={() => setSharing(item)}>
                              <Share2 size={16} />
                              Share
                            </button>
                            <button onClick={() => setHistory(item)}>
                              <History size={16} />
                              Version history
                            </button>
                          </>
                        )}
                        {!inTrash && (
                          <button
                            className="finder-delete"
                            disabled={!canWrite}
                            onClick={() => void manage("trash")}
                          >
                            <Trash2 size={16} />
                            Move to trash
                          </button>
                        )}
                      </Menu>
                    </div>
                  </div>
                ))
              ) : (
                <div className="library-empty">
                  <Folder size={38} />
                  <strong>
                    {query ? "No matching files" : "No files in this folder"}
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
                    disabled={
                      busy ||
                      loading ||
                      !canWrite ||
                      parent === "__trash__" ||
                      !filename.trim()
                    }
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
                    {checked.size > 1
                      ? `${checked.size} items selected`
                      : choice?.name || `${visible.length} items`}
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
