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
  X,
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
  const actionsMenu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function outside(event: PointerEvent) {
      if (!actionsMenu.current?.contains(event.target as Node))
        dismissActions();
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape" && actionsMenu.current?.open) {
        event.preventDefault();
        event.stopPropagation();
        dismissActions();
        actionsMenu.current.querySelector("summary")?.focus();
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape, true);
    };
  }, []);
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
  const selection = checked.size
    ? items.filter((item) => checked.has(item.id))
    : choice
      ? [choice]
      : [];
  function dismissActions() {
    if (actionsMenu.current) actionsMenu.current.open = false;
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
                    setChecked(new Set());
                    setManagement(undefined);
                    dismissActions();
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
                disabled={
                  busy || loading || !canWrite || parent === "__trash__"
                }
                onClick={() => {
                  setNewFile((value) => !value);
                  setNewFolder(false);
                  setManagement(undefined);
                }}
              >
                <Plus size={16} />
                New
              </button>
              <button
                disabled={
                  busy || loading || !canWrite || parent === "__trash__"
                }
                onClick={() => {
                  setNewFolder((v) => !v);
                  setNewFile(false);
                  setManagement(undefined);
                }}
              >
                <FolderPlus size={16} />
                <span>New folder</span>
              </button>
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
            {mode === "open" && (
              <div className="library-actionbar" aria-label="File actions">
                <label className="library-select-all">
                  <input
                    type="checkbox"
                    aria-label="Select all visible files and folders"
                    checked={
                      visible.length > 0 &&
                      visible.every((i) => checked.has(i.id))
                    }
                    disabled={busy || loading || !visible.length}
                    onChange={(e) => {
                      setChecked(
                        e.target.checked
                          ? new Set(visible.map((i) => i.id))
                          : new Set(),
                      );
                      setSelected(undefined);
                      setManagement(undefined);
                      dismissActions();
                    }}
                  />
                  <span>
                    {selection.length
                      ? `${selection.length} selected`
                      : "Select all"}
                  </span>
                </label>
                {selection.length > 0 && (
                  <button
                    className="icon-button"
                    aria-label="Clear selection"
                    disabled={busy}
                    onClick={() => {
                      setChecked(new Set());
                      setSelected(undefined);
                      setManagement(undefined);
                      dismissActions();
                    }}
                  >
                    <X size={15} />
                  </button>
                )}
                <div className="spacer" />
                {choice && parent !== "__trash__" && (
                  <button
                    disabled={busy || !canWrite}
                    onClick={() => void manage("copy")}
                  >
                    <Copy size={15} />
                    Copy
                  </button>
                )}
                <button
                  disabled={
                    busy || loading || !(selection.length || items.length)
                  }
                  onClick={() =>
                    void run(() =>
                      downloadLibraryItems(
                        selection.length ? selection : items,
                      ),
                    )
                  }
                >
                  <Download size={15} />
                  {selection.length ? "Download" : "Download folder"}
                </button>
                {choice && (
                  <details className="library-item-menu" ref={actionsMenu}>
                    <summary
                      aria-label="More file actions"
                      onClick={(e) => {
                        if (busy) e.preventDefault();
                      }}
                    >
                      <MoreHorizontal size={18} />
                      <span>More</span>
                    </summary>
                    <div className="library-item-menu-panel">
                      <button
                        disabled={busy || !canWrite}
                        onClick={() => void manage("rename")}
                      >
                        <Pencil size={15} />
                        Rename
                      </button>
                      <button
                        disabled={busy || !canWrite}
                        onClick={() => void manage("move")}
                      >
                        <FolderInput size={15} />
                        {parent === "__trash__" ? "Restore / move" : "Move"}
                      </button>
                      {choice.kind === "file" && parent !== "__trash__" && (
                        <>
                          <button
                            disabled={busy}
                            onClick={() => {
                              dismissActions();
                              setSharing(choice);
                            }}
                          >
                            <Share2 size={15} />
                            Share
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => {
                              dismissActions();
                              setHistory(choice);
                            }}
                          >
                            <History size={15} />
                            Version history
                          </button>
                        </>
                      )}
                      {parent !== "__trash__" && (
                        <button
                          className="library-trash-action"
                          disabled={busy || !canWrite}
                          onClick={() => void manage("trash")}
                        >
                          <Trash2 size={15} />
                          Move to trash
                        </button>
                      )}
                    </div>
                  </details>
                )}
              </div>
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
                    Trash. Folders must be empty.
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
              aria-multiselectable={mode === "open"}
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
                    onClick={() => !busy && selectItem(item.id)}
                    onContextMenu={(e) => {
                      if (mode !== "open" || busy) return;
                      e.preventDefault();
                      selectItem(item.id);
                      requestAnimationFrame(() => {
                        if (actionsMenu.current)
                          actionsMenu.current.open = true;
                      });
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
                      {mode === "open" && (
                        <input
                          type="checkbox"
                          aria-label={`Select ${item.name}`}
                          checked={checked.has(item.id)}
                          disabled={busy}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            setChecked((before) => {
                              const next = new Set(before);
                              e.target.checked
                                ? next.add(item.id)
                                : next.delete(item.id);
                              setSelected(undefined);
                              setManagement(undefined);
                              return next;
                            })
                          }
                        />
                      )}

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
                            : `${/\.(md|markdown)$/i.test(item.name) ? "Markdown book" : "Fountain screenplay"} · v${item.revision}`}
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
                    {choice?.name ||
                      `${visible.length} items · Select a file or folder.`}
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
