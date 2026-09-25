import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ComponentProps, ReactNode } from "react";
import {
  ArrowRight,
  ArrowUp,
  Check,
  ChevronRight,
  Cloud,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  HardDrive,
  Laptop,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  Search,
} from "lucide-react";
import { Modal } from "./Modal";
import { WriteShapeLibrary } from "./WriteShapeLibrary";
import { WriteShapeMark } from "./WriteShapeMark";
import { formatBytes, formatModified } from "../storage/writeshapeLibrary";
import "./writeshape-files.css";

export type FileDestination = "writeshape" | "drive" | "local";
export interface DestinationItem {
  id: string;
  name: string;
  kind: "file" | "folder";
  size?: number;
  modified?: number | string;
  canEdit?: boolean;
  canAddChildren?: boolean;
}
export interface DestinationStatus {
  connected: boolean;
  available: boolean;
  label?: string;
  message?: string;
  writable?: boolean;
}
export interface DestinationListing {
  items: DestinationItem[];
  breadcrumbs: { id: string; name: string }[];
  writable?: boolean;
}
export interface FilesProvider {
  status: () => Promise<DestinationStatus>;
  /** Must invoke a native local picker before its first await. */
  connect: () => Promise<void>;
  list: (parent?: string) => Promise<DestinationListing>;
  /** Parent imports the document and preserves the previous draft before resolving. */
  open: (item: DestinationItem) => Promise<void>;
  /** Always creates a new file; never overwrites a selected row. */
  save: (input: { name: string; parent: string }) => Promise<void>;
  mkdir?: (input: { name: string; parent: string }) => Promise<void>;
}
export interface WriteShapeFilesProps extends Omit<
  ComponentProps<typeof WriteShapeLibrary>,
  "embedded" | "onBusyChange"
> {
  account: { authenticated: boolean; premium: boolean; email?: string };
  providers: { drive: FilesProvider; local: FilesProvider };
  initialDestination?: FileDestination;
  onDestination?: (destination: FileDestination) => void;
  onSignIn: () => void;
  onUpgrade: () => void;
  onOpenLocalFile: () => Promise<void> | void;
  onDownloadLocal: () => Promise<void> | void;
}
const locations: { id: FileDestination; name: string; icon: ReactNode }[] = [
  { id: "writeshape", name: "WriteShape", icon: <WriteShapeMark size={22} /> },
  { id: "drive", name: "Google Drive", icon: <HardDrive size={19} /> },
  { id: "local", name: "Local", icon: <Laptop size={19} /> },
];

export function WriteShapeFiles(props: WriteShapeFilesProps) {
  const [destination, setDestination] = useState<FileDestination>(
    props.initialDestination || "writeshape",
  );
  const [busy, setBusy] = useState(false);
  const id = useId();
  const tabs = useRef(new Map<FileDestination, HTMLButtonElement>());
  const close = () => {
    if (!busy) props.onClose();
  };
  function select(next: FileDestination) {
    if (busy) return;
    setDestination(next);
    props.onDestination?.(next);
  }
  return (
    <Modal
      title={props.mode === "save" ? "Save screenplay" : "Open screenplay"}
      eyebrow="YOUR FILES"
      onClose={close}
      wide
      className="writeshape-library writeshape-files"
    >
      <div
        className="files-destinations"
        role="tablist"
        aria-label="File location"
      >
        {locations.map((location, index) => (
          <button
            key={location.id}
            ref={(node) => {
              if (node) tabs.current.set(location.id, node);
              else tabs.current.delete(location.id);
            }}
            role="tab"
            id={`${id}-${location.id}`}
            aria-controls={`${id}-panel`}
            aria-selected={destination === location.id}
            tabIndex={destination === location.id ? 0 : -1}
            disabled={busy}
            onClick={() => select(location.id)}
            onKeyDown={(event) => {
              let next: number | undefined;
              if (event.key === "ArrowRight")
                next = (index + 1) % locations.length;
              if (event.key === "ArrowLeft")
                next = (index + locations.length - 1) % locations.length;
              if (event.key === "Home") next = 0;
              if (event.key === "End") next = locations.length - 1;
              if (next === undefined) return;
              event.preventDefault();
              select(locations[next].id);
              tabs.current.get(locations[next].id)?.focus();
            }}
          >
            {location.icon}
            <span>{location.name}</span>
          </button>
        ))}
      </div>
      {destination === "writeshape" && props.account.email && (
        <div className="files-account">WriteShape · {props.account.email}</div>
      )}
      <div
        className="files-region"
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-${destination}`}
        tabIndex={0}
      >
        {destination === "writeshape" ? (
          !props.account.authenticated ? (
            <LocationIntro
              icon={<Cloud size={30} />}
              title="Your writing, together"
              description="Keep your screenplays organized in your WriteShape library, with folders and version history."
              action={
                <button className="primary" onClick={props.onSignIn}>
                  Sign in to WriteShape <ArrowRight size={16} />
                </button>
              }
              note="You can always open and save files on this device without an account."
            />
          ) : !props.account.premium && props.mode === "save" ? (
            <LocationIntro
              icon={<LockKeyhole size={29} />}
              title="Cloud saving is a Premium feature"
              description="Your existing cloud files remain available to open. Save locally any time, or explore Premium for new cloud saves."
              action={
                <button className="primary" onClick={props.onUpgrade}>
                  Explore Premium <ArrowRight size={16} />
                </button>
              }
            />
          ) : (
            <WriteShapeLibrary
              mode={props.mode}
              name={props.name}
              captureSave={props.captureSave}
              onOpen={props.onOpen}
              initialFile={props.initialFile}
              onClose={props.onClose}
              embedded
              onBusyChange={setBusy}
            />
          )
        ) : (
          <DestinationBrowser
            key={destination}
            destination={destination}
            mode={props.mode}
            name={props.name}
            provider={props.providers[destination]}
            account={props.account}
            onClose={props.onClose}
            onBusyChange={setBusy}
            onSignIn={props.onSignIn}
            onUpgrade={props.onUpgrade}
            fallback={
              props.mode === "open"
                ? props.onOpenLocalFile
                : props.onDownloadLocal
            }
          />
        )}
      </div>
    </Modal>
  );
}
function LocationIntro({
  icon,
  title,
  description,
  action,
  note,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  note?: string;
}) {
  return (
    <section className="files-intro">
      <div className="files-intro-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
      {note && <small>{note}</small>}
    </section>
  );
}
function itemTime(item: DestinationItem) {
  const value = item.modified;
  return typeof value === "number"
    ? value
    : value
      ? new Date(value).getTime() || 0
      : 0;
}
function itemModified(item: DestinationItem) {
  const stamp = itemTime(item);
  return stamp ? formatModified(new Date(stamp).toISOString()) : "—";
}
function DestinationBrowser({
  destination,
  mode,
  name,
  provider,
  account,
  onClose,
  onBusyChange,
  onSignIn,
  onUpgrade,
  fallback,
}: {
  destination: "drive" | "local";
  mode: "open" | "save";
  name: string;
  provider: FilesProvider;
  account: WriteShapeFilesProps["account"];
  onClose: () => void;
  onBusyChange: (busy: boolean) => void;
  onSignIn: () => void;
  onUpgrade: () => void;
  fallback: () => Promise<void> | void;
}) {
  const latest = useRef(provider);
  latest.current = provider;
  const active = useRef(true);
  const [status, setStatus] = useState<DestinationStatus>();
  const [items, setItems] = useState<DestinationItem[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<
    DestinationListing["breadcrumbs"]
  >([]);
  const [parent, setParent] = useState("");
  const [folderWritable, setFolderWritable] = useState(true);
  const requestedWritable = useRef(true);
  const [selected, setSelected] = useState<string>();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("name");
  const [filename, setFilename] = useState(
    name.replace(/\.[^.]+$/, "") + ".fountain",
  );
  const [newFolder, setNewFolder] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [statusReload, setStatusReload] = useState(0);
  const rows = useRef(new Map<string, HTMLDivElement>());
  const saveInput = useRef<HTMLInputElement>(null);
  const drive = destination === "drive";
  const rootName =
    status?.label || (drive ? "Google Drive" : "Selected folder");
  const entitled = !drive || account.premium;
  const writable = entitled && status?.writable !== false && folderWritable;
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      onBusyChange(false);
    };
  }, [onBusyChange]);
  useEffect(() => {
    onBusyChange(busy);
  }, [busy, onBusyChange]);
  useEffect(() => {
    let valid = true;
    setLoading(true);
    setError("");
    latest.current
      .status()
      .then((result) => {
        if (valid) setStatus(result);
      })
      .catch((reason) => {
        if (valid)
          setError(
            reason instanceof Error
              ? reason.message
              : "This location is unavailable.",
          );
      })
      .finally(() => {
        if (valid) setLoading(false);
      });
    return () => {
      valid = false;
    };
  }, [statusReload]);
  useEffect(() => {
    if (!status?.connected) return;
    let valid = true;
    setLoading(true);
    setError("");
    setItems([]);
    setSelected(undefined);
    setFolderWritable(false);
    latest.current
      .list(parent)
      .then((result) => {
        if (!valid) return;
        setItems(result.items);
        setBreadcrumbs(result.breadcrumbs);
        setFolderWritable(
          result.writable !== false && requestedWritable.current,
        );
      })
      .catch((reason) => {
        if (valid)
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load this folder.",
          );
      })
      .finally(() => {
        if (valid) setLoading(false);
      });
    return () => {
      valid = false;
    };
  }, [status, parent, reload]);
  const visible = useMemo(
    () =>
      items
        .filter((item) =>
          item.name
            .toLocaleLowerCase()
            .includes(query.trim().toLocaleLowerCase()),
        )
        .sort((a, b) => {
          if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
          return (
            (sort === "modified"
              ? itemTime(b) - itemTime(a)
              : sort === "size"
                ? (b.size || 0) - (a.size || 0)
                : 0) ||
            a.name.localeCompare(b.name, undefined, {
              numeric: true,
              sensitivity: "base",
            })
          );
        }),
    [items, query, sort],
  );
  const choice = items.find((item) => item.id === selected);
  function navigate(next: string, canWrite = true) {
    setParent(next);
    requestedWritable.current = canWrite;
    setFolderWritable(canWrite);
    setSelected(undefined);
    setQuery("");
    setNewFolder(false);
    setError("");
  }
  async function run(action: () => Promise<void> | void) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (reason) {
      if (
        active.current &&
        !(reason instanceof DOMException && reason.name === "AbortError")
      )
        setError(
          reason instanceof Error
            ? reason.message
            : "The request could not finish.",
        );
    } finally {
      if (active.current) setBusy(false);
    }
  }
  function connect() {
    // Call immediately in the click's user activation, before status/list work.
    void run(async () => {
      await latest.current.connect();
      if (!active.current) return;
      navigate("");
      setStatus(undefined);
      setItems([]);
      setStatusReload((value) => value + 1);
    });
  }
  function open(item: DestinationItem) {
    if (item.kind === "folder") {
      navigate(item.id, item.canAddChildren !== false);
      return;
    }
    if (mode === "save") {
      saveInput.current?.focus();
      return;
    }
    void run(async () => {
      await latest.current.open(item);
      if (active.current) onClose();
    });
  }
  const fallbackButton = (
    <button
      disabled={busy}
      onClick={() =>
        void run(async () => {
          await fallback();
          if (active.current) onClose();
        })
      }
    >
      {mode === "open" ? "Open a local file" : "Download a copy"}
      <ArrowRight size={15} />
    </button>
  );
  return (
    <div className="files-provider">
      {error && (
        <div
          role="alert"
          className="library-message library-error files-provider-error"
        >
          <strong>Could not complete this request</strong>
          <span>{error}</span>
          <button
            disabled={busy || loading}
            onClick={() =>
              status?.connected
                ? setReload((value) => value + 1)
                : setStatusReload((value) => value + 1)
            }
          >
            Try again
          </button>
        </div>
      )}
      {!status && loading ? (
        <div className="files-connecting" role="status">
          <LoaderCircle className="files-spinner" size={24} />
          <span>
            Checking {drive ? "Google Drive" : "local folder access"}…
          </span>
        </div>
      ) : !status?.connected ? (
        <LocationIntro
          icon={drive ? <HardDrive size={32} /> : <FolderOpen size={32} />}
          title={
            drive
              ? "Your screenplays in Google Drive"
              : "Choose a folder on this device"
          }
          description={
            status?.message ||
            (drive
              ? "Connect Google Drive to browse your folders and Fountain files here."
              : status?.available
                ? "Choose a folder once, then browse its screenplays and save directly from WriteShape."
                : "Folder browsing is not supported in this browser. You can still open a file or download your screenplay.")
          }
          action={
            drive ? (
              !account.authenticated ? (
                <button className="primary" onClick={onSignIn}>
                  Sign in to connect Drive <ArrowRight size={16} />
                </button>
              ) : !account.premium ? (
                <button className="primary" onClick={onUpgrade}>
                  Explore Premium <ArrowRight size={16} />
                </button>
              ) : (
                <button
                  className="primary"
                  disabled={busy || !status?.available}
                  onClick={connect}
                >
                  {busy ? "Connecting…" : "Connect Google Drive"}
                  <ArrowRight size={16} />
                </button>
              )
            ) : (
              <div className="files-intro-actions">
                {status?.available && (
                  <button className="primary" disabled={busy} onClick={connect}>
                    <FolderOpen size={17} />
                    {busy ? "Choosing folder…" : "Open local folder"}
                  </button>
                )}
                {fallbackButton}
              </div>
            )
          }
          note={
            drive
              ? status?.available === false
                ? "Google Drive connection is not available yet."
                : "Your Drive permissions stay in your control."
              : "Only the folder you choose is available here. Your files stay on your device."
          }
        />
      ) : (
        <div className="files-browser">
          <aside className="files-provider-sidebar">
            <div className="files-provider-heading">
              {drive ? <HardDrive size={24} /> : <FolderOpen size={24} />}
              <strong>{drive ? "Google Drive" : "On this device"}</strong>
              <span>{rootName}</span>
            </div>
            <span className="files-connected">
              <Check size={13} />
              {drive ? "Connected" : "Folder selected"}
            </span>
            {!drive && (
              <button disabled={busy} onClick={connect}>
                <FolderOpen size={15} />
                Change folder
              </button>
            )}
            <p>
              {drive
                ? "Fountain screenplays in your connected Drive. Files remain in Google Drive."
                : "Files in your selected folder. Your browser may ask for permission when you save."}
            </p>
            <small>
              {items.filter((item) => item.kind === "file").length} files ·{" "}
              {items.filter((item) => item.kind === "folder").length} folders
            </small>
            {!drive && (
              <div className="files-sidebar-fallback">{fallbackButton}</div>
            )}
          </aside>
          <div className="library-main">
            <div className="library-pathbar">
              <button
                className="icon-button"
                aria-label="Go to parent folder"
                disabled={busy || !parent}
                onClick={() =>
                  navigate(
                    breadcrumbs.length > 1
                      ? breadcrumbs[breadcrumbs.length - 2].id
                      : "",
                  )
                }
              >
                <ArrowUp size={17} />
              </button>
              <nav aria-label="Folder path">
                <button
                  disabled={busy}
                  aria-current={!parent ? "page" : undefined}
                  onClick={() => navigate("")}
                >
                  {rootName}
                </button>
                {breadcrumbs.map((crumb) => (
                  <span key={crumb.id}>
                    <ChevronRight size={13} />
                    <button
                      disabled={busy}
                      aria-current={crumb.id === parent ? "page" : undefined}
                      onClick={() => navigate(crumb.id)}
                    >
                      {crumb.name}
                    </button>
                  </span>
                ))}
              </nav>
              <button
                className="icon-button"
                aria-label="Refresh folder"
                disabled={busy || loading}
                onClick={() => setReload((value) => value + 1)}
              >
                <RefreshCw size={16} />
              </button>
            </div>
            <div className="library-tools">
              <label className="library-search">
                <Search size={16} />
                <input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setSelected(undefined);
                  }}
                  placeholder="Search this folder"
                  aria-label="Search this folder"
                />
              </label>
              <label className="library-sort">
                Sort
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                >
                  <option value="name">Name</option>
                  <option value="modified">Last modified</option>
                  <option value="size">Size</option>
                </select>
              </label>
              {provider.mkdir && (
                <button
                  disabled={busy || loading || !writable}
                  onClick={() => setNewFolder((value) => !value)}
                >
                  <FolderPlus size={16} />
                  New folder
                </button>
              )}
            </div>
            {newFolder && (
              <form
                className="library-new-folder"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!writable || !latest.current.mkdir) return;
                  void run(async () => {
                    await latest.current.mkdir!({
                      name: folderName.trim(),
                      parent,
                    });
                    if (!active.current) return;
                    setNewFolder(false);
                    setFolderName("");
                    setReload((value) => value + 1);
                  });
                }}
              >
                <input
                  autoFocus
                  aria-label="New folder name"
                  placeholder="Folder name"
                  value={folderName}
                  maxLength={150}
                  onChange={(event) => setFolderName(event.target.value)}
                  required
                />
                <button
                  className="primary"
                  disabled={busy || !folderName.trim()}
                >
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
            <div className="library-column-head" aria-hidden="true">
              <span>Name</span>
              <span>Modified</span>
              <span>Size</span>
            </div>
            <div
              className="library-files"
              role="listbox"
              aria-label={`${drive ? "Google Drive" : "Local"} files and folders`}
              aria-busy={loading}
            >
              {loading ? (
                <div className="library-empty" role="status">
                  <LoaderCircle className="files-spinner" size={23} />
                  Loading folder…
                </div>
              ) : !visible.length ? (
                <div className="library-empty">
                  <FolderOpen size={34} />
                  <strong>
                    {query ? "No matching files" : "This folder is empty"}
                  </strong>
                  <p>
                    {query
                      ? "Try another name or clear your search."
                      : mode === "save"
                        ? "Save your screenplay here, or choose another folder."
                        : "Choose another folder to find a Fountain screenplay."}
                  </p>
                </div>
              ) : (
                visible.map((item, index) => (
                  <div
                    className="library-file-row"
                    key={item.id}
                    ref={(node) => {
                      if (node) rows.current.set(item.id, node);
                      else rows.current.delete(item.id);
                    }}
                    role="option"
                    aria-selected={selected === item.id}
                    tabIndex={
                      selected === item.id || (!selected && index === 0)
                        ? 0
                        : -1
                    }
                    onClick={() => {
                      if (!busy) setSelected(item.id);
                    }}
                    onDoubleClick={() => {
                      if (!busy) open(item);
                    }}
                    onKeyDown={(event) => {
                      if (busy) return;
                      if (event.key === "Enter") {
                        event.preventDefault();
                        open(item);
                      } else if (event.key === " ") {
                        event.preventDefault();
                        setSelected(item.id);
                      } else {
                        const next =
                          event.key === "ArrowDown"
                            ? Math.min(index + 1, visible.length - 1)
                            : event.key === "ArrowUp"
                              ? Math.max(index - 1, 0)
                              : event.key === "Home"
                                ? 0
                                : event.key === "End"
                                  ? visible.length - 1
                                  : undefined;
                        if (next !== undefined) {
                          event.preventDefault();
                          setSelected(visible[next].id);
                          rows.current.get(visible[next].id)?.focus();
                        }
                      }
                    }}
                  >
                    <span className="library-file-name">
                      {item.kind === "folder" ? (
                        <Folder size={25} className="library-folder-icon" />
                      ) : (
                        <FileText size={23} className="library-script-icon" />
                      )}
                      <span>
                        <strong>{item.name}</strong>
                        <small>
                          {item.kind === "folder"
                            ? "Folder"
                            : "Fountain screenplay"}
                          {(item.kind === "file" && item.canEdit === false) ||
                          (item.kind === "folder" &&
                            item.canAddChildren === false)
                            ? " · Read only"
                            : ""}
                        </small>
                      </span>
                    </span>
                    <time>{itemModified(item)}</time>
                    <span className="library-file-size">
                      {item.kind === "file" && item.size !== undefined
                        ? formatBytes(item.size)
                        : "—"}
                    </span>
                  </div>
                ))
              )}
            </div>
            <div className="library-selection-bar">
              <span>
                {choice?.name ||
                  `${visible.length} ${visible.length === 1 ? "item" : "items"}`}
              </span>
              {choice?.kind === "folder" && (
                <button disabled={busy} onClick={() => open(choice)}>
                  Open folder
                  <ChevronRight size={15} />
                </button>
              )}
            </div>
            <footer className="library-footer">
              {mode === "save" ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!writable || loading || busy || !filename.trim())
                      return;
                    void run(async () => {
                      const name = filename
                        .trim()
                        .toLowerCase()
                        .endsWith(".fountain")
                        ? filename.trim()
                        : filename.trim() + ".fountain";
                      await latest.current.save({ name, parent });
                      if (active.current) onClose();
                    });
                  }}
                >
                  <label>
                    Save as
                    <input
                      ref={saveInput}
                      aria-label="Filename"
                      required
                      maxLength={150}
                      value={filename}
                      onChange={(event) => setFilename(event.target.value)}
                    />
                  </label>
                  <button
                    className="primary"
                    disabled={busy || loading || !writable || !filename.trim()}
                  >
                    {busy ? "Saving…" : "Save new file"}
                    <ArrowRight size={16} />
                  </button>
                  <small>
                    Creates a new Fountain file in this folder. Existing files
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
                    onClick={() => choice && open(choice)}
                  >
                    {busy
                      ? "Opening…"
                      : choice?.kind === "folder"
                        ? "Open folder"
                        : "Open file"}
                    <ArrowRight size={16} />
                  </button>
                </div>
              )}
              {!writable && (
                <p className="library-readonly">
                  {!entitled ? (
                    <>
                      New Google Drive saves require Premium.{" "}
                      <button onClick={onUpgrade}>Explore Premium</button>
                    </>
                  ) : (
                    "This folder is read only. You can open its files or choose another folder to save."
                  )}
                </p>
              )}
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
