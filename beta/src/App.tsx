import type { DirectoryHandle } from "./storage/localDirectory";
import { DocumentWorkspace } from "./core/documentWorkspace";
import { DocumentPanes, BufferSync } from "./components/DocumentPanes";
import { OutlineViewActions } from "./components/OutlineViewActions";
import type { AnnotationTarget } from "./editor/annotations";
import { NovelExportDialog } from "./components/NovelExportDialog";
import { isNovel, createNovel, proseLabels } from "./core/markdown";
import { NovelOutline } from "./components/NovelOutline";
import { NovelCharacters } from "./components/NovelCharacters";
import "./components/novel.css";
import { WritingGoals } from "./components/WritingGoals";
import { useWritingGoals } from "./components/useWritingGoals";
import { WriteShapeFiles } from "./components/WriteShapeFiles";
import { WriteShapeMark } from "./components/WriteShapeMark";
import { createFileProviders } from "./storage/fileProviders";
import { destinationKey, destinationLabel } from "./storage/destinations";
import { useDestinationSync } from "./hooks/useDestinationSync";
import { captureWriteShapeSave } from "./core/writeShapeSave";
import { libraryRequest } from "./components/WriteShapeLibrary";
import type { LibraryFile } from "./components/WriteShapeLibrary";
import { isWriteShape } from "./product";
import {
  WriteShapeAccount,
  useWriteShapeAccount,
} from "./components/WriteShapeAccount";
import { PremiumPreview } from "./components/PremiumPreview";
import { PlanComparison } from "./components/PlanComparison";
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
  MessageSquarePlus,
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
import { documentFilename, serializeDocument } from "./core/documentFormat";
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
import { ExportDialog } from "./components/ExportDialog";
import type { ExportSelection } from "./components/ExportDialog";
import { highlightedPdfFilename } from "./core/characterHighlights";
import { AnnotationsDialog } from "./components/AnnotationsDialog";
import { CharacterDialog } from "./components/CharacterDialog";
import { CharacterAnalytics } from "./components/CharacterAnalytics";
import { BeatSheetDialog } from "./components/BeatSheetDialog";
import { WritingToolbar } from "./components/WritingToolbar";
import { FormatControls } from "./components/FormatControls";
import { formatPageCount } from "./core/pageCount";
import { BeatGuide } from "./components/BeatGuide";
import { ZenExitButton } from "./components/ZenExitButton";
import { Settings, readPreferences } from "./components/Settings";
import { WorkspaceBackground } from "./components/WorkspaceBackground";
import { TitleDialog } from "./components/TitleDialog";
import { TitlePreview } from "./components/TitlePreview";
import { Modal } from "./components/Modal";
import { Menu, MenuItem } from "./components/Menu";
import { ApplicationMenu } from "./components/ApplicationMenu";
import { useMobileLayout } from "./components/useMobileLayout";
import {
  fullscreenElement,
  setBrowserFullscreen,
} from "./components/fullscreen";
import { Resizable } from "./components/Resizable";
import { Help } from "./components/Help";
import { CloudDialog } from "./components/CloudDialog";
const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl+";
const isIPad =
  /iPad/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const errorMessage = (e: unknown) =>
  e instanceof Error
    ? e.message
    : "Something went wrong. Your current writing has been kept.";
export default function App() {
  const account = useWriteShapeAccount();
  const isWriteShapeFree = isWriteShape && !account.state.premium;
  const [accountOpen, setAccountOpen] = useState(
    () => isWriteShape && new URLSearchParams(location.search).has("account"),
  );
  const [plansOpen, setPlansOpen] = useState(false);
  const [cloudConflict, setCloudConflict] = useState<string>();
  const [libraryMode, setLibraryMode] = useState<"open" | "save" | null>(null);
  const cloudCapturedContent = useRef("");
  const cloudFile = useRef<(LibraryFile & { localId: string }) | null>(null);
  const [session, setSession] = useState<DocumentSession>();
  const sessionRef = useRef<DocumentSession | undefined>(undefined);
  const accountId = account.state.account?.id;
  const goals = useWritingGoals(
    accountId,
    isWriteShape && account.state.premium,
  );
  const accountIdRef = useRef(accountId);
  accountIdRef.current = accountId;
  useEffect(() => {
    cloudFile.current = null;
    setLibraryMode(null);
    setCloudConflict(undefined);
    setFileTab(accountId ? "writeshape" : "local");
  }, [accountId]);
  const [snapshot, setSnapshot] = useState<SessionSnapshot>();
  const documentWorkspace = useRef<DocumentWorkspace | null>(null);
  const [workspaceReady, setWorkspaceReady] = useState(!isWriteShape);
  const [, updateWorkspace] = useState(0);
  const [workspaceAnnotation, setWorkspaceAnnotation] = useState<{
    controller: EditorController;
    target: AnnotationTarget;
  } | null>(null);
  const [workspaceAnnotationText, setWorkspaceAnnotationText] = useState("");
  const goalActivity = useRef(goals.onActivity);
  goalActivity.current = goals.onActivity;
  const refreshWorkspace = () => {
    updateWorkspace((value) => value + 1);
    documentWorkspace.current?.saveLayout();
    const active = documentWorkspace.current?.activeBuffer;
    if (documentWorkspace.current && !documentWorkspace.current.activeView)
      editor.current = null;
    if (active) {
      setSnapshot({ ...active.snapshot });
      setStatus(
        active.status === "saving"
          ? "Saving on this device…"
          : active.status === "error"
            ? "Device save needs attention"
            : "Saved on this device",
      );
      setStorageFailed(active.status === "error");
    }
  };
  const fallbackDestinationSync = useDestinationSync(
    session,
    snapshot?.id,
    destinationKey(snapshot?.destination),
    accountId,
    account.state.premium,
    isWriteShape && !documentWorkspace.current,
  );
  const destinationSync = documentWorkspace.current?.activeBuffer
    ? {
        engine: documentWorkspace.current.activeBuffer.sync,
        status: documentWorkspace.current.activeBuffer.syncStatus,
      }
    : fallbackDestinationSync;
  const destinationEngineRef = destinationSync.engine;
  const [fileTab, setFileTab] = useState<"writeshape" | "drive" | "local">(
    "local",
  );
  const localRoot = useRef<DirectoryHandle | undefined>(undefined);
  const fileProviders = useMemo(
    () =>
      session
        ? createFileProviders({
            session,
            localRoot,
            accountId,
            premium: account.state.premium,
            mode: libraryMode || "open",
            valid: () =>
              sessionRef.current === session &&
              accountIdRef.current === accountId,
            opened: () => {
              file.current = undefined;
              setLibraryMode(null);
            },
          })
        : undefined,
    [session, accountId, account.state.premium, libraryMode],
  );
  const liveClient = useRef<LiveClient | undefined>(undefined);
  const [liveStatus, setLiveStatus] = useState<LiveStatus>();
  const switchingLive = useRef<LiveClient | undefined>(undefined);
  const [pendingDrive, setPendingDrive] = useState(() =>
    isWriteShape ? null : new URLSearchParams(location.search).get("drive"),
  );
  const cloudSaveToken = useRef<{ id: string; epoch: number } | undefined>(
    undefined,
  );
  const [preferences, setPreferences] = useState(readPreferences);
  const [annotationState, setAnnotationState] = useState<
    "add" | "edit" | "unavailable"
  >("unavailable");
  const [kind, setKind] = useState<BlockKind>("action");
  const [dualDialogue, setDualDialogue] = useState(false);
  const [guideTarget, setGuideTarget] = useState<string>();
  const [beatGuide, setBeatGuide] = useState(() => {
    try {
      return localStorage.getItem("fp2.beatGuide") === "true";
    } catch {
      return false;
    }
  });
  const [dialog, setDialog] = useState<
    | "new"
    | "settings"
    | "title"
    | "help"
    | "library"
    | "history"
    | "rename"
    | "annotations"
    | "characters"
    | "beats"
    | "pdf"
    | "export"
    | null
  >(null);
  const [cloudDialog, setCloudDialog] = useState<{
    provider: Provider;
    mode: "open" | "save" | "share" | "history";
  } | null>(null);
  useEffect(() => {
    if (!isWriteShape || !libraryMode) return;
    let active = true;
    void (async () => {
      await session?.flush();
      const [drafts, recoveries] = await Promise.all([
        workspace.list(),
        workspace.recoveries(),
      ]);
      if (active) {
        setLibrary(drafts);
        setRecoveries(recoveries);
      }
    })().catch((e) => {
      if (active) setNotice(errorMessage(e));
    });
    return () => {
      active = false;
    };
  }, [libraryMode, session]);
  const [status, setStatus] = useState("Opening workspace…");
  const [storageFailed, setStorageFailed] = useState(false);
  const [notice, setNotice] = useState("");
  const [character, setCharacter] = useState<string | null>(null);
  const [zen, setZen] = useState(false);
  const mobile = useMobileLayout();
  const downloadOnlyPdf = mobile || isIPad;
  useEffect(() => {
    // Safari can briefly report a narrow layout while the iPad writing surface
    // changes presentation state. Do not let that transient resize cancel Zen.
    if (mobile && !isIPad) setZen(false);
  }, [mobile]);
  const [nativeFullscreen, setNativeFullscreen] =
    useState(!!fullscreenElement());
  const fullscreen = nativeFullscreen;
  useEffect(() => {
    const update = () => {
      setNativeFullscreen(!!fullscreenElement());
    };
    document.addEventListener("fullscreenchange", update);
    document.addEventListener("webkitfullscreenchange", update);
    return () => {
      document.removeEventListener("fullscreenchange", update);
      document.removeEventListener("webkitfullscreenchange", update);
    };
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
      let tabDocumentId: string | null = null;
      if (isWriteShape) {
        try {
          tabDocumentId = sessionStorage.getItem("writeshape.activeDraft");
        } catch {}
      }
      try {
        migrated = await migrateLegacyWorkspace();
      } catch (error) {
        warning = errorMessage(error);
      }
      try {
        const id = tabDocumentId || workspace.getActiveId();
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
      // Each WriteShape tab owns its recovery draft while sharing the remote file.
      // Reload retains that tab's draft; a newly opened tab starts from the latest saved draft.
      if (
        isWriteShape &&
        initial &&
        (!tabDocumentId || initial.id !== tabDocumentId)
      ) {
        initial = {
          id: newId(),
          name: initial.name,
          screenplay: initial.screenplay,
          destination: initial.destination,
          epoch: 0,
        };
      }
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
      s.onSnapshot = (value) => {
        if (isWriteShape) {
          try {
            sessionStorage.setItem("writeshape.activeDraft", value.id);
          } catch {}
        }
        setSnapshot({ ...value });
      };
      s.onStatus = (state, message) => {
        destinationEngineRef.current?.changed();
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
      if (isWriteShape && !restoredLive) {
        documentWorkspace.current = new DocumentWorkspace(s, {
          changed: refreshWorkspace,
          edited: ({ controller }) => {
            if (!latest.current.preferences.typewriter) return;
            requestAnimationFrame(() => {
              const view = controller.view;
              if (!view.dom.isConnected || view.composing) return;
              const pane = view.dom.closest(".writing-scroll");
              if (!pane) return;
              const coords = view.coordsAtPos(view.state.selection.head),
                bounds = pane.getBoundingClientRect();
              if (
                coords.top > bounds.top + bounds.height * 0.65 ||
                coords.top < bounds.top + bounds.height * 0.25
              )
                pane.scrollBy({
                  top: coords.top - (bounds.top + bounds.height * 0.48),
                  behavior: "instant",
                });
            });
          },
          activated: (buffer, view) => {
            const previous = sessionRef.current;
            if (previous) {
              const old = documentWorkspace.current?.buffers.get(
                previous.current.id,
              );
              if (old) old.file = file.current;
            }
            sessionRef.current = buffer.session;
            editor.current = view.controller;
            file.current = buffer.file;
            cloudFile.current = null;
            setSession(buffer.session);
            setSnapshot({ ...buffer.session.capture() });
            try {
              sessionStorage.setItem(
                "writeshape.activeDraft",
                buffer.session.current.id,
              );
            } catch {}
            workspace.setActiveId(buffer.session.current.id);
            const attrs =
              view.controller.view.state.selection.$from.parent.attrs;
            setKind(attrs.kind || "action");
            setDualDialogue(!!attrs.dual);
          },
          selection: (value, dual) => {
            setKind(value);
            setDualDialogue(dual);
          },
          activity: (words, pasted) => goalActivity.current(words, pasted),
          annotationState: setAnnotationState,
          annotation: (target) => {
            const controller = editor.current;
            if (controller) {
              setWorkspaceAnnotation({ controller, target });
              setWorkspaceAnnotationText(target.text);
            }
          },
          error: tell,
        });
      }
      if (documentWorkspace.current)
        await documentWorkspace.current.restoreLayout();
      if (!live) {
        documentWorkspace.current?.dispose();
        return;
      }
      const activeSession =
        documentWorkspace.current?.activeBuffer?.session || s;
      sessionRef.current = activeSession;
      setWorkspaceReady(true);
      if (restoredLive) attachLive(restoredLive);
      setSession(activeSession);
      setSnapshot(activeSession.current);
      workspace.setActiveId(activeSession.current.id);
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
      if (params.has("driveConnected")) {
        tell("Google Drive connected. Open Files to choose a screenplay.");
        params.delete("driveConnected");
        window.history.replaceState(
          {},
          "",
          `${location.pathname}${params.size ? `?${params}` : ""}`,
        );
      }
      if (isWriteShape && params.has("connectionError")) {
        tell(
          params.get("connectionError") === "drive"
            ? "Google Drive could not connect. Your local writing is unchanged. Open Files to reconnect."
            : "Google sign-in could not finish. Your local writing is unchanged. Open Account to try again.",
        );
        params.delete("connectionError");
        window.history.replaceState(
          {},
          "",
          `${location.pathname}${params.size ? `?${params}` : ""}${location.hash}`,
        );
      }
      if (params.has("error")) tell(params.get("error")!);
    })();
    return () => {
      live = false;
      documentWorkspace.current?.dispose();
      documentWorkspace.current = null;
      sessionRef.current?.dispose();
      void stopLive().catch(() => {});
    };
  }, []);
  useEffect(() => {
    if (mobile)
      setPreferences((p) => ({ ...p, outline: false, insights: false }));
  }, [mobile]);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const root = document.documentElement;
    let frame = 0;
    let settleTimer = 0;

    const applyViewport = () => {
      frame = 0;
      // iOS/WebKit can visually pan the page for the software keyboard without
      // changing document scrollTop. pageTop sometimes updates more reliably
      // than offsetTop during that transition, so use whichever reports the
      // larger visual displacement from the layout viewport.
      const top = Math.max(
        0,
        viewport.offsetTop,
        viewport.pageTop - window.scrollY,
      );
      root.style.setProperty("--fp-visual-top", `${top}px`);
      root.style.setProperty(
        "--fp-visual-height",
        `${viewport.height > 0 ? viewport.height : window.innerHeight}px`,
      );
    };

    const scheduleViewport = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(applyViewport);
      // Safari has shipped keyboard transitions where offsetTop is stale in the
      // first viewport event and correct shortly afterward.
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(applyViewport, 80);
    };

    scheduleViewport();
    viewport.addEventListener("resize", scheduleViewport);
    viewport.addEventListener("scroll", scheduleViewport);
    window.addEventListener("resize", scheduleViewport);
    window.addEventListener("orientationchange", scheduleViewport);
    document.addEventListener("focusin", scheduleViewport);
    document.addEventListener("focusout", scheduleViewport);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);
      viewport.removeEventListener("resize", scheduleViewport);
      viewport.removeEventListener("scroll", scheduleViewport);
      window.removeEventListener("resize", scheduleViewport);
      window.removeEventListener("orientationchange", scheduleViewport);
      document.removeEventListener("focusin", scheduleViewport);
      document.removeEventListener("focusout", scheduleViewport);
      root.style.removeProperty("--fp-visual-top");
      root.style.removeProperty("--fp-visual-height");
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
      documentWorkspace.current?.saveLayout();
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
      if (!isWriteShape && id === session.current.id && !liveClient.current)
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
    if (isWriteShape) {
      setLibraryMode("open");
      return;
    }
    await openLocalFallback();
  }
  async function openLocalFallback() {
    if (!session) return;
    const token = session.token();
    const result = await openLocalFile({ useFileInput: isWriteShape });
    if (!result) return;
    session.assertCurrent(token);
    const imported = importScreenplay(result.content, result.name);
    await session.open(imported.screenplay, imported.name);
    file.current = imported.converted ? undefined : result.handle;
    setDialog(null);
    setLibraryMode(null);
  }
  async function saveLocal(as = false) {
    if (!session) return;
    const captured = session.capture();
    const token = session.token();
    const handle = await saveLocalFile(
      serializeDocument(captured.screenplay),
      captured.name,
      as ? undefined : file.current,
    );
    if (token.id === session.current.id) file.current = handle;
    await session.flush();
    tell(`Saved ${captured.name}.`);
  }
  async function save() {
    if (documentWorkspace.current && !documentWorkspace.current.activeView) {
      tell("Open a document to save it.");
      return;
    }
    if (isWriteShape && session) {
      await session.flush();
      if (!session.current.destination || !destinationSync.engine.current) {
        setLibraryMode("save");
        return;
      }
      await destinationSync.engine.current.flush();
      return;
    }
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
    const content = serializeDocument(snap.screenplay);
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
  async function newDocument(format?: "screenplay" | "novel") {
    if (!session) return;
    if (isWriteShape && !format) {
      setDialog("new");
      setLibraryMode(null);
      return;
    }
    await session.open(
      format === "novel" ? createNovel() : emptyScreenplay(),
      format === "novel" ? "Untitled.md" : "Untitled.fountain",
    );
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
    if (isWriteShape) {
      setFileTab("local");
      setLibraryMode("open");
    } else setDialog("library");
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
      if (isWriteShape) setLibraryMode(null);
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
  async function exportSelection(selection: ExportSelection) {
    if (
      isWriteShapeFree &&
      (selection.format !== "pdf" ||
        selection.mobile ||
        selection.characters.length)
    ) {
      setPlansOpen(true);
      return;
    }
    if (!session) return;
    if (selection.format === "fdx") {
      await exportFile("fdx");
    } else {
      const snap = session.capture();
      const result = await publishPdf(snap.screenplay, {
        ...pdfOptions,
        mobileLayout: selection.mobile,
        highlightCharacters: [...selection.characters],
      });
      const filename = selection.characters.length
        ? highlightedPdfFilename(snap.name, selection.characters)
        : `${snap.name.replace(/\.[^.]+$/, "")}.pdf`;
      downloadFile(
        new Blob([result.bytes as BlobPart], { type: "application/pdf" }),
        selection.mobile ? filename.replace(/\.pdf$/, "-mobile.pdf") : filename,
      );
      if (result.warnings.length) tell(result.warnings.join(" "));
    }
    setDialog((current) => (current === "export" ? null : current));
  }
  async function exportFile(
    format: "pdf" | "mobilePdf" | "beatPdf" | "fdx" | "beats",
  ) {
    if (!session) return;
    if (isWriteShapeFree && format !== "pdf") {
      setPlansOpen(true);
      return;
    }
    const snap = session.capture();
    const stem = snap.name.replace(/\.[^.]+$/, "");
    if (format === "pdf" || format === "mobilePdf" || format === "beatPdf") {
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
          : await publishPdf(outputDoc, {
              ...pdfOptions,
              ...(format === "mobilePdf" ? { mobileLayout: true } : {}),
            });
      if (result.warnings.length) tell(result.warnings.join(" "));
      downloadFile(
        new Blob([result.bytes as BlobPart], { type: "application/pdf" }),
        `${stem}${format === "beatPdf" ? "-beats" : format === "mobilePdf" ? "-mobile" : ""}.pdf`,
      );
      if (format === "pdf") acceptPdf(result, snap, pdfOptionsKey);
    } else {
      const exports = await import("./core/export");
      const text =
        format === "fdx"
          ? exports.exportFdx(snap.screenplay)
          : exports.exportBeatSheetCsv(snap.screenplay);
      downloadFile(
        text,
        `${stem}${format === "beats" ? "-beats.csv" : `.${format}`}`,
        format === "fdx" ? "application/xml" : "text/csv",
      );
    }
    if (format !== "pdf" && format !== "mobilePdf" && format !== "beatPdf")
      tell("Export ready.");
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
      // Google's native Picker is a sibling, not an app-owned <dialog>.
      // Inert background elements do not suppress window-level shortcuts.
      if (document.body.classList.contains("drive-picker-active")) return;
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
              ? isWriteShape
                ? Promise.resolve(setLibraryMode("save"))
                : actions.current.saveLocal(true)
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
  if (!workspaceReady || !snapshot || !session || !insights)
    return (
      <main className="loading">
        {isWriteShape ? (
          <WriteShapeMark size={28} />
        ) : (
          <span className="brand-mark">F</span>
        )}
        <p>Opening your writing room…</p>
      </main>
    );
  const deviceDrafts = (
    <>
      <div className="library-actions">
        <button
          onClick={() =>
            void run(async () => {
              await newDocument();
              if (!isWriteShape) setDialog(null);
              if (isWriteShape) setLibraryMode(null);
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
              if (isWriteShape) setLibraryMode(null);
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
                      r.screenplay.metadata.format === "markdown"
                        ? "Recovered document.md"
                        : "Recovered screenplay.fountain",
                    );
                    await workspace.clearRecovery(r.recoveryId);
                    setRecoveries(await workspace.recoveries());
                    file.current = undefined;
                    setDialog(null);
                    if (isWriteShape) setLibraryMode(null);
                  })
                }
              >
                Open as a new copy
              </button>
              <button
                onClick={() =>
                  downloadFile(
                    serializeDocument(r.screenplay),
                    r.screenplay.metadata.format === "markdown"
                      ? "Recovery.md"
                      : "Recovery.fountain",
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
    </>
  );
  const doc = snapshot.screenplay;
  const novel = isWriteShape && isNovel(doc);
  const workspaceEmpty =
    !!documentWorkspace.current && !documentWorkspace.current.activeView;
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
    void setBrowserFullscreen(!fullscreenElement()).catch(report);
  };
  const toggleZen = () => {
    if (mobile && !isIPad) return;
    setZen(!zen);
    setSearchOpen(false);
    if (isIPad) {
      // Restore the old iPad Zen path. Its page layout remains usable even if
      // native fullscreen is unavailable; do not force focus after entering.
      const standalone =
        matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone;
      if (!standalone) void setBrowserFullscreen(!zen).catch(() => {});
      return;
    }
    editor.current?.focus();
  };
  const openIntegration = (
    provider: Provider,
    mode: "open" | "save" | "share" | "history" = "open",
  ) => {
    setCloudDialog({ provider, mode });
  };
  const changeElement = (value: BlockKind, dual = false) => {
    const changed = editor.current?.setKind(value, dual);
    if (dual && !changed)
      tell(
        "Choose a character or dialogue next to another speech to create dual dialogue.",
      );
  };
  const writingControls = (
    <WritingToolbar
      novel={novel}
      onHeading={(level) => editor.current?.setHeadingLevel(level)}
      kind={kind}
      dualDialogue={dualDialogue}
      onKind={changeElement}
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
        {novel ? "Skip to document" : "Skip to screenplay"}
      </a>
      <header className="app-header">
        <button
          className="brand"
          aria-label={
            isWriteShape ? "WriteShape help" : "Fountain Publisher help"
          }
          onClick={() => setDialog("help")}
        >
          {isWriteShape ? (
            <WriteShapeMark size={28} />
          ) : (
            <span className="brand-mark">F</span>
          )}
          <span>{isWriteShape ? "WriteShape" : "Fountain Publisher"}</span>
        </button>
        {isWriteShape && !mobile && (
          <button onClick={() => setPlansOpen(true)}>
            {isWriteShapeFree
              ? "Free · View plans"
              : account.state.account?.privateTester
                ? "Premium · Private tester"
                : "Premium · View plans"}
          </button>
        )}
        {isWriteShape && !mobile && (
          <button onClick={() => setLibraryMode("open")}>Files</button>
        )}
        {isWriteShape && !mobile && (
          <button onClick={() => setAccountOpen(true)}>Account</button>
        )}
        <ApplicationMenu
          simpleMobile={isWriteShape}
          onSettings={() => setDialog("settings")}
          onHelp={() => setDialog("help")}
          mobile={mobile}
          controls={writingControls}
          filename={snapshot.name}
        >
          <Menu label="File">
            {isWriteShape && (
              <MenuItem onClick={() => setAccountOpen(true)}>
                Account and subscription…
              </MenuItem>
            )}
            {isWriteShape && (
              <MenuItem onClick={() => setPlansOpen(true)}>
                Explore Premium…
              </MenuItem>
            )}
            <small>{novel ? "DOCUMENT" : "SCREENPLAY"}</small>
            <MenuItem onClick={() => void run(newDocument)}>
              {isWriteShape ? "New" : "New screenplay"}
            </MenuItem>
            <MenuItem onClick={() => void run(openLocal)} shortcut={`${mod}O`}>
              {isWriteShape ? "Open…" : "Open screenplay…"}
            </MenuItem>
            <MenuItem onClick={() => void run(save)} shortcut={`${mod}S`}>
              Save
            </MenuItem>
            <MenuItem
              onClick={() =>
                isWriteShape
                  ? setLibraryMode("save")
                  : void run(() => saveLocal(true))
              }
              shortcut={`⇧${mod}S`}
            >
              Save As…
            </MenuItem>
            <MenuItem
              onClick={() => {
                setRename(snapshot.name);
                setDialog("rename");
              }}
            >
              {novel ? "Rename document…" : "Rename screenplay…"}
            </MenuItem>
            {!isWriteShape && (
              <MenuItem onClick={() => void run(listWorkspace)}>
                Workspace…
              </MenuItem>
            )}
            <MenuItem onClick={() => void run(listHistory)}>
              Version history…
            </MenuItem>
            <hr />
            {isWriteShape ? (
              <>
                <MenuItem
                  onClick={() => {
                    downloadFile(
                      serializeDocument(session.capture().screenplay),
                      snapshot.name,
                    );
                  }}
                >
                  Download local copy…
                </MenuItem>
              </>
            ) : (
              <>
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
              </>
            )}
            <small>PUBLISH</small>
            <MenuItem
              onClick={() => {
                session.capture();
                setSnapshot({ ...session.current });
                setDialog("export");
              }}
            >
              Export…
            </MenuItem>
          </Menu>
          <Menu label="Edit">
            <MenuItem
              disabled={annotationState !== "add"}
              onClick={() => editor.current?.annotateSelection()}
            >
              Add annotation…
            </MenuItem>
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
              {novel ? "Rename document…" : "Rename screenplay…"}
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
            <MenuItem onClick={() => setDialog("annotations")}>
              Annotations…
            </MenuItem>
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
            {(novel
              ? (Object.keys(proseLabels) as BlockKind[])
              : ([
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
                ] as BlockKind[])
            ).map((k) => (
              <MenuItem key={k} onClick={() => insert(k)}>
                {novel
                  ? proseLabels[k as keyof typeof proseLabels]
                  : blockLabels[k]}
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
          {mobile && (
            <button
              className="icon-button"
              aria-label="Add annotation"
              title="Add annotation"
              disabled={annotationState !== "add"}
              onPointerDown={(event) => {
                if (event.button === 0) event.preventDefault();
              }}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => editor.current?.annotateSelection()}
            >
              <MessageSquarePlus size={17} />
            </button>
          )}
        </div>
        <div className="spacer" />
        {mobile ? (
          <div className="mobile-header-format">
            <FormatControls
              novel={novel}
              onHeading={(level) => editor.current?.setHeadingLevel(level)}
              kind={kind}
              dualDialogue={dualDialogue}
              onKind={changeElement}
              onMark={(mark) => editor.current?.toggleMark(mark)}
            />
          </div>
        ) : (
          <button
            className="document-name"
            disabled={workspaceEmpty}
            onClick={() => {
              setRename(snapshot.name);
              setDialog("rename");
            }}
            title="Rename screenplay"
          >
            {workspaceEmpty ? "No open document" : snapshot.name}
          </button>
        )}
        <button
          className="save-button"
          disabled={busy || workspaceEmpty}
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
      <div className={`workspace${novel ? " novel-mode" : ""}`}>
        {preferences.outline && !zen && !workspaceEmpty && (
          <>
            <aside
              className="outline-panel"
              aria-label={novel ? "Book outline" : "Scene outline"}
            >
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
              {novel ? (
                <NovelOutline
                  doc={doc}
                  onJump={scene}
                  viewActions={
                    documentWorkspace.current
                      ? (id) => (
                          <OutlineViewActions
                            model={documentWorkspace.current!}
                            sectionId={id}
                          />
                        )
                      : undefined
                  }
                  onAdd={() => {
                    insert("section");
                    editor.current?.setHeadingLevel(2);
                  }}
                  onBeats={() => openView("beats")}
                />
              ) : (
                <>
                  <div className="outline-section">
                    <small>SCENES</small>
                    <span>{insights.sceneCount}</span>
                  </div>
                  <ol className="scene-list">
                    {insights.scenes.map((s, i) => (
                      <li key={s.id}>
                        {documentWorkspace.current && (
                          <OutlineViewActions
                            model={documentWorkspace.current}
                            sectionId={s.id}
                          />
                        )}
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
                </>
              )}
              <div className="outline-bottom">
                {!isWriteShape && (
                  <button onClick={() => void run(listWorkspace)}>
                    <FolderOpen size={16} />
                    Workspace
                  </button>
                )}
                {!isWriteShape && (
                  <div>
                    <button
                      hidden={isWriteShape}
                      aria-label="Open GitHub"
                      onClick={() => openIntegration("github")}
                    >
                      <Github size={17} />
                    </button>
                    <button
                      hidden={isWriteShape}
                      aria-label="Open Google Drive"
                      onClick={() => openIntegration("google")}
                    >
                      <Cloud size={17} />
                    </button>
                  </div>
                )}
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
          {!mobile && !workspaceEmpty && writingControls}
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
          {beatGuide &&
            (isWriteShapeFree ? (
              <section>
                <button onClick={() => setBeatGuide(false)}>
                  Close Beat Guide
                </button>
                <PremiumPreview
                  title="Beat Guide"
                  onUpgrade={() => setPlansOpen(true)}
                />
              </section>
            ) : (
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
            ))}
          <div className="writing-viewport">
            {!mobile && (
              <WorkspaceBackground
                pattern={preferences.background}
                options={
                  preferences.background === "plain"
                    ? undefined
                    : preferences.backgroundOptions[preferences.background]
                }
                paused={Boolean(
                  (dialog && dialog !== "settings") || cloudDialog || character,
                )}
              />
            )}
            {documentWorkspace.current ? (
              <DocumentPanes
                model={documentWorkspace.current}
                preferences={preferences}
                onOpen={() => setLibraryMode("open")}
                onTitle={() => setDialog("title")}
                changed={refreshWorkspace}
              />
            ) : (
              <div className="writing-scroll">
                <div
                  className="paper-wrap"
                  style={{ zoom: preferences.zoom / 100 }}
                >
                  <article
                    className={`screenplay-paper ${preferences.colors ? "element-colors" : ""} ${preferences.boldSceneHeadings ? "bold-scenes" : ""} numbers-${preferences.sceneNumbers}`}
                    data-number-format={preferences.sceneNumberFormat}
                    aria-label={novel ? "Manuscript page" : "Screenplay page"}
                  >
                    <TitlePreview
                      value={doc.titlePage}
                      onEdit={() => setDialog("title")}
                    />
                    <EditorSurface
                      initial={doc}
                      onReady={onReady}
                      onChange={onEditorChange}
                      onWritingActivity={
                        isWriteShape ? goals.onActivity : undefined
                      }
                      onSelection={(value, dual) => {
                        setKind(value);
                        setDualDialogue(dual);
                      }}
                      onAnnotationState={setAnnotationState}
                    />
                  </article>
                </div>
              </div>
            )}
          </div>
        </main>
        {preferences.insights && !zen && !workspaceEmpty && (
          <>
            <Resizable
              label="Resize insights"
              reverse
              value={preferences.rightWidth}
              onChange={(rightWidth) =>
                setPreferences((p) => ({ ...p, rightWidth }))
              }
            />
            <aside
              className="insights-panel"
              aria-label={novel ? "Manuscript insights" : "Screenplay insights"}
            >
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
              {isWriteShapeFree ? (
                <PremiumPreview
                  title="Insights"
                  onUpgrade={() => setPlansOpen(true)}
                />
              ) : (
                <>
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
                      <strong>
                        {novel
                          ? doc.blocks.filter((b) => b.kind === "section")
                              .length
                          : insights.sceneCount}
                      </strong>
                      <span>{novel ? "headings" : "scenes"}</span>
                    </div>
                    <div>
                      <strong>{insights.wordCount.toLocaleString()}</strong>
                      <span>words</span>
                    </div>
                  </div>
                  {novel ? (
                    <NovelCharacters doc={doc} onChange={changeDoc} />
                  ) : (
                    <>
                      <section className="insight-section">
                        <div className="section-label">
                          <h3>On the page</h3>
                          <span>
                            {Math.round(insights.dialoguePercent)}% dialogue
                          </span>
                        </div>
                        <div className="balance-bar">
                          <span
                            style={{ width: `${insights.dialoguePercent}%` }}
                          />
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
                    </>
                  )}
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
                    <small>Saved with your document</small>
                  </section>
                </>
              )}
              {isWriteShape && (
                <WritingGoals
                  state={goals}
                  premium={account.state.premium}
                  onUpgrade={() => setPlansOpen(true)}
                />
              )}
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
          {isWriteShape && (
            <button
              className="destination-status"
              onClick={() =>
                setLibraryMode(
                  destinationSync.status?.phase === "conflict"
                    ? "save"
                    : "open",
                )
              }
              title={destinationSync.status?.message}
            >
              {destinationLabel(snapshot.destination)}
              {snapshot.destination
                ? ` · ${destinationSync.status?.phase || "checking"}`
                : " · Choose save location"}
            </button>
          )}
        </span>
        {storageFailed && (
          <button onClick={() => void run(() => session.fork())}>
            Keep as a copy
          </button>
        )}
        <div className="spacer" />
        <span>
          {novel
            ? proseLabels[kind as keyof typeof proseLabels] || "Body text"
            : dualDialogue
              ? "Dual dialogue"
              : blockLabels[kind]}
        </span>
        <span className="status-divider" />
        <span>{preferences.pageSize === "letter" ? "US Letter" : "A4"}</span>
        <span className="status-divider" />
        <span>{novel ? "Markdown · Novel" : "Fountain"}</span>
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
          Recovered writing is available · Open files
        </button>
      )}
      {dialog === "annotations" && (
        <AnnotationsDialog
          doc={doc}
          onJump={showBeatRange}
          onClose={() => setDialog(null)}
        />
      )}
      {character && !isWriteShapeFree && (
        <CharacterDialog
          name={character}
          doc={doc}
          onChange={changeDoc}
          onDialogue={showBeatRange}
          onClose={() => setCharacter(null)}
        />
      )}
      {dialog === "beats" &&
        (isWriteShapeFree ? (
          <Modal title="Beat Sheet" onClose={() => setDialog(null)}>
            <PremiumPreview
              title="Beat Sheet"
              onUpgrade={() => {
                setDialog(null);
                setPlansOpen(true);
              }}
            />
          </Modal>
        ) : (
          <BeatSheetDialog
            doc={doc}
            onChange={changeDoc}
            onAssign={startBeatAssignment}
            onRange={showBeatRange}
            onExport={() => void run(() => exportFile("beatPdf"))}
            onExportCsv={() => void run(() => exportFile("beats"))}
            onClose={() => setDialog(null)}
          />
        ))}
      {libraryMode && fileProviders && (
        <WriteShapeFiles
          key={accountId}
          account={{
            authenticated: !!accountId,
            premium: account.state.premium,
            email: account.state.account?.email,
          }}
          initialDestination={fileTab}
          deviceDrafts={deviceDrafts}
          onDestination={setFileTab}
          providers={fileProviders}
          onSignIn={() => {
            setLibraryMode(null);
            setAccountOpen(true);
          }}
          onUpgrade={() => {
            setLibraryMode(null);
            setPlansOpen(true);
          }}
          onOpenLocalFile={openLocalFallback}
          onDownloadLocal={() => {
            downloadFile(
              serializeDocument(session.capture().screenplay),
              session.current.name,
            );
            setLibraryMode(null);
          }}
          mode={libraryMode}
          name={snapshot.name}
          initialFile={
            cloudFile.current?.localId === snapshot.id
              ? cloudFile.current
              : undefined
          }
          captureSave={() => {
            cloudCapturedContent.current = serializeDocument(
              session.capture().screenplay,
            );
            return captureWriteShapeSave(
              session,
              (item: LibraryFile, localId) => {
                cloudFile.current = { ...item, localId };
                session.setDestination({
                  provider: "writeshape",
                  id: item.id,
                  parent: item.parent,
                  accountId,
                  name: item.name,
                  revision: String(item.revision),
                  baseContent: item.content || cloudCapturedContent.current,
                  canWrite: true,
                });
                void session.flush().catch(report);
                tell("Saved to WriteShape.");
              },
              () =>
                sessionRef.current === session &&
                accountIdRef.current === accountId,
            );
          }}
          onOpen={async (item) => {
            if (
              sessionRef.current !== session ||
              accountIdRef.current !== accountId ||
              session.current.id !== snapshot.id
            )
              throw new Error(
                "Your account or open draft changed. Open the library again to continue.",
              );
            const imported = importScreenplay(item.content || "", item.name);
            await session.open(
              imported.screenplay,
              imported.name,
              undefined,
              undefined,
              {
                provider: "writeshape",
                id: item.id,
                parent: item.parent,
                accountId,
                name: imported.name,
                revision: String(item.revision),
                baseContent: serializeDocument(imported.screenplay),
                canWrite: true,
              },
              () => {
                if (
                  sessionRef.current !== session ||
                  accountIdRef.current !== accountId
                )
                  throw new Error(
                    "The account changed. Your draft is preserved.",
                  );
              },
            );
            if (
              sessionRef.current !== session ||
              accountIdRef.current !== accountId
            )
              return;
            file.current = undefined;
            cloudFile.current = { ...item, localId: session.current.id };
          }}
          onClose={() => setLibraryMode(null)}
        />
      )}
      {isWriteShape &&
        destinationSync.status &&
        ["conflict", "offline", "error", "readonly"].includes(
          destinationSync.status.phase,
        ) && (
          <div className="destination-notice" role="status">
            <span>{destinationSync.status.message}</span>
            <button
              onClick={() => void destinationSync.engine.current?.refresh()}
            >
              Check latest
            </button>
            <button
              onClick={() =>
                void run(async () => {
                  await session.fork();
                  setLibraryMode("save");
                })
              }
            >
              Save a copy…
            </button>
            <button
              onClick={() =>
                void run(async () => {
                  if (destinationSync.status?.phase === "conflict")
                    await session.fork();
                  setLibraryMode("open");
                })
              }
            >
              Open latest…
            </button>
          </div>
        )}
      {cloudConflict && (
        <Modal
          title="The cloud file has a newer version"
          onClose={() => setCloudConflict(undefined)}
        >
          <p>{cloudConflict}</p>
          <p>
            Your current draft is unchanged and remains saved on this device.
          </p>
          <div className="dialog-actions">
            <button
              onClick={() => {
                setCloudConflict(undefined);
                setLibraryMode("open");
              }}
            >
              Browse latest and history
            </button>
            <button
              className="primary"
              onClick={() => {
                setCloudConflict(undefined);
                setLibraryMode("save");
              }}
            >
              Save as a new file
            </button>
          </div>
        </Modal>
      )}
      {plansOpen && (
        <PlanComparison
          onClose={() => setPlansOpen(false)}
          onAccount={() => {
            setPlansOpen(false);
            setAccountOpen(true);
          }}
        />
      )}
      {accountOpen && (
        <WriteShapeAccount
          state={account.state}
          error={account.error}
          refresh={account.refresh}
          beforeNavigate={async () => {
            await session.flush();
          }}
          onClose={() => setAccountOpen(false)}
        />
      )}
      {documentWorkspace.current &&
        [...documentWorkspace.current.buffers.values()].map((buffer) => (
          <BufferSync
            key={buffer.session.current.id}
            buffer={buffer}
            accountId={accountId}
            premium={account.state.premium}
            changed={refreshWorkspace}
          />
        ))}
      {workspaceAnnotation && (
        <Modal title="Annotation" onClose={() => setWorkspaceAnnotation(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              try {
                workspaceAnnotation.controller.saveAnnotation(
                  workspaceAnnotation.target,
                  workspaceAnnotationText,
                );
                setWorkspaceAnnotation(null);
              } catch (error) {
                report(error);
              }
            }}
          >
            <textarea
              aria-label="Annotation"
              value={workspaceAnnotationText}
              readOnly={!workspaceAnnotation.target.canEdit}
              onChange={(e) => setWorkspaceAnnotationText(e.target.value)}
            />
            {workspaceAnnotation.target.canEdit && (
              <>
                {workspaceAnnotation.target.noteId && (
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        workspaceAnnotation.controller.saveAnnotation(
                          workspaceAnnotation.target,
                          null,
                        );
                        setWorkspaceAnnotation(null);
                      } catch (error) {
                        report(error);
                      }
                    }}
                  >
                    Delete annotation
                  </button>
                )}
                <button type="submit">Save annotation</button>
              </>
            )}
          </form>
        </Modal>
      )}
      {dialog === "new" && (
        <Modal title="New document" onClose={() => setDialog(null)}>
          <p>Choose the form for your next piece of writing.</p>
          <div className="new-document-options">
            <button onClick={() => void run(() => newDocument("screenplay"))}>
              <strong>Screenplay</strong>
              <small>Scenes, dialogue and Fountain files.</small>
            </button>
            <button onClick={() => void run(() => newDocument("novel"))}>
              <strong>Novel</strong>
              <small>
                Books, fiction or nonfiction. Chapters and prose, saved as
                Markdown.
              </small>
            </button>
          </div>
        </Modal>
      )}
      {dialog === "export" &&
        (novel ? (
          <NovelExportDialog
            busy={busy}
            onClose={() => setDialog(null)}
            onExport={(format) =>
              void run(async () => {
                const snap = session.capture();
                const { exportNovel } = await import("./core/novelExport");
                const result = await exportNovel(snap.screenplay, format);
                downloadFile(
                  result.blob,
                  snap.name.replace(/\.[^.]+$/, "") + "." + format,
                );
                if (result.warnings.length) tell(result.warnings.join(" "));
                setDialog(null);
              })
            }
          />
        ) : (
          <ExportDialog
            freeOnly={isWriteShapeFree}
            onUpgrade={() => {
              setDialog(null);
              setPlansOpen(true);
            }}
            names={insights.characters.map((person) => person.name)}
            busy={busy}
            onExport={(selection) => void run(() => exportSelection(selection))}
            onClose={() => setDialog(null)}
          />
        ))}
      {dialog === "pdf" && (
        <Modal
          title="PDF pages"
          className="pdf-preview-dialog"
          onClose={() => setDialog(null)}
        >
          <div
            className={`pdf-view${downloadOnlyPdf ? " pdf-mobile-view" : ""}`}
          >
            <div className="pdf-toolbar">
              {!downloadOnlyPdf && (
                <span>
                  {pdfWorking || !exact
                    ? "Preparing your pages…"
                    : pdfPages
                      ? `${pdfPages.pages} published pages`
                      : "PDF preview"}
                </span>
              )}
              {pdfUrl && exact ? (
                <a
                  className="pdf-download"
                  href={pdfUrl}
                  download={`${snapshot?.name.replace(/\.[^.]+$/, "") || "Screenplay"}.pdf`}
                  target="_blank"
                  rel="noopener"
                >
                  <Download size={18} />
                  Download PDF
                </a>
              ) : (
                <button disabled>
                  <Download size={18} />
                  Preparing PDF…
                </button>
              )}
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
            ) : downloadOnlyPdf ? null : pdfUrl && exact ? (
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
      {dialog === "characters" && !isWriteShapeFree && (
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
        <Modal
          title={novel ? "Name your document" : "Name your screenplay"}
          onClose={() => setDialog(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const name = rename.trim();
              if (name) {
                session.rename(documentFilename(name, snapshot.name));
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
          {deviceDrafts}
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
                        h.name.replace(/\.(fountain|md|markdown|txt)$/i, "") +
                          (h.screenplay.metadata.format === "markdown"
                            ? " restored.md"
                            : " restored.fountain"),
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
      {cloudDialog && isWriteShape && (
        <Modal title="Cloud storage" onClose={() => setCloudDialog(null)}>
          <p>
            WriteShape Free saves locally. Cloud accounts are not available yet.
          </p>
          <button
            onClick={() => {
              setCloudDialog(null);
              setPlansOpen(true);
            }}
          >
            View plans
          </button>
        </Modal>
      )}
      {cloudDialog && !isWriteShape && (
        <CloudDialog
          {...cloudDialog}
          filename={snapshot.name}
          remote={snapshot.remote}
          getContent={() => {
            cloudSaveToken.current = session.token();
            return serializeDocument(session.capture().screenplay);
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
