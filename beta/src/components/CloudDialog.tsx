import { useEffect, useRef, useState } from "react";
import {
  Github,
  Cloud,
  Folder,
  FileText,
  ArrowLeft,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { flushSync } from "react-dom";
import { pickDriveItem } from "../storage/drivePicker";
import { Modal } from "./Modal";
import { cloud, connectAccount } from "../storage/cloud";
import type {
  CloudDocument,
  CloudStatus,
  DriveEntry,
  DriveRevision,
  GitHubEntry,
  GitHubRepository,
  Provider,
  RemoteLocation,
} from "../storage/cloud";
import { downloadFile } from "../storage/files";
export function CloudDialog({
  provider,
  mode,
  filename,
  remote,
  getContent,
  onOpen,
  onSaved,
  onSaveCurrent,
  onConnected,
  onBeforeConnect,
  onClose,
}: {
  provider: Provider;
  mode: "open" | "save" | "share" | "history";
  filename: string;
  remote?: RemoteLocation;
  getContent: () => string;
  onOpen: (doc: CloudDocument) => Promise<void>;
  onSaved: (doc: CloudDocument) => Promise<void> | void;
  onSaveCurrent?: () => Promise<void>;
  onConnected?: () => Promise<void>;
  onBeforeConnect: () => Promise<void>;
  onClose: () => void;
}) {
  const [saveCopy, setSaveCopy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerAbort = useRef<AbortController | null>(null);
  const [status, setStatus] = useState<CloudStatus>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [repos, setRepos] = useState<GitHubRepository[]>([]);
  const [repo, setRepo] = useState(
    remote?.provider === "github" ? `${remote.owner}/${remote.repo}` : "",
  );
  const [branch, setBranch] = useState(
    remote?.provider === "github" ? remote.branch : "",
  );
  const [branches, setBranches] = useState<string[]>([]);
  const [path, setPath] = useState("");
  const [parent, setParent] = useState("root");
  const [parents, setParents] = useState<{ id: string; name: string }[]>([]);
  const [shared, setShared] = useState(false);
  const [entries, setEntries] = useState<(GitHubEntry | DriveEntry)[]>([]);
  const [next, setNext] = useState<string>();
  const [repoNext, setRepoNext] = useState<number>();
  const [name, setName] = useState(filename);
  const [commit, setCommit] = useState("Update screenplay");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"reader" | "writer">("reader");
  const [revisions, setRevisions] = useState<DriveRevision[]>([]);
  const [success, setSuccess] = useState("");
  const pending = useRef(0);
  const alive = useRef(true);
  const request = useRef(0);
  useEffect(
    () => () => {
      alive.current = false;
      pickerAbort.current?.abort();
      request.current++;
    },
    [],
  );
  async function run(fn: () => Promise<void>) {
    setError("");
    pending.current++;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      if (
        alive.current &&
        !(e instanceof DOMException && e.name === "AbortError")
      )
        setError(
          e instanceof Error ? e.message : "The request could not complete.",
        );
    } finally {
      pending.current--;
      if (alive.current) setBusy(pending.current > 0);
    }
  }
  useEffect(() => {
    void run(async () => {
      const s = await cloud.status();
      if (alive.current) setStatus(s);
    });
  }, []);
  useEffect(() => {
    if (!status?.github.connected || provider !== "github") return;
    void run(async () => {
      const r = await cloud.githubRepos();
      if (alive.current) {
        setRepos(r.items);
        setRepoNext(r.nextPage);
        if (!repo && r.items[0]) {
          setRepo(r.items[0].fullName);
          setBranch(r.items[0].defaultBranch);
        }
      }
    });
  }, [status?.github.connected, provider]);
  useEffect(() => {
    if (!repo || provider !== "github") return;
    const [owner, r] = repo.split("/");
    let active = true;
    void run(async () => {
      let result = await cloud.githubBranches(owner, r);
      const all = result.items;
      while (result.nextPage) {
        result = await cloud.githubBranches(owner, r, result.nextPage);
        all.push(...result.items);
      }
      if (active) {
        setBranches(all.map((b) => b.name));
        if (!all.some((b) => b.name === branch)) setBranch(all[0]?.name ?? "");
      }
    });
    return () => {
      active = false;
    };
  }, [repo]);
  async function list(more = false) {
    const id = ++request.current;
    await run(async () => {
      if (provider === "github") {
        if (!repo || !branch) return;
        const [owner, r] = repo.split("/");
        const result = await cloud.githubFiles(owner, r, branch, path);
        if (alive.current && id === request.current) setEntries(result.items);
      } else {
        const result = await cloud.driveFiles(
          parent,
          more ? next : undefined,
          shared,
        );
        if (alive.current && id === request.current) {
          setEntries((e) => (more ? [...e, ...result.items] : result.items));
          setNext(result.nextPageToken);
        }
      }
    });
  }
  useEffect(() => {
    if (status?.[provider].connected && (mode === "open" || mode === "save"))
      void list();
  }, [status, repo, branch, path, parent, shared]);
  useEffect(() => {
    if (
      mode === "history" &&
      remote?.provider === "google" &&
      status?.google.connected
    ) {
      void run(async () => {
        const r = await cloud.driveRevisions(remote.id);
        if (alive.current) {
          setRevisions(r.items);
          setNext(r.nextPageToken);
        }
      });
    }
  }, [status]);
  const openEntry = (entry: GitHubEntry | DriveEntry) => {
    const folder =
      "type" in entry
        ? entry.type === "dir"
        : entry.mimeType === "application/vnd.google-apps.folder";
    if (folder) {
      if ("path" in entry) setPath(entry.path);
      else {
        setParents((p) => [...p, { id: parent, name: entry.name }]);
        setParent(entry.id);
      }
      return;
    }
    if (mode === "save") {
      setName(entry.name.replace(/\.fdx$/i, ".fountain"));
      if (provider === "google") setSaveCopy(true);
      return;
    }
    void run(async () => {
      const [owner, r] = repo.split("/");
      const doc =
        "path" in entry
          ? await cloud.githubOpen(owner, r, branch, entry.path)
          : await cloud.driveOpen(entry.id);
      if (alive.current) {
        await onOpen(doc);
        onClose();
      }
    });
  };
  const browseDrive = (folder = false) =>
    void run(async () => {
      pickerAbort.current?.abort();
      const controller = new AbortController();
      pickerAbort.current = controller;
      try {
        const item = await pickDriveItem({
          folder,
          parent,
          signal: controller.signal,
          onReady: () => flushSync(() => setPickerOpen(true)),
        });
        if (!alive.current) return;
        setPickerOpen(false);
        if (!item) return;
        if (folder) {
          setSaveCopy(true);
          setParents([{ id: "root", name: item.name }]);
          setParent(item.id);
          setShared(false);
        } else {
          const doc = await cloud.driveOpen(item.id);
          if (!alive.current) return;
          await onOpen(doc);
          onClose();
        }
      } finally {
        if (alive.current) setPickerOpen(false);
      }
    });
  const save = () => {
    const content = getContent();
    void run(async () => {
      if (
        provider === "google" &&
        remote?.provider === "google" &&
        remote.live &&
        !saveCopy &&
        onSaveCurrent
      ) {
        await onSaveCurrent();
        if (alive.current) onClose();
        return;
      }
      let result: CloudDocument;
      if (provider === "github") {
        const [owner, r] = repo.split("/");
        const fullPath = [path, name].filter(Boolean).join("/");
        const sha =
          remote?.provider === "github" &&
          remote.owner === owner &&
          remote.repo === r &&
          remote.branch === branch &&
          remote.path === fullPath
            ? remote.sha
            : undefined;
        result = await cloud.githubSave({
          owner,
          repo: r,
          branch,
          path: fullPath,
          content,
          sha,
          message: commit,
        });
      } else {
        result =
          remote?.provider === "google" && !saveCopy
            ? await cloud.driveSave({
                id: remote.id,
                etag: remote.etag,
                content,
              })
            : await cloud.driveCreate({ name, content, parent });
      }
      if (alive.current) {
        await onSaved(result);
        onClose();
      }
    });
  };
  const connected = status?.[provider].connected;
  const configured = status?.[provider].configured;
  return (
    <>
      <Modal
        title={provider === "github" ? "GitHub" : "Google Drive"}
        eyebrow={
          mode === "save"
            ? "SAVE YOUR SCREENPLAY"
            : mode === "share"
              ? "SHARING"
              : mode === "history"
                ? "VERSION HISTORY"
                : "OPEN A SCREENPLAY"
        }
        onClose={onClose}
        suspended={pickerOpen}
        wide
      >
        <div className="cloud-account">
          {provider === "github" ? <Github size={22} /> : <Cloud size={22} />}
          <span>
            {connected
              ? status?.[provider].account
              : "Your stories, wherever you work."}
          </span>
          <div className="spacer" />
          {connected && (
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await cloud.disconnect(provider);
                  if (alive.current) setStatus(await cloud.status());
                })
              }
            >
              Disconnect
            </button>
          )}
        </div>
        {error && (
          <div className="error-box" role="alert">
            {error}
            <p>
              Your current draft has been kept. If the remote file changed,
              download your copy before opening its latest version.
            </p>
            <button onClick={() => downloadFile(getContent(), filename)}>
              Download my copy
            </button>
          </div>
        )}
        {success && <p role="status">{success}</p>}
        {!status && !error && <p className="muted">Checking connection…</p>}
        {status && !connected && (
          <div className="connect-state">
            <h3>
              {configured
                ? `Connect ${provider === "github" ? "GitHub" : "Google Drive"}`
                : "Account connection needs setup"}
            </h3>
            <p>
              {configured
                ? "Sign in securely to browse and save your screenplays."
                : `This installation needs ${provider === "github" ? "GitHub" : "Google"} OAuth credentials before it can connect your account. See the integration setup guide included with the project.`}
            </p>
            {configured && (
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await connectAccount(provider, onBeforeConnect);
                    if (alive.current) setStatus(await cloud.status());
                    if (alive.current) await onConnected?.();
                  })
                }
              >
                Connect account
                <ExternalLink size={15} />
              </button>
            )}
          </div>
        )}
        {connected && (mode === "open" || mode === "save") && (
          <>
            {provider === "google" && (
              <div className="drive-browse">
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => browseDrive(mode === "save")}
                >
                  <Folder size={17} />
                  {mode === "save"
                    ? "Choose destination folder…"
                    : "Browse Google Drive…"}
                </button>
                <span>Folders, search, and shared drives</span>
              </div>
            )}
            <div className="cloud-controls">
              {provider === "github" ? (
                <>
                  <label>
                    Repository
                    <select
                      value={repo}
                      onChange={(e) => {
                        setRepo(e.target.value);
                        setPath("");
                        setBranch(
                          repos.find((r) => r.fullName === e.target.value)
                            ?.defaultBranch ?? "",
                        );
                      }}
                    >
                      {repos.map((r) => (
                        <option key={r.fullName} value={r.fullName}>
                          {r.fullName}
                        </option>
                      ))}
                    </select>
                  </label>
                  {repoNext && (
                    <button
                      onClick={() =>
                        void run(async () => {
                          const r = await cloud.githubRepos(repoNext);
                          setRepos((old) => [...old, ...r.items]);
                          setRepoNext(r.nextPage);
                        })
                      }
                    >
                      More repositories
                    </button>
                  )}
                  <label>
                    Branch
                    <select
                      value={branch}
                      onChange={(e) => {
                        setBranch(e.target.value);
                        setPath("");
                      }}
                    >
                      {branches.map((b) => (
                        <option key={b}>{b}</option>
                      ))}
                    </select>
                  </label>
                </>
              ) : (
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={shared}
                    onChange={(e) => {
                      setShared(e.target.checked);
                      setParent("root");
                      setParents([]);
                    }}
                  />
                  Shared with me
                </label>
              )}
              <button
                className="icon-button"
                disabled={busy}
                aria-label="Refresh files"
                onClick={() => void list()}
              >
                <RefreshCw size={16} />
              </button>
            </div>
            <div className="breadcrumb">
              <button
                disabled={provider === "github" ? !path : parents.length === 0}
                aria-label="Parent folder"
                onClick={() => {
                  if (provider === "github")
                    setPath(path.split("/").slice(0, -1).join("/"));
                  else {
                    setParent(parents.at(-1)!.id);
                    setParents(parents.slice(0, -1));
                  }
                }}
              >
                <ArrowLeft size={14} />
              </button>
              <span>
                {provider === "github"
                  ? path || "Repository root"
                  : parents.length
                    ? parents.map((p) => p.name).join(" / ")
                    : shared
                      ? "Shared with me"
                      : "Files opened with this app"}
              </span>
            </div>
            <div className="cloud-files" aria-busy={busy}>
              {entries.map((e) => {
                const folder =
                  "type" in e
                    ? e.type === "dir"
                    : e.mimeType === "application/vnd.google-apps.folder";
                return (
                  <button
                    key={"path" in e ? e.path : e.id}
                    disabled={busy}
                    onClick={() => openEntry(e)}
                  >
                    {folder ? <Folder size={17} /> : <FileText size={17} />}
                    <span>{e.name}</span>
                  </button>
                );
              })}
              {!entries.length && !busy && (
                <p className="muted">
                  {provider === "google"
                    ? "No available screenplay files. Browse Google Drive to choose a file or folder."
                    : "No screenplay files in this folder."}
                </p>
              )}
              {next && provider === "google" && (
                <button disabled={busy} onClick={() => void list(true)}>
                  Load more files
                </button>
              )}
            </div>
            {mode === "save" && (
              <div className="save-cloud-form">
                <label>
                  Filename
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={remote?.provider === "google" && !saveCopy}
                  />
                </label>
                {provider === "github" && (
                  <label>
                    Commit message
                    <input
                      value={commit}
                      onChange={(e) => setCommit(e.target.value)}
                    />
                  </label>
                )}
                <button
                  className="primary"
                  disabled={
                    busy ||
                    !name.trim() ||
                    (provider === "github" &&
                      (!repo || !branch || !commit.trim()))
                  }
                  onClick={save}
                >
                  {busy
                    ? "Saving…"
                    : remote?.provider === "google" && !saveCopy
                      ? "Save current Drive file"
                      : "Save here"}
                </button>
              </div>
            )}
          </>
        )}
        {connected &&
          mode === "share" &&
          (remote?.provider === "google" ? (
            <form
              className="form-grid"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  await cloud.driveShare({ id: remote.id, email, role });
                  setSuccess(`Access granted to ${email}.`);
                  setEmail("");
                });
              }}
            >
              <p>
                Share <strong>{filename}</strong> through Google Drive.
              </p>
              <label>
                Email address
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label>
                Access
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as typeof role)}
                >
                  <option value="reader">Can view</option>
                  <option value="writer">Can edit</option>
                </select>
              </label>
              {status?.collaboration !== false && (
                <>
                  <p className="muted">
                    Everyone with access can open this link to write together.
                    Viewers can follow the screenplay live.
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      void run(async () => {
                        const url = new URL(location.origin);
                        url.searchParams.set("drive", remote.id);
                        await navigator.clipboard.writeText(url.href);
                        setSuccess(
                          "Collaboration link copied. Drive permissions still apply.",
                        );
                      })
                    }
                  >
                    Copy collaboration link
                  </button>
                </>
              )}
              <button className="primary" disabled={busy}>
                Grant access
              </button>
            </form>
          ) : (
            <p>Save this screenplay to Google Drive before sharing it.</p>
          ))}
        {connected &&
          mode === "history" &&
          (remote?.provider === "google" ? (
            <div className="version-list">
              {revisions.map((r) => (
                <div key={r.id}>
                  <span>
                    {r.modifiedTime
                      ? new Date(r.modifiedTime).toLocaleString()
                      : `Version ${r.id}`}
                    <small>{r.lastModifyingUser?.displayName}</small>
                  </span>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        const result = await cloud.driveRevision(
                          remote.id,
                          r.id,
                        );
                        if (alive.current)
                          downloadFile(
                            result.content,
                            filename.replace(
                              /\.fountain$/i,
                              `-version-${r.id}.fountain`,
                            ),
                          );
                      })
                    }
                  >
                    Download
                  </button>
                </div>
              ))}
              {!revisions.length && !busy && (
                <p>No earlier versions are available.</p>
              )}
              {next && (
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const r = await cloud.driveRevisions(remote.id, next);
                      setRevisions((old) => [...old, ...r.items]);
                      setNext(r.nextPageToken);
                    })
                  }
                >
                  More versions
                </button>
              )}
            </div>
          ) : (
            <p>Open a Google Drive screenplay to view its versions.</p>
          ))}
      </Modal>
    </>
  );
}
