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
      session.assertCurrent(token);
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
        session.assertCurrent(token);
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
    if (prior || buffer.state)
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
      for (const key of buffer.views) {
        const peer = this.views.get(key);
        if (peer && peer.id !== id)
          peer.controller.receiveSharedState(state, transactions);
      }
    };
    buffer.views.add(id);
    this.views.set(id, view);
    this.panes[pane].tabs.push(id);
    // A session captures one linked view; all view document/history states agree.
    if (!buffer.session.editor) buffer.session.editor = controller;
    if (focus) controller.setSectionFocus(sectionId);
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
    source.tabs = source.tabs.filter((key) => key !== id);
    if (source.selected === id) source.selected = source.tabs[0];
    const target = this.panes[pane];
    target.tabs.splice(index ?? target.tabs.length, 0, id);
    if (pane === 1) this.split = true;
    this.activate(id);
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
      pane.tabs = pane.tabs.filter((key) => key !== id);
      if (pane.selected === id) pane.selected = pane.tabs[0];
    }
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
    if (!view) return;
    view.sectionId = sectionId;
    view.controller.setSectionFocus(sectionId);
    this.options.changed();
  }
  dispose() {
    this.saveLayout();
    this.layoutReady = false;
    for (const b of this.buffers.values())
      void b.session.flush().catch(() => {});
    this.panes = [{ tabs: [] }, { tabs: [] }];
    for (const view of this.views.values()) view.controller.destroy();
    for (const b of this.buffers.values()) b.session.dispose();
    this.views.clear();
    this.buffers.clear();
  }
}
