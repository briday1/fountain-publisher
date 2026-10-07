import { LiveClient, type LiveStatus } from "../collaboration/LiveClient";
import { readSharedDocument } from "../collaboration/sharedDocument";
import { cloud } from "../storage/cloud";
import { serializeDocument } from "./documentFormat";
import { workspace } from "../storage/workspace";
import { type EditorState, Selection, TextSelection } from "prosemirror-state";
import { DocumentSession, type SessionSnapshot } from "./session";
import { newId } from "./model";
import {
  EditorController,
  type EditorCallbacks,
} from "../editor/EditorController";
import type { DestinationSync, DestinationStatus } from "./destinationSync";
import { destinationKey } from "../storage/destinations";
import type { FileHandle } from "../storage/files";

export interface DocumentBuffer {
  live?: LiveClient;
  liveStatus?: LiveStatus;
  joiningLive?: boolean;
  endingLive?: boolean;
  session: DocumentSession;
  snapshot: SessionSnapshot;
  views: Set<string>;
  status: "saving" | "saved" | "error";
  message?: string;
  sync: { current: DestinationSync | undefined };
  syncStatus?: DestinationStatus;
  file?: FileHandle;
  state?: EditorState;
}
export interface DocumentView {
  id: string;
  bufferId: string;
  controller: EditorController;
  host: HTMLDivElement;
  scrollTop: number;
  sectionId?: string;
}
export interface WorkspacePane {
  tabs: string[];
  selected?: string;
}
interface WorkspaceOptions {
  canFocus?(): boolean;
  changed(): void;
  edited?(view: DocumentView): void;
  activated(buffer: DocumentBuffer, view: DocumentView): void;
  selection: NonNullable<EditorCallbacks["onSelection"]>;
  activity: NonNullable<EditorCallbacks["onWritingActivity"]>;
  annotationState: NonNullable<EditorCallbacks["onAnnotationState"]>;
  annotation: NonNullable<EditorCallbacks["onAnnotation"]>;
  error(message: string): void;
}
/** One durable session/save queue per document; views own only caret and scroll. */
export class DocumentWorkspace {
  buffers = new Map<string, DocumentBuffer>();
  views = new Map<string, DocumentView>();
  panes: [WorkspacePane, WorkspacePane] = [{ tabs: [] }, { tabs: [] }];
  activePane: 0 | 1 = 0;
  split = false;
  ratio = 50;
  private layoutReady = false;
  constructor(
    initial: DocumentSession,
    private options: WorkspaceOptions,
  ) {
    this.addBuffer(initial);
    this.addView(initial.current.id, 0);
  }
  notifyChanged() {
    this.options.changed();
  }
  async startLive(bufferId: string, resume = false) {
    const buffer = this.buffers.get(bufferId);
    const destination = buffer?.session.current.destination;
    if (
      !buffer ||
      !destination ||
      destination.provider === "local" ||
      buffer.live ||
      buffer.joiningLive
    )
      return;
    if (
      [...buffer.views].some((id) => this.views.get(id)?.controller.isComposing)
    )
      throw new Error(
        "Finish the current text composition before joining live writing.",
      );
    buffer.joiningLive = true;
    this.options.changed();
    let client: LiveClient | undefined;
    try {
      await buffer.session.flush();
      if (!resume) {
        await buffer.sync.current?.flush();
        if (buffer.sync.current?.dirty)
          throw new Error(
            "Resolve pending saves or conflicts before joining live writing. Your draft is preserved.",
          );
      }
      const currentDestination = buffer.session.current.destination!;
      if (
        !resume &&
        serializeDocument(buffer.session.capture().screenplay) !==
          currentDestination.baseContent
      )
        throw new Error(
          "Save your pending writing before joining live editing. Your draft is preserved.",
        );
      const roomId =
        (destination.provider === "drive" ? "drive_" : "library_") +
        destination.id;
      const joiningToken = buffer.session.token();
      if (resume && !navigator.onLine)
        client = await LiveClient.cached(roomId, destination.accountId || "");
      if (!client) {
        const bootstrap = await cloud.liveBootstrap(roomId);
        if (bootstrap.self.id !== destination.accountId)
          throw new Error(
            "The signed-in account changed. Your draft is preserved.",
          );
        if (
          resume &&
          serializeDocument(buffer.session.capture().screenplay) !==
            bootstrap.content &&
          serializeDocument(buffer.session.capture().screenplay) !==
            currentDestination.baseContent
        )
          throw new Error(
            "Your local draft differs from the live room. Save a copy before joining to preserve both versions.",
          );
        client = await LiveClient.prepare(bootstrap);
      }
      if (
        !this.buffers.has(bufferId) ||
        destinationKey(buffer.session.current.destination) !==
          destinationKey(destination)
      )
        throw new Error("The document changed while joining live writing.");
      buffer.session.assertCurrent(joiningToken);
      buffer.sync.current?.dispose();
      buffer.sync.current = undefined;
      buffer.live = client;
      const bound = client;
      client.onStatus = (status) => {
        if (buffer.live === bound) {
          buffer.liveStatus = status;
          this.options.changed();
        }
      };
      client.onPermission = (canEdit) => {
        for (const id of buffer.views)
          this.views.get(id)?.controller.setCollaborationEditable(canEdit);
      };
      client.isComposing = () =>
        [...buffer.views].some(
          (id) => !!this.views.get(id)?.controller.isComposing,
        );
      client.onSaved = (etag) => {
        if (buffer.live !== bound || !buffer.session.current.destination)
          return;
        buffer.session.setDestination({
          ...buffer.session.current.destination,
          revision: etag,
          baseContent: serializeDocument(readSharedDocument(bound.doc)),
        });
      };
      client.doc.on("update", () => {
        if (buffer.live !== bound) return;
        if (!buffer.views.size)
          buffer.session.current = {
            ...buffer.session.current,
            screenplay: readSharedDocument(bound.doc),
          };
        buffer.session.markChanged();
        this.options.changed();
      });
      for (const id of buffer.views)
        this.attachLiveView(buffer, this.views.get(id)!);
      buffer.session.current = {
        ...buffer.session.current,
        screenplay: readSharedDocument(client.doc),
      };
      buffer.liveStatus = undefined;
      buffer.session.setDestination({
        ...currentDestination,
        live: true,
        livePaused: false,
      });
      await buffer.session.flush();
      client.start();
    } catch (error) {
      if (client && buffer.live === client) this.stopLive(bufferId);
      else client?.destroy();
      throw error;
    } finally {
      buffer.joiningLive = false;
      this.options.changed();
    }
  }
  private attachLiveView(buffer: DocumentBuffer, view: DocumentView) {
    const client = buffer.live!;
    const focused = view.controller.focusedSection;
    view.controller.attachCollaboration({
      doc: client.doc,
      awareness: client.awareness,
      canEdit: client.self.canEdit,
    });
    if (focused && this.options.canFocus?.() !== false)
      view.controller.setSectionFocus(focused);
  }
  async endLive(bufferId: string) {
    const buffer = this.buffers.get(bufferId);
    if (!buffer?.live || buffer.endingLive) return;
    if (
      [...buffer.views].some((id) => this.views.get(id)?.controller.isComposing)
    )
      throw new Error("Finish typing before ending live editing.");
    const client = buffer.live;
    buffer.endingLive = true;
    for (const id of buffer.views)
      this.views.get(id)?.controller.setCollaborationEditable(false);
    this.options.changed();
    try {
      await buffer.session.flush();
      // Do not silently switch back to ordinary autosave with unacknowledged
      // shared edits. A failed checkpoint leaves the live session recoverable.
      if (client.self.canEdit) await client.checkpoint();
      if (buffer.live !== client) return;
      await client.stop();
      if (buffer.live !== client) return;
      buffer.session.capture();
      for (const id of buffer.views)
        this.views.get(id)?.controller.detachCollaboration();
      buffer.state = [...buffer.views]
        .map((id) => this.views.get(id)?.controller.view.state)
        .find(Boolean);
      buffer.live = undefined;
      buffer.liveStatus = undefined;
      const destination = buffer.session.current.destination;
      if (destination)
        buffer.session.setDestination({
          ...destination,
          live: false,
          livePaused: true,
        });
      client.destroy();
      await buffer.session.flush();
    } finally {
      if (buffer.live === client)
        for (const id of buffer.views)
          this.views
            .get(id)
            ?.controller.setCollaborationEditable(client.self.canEdit);
      buffer.endingLive = false;
      this.options.changed();
    }
  }
  stopLive(bufferId: string) {
    const buffer = this.buffers.get(bufferId);
    if (!buffer?.live) return;
    const client = buffer.live;
    buffer.session.capture();
    for (const id of buffer.views)
      this.views.get(id)?.controller.detachCollaboration();
    buffer.live = undefined;
    buffer.liveStatus = undefined;
    void client
      .stop()
      .catch(() => {})
      .finally(() => client.destroy());
    this.options.changed();
  }
  get activeView() {
    return this.views.get(this.panes[this.activePane].selected || "");
  }
  get activeBuffer() {
    const view = this.activeView;
    return view ? this.buffers.get(view.bufferId) : undefined;
  }
  saveLayout() {
    if (!this.layoutReady) return;
    try {
      sessionStorage.setItem(
        "writeshape.documentViews",
        JSON.stringify({
          version: 1,
          panes: this.panes,
          activePane: this.activePane,
          split: this.split,
          ratio: this.ratio,
          views: [...this.views.values()].map((view) => ({
            id: view.id,
            bufferId: view.bufferId,
            sectionId: view.sectionId,
            focus: !!view.controller.focusedSection,
            scrollTop: view.scrollTop,
            selection: view.controller.view.state.selection.toJSON(),
          })),
        }),
      );
    } catch {
      /* Layout is optional; document durability is separate. */
    }
  }
  async restoreLayout() {
    try {
      const raw = sessionStorage.getItem("writeshape.documentViews");
      const layout = raw ? JSON.parse(raw) : null;
      if (
        !layout ||
        layout.version !== 1 ||
        !Array.isArray(layout.views) ||
        !Array.isArray(layout.panes) ||
        layout.panes.length !== 2 ||
        !layout.panes.every((p: any) => p && Array.isArray(p.tabs)) ||
        !layout.views.length ||
        layout.views.length > 100
      )
        return;
      const loaded = new Map();
      for (const id of new Set<string>(
        layout.views
          .map((v: any) => v.bufferId)
          .filter((id: any) => typeof id === "string"),
      )) {
        const saved = await workspace.load(id);
        if (saved) loaded.set(id, saved);
      }
      if (!loaded.size) return;
      for (const view of this.views.values()) view.controller.destroy();
      this.views.clear();
      this.panes = [{ tabs: [] }, { tabs: [] }];
      for (const buffer of this.buffers.values()) {
        buffer.views.clear();
        buffer.session.editor = null;
      }
      for (const [id, saved] of loaded)
        if (!this.buffers.has(id)) this.addBuffer(new DocumentSession(saved));
      const ids = new Map<string, string>();
      for (const pane of [0, 1] as const) {
        for (const oldId of layout.panes[pane].tabs || []) {
          const saved = layout.views.find((v: any) => v.id === oldId);
          if (!saved || !loaded.has(saved.bufferId)) continue;
          const view = this.addView(
            saved.bufferId,
            pane,
            typeof saved.sectionId === "string" ? saved.sectionId : undefined,
            !!saved.focus,
          );
          view.scrollTop = Math.max(0, Number(saved.scrollTop) || 0);
          try {
            const state = view.controller.view.state;
            const selection = Selection.fromJSON(state.doc, saved.selection);
            view.controller.view.dispatch(state.tr.setSelection(selection));
          } catch {
            view.controller.view.dispatch(
              view.controller.view.state.tr.setSelection(
                TextSelection.atStart(view.controller.view.state.doc),
              ),
            );
          }
          ids.set(oldId, view.id);
        }
      }
      for (const pane of [0, 1] as const)
        this.panes[pane].selected =
          ids.get(layout.panes[pane].selected) || this.panes[pane].tabs[0];
      this.split = !!layout.split || this.panes[1].tabs.length > 0;
      this.ratio = Math.max(25, Math.min(75, Number(layout.ratio) || 50));
      this.activePane = layout.activePane === 1 ? 1 : 0;
      const active =
        this.panes[this.activePane].selected ||
        this.panes[1 - this.activePane].selected;
      if (active) this.activate(active);
    } catch {
      /* Invalid/stale layout never prevents opening the saved draft. */
    } finally {
      this.layoutReady = true;
      this.saveLayout();
    }
  }
  private addBuffer(session: DocumentSession) {
    const buffer: DocumentBuffer = {
      session,
      snapshot: session.current,
      views: new Set(),
      status: "saved",
      sync: { current: undefined },
    };
    this.buffers.set(session.current.id, buffer);
    session.onSnapshot = (snapshot) => {
      const destination = snapshot.destination;
      const roomId =
        destination && destination.provider !== "local"
          ? (destination.provider === "drive" ? "drive_" : "library_") +
            destination.id
          : undefined;
      if (
        buffer.live &&
        (buffer.live.fileId !== roomId ||
          buffer.live.accountId !== destination?.accountId)
      )
        this.stopLive(snapshot.id);

      if (
        !buffer.views.size &&
        buffer.snapshot.screenplay.blocks !== snapshot.screenplay.blocks
      )
        buffer.state = undefined;
      buffer.snapshot = snapshot;
      this.options.changed();
    };
    session.onStatus = (status, message) => {
      const changed = buffer.status !== status || buffer.message !== message;
      buffer.status = status;
      buffer.message = message;
      buffer.sync.current?.changed();
      if (changed) this.options.changed();
      if (message) this.options.error(message);
    };
    session.onOpenRequest = async (...args) => {
      const [screenplay, name, remote, saved, destination, validate] = args;
      const pane = this.activePane;
      const token = session.token();
      await session.flush();
      if (!buffer.live) session.assertCurrent(token);
      validate?.();
      const key = destinationKey(destination || saved?.destination);
      let existing = [...this.buffers.values()].find(
        (b) =>
          saved?.id === b.session.current.id ||
          (!!key && destinationKey(b.session.current.destination) === key),
      );
      const target = destination || saved?.destination;
      if (
        !existing &&
        target?.provider === "local" &&
        target.handle?.isSameEntry
      ) {
        for (const candidate of this.buffers.values()) {
          const other = candidate.session.current.destination;
          if (
            other?.provider === "local" &&
            other.handle &&
            (await target.handle.isSameEntry(other.handle))
          ) {
            existing = candidate;
            break;
          }
        }
        if (!buffer.live) session.assertCurrent(token);
        validate?.();
      }
      if (existing) {
        this.addView(existing.session.current.id, pane);
        return;
      }
      const next = new DocumentSession(
        saved || {
          id: newId(),
          name,
          screenplay,
          remote,
          destination,
          epoch: 0,
        },
      );
      this.addBuffer(next);
      this.addView(next.current.id, pane);
      await next.flush();
    };
    session.onForkRequest = async () => {
      const snapshot = session.capture();
      await session.onOpenRequest!(
        snapshot.screenplay,
        snapshot.name.replace(/\.(md|markdown|fountain|txt)$/i, "") +
          " copy" +
          (snapshot.screenplay.metadata.format === "markdown"
            ? ".md"
            : ".fountain"),
      );
    };
    return buffer;
  }
  addView(bufferId: string, pane: 0 | 1, sectionId?: string, focus = false) {
    const buffer = this.buffers.get(bufferId)!;
    const id = newId(),
      host = document.createElement("div");
    host.className = "editor-host";
    const controller = new EditorController(
      host,
      buffer.session.capture().screenplay,
      {
        onChange: () => {
          buffer.session.markChanged();
        },
        onWritingActivity: (words, pasted) =>
          this.options.activity(words, pasted),
        onSelection: (kind, dual) => {
          if (this.activeView?.id === id) this.options.selection(kind, dual);
        },
        onAnnotationState: (state) => {
          if (this.activeView?.id === id) this.options.annotationState(state);
        },
        onAnnotation: (target) => {
          this.activate(id);
          this.options.annotation(target);
        },
      },
    );
    const prior = [...buffer.views]
      .map((key) => this.views.get(key))
      .find(Boolean);
    if (!buffer.live && (prior || buffer.state))
      controller.receiveSharedState(
        prior?.controller.view.state || buffer.state!,
        null,
      );
    buffer.state = controller.view.state;
    const view: DocumentView = {
      id,
      bufferId,
      controller,
      host,
      scrollTop: 0,
      sectionId,
    };
    controller.onSharedUpdate = (state, transactions) => {
      buffer.state = state;
      if (buffer.live) return;
      for (const key of buffer.views) {
        const peer = this.views.get(key);
        if (peer && peer.id !== id)
          peer.controller.receiveSharedState(state, transactions);
      }
    };
    buffer.views.add(id);
    this.views.set(id, view);
    if (buffer.live) this.attachLiveView(buffer, view);
    this.panes[pane].tabs.push(id);
    // A session captures one linked view; all view document/history states agree.
    if (!buffer.session.editor) buffer.session.editor = controller;
    if (focus && this.options.canFocus?.() !== false)
      controller.setSectionFocus(sectionId);
    if (sectionId) controller.focusBlock(sectionId);
    this.activate(id);
    return view;
  }
  activate(id: string) {
    const view = this.views.get(id);
    if (!view) return;
    const pane = this.panes.findIndex((p) => p.tabs.includes(id)) as 0 | 1;
    this.activePane = pane;
    this.panes[pane].selected = id;
    if (pane === 1) this.split = true;
    const buffer = this.buffers.get(view.bufferId)!;
    this.options.activated(buffer, view);
    view.controller.refreshSelection();
    this.options.changed();
  }
  duplicate(id: string, other = false, sectionId?: string, focus = false) {
    const view = this.views.get(id);
    if (!view) return;
    const pane = other ? ((1 - this.activePane) as 0 | 1) : this.activePane;
    if (other) this.split = true;
    return this.addView(view.bufferId, pane, sectionId, focus);
  }
  toggleSplit() {
    if (this.split) {
      const right = this.panes[1];
      this.panes[0].tabs.push(...right.tabs);
      if (this.activePane === 1 && right.selected)
        this.panes[0].selected = right.selected;
      this.panes[1] = { tabs: [] };
      this.activePane = 0;
      this.split = false;
      if (this.panes[0].selected) this.activate(this.panes[0].selected);
    } else {
      this.split = true;
      if (!this.panes[1].tabs.length && this.activeView)
        this.duplicate(this.activeView.id, true);
    }
    this.options.changed();
  }
  swapPanes() {
    if (!this.split) return;
    const active = this.activeView?.id;
    this.panes = [this.panes[1], this.panes[0]];
    this.activePane = (1 - this.activePane) as 0 | 1;
    if (active) this.activate(active);
    else this.options.changed();
  }
  move(id: string, pane: 0 | 1, index?: number) {
    const oldPane = this.panes.findIndex((p) => p.tabs.includes(id));
    if (oldPane < 0) return;
    const source = this.panes[oldPane];
    const oldIndex = source.tabs.indexOf(id);
    source.tabs = source.tabs.filter((key) => key !== id);
    if (source.selected === id)
      source.selected = source.tabs[Math.min(oldIndex, source.tabs.length - 1)];
    const target = this.panes[pane];
    target.tabs.splice(index ?? target.tabs.length, 0, id);
    if (pane === 1) this.split = true;
    this.collapseEmptyPane();
    this.activate(id);
  }
  /** A drop slot is measured before removing the dragged tab. */
  moveToSlot(id: string, pane: 0 | 1, slot: number) {
    const index = this.panes[pane].tabs.indexOf(id);
    this.move(
      id,
      pane,
      Math.max(0, slot - (index >= 0 && index < slot ? 1 : 0)),
    );
  }
  splitWith(id: string, side: "left" | "right" = "right", move = false) {
    if (!this.views.has(id)) return;
    this.activate(id);
    if (this.split) {
      if (move) this.move(id, (1 - this.activePane) as 0 | 1);
      else {
        const view = this.views.get(id)!;
        this.duplicate(
          id,
          true,
          view.sectionId,
          !!view.controller.focusedSection,
        );
      }
      return;
    }
    const view = this.views.get(id)!;
    this.ratio = 50;
    // A lone editor stays visible in the original group when split.
    if (move && this.panes[0].tabs.length > 1) this.move(id, 1);
    else
      this.duplicate(
        id,
        true,
        view.sectionId,
        !!view.controller.focusedSection,
      );
    if (side === "left") this.swapPanes();
  }
  closeTabs(pane: 0 | 1, keep?: string, rightOf?: string) {
    const tabs = [...this.panes[pane].tabs];
    const start = rightOf ? tabs.indexOf(rightOf) + 1 : 0;
    if (rightOf && start === 0) return;
    for (const id of tabs.slice(start)) if (id !== keep) this.close(id);
  }
  resizePanes(ratio: number) {
    this.ratio = Math.max(25, Math.min(75, ratio));
    this.options.changed();
    this.saveLayout();
  }
  private collapseEmptyPane() {
    if (!this.split || (this.panes[0].tabs.length && this.panes[1].tabs.length))
      return;
    const remaining = this.panes[0].tabs.length ? this.panes[0] : this.panes[1];
    this.panes = [remaining, { tabs: [] }];
    this.activePane = 0;
    this.split = false;
  }
  closePane(pane: 0 | 1) {
    if (!this.split) return;
    // Snapshot the IDs: closing the last tab may promote the surviving pane.
    const tabs = [...this.panes[pane].tabs];
    for (const id of tabs) this.close(id);
    this.collapseEmptyPane();
    if (this.activeView) this.activate(this.activeView.id);
    else this.options.changed();
  }
  close(id: string) {
    const view = this.views.get(id);
    if (!view) return;
    const buffer = this.buffers.get(view.bufferId)!;
    // Capture before releasing the last view; the session and draft remain alive.
    buffer.snapshot = buffer.session.capture();
    buffer.state = view.controller.view.state;
    buffer.views.delete(id);
    this.views.delete(id);
    if (buffer.session.editor === view.controller)
      buffer.session.editor =
        this.views.get([...buffer.views][0])?.controller || null;
    view.controller.destroy();
    for (const pane of this.panes) {
      const index = pane.tabs.indexOf(id);
      pane.tabs = pane.tabs.filter((key) => key !== id);
      if (pane.selected === id)
        pane.selected = pane.tabs[Math.min(index, pane.tabs.length - 1)];
    }
    this.collapseEmptyPane();
    const next =
      this.panes[this.activePane].selected ||
      this.panes[1 - this.activePane].selected;
    if (next) this.activate(next);
    else this.options.changed();
    void buffer.session
      .flush()
      .catch((error) => this.options.error(String(error)));
  }
  focusSection(id: string, sectionId?: string) {
    const view = this.views.get(id);
    if (!view || (sectionId && this.options.canFocus?.() === false)) return;
    view.sectionId = sectionId;
    view.controller.setSectionFocus(sectionId);
    this.saveLayout();
    this.options.changed();
  }
  dispose() {
    this.saveLayout();
    this.layoutReady = false;
    for (const b of this.buffers.values())
      void b.session.flush().catch(() => {});
    this.panes = [{ tabs: [] }, { tabs: [] }];
    for (const b of this.buffers.values()) this.stopLive(b.session.current.id);
    for (const view of this.views.values()) view.controller.destroy();
    for (const b of this.buffers.values()) b.session.dispose();
    this.views.clear();
    this.buffers.clear();
  }
}
