import { useEffect, useRef, useState } from "react";
import { Folder, FileText, Search, RefreshCw, HardDrive } from "lucide-react";
import { cloud } from "../storage/cloud";
import type { DriveEntry } from "../storage/cloud";
const views = {
  my: "My Drive",
  all: "All files",
  shared: "Shared with me",
  drives: "Shared drives",
  recent: "Recent",
  starred: "Starred",
};
type View = keyof typeof views;
type FolderLocation = {
  id: string;
  name: string;
  driveId?: string;
  canSave: boolean;
};
export interface DriveDestination {
  id: string;
  names: string[];
  canSave: boolean;
}
export function DriveBrowser({
  onFile,
  onNavigate,
  disabled = false,
}: {
  onFile: (entry: DriveEntry) => void;
  onNavigate: (destination: DriveDestination | null) => void;
  disabled?: boolean;
}) {
  const [view, setView] = useState<View>("my");
  const [folders, setFolders] = useState<FolderLocation[]>([]);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<DriveEntry[]>([]);
  const [next, setNext] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const generation = useRef(0);
  const current = folders.at(-1);
  const notify = (
    nextView: View,
    nextFolders: FolderLocation[],
    searchText = "",
  ) => {
    const folder = nextFolders.at(-1);
    onNavigate(
      searchText
        ? null
        : folder
          ? {
              id: folder.id,
              names: nextFolders.map((f) => f.name),
              canSave: folder.canSave,
            }
          : nextView === "my"
            ? { id: "root", names: ["My Drive"], canSave: true }
            : null,
    );
  };
  const navigate = (nextView: View, nextFolders: FolderLocation[]) => {
    generation.current++;
    setView(nextView);
    setFolders(nextFolders);
    setSearch("");
    setQuery("");
    setItems([]);
    setNext(undefined);
    notify(nextView, nextFolders);
  };
  async function load(more = false) {
    const id = ++generation.current;
    setBusy(true);
    setError("");
    if (!more) {
      setItems([]);
      setNext(undefined);
    }
    try {
      const result = await cloud.driveBrowse({
        view,
        parent: current?.id,
        driveId: current?.driveId,
        search: query,
        pageToken: more ? next : undefined,
      });
      if (id !== generation.current) return;
      setItems((old) =>
        more
          ? [
              ...old,
              ...result.items.filter(
                (item) => !old.some((previous) => previous.id === item.id),
              ),
            ]
          : result.items,
      );
      setNext(result.nextPageToken);
    } catch (e) {
      if (id === generation.current)
        setError(
          e instanceof Error ? e.message : "Could not load Drive files.",
        );
    } finally {
      if (id === generation.current) setBusy(false);
    }
  }
  useEffect(() => {
    void load();
    return () => {
      generation.current++;
    };
  }, [view, folders, query, refresh]);
  return (
    <section className="drive-browser" aria-label="Drive file browser">
      <nav className="drive-views" aria-label="Drive views">
        {Object.entries(views).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-current={view === id ? "page" : undefined}
            disabled={disabled}
            onClick={() => navigate(id as View, [])}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="drive-browser-main">
        <form
          className="drive-search"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(search.trim());
            notify(view, folders, search.trim());
          }}
        >
          <Search size={16} aria-hidden="true" />
          <input
            aria-label="Search Drive"
            placeholder={
              current ? `Search ${current.name}` : `Search ${views[view]}`
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={disabled}
          />
          <button type="submit" disabled={disabled}>
            Search
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Refresh Drive"
            disabled={busy || disabled}
            onClick={() => setRefresh((r) => r + 1)}
          >
            <RefreshCw size={16} />
          </button>
        </form>
        <nav className="drive-breadcrumbs" aria-label="Drive folder path">
          <button
            type="button"
            disabled={disabled}
            onClick={() => navigate(view, [])}
          >
            {views[view]}
          </button>
          {folders.map((folder, index) => (
            <span key={folder.id}>
              {" "}
              /{" "}
              <button
                type="button"
                disabled={disabled}
                onClick={() => navigate(view, folders.slice(0, index + 1))}
              >
                {folder.name}
              </button>
            </span>
          ))}
        </nav>
        {error && (
          <p role="alert">
            {error}{" "}
            <button type="button" onClick={() => void load()}>
              Try again
            </button>
          </p>
        )}
        <div className="cloud-files drive-browser-files" aria-busy={busy}>
          {items.map((entry) => {
            const isDrive = view === "drives" && !current;
            const folder =
              isDrive ||
              entry.mimeType === "application/vnd.google-apps.folder";
            return (
              <button
                type="button"
                key={entry.id}
                disabled={disabled || busy}
                onClick={() => {
                  if (folder)
                    navigate(view, [
                      ...folders,
                      {
                        id: entry.id,
                        name: entry.name,
                        driveId: isDrive
                          ? entry.id
                          : (entry.driveId ?? current?.driveId),
                        canSave: entry.capabilities?.canAddChildren === true,
                      },
                    ]);
                  else onFile(entry);
                }}
              >
                {isDrive ? (
                  <HardDrive size={18} />
                ) : folder ? (
                  <Folder size={18} />
                ) : (
                  <FileText size={18} />
                )}
                <span>{entry.name}</span>
                {folder && <span aria-hidden="true">›</span>}
              </button>
            );
          })}
          {busy && <p role="status">Loading Drive…</p>}
          {!busy && !error && !items.length && (
            <p className="muted">
              {query
                ? "No matching files or folders."
                : "No screenplays or folders here."}
            </p>
          )}
          {next && (
            <button
              type="button"
              disabled={busy || disabled}
              onClick={() => void load(true)}
            >
              Load more files
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
