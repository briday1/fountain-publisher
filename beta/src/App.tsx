import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties } from "react";
import { flushSync } from "react-dom";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  BookOpen,
  Check,
  Cloud,
  Download,
  FileText,
  FolderOpen,
  Github,
  Link,
  Plus,
  Redo2,
  Search,
  Undo2,
  X,
} from "lucide-react";
import { emptyScreenplay, blockLabels, newId } from "./core/model";
import type { BeatRange, BlockKind, Screenplay } from "./core/model";
import { resolveBeatRange } from "./core/beatRanges";
import { importScreenplay } from "./core/fdx";
import { serializeFountain } from "./core/fountain";
import { analyzeScreenplay } from "./core/insights";
import { DocumentSession } from "./core/session";
import type { SessionSnapshot } from "./core/session";
import { publishPdf } from "./core/publisher";
import type { EditorController } from "./editor/EditorController";
import { workspace } from "./storage/workspace";
import { migrateLegacyWorkspace } from "./storage/legacyWorkspace";
import type {
  Recovery,
  Snapshot,
  WorkspaceDocument,
} from "./storage/workspace";
import { downloadFile, openLocalFile, saveLocalFile } from "./storage/files";
import type { FileHandle } from "./storage/files";
import { cloud } from "./storage/cloud";
import type { CloudDocument, Provider } from "./storage/cloud";
import { LiveClient } from "./collaboration/LiveClient";
import type { LiveStatus } from "./collaboration/LiveClient";
import {
  readSharedDocument,
  validateSharedDocument,
} from "./collaboration/sharedDocument";
import { EditorSurface } from "./components/EditorSurface";
import { HighlightPdfDialog } from "./components/HighlightPdfDialog";
import { highlightedPdfFilename } from "./core/characterHighlights";
import { CharacterDialog } from "./components/CharacterDialog";
import { CharacterAnalytics } from "./components/CharacterAnalytics";
import { BeatSheetDialog } from "./components/BeatSheetDialog";
import { WritingToolbar } from "./components/WritingToolbar";
import { formatPageCount } from "./core/pageCount";
import { BeatGuide } from "./components/BeatGuide";
import { ZenExitButton } from "./components/ZenExitButton";
import { Settings, readPreferences } from "./components/Settings";
import { TitleDialog } from "./components/TitleDialog";
import { TitlePreview } from "./components/TitlePreview";
import { Modal } from "./components/Modal";
import { Menu, MenuItem } from "./components/Menu";
import { ApplicationMenu } from "./components/ApplicationMenu";
import { useMobileLayout } from "./components/useMobileLayout";
import { Resizable } from "./components/Resizable";
import { Help } from "./components/Help";
import { CloudDialog } from "./components/CloudDialog";
const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl+";
const errorMessage = (e: unknown) =>
  e instanceof Error
    ? e.message
    : "Something went wrong. Your current writing has been kept.";
export default function App() {
  const [session, setSession] = useState<DocumentSession>();
  const sessionRef = useRef<DocumentSession | undefined>(undefined);
  const [snapshot, setSnapshot] = useState<SessionSnapshot>();
  const liveClient = useRef<LiveClient | undefined>(undefined);
  const [liveStatus, setLiveStatus] = useState<LiveStatus>();
  const switchingLive = useRef<LiveClient | undefined>(undefined);
  const [pendingDrive, setPendingDrive] = useState(() =>
    new URLSearchParams(location.search).get("drive"),
  );
  const cloudSaveToken = useRef<{ id: string; epoch: number } | undefined>(
    undefined,
  );
  const [preferences, setPreferences] = useState(readPreferences);
  const [kind, setKind] = useState<BlockKind>("action");
  const [guideTarget, setGuideTarget] = useState<string>();
  const [beatGuide, setBeatGuide] = useState(() => {
    try {
      return localStorage.getItem("fp2.beatGuide") === "true";
    } catch {
      return false;
    }
  });
  const [dialog, setDialog] = useState<
    | "settings"
    | "title"
    | "help"
    | "library"
    | "history"
    | "rename"
    | "characters"
    | "beats"
    | "pdf"
    | "highlight"
    | null
  >(null);
  const [cloudDialog, setCloudDialog] = useState<{
    provider: Provider;
    mode: "open" | "save" | "share" | "history";
  } | null>(null);
  const [status, setStatus] = useState("Opening workspace…");
  const [storageFailed, setStorageFailed] = useState(false);
  const [notice, setNotice] = useState("");
  const [character, setCharacter] = useState<string | null>(null);
  const [zen, setZen] = useState(false);
  const mobile = useMobileLayout();
  useEffect(() => {
    if (mobile) setZen(false);
  }, [mobile]);
  const [fullscreen, setFullscreen] = useState(!!document.fullscreenElement);
  useEffect(() => {
    const update = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);
  const [busy, setBusy] = useState(false);
  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfError, setPdfError] = useState("");
  const [pdfWorking, setPdfWorking] = useState(false);
  const [pdfRetry, setPdfRetry] = useState(0);
  const [pdfWarnings, setPdfWarnings] = useState<string[]>([]);
  const [pdfPages, setPdfPages] = useState<{
    epoch: number;
    id: string;
    pages: number;
    equivalent: number;
    options: string;
  }>();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [match, setMatch] = useState({ index: 0, total: 0 });
  const [library, setLibrary] = useState<WorkspaceDocument[]>([]);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [recoveries, setRecoveries] = useState<Recovery[]>([]);
  const [rename, setRename] = useState("");
  const editor = useRef<EditorController | null>(null);
  const file = useRef<FileHandle | undefined>(undefined);
  const latest = useRef({ preferences, zen });
  latest.current = { preferences, zen };
  useLayoutEffect(() => {
    const view = editor.current?.view;
    // Reflow can move the caret far down a long paragraph. Reveal the current
    // selection after the room has resized, without taking focus from a control.
    if (view?.hasFocus()) view.dispatch(view.state.tr.scrollIntoView());
  }, [zen, fullscreen]);
  const pdfGeneration = useRef(0);
  const pdfBuildQueue = useRef<Promise<void>>(Promise.resolve());
  const pdfResult = useRef<{
    id: string;
    epoch: number;
    options: string;
    result: Awaited<ReturnType<typeof publishPdf>>;
  } | null>(null);
  const pdfObject = useRef("");
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const searchInput = useRef<HTMLInputElement>(null);
  const pdfOptions = {
    pageSize: preferences.pageSize,
    boldSceneHeadings: preferences.boldSceneHeadings,
    sceneNumbers: preferences.sceneNumbers,
    sceneNumberFormat: preferences.sceneNumberFormat,
  };
  const pdfOptionsKey = JSON.stringify(pdfOptions);
  function acceptPdf(
    result: Awaited<ReturnType<typeof publishPdf>>,
    published: SessionSnapshot,
    options: string,
  ): boolean {
    const current = sessionRef.current?.token();
    const prefs = latest.current.preferences;
    const currentOptions = JSON.stringify({
      pageSize: prefs.pageSize,
      boldSceneHeadings: prefs.boldSceneHeadings,
      sceneNumbers: prefs.sceneNumbers,
      sceneNumberFormat: prefs.sceneNumberFormat,
    });
    if (
      current?.id !== published.id ||
      current.epoch !== published.epoch ||
      options !== currentOptions
    )
      return false;
    const url = URL.createObjectURL(
      new Blob([result.bytes as BlobPart], { type: "application/pdf" }),
    );
    if (pdfObject.current) URL.revokeObjectURL(pdfObject.current);
    pdfObject.current = url;
    pdfResult.current = {
      id: published.id,
      epoch: published.epoch,
      options,
      result,
    };
    setPdfUrl(url);
    setPdfWarnings(result.warnings);
    setPdfPages({
      id: published.id,
      epoch: published.epoch,
      options,
      pages: result.pageCount,
      equivalent:
        result.pageEquivalent - (result.pageCount - result.scriptPageCount),
    });
    setPdfError("");
    setPdfWorking(false);
    return true;
  }
  useEffect(() => {
    try {
      localStorage.setItem("fp2.beatGuide", String(beatGuide));
    } catch {
      /* A writing preference does not affect document persistence. */
    }
  }, [beatGuide]);
  useEffect(() => {
    setGuideTarget(undefined);
  }, [snapshot?.id]);
  function tell(message: string) {
    setNotice(message);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 7000);
  }
  const report = (error: unknown) => {
    if (error instanceof DOMException && error.name === "AbortError") return;
    tell(errorMessage(error));
  };
  async function stopLive() {
    const client = liveClient.current;
    if (!client) return;
    // Finish the durable local outbox before a document switch can discard its editor.
    await client.stop();
    if (liveClient.current !== client) {
      client.destroy();
      return;
    }
    sessionRef.current?.capture();
    editor.current?.detachCollaboration();
    liveClient.current = undefined;
    client.destroy();
    setLiveStatus(undefined);
  }
  async function prepareLiveSwitch() {
    const client = liveClient.current;
    if (!client) return;
    switchingLive.current = client;
    try {
      await client.stop();
    } catch (error) {
      if (switchingLive.current === client) switchingLive.current = undefined;
      throw error;
    }
  }
  async function abortLiveSwitch() {
    const client = switchingLive.current;
    switchingLive.current = undefined;
    if (client && liveClient.current === client) await client.resume();
  }
  function completeLiveSwitch() {
    const client = switchingLive.current;
    switchingLive.current = undefined;
    if (!client) return;
    if (liveClient.current === client) {
      editor.current?.detachCollaboration();
      liveClient.current = undefined;
      setLiveStatus(undefined);
    }
    client.destroy();
  }
  function attachLive(client: LiveClient) {
    client.onStatus = (value) => {
      if (liveClient.current === client) setLiveStatus(value);
    };
    client.onPermission = (canEdit) => {
      if (liveClient.current === client)
        editor.current?.setCollaborationEditable(canEdit);
    };
    client.onSaved = (etag) => {
      const current = sessionRef.current;
      const remote = current?.current.remote;
      if (
        liveClient.current === client &&
        current &&
        remote?.provider === "google" &&
        remote.id === client.fileId &&
        remote.etag !== etag
      )
        current.setRemote({ ...remote, etag }, current.token());
    };
    client.isComposing = () => !!editor.current?.isComposing;
    editor.current?.attachCollaboration({
      doc: client.doc,
      awareness: client.awareness,
      canEdit: client.self.canEdit,
    });
    liveClient.current = client;
    client.start();
  }
  useEffect(() => {
    let live = true;
    void (async () => {
      let initial: WorkspaceDocument | SessionSnapshot | undefined;
      let warning = "";
      let migrated: WorkspaceDocument | undefined;
      try {
        migrated = await migrateLegacyWorkspace();
      } catch (error) {
        warning = errorMessage(error);
      }
      try {
        const id = workspace.getActiveId();
        if (id) initial = await workspace.load(id);
        if (!initial) initial = migrated;
        const drafts = await workspace.recoveries();
        if (live) setRecoveries(drafts);
      } catch (e) {
        warning = errorMessage(e);
      }
      if (!initial)
        initial = {
          id: newId(),
          name: "Untitled.fountain",
          screenplay: emptyScreenplay(),
          epoch: 0,
        };
      let restoredLive: LiveClient | undefined;
      if (
        initial.remote?.provider === "google" &&
        initial.remote.live &&
        initial.remote.accountId
      ) {
        try {
          restoredLive = await LiveClient.cached(
            initial.remote.id,
            initial.remote.accountId,
          );
          if (restoredLive) {
            validateSharedDocument(restoredLive.doc);
            initial = {
              ...initial,
              screenplay: readSharedDocument(restoredLive.doc),
            };
          } else
            warning =
              "This device's shared writing cache is unavailable. Your draft is kept; reopen the Drive file to join live writing.";
        } catch (error) {
          restoredLive?.destroy();
          restoredLive = undefined;
          warning = errorMessage(error);
        }
      }
      if (!live) {
        restoredLive?.destroy();
        return;
      }
      const s = new DocumentSession(initial);
      s.onBeforeOpen = prepareLiveSwitch;
      s.onOpenAborted = abortLiveSwitch;
      s.onOpenComplete = completeLiveSwitch;
      s.onSnapshot = (value) => setSnapshot({ ...value });
      s.onStatus = (state, message) => {
        setStatus(
          state === "saving"
            ? "Saving on this device…"
            : state === "saved"
              ? "Saved on this device"
              : "Device save needs attention",
        );
        setStorageFailed(state === "error");
        if (message) tell(message);
      };
      sessionRef.current = s;
      if (restoredLive) attachLive(restoredLive);
      setSession(s);
      setSnapshot(s.current);
      workspace.setActiveId(initial.id);
      setStatus("Saved on this device");
      if (warning) {
        setStorageFailed(true);
        tell(warning);
      } else await s.flush().catch(report);
      const params = new URLSearchParams(location.search);
      if (params.has("connected")) {
        tell(`Connected to ${params.get("connected")}.`);
        params.delete("connected");
        window.history.replaceState(
          {},
          "",
          `${location.pathname}${params.size ? `?${params}` : ""}`,
        );
      }
      if (params.has("error")) tell(params.get("error")!);
    })();
    return () => {
      live = false;
      sessionRef.current?.dispose();
      void stopLive().catch(() => {});
    };
  }, []);
  useEffect(() => {
    const narrow = matchMedia("(max-width: 950px)");
    const mobile = matchMedia("(max-width: 720px)");
    const collapse = () => {
      if (narrow.matches)
        setPreferences((p) => ({
          ...p,
          outline: false,
          ...(mobile.matches ? { insights: false } : {}),
        }));
    };
    collapse();
    narrow.addEventListener("change", collapse);
    mobile.addEventListener("change", collapse);
    return () => {
      narrow.removeEventListener("change", collapse);
      mobile.removeEventListener("change", collapse);
    };
  }, []);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      (document.documentElement.dataset.theme =
        preferences.theme === "system"
          ? media.matches
            ? "dark"
            : "light"
          : preferences.theme);
    apply();
    media.addEventListener("change", apply);
    try {
      localStorage.setItem("fp2.preferences", JSON.stringify(preferences));
    } catch {
      /* Preferences do not contain the document. */
    }
    return () => media.removeEventListener("change", apply);
  }, [preferences]);
  useEffect(() => {
    if (!session) return;
    const before = (e: BeforeUnloadEvent) => {
      if (session.dirty) {
        void session.flush().catch(() => {});
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const visibility = () => {
      if (document.visibilityState === "hidden")
        void session.flush().catch(() => {});
    };
    window.addEventListener("beforeunload", before);
    document.addEventListener("visibilitychange", visibility);
    const unsubscribe = workspace.subscribe((id) => {
      if (id === session.current.id && !liveClient.current)
        tell(
          "This screenplay was saved in another tab. Open Workspace to load that version, or save your writing as a copy.",
        );
    });
    return () => {
      window.removeEventListener("beforeunload", before);
      document.removeEventListener("visibilitychange", visibility);
      unsubscribe();
    };
  }, [session]);
  const onReady = useCallback((value: EditorController | null) => {
    editor.current = value;
    if (sessionRef.current) sessionRef.current.editor = value;
    const client = liveClient.current;
    if (value && client)
      value.attachCollaboration({
        doc: client.doc,
        awareness: client.awareness,
        canEdit: client.self.canEdit,
      });
  }, []);
  const onEditorChange = useCallback((remote = false) => {
    sessionRef.current?.markChanged();
    if (
      !remote &&
      latest.current.preferences.typewriter &&
      editor.current &&
      !editor.current.view.composing
    ) {
      requestAnimationFrame(() => {
        const view = editor.current?.view;
        if (!view) return;
        const coords = view.coordsAtPos(view.state.selection.head);
        const pane = document.querySelector(".writing-scroll");
        if (pane) {
          const bounds = pane.getBoundingClientRect();
          if (
            coords.top > bounds.top + bounds.height * 0.65 ||
            coords.top < bounds.top + bounds.height * 0.25
          )
            pane.scrollBy({
              top: coords.top - (bounds.top + bounds.height * 0.48),
              behavior: "instant",
            });
        }
      });
    }
  }, []);
  useEffect(() => {
    editor.current?.view.dom.setAttribute(
      "spellcheck",
      String(preferences.spellcheck),
    );
  }, [preferences.spellcheck, session]);
  const insights = useMemo(
    () => (snapshot ? analyzeScreenplay(snapshot.screenplay) : null),
    [snapshot?.screenplay.blocks],
  );
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      report(e);
    } finally {
      setBusy(false);
    }
  }
  async function openLocal() {
    if (!session) return;
    const token = session.token();
    const result = await openLocalFile();
    if (!result) return;
    session.assertCurrent(token);
    const imported = importScreenplay(result.content, result.name);
    await session.open(imported.screenplay, imported.name);
    file.current = imported.converted ? undefined : result.handle;
    setDialog(null);
  }
  async function saveLocal(as = false) {
    if (!session) return;
    const captured = session.capture();
    const token = session.token();
    const handle = await saveLocalFile(
      serializeFountain(captured.screenplay),
      captured.name,
      as ? undefined : file.current,
    );
    if (token.id === session.current.id) file.current = handle;
    await session.flush();
    tell(`Saved ${captured.name}.`);
  }
  async function save() {
    if (!session) return;
    const activeLive = liveClient.current;
    if (activeLive) {
      await session.flush();
      if (liveClient.current !== activeLive)
        throw new Error(
          "The active screenplay changed before saving. Save the current screenplay again.",
        );
      await activeLive.checkpoint();
      if (liveClient.current === activeLive) tell("Saved to Google Drive.");
      return;
    }
    if (!session.current.remote) {
      await saveLocal();
      return;
    }
    const snap = session.capture();
    const token = session.token();
    const remote = snap.remote!;
    if (remote.provider === "google" && remote.live)
      throw new Error(
        "Reopen this Google Drive file to reconnect live writing before saving. Your writing is kept on this device; you can also download a copy.",
      );
    const content = serializeFountain(snap.screenplay);
    const result =
      remote.provider === "github"
        ? await cloud.githubSave({
            ...remote,
            content,
            message: "Update screenplay",
          })
        : await cloud.driveSave({ id: remote.id, etag: remote.etag, content });
    session.setRemote(result.remote, token);
    await session.flush();
    tell(
      `Saved to ${remote.provider === "github" ? "GitHub" : "Google Drive"}.`,
    );
  }
  async function newDocument() {
    if (!session) return;
    await session.open(emptyScreenplay(), "Untitled.fountain");
    file.current = undefined;
    setDialog(null);
    editor.current?.focus();
  }
  const changeDoc = (doc: Screenplay, previousDocument?: Screenplay) => {
    if (liveClient.current && !liveClient.current.self.canEdit) {
      tell("This Drive document is view only. Keep a copy to make edits.");
      return;
    }
    session?.updateMetadata(doc, previousDocument);
  };
  function showBeatRange(range: BeatRange) {
    // Commit dismissal before focusing the editor. No deferred callback can
    // move the caret after the writer has already pressed the next key.
    flushSync(() => {
      setDialog(null);
      setCharacter(null);
      if (matchMedia("(max-width: 950px)").matches)
        setPreferences((value) => ({
          ...value,
          outline: false,
          ...(matchMedia("(max-width: 720px)").matches
            ? { insights: false }
            : {}),
        }));
    });
    if (!editor.current?.revealRange(range))
      tell(
        "These lines are no longer in the screenplay. Select a new range for this beat.",
      );
  }
  function startBeatAssignment(id: string) {
    setGuideTarget(id);
    setBeatGuide(true);
    setDialog(null);
  }
  function assignBeatRange(beatId: string, range: BeatRange): boolean {
    if (!session) return false;
    if (liveClient.current && !liveClient.current.self.canEdit) {
      tell("This Drive document is view only.");
      return false;
    }
    const current = session.capture().screenplay;
    const resolved = resolveBeatRange(current, range);
    if (
      !resolved ||
      !current.metadata.beats.some((beat) => beat.id === beatId)
    ) {
      tell("Select the screenplay lines you want to assign.");
      return false;
    }
    changeDoc({
      ...current,
      metadata: {
        ...current.metadata,
        beats: current.metadata.beats.map((beat) =>
          beat.id === beatId ? { ...beat, range, sceneId: undefined } : beat,
        ),
      },
    });
    // Assign + Next leaves the caret ready to continue after the assigned text.
    editor.current?.focusRange({ start: range.end, end: range.end });
    return true;
  }
  function insert(k: BlockKind) {
    setDialog(null);
    editor.current?.insertBlock(
      k,
      k === "scene" ? "INT. " : k === "parenthetical" ? "()" : "",
    );
  }
  function scene(id: string) {
    setDialog(null);
    if (matchMedia("(max-width: 950px)").matches)
      setPreferences((value) => ({
        ...value,
        outline: false,
        ...(matchMedia("(max-width: 720px)").matches
          ? { insights: false }
          : {}),
      }));
    requestAnimationFrame(() => editor.current?.focusBlock(id));
  }
  async function listWorkspace() {
    await session?.flush();
    setLibrary(await workspace.list());
    setRecoveries(await workspace.recoveries());
    setDialog("library");
  }
  async function listHistory() {
    if (!session) return;
    await session.flush();
    setHistory(await workspace.snapshots(session.current.id));
    setDialog("history");
  }
  async function openCloudDocument(doc: CloudDocument) {
    if (!session) return;
    const imported = importScreenplay(doc.content, doc.name);
    if (
      !imported.converted &&
      doc.remote.provider === "google" &&
      cloud.collaborationSupported
    ) {
      await openSharedDrive(doc.remote.id);
      return;
    }
    await session.open(
      imported.screenplay,
      imported.name,
      imported.converted ? undefined : doc.remote,
    );
    file.current = undefined;
    setDialog(null);
  }
  async function openSharedDrive(
    fileId: string,
    token = sessionRef.current?.token(),
  ) {
    const current = sessionRef.current;
    if (!current || !token) return;
    if (!cloud.collaborationSupported)
      throw new Error(
        "Live collaboration is available on fountain-publisher.com. This local server supports ordinary Google Drive open and save.",
      );
    const bootstrap = await cloud.liveBootstrap(fileId);
    const client = await LiveClient.prepare(bootstrap);
    try {
      current.assertCurrent(token);
      await current.open(readSharedDocument(client.doc), bootstrap.name, {
        ...bootstrap.remote,
        accountId: bootstrap.self.id,
      });
      attachLive(client);
      file.current = undefined;
      setDialog(null);
      setPendingDrive(null);
      const params = new URLSearchParams(location.search);
      params.delete("drive");
      window.history.replaceState(
        {},
        "",
        `${location.pathname}${params.size ? `?${params}` : ""}`,
      );
    } catch (error) {
      if (liveClient.current === client) {
        liveClient.current = undefined;
        editor.current?.detachCollaboration();
        setLiveStatus(undefined);
      }
      await client.stop().catch(() => {});
      client.destroy();
      throw error;
    }
  }
  async function openWorkspaceDocument(draft: WorkspaceDocument) {
    const current = sessionRef.current;
    if (!current) return;
    const token = current.token();
    let restored: LiveClient | undefined;
    try {
      if (
        draft.remote?.provider === "google" &&
        draft.remote.live &&
        cloud.collaborationSupported
      ) {
        if (draft.remote.accountId)
          restored = await LiveClient.cached(
            draft.remote.id,
            draft.remote.accountId,
          );
        if (!restored) {
          await openSharedDrive(draft.remote.id, token);
          return;
        }
        validateSharedDocument(restored.doc);
      }
      current.assertCurrent(token);
      await current.open(
        restored ? readSharedDocument(restored.doc) : draft.screenplay,
        draft.name,
        draft.remote,
        draft,
      );
      if (restored) attachLive(restored);
      file.current = undefined;
      setDialog(null);
    } catch (error) {
      if (restored) {
        if (liveClient.current === restored) {
          liveClient.current = undefined;
          editor.current?.detachCollaboration();
          setLiveStatus(undefined);
        }
        await restored.stop().catch(() => {});
        restored.destroy();
      }
      throw error;
    }
  }
  const openingDrive = useRef(false);
  useEffect(() => {
    if (!session || !pendingDrive || openingDrive.current) return;
    openingDrive.current = true;
    const token = session.token();
    void (async () => {
      try {
        const accounts = await cloud.status();
        if (!accounts.google.connected) {
          setCloudDialog({ provider: "google", mode: "open" });
          return;
        }
        await openSharedDrive(pendingDrive, token);
      } catch (error) {
        report(error);
        setCloudDialog({ provider: "google", mode: "open" });
      } finally {
        openingDrive.current = false;
      }
    })();
  }, [session, pendingDrive]);
  async function copyCollaborationLink() {
    const remote = sessionRef.current?.current.remote;
    if (remote?.provider !== "google") return;
    const url = new URL(location.origin);
    url.searchParams.set("drive", remote.id);
    await navigator.clipboard.writeText(url.href);
    tell("Collaboration link copied. Anyone with Drive access can join here.");
  }
  async function exportHighlightedPdf(names: string[]) {
    if (!session || !names.length) return;
    const snap = session.capture();
    const result = await publishPdf(snap.screenplay, {
      ...pdfOptions,
      highlightCharacters: [...names],
    });
    downloadFile(
      new Blob([result.bytes as BlobPart], { type: "application/pdf" }),
      highlightedPdfFilename(snap.name, names),
    );
    if (result.warnings.length) tell(result.warnings.join(" "));
    setDialog((current) => (current === "highlight" ? null : current));
  }
  async function exportFile(
    format: "pdf" | "beatPdf" | "fdx" | "beats" | "html",
  ) {
    if (!session) return;
    const snap = session.capture();
    const stem = snap.name.replace(/\.[^.]+$/, "");
    if (format === "pdf" || format === "beatPdf") {
      const outputDoc =
        format === "beatPdf"
          ? (await import("./core/export")).beatSheetDocument(snap.screenplay)
          : snap.screenplay;
      const cached = pdfResult.current;
      const result =
        format === "pdf" &&
        cached?.id === snap.id &&
        cached.epoch === snap.epoch &&
        cached.options === pdfOptionsKey
          ? cached.result
          : await publishPdf(outputDoc, pdfOptions);
      if (result.warnings.length) tell(result.warnings.join(" "));
      downloadFile(
        new Blob([result.bytes as BlobPart], { type: "application/pdf" }),
        `${stem}${format === "beatPdf" ? "-beats" : ""}.pdf`,
      );
      if (format === "pdf") acceptPdf(result, snap, pdfOptionsKey);
    } else {
      const exports = await import("./core/export");
      const text =
        format === "fdx"
          ? exports.exportFdx(snap.screenplay)
          : format === "beats"
            ? exports.exportBeatSheetCsv(snap.screenplay)
            : exports.exportHtml(snap.screenplay);
      downloadFile(
        text,
        `${stem}${format === "beats" ? "-beats.csv" : `.${format}`}`,
        format === "fdx"
          ? "application/xml"
          : format === "beats"
            ? "text/csv"
            : "text/html",
      );
    }
    if (format !== "pdf" && format !== "beatPdf") tell("Export ready.");
  }
  useEffect(() => {
    if (!snapshot) return;
    const id = ++pdfGeneration.current;
    setPdfError("");
    setPdfWorking(true);
    const timer = setTimeout(() => {
      // Build after writing settles, in the publishing worker. At most one
      // background build runs; queued superseded versions are discarded.
      pdfBuildQueue.current = pdfBuildQueue.current
        .catch(() => {})
        .then(async () => {
          const token = sessionRef.current?.token();
          if (
            id !== pdfGeneration.current ||
            token?.id !== snapshot.id ||
            token.epoch !== snapshot.epoch
          )
            return;
          await publishPdf(snapshot.screenplay, pdfOptions)
            .then((result) => {
              if (id === pdfGeneration.current)
                acceptPdf(result, snapshot, pdfOptionsKey);
            })
            .catch((e) => {
              const current = sessionRef.current?.token();
              if (
                id === pdfGeneration.current &&
                current?.id === snapshot.id &&
                current.epoch === snapshot.epoch
              )
                setPdfError(errorMessage(e));
            })
            .finally(() => {
              if (id === pdfGeneration.current) setPdfWorking(false);
            });
        });
    }, 500);
    return () => {
      clearTimeout(timer);
      pdfGeneration.current++;
    };
  }, [
    snapshot?.id,
    snapshot?.epoch,
    pdfRetry,
    preferences.pageSize,
    preferences.boldSceneHeadings,
    preferences.sceneNumbers,
    preferences.sceneNumberFormat,
  ]);
  function find(backwards = false) {
    const result = editor.current?.find(query, { caseSensitive, backwards });
    if (result) setMatch(result);
  }
  useLayoutEffect(() => {
    if (searchOpen) searchInput.current?.focus();
  }, [searchOpen]);
  const actions = useRef({ save, saveLocal, openLocal, newDocument });
  actions.current = { save, saveLocal, openLocal, newDocument };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      const cmd = e.metaKey || e.ctrlKey;
      // Native dialogs own their in-progress fields. Global navigation must not
      // dismiss them and discard a draft title or other unsaved form changes.
      if (
        cmd &&
        ["o", "f"].includes(e.key.toLowerCase()) &&
        document.querySelector("dialog[open]")
      )
        return;
      if (cmd && ["s", "o", "f"].includes(e.key.toLowerCase())) {
        e.preventDefault();
        if (e.key.toLowerCase() === "s")
          void run(() =>
            e.shiftKey
              ? actions.current.saveLocal(true)
              : actions.current.save(),
          );
        if (e.key.toLowerCase() === "o") void run(actions.current.openLocal);
        if (e.key.toLowerCase() === "f") {
          setDialog(null);
          setSearchOpen(true);
        }
      }
      if (e.key === "Escape" && !document.querySelector("dialog[open]")) {
        if (document.querySelector(".search-panel")) {
          setSearchOpen(false);
          editor.current?.focus();
        } else if (latest.current.zen) {
          setZen(false);
          editor.current?.focus();
        }
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  if (!snapshot || !session || !insights)
    return (
      <main className="loading">
        <span className="brand-mark">F</span>
        <p>Opening your writing room…</p>
      </main>
    );
  const doc = snapshot.screenplay;
  const exact =
    pdfPages?.epoch === session.token().epoch &&
    pdfPages.id === snapshot.id &&
    pdfPages.options === pdfOptionsKey;
  const pages = exact ? formatPageCount(pdfPages.equivalent) : "…";
  const openView = (next: "beats" | "pdf") => {
    session.capture();
    setSnapshot({ ...session.current });
    if (next === "beats") setGuideTarget(undefined);
    setDialog(next);
  };
  const toggleFullscreen = () => {
    void (async () => {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    })().catch(report);
  };
  const toggleZen = () => {
    if (mobile) return;
    setZen(!zen);
    setSearchOpen(false);
    editor.current?.focus();
  };
  const openIntegration = (
    provider: Provider,
    mode: "open" | "save" | "share" | "history" = "open",
  ) => {
    setCloudDialog({ provider, mode });
  };
  const writingControls = (
    <WritingToolbar
      kind={kind}
      onKind={(value) => editor.current?.setKind(value)}
      onMark={(mark) => editor.current?.toggleMark(mark)}
      preferences={preferences}
      onPreferences={setPreferences}
      beatGuide={beatGuide}
      onBeatGuide={() => setBeatGuide(!beatGuide)}
      onBeatSheet={() => openView("beats")}
      searchOpen={searchOpen}
      onSearch={() => setSearchOpen(!searchOpen)}
      onPdf={() => openView("pdf")}
      zen={zen}
      onZen={toggleZen}
      fullscreen={fullscreen}
      onFullscreen={toggleFullscreen}
    />
  );
  return (
    <div
      className={`app ${zen ? "zen" : ""}`}
      style={
        {
          "--left-width": `${preferences.leftWidth}px`,
          "--right-width": `${preferences.rightWidth}px`,
        } as CSSProperties
      }
    >
      <a
        className="skip-link"
        href="#writing-area"
        onClick={(e) => {
          e.preventDefault();
          setDialog(null);
          editor.current?.focus();
        }}
      >
        Skip to screenplay
      </a>
      <header className="app-header">
        <button className="brand" onClick={() => setDialog("help")}>
          <span className="brand-mark">F</span>
          <span>Fountain Publisher</span>
        </button>
        <ApplicationMenu
          mobile={mobile}
          controls={writingControls}
          filename={snapshot.name}
        >
          <Menu label="File">
            <small>SCREENPLAY</small>
            <MenuItem onClick={() => void run(newDocument)}>
              New screenplay
            </MenuItem>
            <MenuItem onClick={() => void run(openLocal)} shortcut={`${mod}O`}>
              Open screenplay…
            </MenuItem>
            <MenuItem onClick={() => void run(save)} shortcut={`${mod}S`}>
              Save
            </MenuItem>
            <MenuItem
              onClick={() => void run(() => saveLocal(true))}
              shortcut={`⇧${mod}S`}
            >
              Save As…
            </MenuItem>
            <MenuItem onClick={() => void run(listWorkspace)}>
              Workspace…
            </MenuItem>
            <MenuItem onClick={() => void run(listHistory)}>
              Version history…
            </MenuItem>
            <hr />
            <small>CONNECTED STORAGE</small>
            <MenuItem onClick={() => openIntegration("github")}>
              Open from GitHub…
            </MenuItem>
            <MenuItem onClick={() => openIntegration("github", "save")}>
              Save to GitHub…
            </MenuItem>
            <MenuItem onClick={() => openIntegration("google")}>
              Open from Google Drive…
            </MenuItem>
            <MenuItem onClick={() => openIntegration("google", "save")}>
              Save to Google Drive…
            </MenuItem>
            <MenuItem onClick={() => openIntegration("google", "share")}>
              Share Drive document…
            </MenuItem>
            <MenuItem onClick={() => openIntegration("google", "history")}>
              Drive version history…
            </MenuItem>
            <hr />
            <small>PUBLISH</small>
            <MenuItem onClick={() => void run(() => exportFile("pdf"))}>
              Export PDF…
            </MenuItem>
            <MenuItem
              onClick={() => {
                session.capture();
                setSnapshot({ ...session.current });
                setDialog("highlight");
              }}
            >
              Export highlighted PDF…
            </MenuItem>
            <MenuItem onClick={() => void run(() => exportFile("fdx"))}>
              Export Final Draft…
            </MenuItem>
          </Menu>
          <Menu label="Edit">
            <MenuItem
              onClick={() => editor.current?.undo()}
              shortcut={`${mod}Z`}
            >
              Undo
            </MenuItem>
            <MenuItem
              onClick={() => editor.current?.redo()}
              shortcut={`⇧${mod}Z`}
            >
              Redo
            </MenuItem>
            <hr />
            <MenuItem
              onClick={() => {
                setDialog(null);
                setSearchOpen(true);
              }}
              shortcut={`${mod}F`}
            >
              Find and replace…
            </MenuItem>
            <MenuItem
              onClick={() => {
                setRename(snapshot.name);
                setDialog("rename");
              }}
            >
              Rename screenplay…
            </MenuItem>
          </Menu>
          <Menu label="View">
            <MenuItem
              onClick={() =>
                setPreferences({
                  ...preferences,
                  outline: !preferences.outline,
                  ...(innerWidth <= 950 ? { insights: false } : {}),
                })
              }
            >
              {preferences.outline ? "Hide" : "Show"} outline
            </MenuItem>
            <MenuItem
              onClick={() =>
                setPreferences({
                  ...preferences,
                  insights: !preferences.insights,
                  ...(innerWidth <= 950 ? { outline: false } : {}),
                })
              }
            >
              {preferences.insights ? "Hide" : "Show"} insights
            </MenuItem>
            <hr />
            <MenuItem onClick={() => openView("beats")}>Beat sheet</MenuItem>
            <MenuItem onClick={() => openView("pdf")}>PDF pages</MenuItem>
            <hr />
            <MenuItem onClick={toggleZen}>
              {zen ? "Exit Zen mode" : "Enter Zen mode"}
            </MenuItem>
            <MenuItem onClick={toggleFullscreen}>
              {fullscreen ? "Exit full screen" : "Full screen"}
            </MenuItem>
            <MenuItem onClick={() => setDialog("settings")}>Settings…</MenuItem>
          </Menu>
          <Menu label="Insert">
            <MenuItem onClick={() => setDialog("title")}>Title page…</MenuItem>
            {(
              [
                "scene",
                "action",
                "character",
                "dialogue",
                "parenthetical",
                "transition",
                "section",
                "synopsis",
                "note",
                "pageBreak",
                "centered",
                "lyrics",
              ] as BlockKind[]
            ).map((k) => (
              <MenuItem key={k} onClick={() => insert(k)}>
                {blockLabels[k]}
              </MenuItem>
            ))}
          </Menu>
          <button
            className="menu-trigger"
            onClick={() => setDialog("settings")}
          >
            Settings
          </button>
          <button className="menu-trigger" onClick={() => setDialog("help")}>
            Help
          </button>
        </ApplicationMenu>
        <div className="header-history">
          <button
            className="icon-button"
            aria-label="Undo"
            onClick={() => editor.current?.undo()}
          >
            <Undo2 size={17} />
          </button>
          <button
            className="icon-button"
            aria-label="Redo"
            onClick={() => editor.current?.redo()}
          >
            <Redo2 size={17} />
          </button>
        </div>
        <div className="spacer" />
        <button
          className="document-name"
          onClick={() => {
            setRename(snapshot.name);
            setDialog("rename");
          }}
          title="Rename screenplay"
        >
          {snapshot.name}
        </button>
        <button
          className="save-button"
          disabled={busy}
          onClick={() => void run(save)}
        >
          <Download size={15} />
          <span>Save</span>
        </button>
      </header>
      {liveStatus && (liveStatus.phase === "paused" || !liveStatus.canEdit) && (
        <div className="live-notice" role="status" aria-live="polite">
          <span>
            {liveStatus.message ||
              "View only · You can follow this screenplay live."}
          </span>
          <button onClick={() => void run(() => session.fork())}>
            Keep a copy
          </button>
          {liveStatus.phase === "paused" && (
            <button
              onClick={() =>
                void run(async () => {
                  const id = liveClient.current?.fileId;
                  if (id) await openSharedDrive(id);
                })
              }
            >
              Reconnect
            </button>
          )}
        </div>
      )}
      <div className="workspace">
        {preferences.outline && !zen && (
          <>
            <aside className="outline-panel" aria-label="Scene outline">
              <div className="panel-heading">
                <div>
                  <small>YOUR STORY</small>
                  <h2>Outline</h2>
                </div>
                <button
                  className="icon-button"
                  aria-label="Close outline"
                  title="Close outline"
                  onClick={() =>
                    setPreferences({ ...preferences, outline: false })
                  }
                >
                  <X size={17} />
                </button>
              </div>
              <button
                className="outline-title"
                onClick={() => setDialog("title")}
              >
                <FileText size={17} />
                <span>
                  Title page
                  <small>
                    {doc.titlePage.title ? "Edit details" : "Add details"}
                  </small>
                </span>
              </button>
              <div className="outline-section">
                <small>SCENES</small>
                <span>{insights.sceneCount}</span>
              </div>
              <ol className="scene-list">
                {insights.scenes.map((s, i) => (
                  <li key={s.id}>
                    <button onClick={() => scene(s.id)}>
                      <span className="scene-index">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span>
                        {s.heading}
                        <small>
                          {s.synopsis ||
                            `${s.wordCount} words · ${s.timeOfDay || "Scene"}`}
                        </small>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
              {!insights.sceneCount && (
                <p className="panel-empty">
                  Your scenes will appear here as you write.
                </p>
              )}
              <button
                className="subtle-button add-scene"
                onClick={() => insert("scene")}
              >
                <Plus size={15} />
                Add scene
              </button>
              <div className="outline-bottom">
                <button onClick={() => void run(listWorkspace)}>
                  <FolderOpen size={16} />
                  Workspace
                </button>
                <div>
                  <button
                    aria-label="Open GitHub"
                    onClick={() => openIntegration("github")}
                  >
                    <Github size={17} />
                  </button>
                  <button
                    aria-label="Open Google Drive"
                    onClick={() => openIntegration("google")}
                  >
                    <Cloud size={17} />
                  </button>
                </div>
              </div>
            </aside>
            <Resizable
              label="Resize outline"
              value={preferences.leftWidth}
              onChange={(leftWidth) =>
                setPreferences((p) => ({ ...p, leftWidth }))
              }
            />
          </>
        )}
        <main className="main-panel" id="writing-area">
          {zen && !beatGuide && (
            <div className="zen-controls">
              <ZenExitButton onExit={toggleZen} />
            </div>
          )}
          {!mobile && writingControls}
          {searchOpen && (
            <div className="search-panel">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  find();
                }}
              >
                <Search size={16} />
                <input
                  ref={searchInput}
                  aria-label="Find in screenplay"
                  placeholder="Find in screenplay"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setMatch({ index: 0, total: 0 });
                  }}
                />
                <span className="match-count">
                  {match.total
                    ? `${match.index} of ${match.total}`
                    : "Find a word"}
                </span>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Previous match"
                  onClick={() => find(true)}
                >
                  <ArrowUp size={15} />
                </button>
                <button className="icon-button" aria-label="Next match">
                  <ArrowDown size={15} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Close find"
                  onClick={() => {
                    setSearchOpen(false);
                    editor.current?.find("");
                    editor.current?.focus();
                  }}
                >
                  <X size={16} />
                </button>
              </form>
              <div className="replace-row">
                <input
                  aria-label="Replacement text"
                  placeholder="Replace with"
                  value={replacement}
                  onChange={(e) => setReplacement(e.target.value)}
                />
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={caseSensitive}
                    onChange={(e) => setCaseSensitive(e.target.checked)}
                  />
                  Match case
                </label>
                <button
                  onClick={() => {
                    editor.current?.replace(query, replacement, {
                      caseSensitive,
                    });
                    find();
                  }}
                >
                  Replace
                </button>
                <button
                  onClick={() => {
                    const n = editor.current?.replaceAll(query, replacement, {
                      caseSensitive,
                    });
                    tell(`Replaced ${n ?? 0} matches.`);
                    setMatch({ index: 0, total: 0 });
                  }}
                >
                  All
                </button>
              </div>
            </div>
          )}
          {beatGuide && (
            <BeatGuide
              key={snapshot.id}
              doc={doc}
              editor={editor.current}
              targetBeatId={guideTarget}
              onAssign={assignBeatRange}
              onRange={showBeatRange}
              onEdit={() => openView("beats")}
              onClose={() => setBeatGuide(false)}
              onExitZen={zen ? toggleZen : undefined}
            />
          )}
          <div
            className={`writing-scroll background-${preferences.background}`}
          >
            <div
              className="paper-wrap"
              style={{ zoom: preferences.zoom / 100 }}
            >
              <article
                className={`screenplay-paper ${preferences.colors ? "element-colors" : ""} ${preferences.boldSceneHeadings ? "bold-scenes" : ""} numbers-${preferences.sceneNumbers}`}
                data-number-format={preferences.sceneNumberFormat}
                aria-label="Screenplay page"
              >
                <TitlePreview
                  value={doc.titlePage}
                  onEdit={() => setDialog("title")}
                />
                <EditorSurface
                  initial={doc}
                  onReady={onReady}
                  onChange={onEditorChange}
                  onSelection={setKind}
                />
              </article>
            </div>
          </div>
        </main>
        {preferences.insights && !zen && (
          <>
            <Resizable
              label="Resize insights"
              reverse
              value={preferences.rightWidth}
              onChange={(rightWidth) =>
                setPreferences((p) => ({ ...p, rightWidth }))
              }
            />
            <aside className="insights-panel" aria-label="Screenplay insights">
              <div className="panel-heading">
                <div>
                  <small>DOCUMENT</small>
                  <h2>Insights</h2>
                </div>
                <button
                  className="icon-button"
                  aria-label="Close insights"
                  title="Close insights"
                  onClick={() =>
                    setPreferences({ ...preferences, insights: false })
                  }
                >
                  <X size={16} />
                </button>
              </div>
              <div className="metrics">
                <div
                  aria-label="PDF page count"
                  aria-busy={!exact && !pdfError}
                  title={
                    pdfError ||
                    (exact
                      ? "Screenplay pages from the generated PDF, rounded up to an eighth; excludes title pages"
                      : "Generating the PDF to count its pages")
                  }
                >
                  <strong>{pages}</strong>
                  <span>
                    {pdfError && !exact ? "PDF unavailable" : "PDF pages"}
                  </span>
                </div>
                <div>
                  <strong>{insights.sceneCount}</strong>
                  <span>scenes</span>
                </div>
                <div>
                  <strong>{insights.wordCount.toLocaleString()}</strong>
                  <span>words</span>
                </div>
              </div>
              <div className="runtime">
                <span>Estimated runtime</span>
                <b>{insights.estimatedMinutes.toFixed(1)} min</b>
              </div>
              <section className="insight-section">
                <div className="section-label">
                  <h3>On the page</h3>
                  <span>{Math.round(insights.dialoguePercent)}% dialogue</span>
                </div>
                <div className="balance-bar">
                  <span style={{ width: `${insights.dialoguePercent}%` }} />
                </div>
                <div className="chart-key">
                  <span>
                    <i />
                    Dialogue
                  </span>
                  <span>
                    <i />
                    Action
                  </span>
                </div>
              </section>
              <section className="insight-section">
                <div className="section-label">
                  <h3>Characters</h3>
                  <span>{insights.characterCount}</span>
                </div>
                {!insights.characters.length && (
                  <p className="muted">
                    Your characters will find their voices here.
                  </p>
                )}
                {insights.characters.map((c, i) => (
                  <button
                    className="character-row"
                    key={c.name}
                    onClick={() => setCharacter(c.name)}
                  >
                    <div>
                      <span
                        className="character-dot"
                        style={{
                          background: [
                            "#76add9",
                            "#c29ad0",
                            "#91b378",
                            "#d8b175",
                            "#7cbdb4",
                          ][i % 5],
                        }}
                      />
                      <strong>{c.name}</strong>
                      <span>{c.dialogueWords} words</span>
                    </div>
                    <div className="character-bar">
                      <span
                        style={{
                          width: `${c.share}%`,
                          background: [
                            "#76add9",
                            "#c29ad0",
                            "#91b378",
                            "#d8b175",
                            "#7cbdb4",
                          ][i % 5],
                        }}
                      />
                    </div>
                    <small>
                      {c.speeches} speeches · {c.sceneCount} scenes ·{" "}
                      {c.estimatedMinutes.toFixed(1)} min
                    </small>
                  </button>
                ))}
                <button
                  className="pacing-link"
                  onClick={() => setDialog("characters")}
                >
                  <BarChart3 size={15} />
                  Character analytics<span aria-hidden="true">→</span>
                </button>
              </section>
              <section className="insight-section notes-section">
                <div className="section-label">
                  <h3>Story notes</h3>
                  <BookOpen size={14} />
                </div>
                <textarea
                  aria-label="Story notes"
                  readOnly={liveStatus?.canEdit === false}
                  placeholder="A thought to come back to…"
                  value={doc.metadata.notes}
                  rows={5}
                  onChange={(e) =>
                    changeDoc({
                      ...doc,
                      metadata: { ...doc.metadata, notes: e.target.value },
                    })
                  }
                />
                <small>Saved with your screenplay</small>
              </section>
            </aside>
          </>
        )}
      </div>
      <footer className="statusbar">
        {liveStatus && (
          <div
            className="live-status"
            role="status"
            aria-live="off"
            aria-label="Live collaboration"
            title={liveStatus.message}
          >
            <span className={`live-dot ${liveStatus.phase}`} />
            <span>
              {
                {
                  connecting: "Connecting…",
                  live: "Live",
                  syncing: "Syncing…",
                  offline: "Offline · edits kept on this device",
                  readonly: "View only · live",
                  paused: "Live sync paused",
                }[liveStatus.phase]
              }
            </span>
            {liveStatus.members.map((member, index) => (
              <span
                className="live-member"
                key={`${member.id}-${index}`}
                style={{ "--member-color": member.color } as CSSProperties}
              >
                {member.name}
              </span>
            ))}
            <button
              aria-label="Copy collaboration link"
              title="Copy collaboration link for people with Drive access"
              onClick={() => void run(copyCollaborationLink)}
            >
              <Link size={13} />
            </button>
          </div>
        )}
        <span className={storageFailed ? "save-status failed" : "save-status"}>
          {storageFailed ? <Cloud size={12} /> : <Check size={12} />}
          <span>{status}</span>
        </span>
        {storageFailed && (
          <button onClick={() => void run(() => session.fork())}>
            Keep as a copy
          </button>
        )}
        <div className="spacer" />
        <span>{blockLabels[kind]}</span>
        <span className="status-divider" />
        <span>{preferences.pageSize === "letter" ? "US Letter" : "A4"}</span>
        <span className="status-divider" />
        <span>Fountain</span>
      </footer>
      {notice && (
        <div className="toast" role="status">
          <span>{notice}</span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {recoveries.length > 0 && !dialog && (
        <button
          className="recovery-banner"
          onClick={() => void run(listWorkspace)}
        >
          Recovered writing is available · Open workspace
        </button>
      )}
      {character && (
        <CharacterDialog
          name={character}
          doc={doc}
          onChange={changeDoc}
          onDialogue={showBeatRange}
          onAnalytics={() => {
            setCharacter(null);
            setDialog("characters");
          }}
          onClose={() => setCharacter(null)}
        />
      )}
      {dialog === "beats" && (
        <BeatSheetDialog
          doc={doc}
          onChange={changeDoc}
          onAssign={startBeatAssignment}
          onRange={showBeatRange}
          onExport={() => void run(() => exportFile("beatPdf"))}
          onExportCsv={() => void run(() => exportFile("beats"))}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "highlight" && (
        <HighlightPdfDialog
          names={insights.characters.map((person) => person.name)}
          busy={busy}
          onExport={(names) => void run(() => exportHighlightedPdf(names))}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "pdf" && (
        <Modal
          title="PDF pages"
          className="pdf-preview-dialog"
          onClose={() => setDialog(null)}
        >
          <div className="pdf-view">
            <div className="pdf-toolbar">
              <span>
                {pdfWorking || !exact
                  ? "Preparing your pages…"
                  : pdfPages
                    ? `${pdfPages.pages} published pages`
                    : "PDF preview"}
              </span>
              <button
                disabled={busy}
                onClick={() => void run(() => exportFile("pdf"))}
              >
                <Download size={15} />
                Download PDF
              </button>
            </div>
            {pdfWarnings.length > 0 && (
              <div className="error-box" role="status">
                {pdfWarnings.join(" ")}
              </div>
            )}
            {pdfError ? (
              <div className="error-box" role="alert">
                {pdfError}
                <button onClick={() => setPdfRetry((value) => value + 1)}>
                  Try again
                </button>
              </div>
            ) : pdfUrl && exact ? (
              <iframe src={pdfUrl} title="Published screenplay PDF" />
            ) : (
              <div className="pdf-loading">
                <FileText size={32} />
                <p>Setting your story on the page…</p>
              </div>
            )}
          </div>
        </Modal>
      )}
      {dialog === "characters" && (
        <CharacterAnalytics
          doc={doc}
          onCharacter={(name) => {
            setDialog(null);
            setCharacter(name);
          }}
          onScene={(id) => {
            setDialog(null);
            scene(id);
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "settings" && (
        <Settings
          value={preferences}
          onChange={setPreferences}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "title" && (
        <TitleDialog
          value={doc.titlePage}
          readOnly={liveStatus?.canEdit === false}
          onSave={(titlePage, original) =>
            changeDoc({ ...doc, titlePage }, { ...doc, titlePage: original })
          }
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "help" && <Help onClose={() => setDialog(null)} />}
      {dialog === "rename" && (
        <Modal title="Name your screenplay" onClose={() => setDialog(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const name = rename.trim();
              if (name) {
                session.rename(
                  /\.fountain$/i.test(name) ? name : `${name}.fountain`,
                );
                file.current = undefined;
                setDialog(null);
              }
            }}
          >
            <label className="field">
              Filename
              <input
                autoFocus
                required
                value={rename}
                onChange={(e) => setRename(e.target.value)}
              />
            </label>
            <footer className="dialog-actions">
              <button type="button" onClick={() => setDialog(null)}>
                Cancel
              </button>
              <button className="primary">Rename</button>
            </footer>
          </form>
        </Modal>
      )}
      {dialog === "library" && (
        <Modal
          title="Your workspace"
          eyebrow="SAVED ON THIS DEVICE"
          onClose={() => setDialog(null)}
          wide
        >
          <div className="library-actions">
            <button
              onClick={() =>
                void run(async () => {
                  await newDocument();
                  setDialog(null);
                })
              }
            >
              <Plus size={16} />
              New screenplay
            </button>
            <button
              onClick={() =>
                void run(async () => {
                  await session.fork();
                  setDialog(null);
                })
              }
            >
              Keep current as a copy
            </button>
          </div>
          {recoveries.length > 0 && (
            <div className="recovery-list">
              <h3>Recovery drafts</h3>
              {recoveries.map((r) => (
                <div key={r.recoveryId}>
                  <span>{new Date(r.updatedAt).toLocaleString()}</span>
                  <button
                    onClick={() =>
                      void run(async () => {
                        await session.open(
                          r.screenplay,
                          "Recovered screenplay.fountain",
                        );
                        await workspace.clearRecovery(r.recoveryId);
                        setRecoveries(await workspace.recoveries());
                        file.current = undefined;
                        setDialog(null);
                      })
                    }
                  >
                    Open as a new copy
                  </button>
                  <button
                    onClick={() =>
                      downloadFile(
                        serializeFountain(r.screenplay),
                        "Recovery.fountain",
                      )
                    }
                  >
                    Download
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="library-list">
            {library.map((d) => (
              <button
                key={d.id}
                onClick={() =>
                  void run(async () => {
                    await openWorkspaceDocument(d);
                  })
                }
              >
                <FileText size={20} />
                <span>
                  <strong>{d.name}</strong>
                  <small>
                    {new Date(d.updatedAt).toLocaleString()}
                    {d.remote
                      ? ` · ${d.remote.provider === "github" ? "GitHub" : "Google Drive"}`
                      : ""}
                  </small>
                </span>
                {d.id === snapshot.id && (
                  <span className="current-label">Current</span>
                )}
              </button>
            ))}
          </div>
          <p className="muted">
            Download or connect a storage account to keep a copy outside this
            browser.
          </p>
        </Modal>
      )}
      {dialog === "history" && (
        <Modal
          title="Version history"
          eyebrow="LOCAL RECOVERY"
          onClose={() => setDialog(null)}
        >
          <p>
            Earlier versions are kept while you work. Restoring opens a new
            copy.
          </p>
          <div className="version-list">
            {history.map((h) => (
              <div key={h.id}>
                <span>
                  {new Date(h.createdAt).toLocaleString()}
                  <small>{h.name}</small>
                </span>
                <button
                  onClick={() =>
                    void run(async () => {
                      await session.open(
                        h.screenplay,
                        h.name.replace(/\.fountain$/i, "") +
                          " restored.fountain",
                      );
                      file.current = undefined;
                      setDialog(null);
                    })
                  }
                >
                  Restore copy
                </button>
              </div>
            ))}
            {!history.length && (
              <p className="muted">
                Earlier versions will appear as you continue writing.
              </p>
            )}
          </div>
        </Modal>
      )}
      {cloudDialog && (
        <CloudDialog
          {...cloudDialog}
          filename={snapshot.name}
          remote={snapshot.remote}
          getContent={() => {
            cloudSaveToken.current = session.token();
            return serializeFountain(session.capture().screenplay);
          }}
          onOpen={openCloudDocument}
          onSaveCurrent={save}
          onConnected={async () => {
            if (pendingDrive && cloudDialog.provider === "google") {
              await openSharedDrive(pendingDrive);
              setCloudDialog(null);
            }
          }}
          onSaved={async (result) => {
            const token = cloudSaveToken.current;
            if (!token)
              throw new Error(
                "Your file was saved. Reopen it to continue writing.",
              );
            session.assertCurrent(token);
            if (
              result.remote.provider === "google" &&
              cloud.collaborationSupported
            )
              await openSharedDrive(result.remote.id, token);
            else {
              await stopLive();
              session.setRemote(result.remote, token);
              await session.flush();
            }
            tell(
              `Saved to ${result.remote.provider === "github" ? "GitHub" : "Google Drive"}.`,
            );
          }}
          onBeforeConnect={() => session.flush()}
          onClose={() => setCloudDialog(null)}
        />
      )}
    </div>
  );
}
