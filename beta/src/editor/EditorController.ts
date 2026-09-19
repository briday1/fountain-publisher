import { Fragment, Slice } from "prosemirror-model";
import type { Node as ProseMirrorNode, ResolvedPos } from "prosemirror-model";
import { parseFountain } from "../core/fountain";
import {
  EditorState,
  Plugin,
  PluginKey,
  Selection,
  TextSelection,
} from "prosemirror-state";
import type { Command, Transaction } from "prosemirror-state";
import { Decoration, DecorationSet, EditorView } from "prosemirror-view";
import { baseKeymap, toggleMark } from "prosemirror-commands";
import { history, isHistoryTransaction } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import * as Y from "yjs";
import type { Awareness } from "y-protocols/awareness";
import {
  ySyncPlugin,
  ySyncPluginKey,
  yUndoPlugin,
  yCursorPlugin,
  initProseMirrorDoc,
  defaultDeleteFilter,
} from "y-prosemirror";
import { closeHistory, undo, redo } from "./history";
import {
  readSharedDocument,
  readSharedDetails,
  updateSharedDetails,
  sharedDetails,
  sharedBeats,
  sharedMetadataOrigin,
  refreshSharedRangeAliases,
  resolveSharedRange,
  sharedRangeAt,
  validateSharedDocument,
} from "../collaboration/sharedDocument";
import type { SharedView } from "../collaboration/sharedDocument";
import type {
  BlockKind,
  Beat,
  BeatRange,
  Screenplay,
  ScriptBlock,
  TextMark,
} from "../core/model";
import { newId } from "../core/model";
import {
  blockToNode,
  blocksToDoc,
  docToBlocks,
  freshenPastedIds,
  screenplaySchema,
} from "./schema";
import {
  cycleBlockKind,
  insertLineBreak,
  isCharacterCue,
  isSceneHeading,
  isTransition,
  screenplayEnter,
  selectText,
  setBlockKind,
} from "./commands";
import {
  anchorPosition,
  BeatAnchorStep,
  beatAnchorKey,
  beatAnchorPlugin,
  mapBeatAnchors,
  rangesFromAnchors,
  textAnchor,
  updateBeatAnchors,
} from "./beatAnchors";
import { characterCompletion } from "./characterCompletion";
import { annotationPlugin } from "./annotations";
import type { AnnotationTarget } from "./annotations";
import "./editor.css";

export interface EditorCallbacks {
  onAnnotationState?: (state: "add" | "edit" | "unavailable") => void;
  onAnnotation?: (target: AnnotationTarget) => void;
  /** A dirty signal, never a whole-document snapshot. Use getBlocks on idle/save. */
  onChange?: (remote?: boolean) => void;
  onSelection?: (kind: BlockKind) => void;
}
export interface FindOptions {
  caseSensitive?: boolean;
  backwards?: boolean;
}
export interface FindResult {
  index: number;
  total: number;
}
interface Match {
  from: number;
  to: number;
}
const searchKey = new PluginKey<DecorationSet>("screenplaySearch");
const normalizeKey = new PluginKey("screenplayNormalize");
const navigationKey = new PluginKey<DecorationSet>("screenplayNavigation");
export interface EditorCollaboration {
  doc: Y.Doc;
  awareness: Awareness;
  canEdit: boolean;
  onMetadata?: () => void;
}
interface LiveBinding extends EditorCollaboration {
  undoManager: Y.UndoManager;
  beforeRemoteTransaction: (transaction: Y.Transaction) => void;
  metadataObserver: (
    events: Y.YEvent<Y.AbstractType<unknown>>[],
    transaction: Y.Transaction,
  ) => void;
}

/** Native selectionchange may arrive after the next keydown, especially after
 * a click or arrow movement. Commands must use the caret the writer can see. */
function pendingNativeSelection(view: EditorView): Selection | undefined {
  const selection = view.dom.ownerDocument.getSelection();
  if (
    !view.hasFocus() ||
    !selection?.anchorNode ||
    !selection.focusNode ||
    !view.dom.contains(selection.anchorNode) ||
    !view.dom.contains(selection.focusNode)
  )
    return;
  const anchor = view.posAtDOM(selection.anchorNode, selection.anchorOffset);
  const head = view.posAtDOM(selection.focusNode, selection.focusOffset);
  if (
    anchor === view.state.selection.anchor &&
    head === view.state.selection.head
  )
    return;
  return TextSelection.between(
    view.state.doc.resolve(anchor),
    view.state.doc.resolve(head),
  );
}
function syncNativeSelection(view: EditorView) {
  const next = pendingNativeSelection(view);
  if (next) view.dispatch(view.state.tr.setSelection(next));
}

const fountainBlockPastes = new WeakSet<ProseMirrorNode>();

/** Use the import parser for Fountain, retaining ordinary inline paste behavior. */
function fountainClipboardSlice(
  text: string,
  context: ResolvedPos,
): Slice | null {
  // A pasted title stays visible in the body; pasting must not replace document metadata.
  const blocks = parseFountain(text, { titlePage: false }).blocks;
  const structured =
    blocks.some((block) => block.kind !== "action") || /^!/m.test(text);
  if (!structured && !blocks.some((block) => block.spans?.length)) return null;
  const inline = !structured && !/[\r\n]/.test(text);
  const nodes = blocks.map((block) =>
    blockToNode({
      ...block,
      id: newId(),
      ...(inline ? { kind: context.parent.attrs.kind as BlockKind } : {}),
    }),
  );
  if (!inline) nodes.forEach((node) => fountainBlockPastes.add(node));
  return new Slice(Fragment.from(nodes), inline ? 1 : 0, inline ? 1 : 0);
}

/** All editing state belongs to ProseMirror. React mounts one persistent surface. */
export class EditorController {
  readonly view: EditorView;
  private callbacks: EditorCallbacks;
  private destroyed = false;
  private compositionTimer?: ReturnType<typeof setTimeout>;
  private hardwareInputTimer?: ReturnType<typeof setTimeout>;
  private hardwareInputType?: string;
  private selectedKind?: BlockKind;
  private live?: LiveBinding;
  private metadataNotification = false;
  get isComposing(): boolean {
    return this.view.composing;
  }
  get isCollaborating(): boolean {
    return Boolean(this.live);
  }
  private get writable(): boolean {
    return !this.live || this.live.canEdit;
  }
  private sharedView(): SharedView {
    return {
      doc: this.view.state.doc,
      mapping: ySyncPluginKey.getState(this.view.state).binding.mapping,
    };
  }

  constructor(
    host: HTMLElement,
    screenplay: Screenplay,
    callbacks: EditorCallbacks = {},
  ) {
    this.callbacks = callbacks;
    this.view = new EditorView(host, {
      state: this.createState(screenplay),
      editable: () => this.writable,
      attributes: {
        class: "screenplay-editor",
        role: "textbox",
        "aria-label": "Screenplay editor",
        "aria-multiline": "true",
        spellcheck: "true",
        autocorrect: "on",
        autocapitalize: "sentences",
      },
      dispatchTransaction: (transaction) => this.dispatch(transaction),
      handleDOMEvents: {
        keydown: (view, event) => {
          const key = event as KeyboardEvent;
          if (key.isComposing || view.composing) return true;
          syncNativeSelection(view);
          // Handle Enter before ProseMirror's iOS DOM handler schedules its
          // 200ms fallback. Otherwise beforeinput inserts once and the pending
          // fallback runs the keymap again. Keep using the existing keymaps so
          // Shift-Enter, completion, and the native-input deduplication agree.
          if (
            this.writable &&
            key.key === "Enter" &&
            view.someProp("handleKeyDown", (handler) => handler(view, key))
          ) {
            key.preventDefault();
            return true;
          }
          if (
            !key.shiftKey &&
            !key.altKey &&
            !key.ctrlKey &&
            !key.metaKey &&
            (key.key === "ArrowLeft" || key.key === "ArrowRight") &&
            !view.state.selection.empty
          ) {
            // Collapse in the same key event. Leaving this to the browser opens
            // a window where a presence redraw can restore the old selection
            // before its delayed selectionchange event reaches ProseMirror.
            const forward = key.key === "ArrowRight";
            const boundary = forward
              ? view.state.selection.to
              : view.state.selection.from;
            const next = Selection.near(
              view.state.doc.resolve(boundary),
              forward ? -1 : 1,
            );
            key.preventDefault();
            view.dispatch(view.state.tr.setSelection(next).scrollIntoView());
            return true;
          }
          return false;
        },
        beforeinput: (view, event) => {
          const input = event as InputEvent;
          if (
            !this.writable ||
            input.isComposing ||
            view.composing ||
            !input.cancelable
          )
            return false;
          // Native text insertion (mobile, dictation, insertText) may not have a
          // keydown. Read the visible caret before any command or DOM insertion.
          syncNativeSelection(view);
          if (this.hardwareInputType === input.inputType) {
            clearTimeout(this.hardwareInputTimer);
            this.hardwareInputType = undefined;
            input.preventDefault();
            return true;
          }
          const command = (
            {
              insertParagraph: screenplayEnter,
              insertLineBreak,
              historyUndo: undo,
              historyRedo: redo,
              formatBold: toggleMark(screenplaySchema.marks.bold),
              formatItalic: toggleMark(screenplaySchema.marks.italic),
              formatUnderline: toggleMark(screenplaySchema.marks.underline),
            } as Record<string, Command>
          )[input.inputType];
          if (!command) return false;
          // Mobile keyboards and accessibility input need not emit keydown.
          // Route their paragraph, format, and history actions through the same state.
          input.preventDefault();
          command(view.state, view.dispatch, view);
          return true;
        },
        compositionend: () => {
          clearTimeout(this.compositionTimer);
          this.compositionTimer = setTimeout(() => {
            if (!this.destroyed && !this.view.composing)
              this.view.dispatch(
                this.view.state.tr.setMeta(normalizeKey, true),
              );
          }, 30);
          return false;
        },
      },
      transformPasted: (slice, view) => {
        const usedIds = new Set<string>();
        const { from, to } = view.state.selection;
        view.state.doc.forEach((node, pos) => {
          if (pos < from || pos + node.nodeSize > to)
            usedIds.add(node.attrs.id);
        });
        // Copy creates fresh IDs; cut/paste keeps scene and beat links when the
        // original paragraphs have been removed from the document.
        // ProseMirror opens external clipboard slices after parsing. Restore
        // complete Fountain blocks so a scene cannot merge into surrounding prose.
        const fountainBlocks =
          slice.content.firstChild &&
          fountainBlockPastes.has(slice.content.firstChild);
        return new Slice(
          freshenPastedIds(slice.content, usedIds),
          fountainBlocks ? 0 : slice.openStart,
          fountainBlocks ? 0 : slice.openEnd,
        );
      },
      handlePaste: (view, event) => {
        const text = event.clipboardData?.getData("text/plain");
        const html = event.clipboardData?.getData("text/html") || "";
        // Native editor copies carry their own block types, marks, and identity.
        if (!text || /data-pm-slice=/.test(html)) return false;
        const slice = fountainClipboardSlice(text, view.state.selection.$from);
        if (!slice) return false;
        view.dispatch(
          view.state.tr
            .replaceSelection(slice)
            .scrollIntoView()
            .setMeta("paste", true)
            .setMeta("uiEvent", "paste"),
        );
        return true;
      },
      clipboardTextParser: (text, $context) => {
        const fountain = fountainClipboardSlice(text, $context);
        if (fountain) return fountain;
        // A single-line paste stays in its current paragraph. Multiple lines retain
        // their paragraph boundaries and receive screenplay styling immediately.
        let previous = ($context.parent.attrs.kind as BlockKind) || "action";
        const lines = text.replace(/\r\n?/g, "\n").split("\n");
        const blocks = lines.map((line, index) => {
          let kind: BlockKind = index === 0 ? previous : "action";
          if (isSceneHeading(line)) kind = "scene";
          else if (isTransition(line)) kind = "transition";
          else if (
            line.trim() &&
            isCharacterCue(line) &&
            lines[index + 1]?.trim()
          )
            kind = "character";
          else if (
            line.trim().startsWith("(") &&
            ["character", "dialogue", "parenthetical"].includes(previous)
          )
            kind = "parenthetical";
          else if (
            line.trim() &&
            ["character", "parenthetical", "dialogue"].includes(previous)
          )
            kind = "dialogue";
          previous = line.trim() ? kind : "action";
          return blockToNode({ id: newId(), kind, text: line });
        });
        return new Slice(Fragment.from(blocks), 1, 1);
      },
      clipboardTextSerializer: (slice) =>
        slice.content.textBetween(0, slice.content.size, "\n"),
    });
    this.notifySelection();
  }

  private createState(screenplay: Screenplay): EditorState {
    const hardwareCommand =
      (inputType: string, command: Command): Command =>
      (state, dispatch, view) => {
        const handled = command(state, dispatch, view);
        if (handled && dispatch) {
          clearTimeout(this.hardwareInputTimer);
          this.hardwareInputType = inputType;
          this.hardwareInputTimer = setTimeout(() => {
            this.hardwareInputType = undefined;
          }, 250);
        }
        return handled;
      };
    const normalize = new Plugin({
      key: normalizeKey,
      appendTransaction: (transactions, _previous, state) => {
        if (
          this.view?.composing ||
          !this.writable ||
          transactions.some(
            (tr) => tr.getMeta(ySyncPluginKey)?.isChangeOrigin,
          ) ||
          !transactions.some((tr) => tr.docChanged || tr.getMeta(normalizeKey))
        )
          return null;
        const { $from } = state.selection;
        if (!$from.depth || !$from.parent.isTextblock) return null;
        const block = $from.parent;
        const attrs = block.attrs;
        // Inspect only the paragraph being edited, including during large scripts.
        let kind = attrs.kind as BlockKind;
        let automatic = attrs.automatic as boolean;
        let autoFrom = attrs.autoFrom as BlockKind;
        if (!attrs.manual) {
          const text = block.textContent;
          if (kind === "action") {
            const detected = isSceneHeading(text)
              ? "scene"
              : isTransition(text)
                ? "transition"
                : null;
            if (detected) {
              autoFrom = kind;
              kind = detected;
              automatic = true;
            }
          } else if (kind === "dialogue" && text.trimStart().startsWith("(")) {
            autoFrom = kind;
            kind = "parenthetical";
            automatic = true;
          } else if (
            automatic &&
            ((kind === "scene" && !isSceneHeading(text)) ||
              (kind === "transition" && !isTransition(text)) ||
              (kind === "parenthetical" && !text.trimStart().startsWith("(")))
          ) {
            kind = autoFrom;
            automatic = false;
          }
        }
        if (kind === attrs.kind && automatic === attrs.automatic && attrs.id)
          return null;
        return state.tr.setNodeMarkup($from.before(), undefined, {
          ...attrs,
          id: attrs.id || newId(),
          kind,
          automatic,
          autoFrom,
        });
      },
    });
    const shared = this.live
      ? initProseMirrorDoc(
          this.live.doc.getXmlFragment("script"),
          screenplaySchema,
        )
      : undefined;
    return EditorState.create({
      schema: screenplaySchema,
      doc: shared?.doc ?? blocksToDoc(screenplay.blocks),
      plugins: [
        ...(this.live && shared
          ? [
              ySyncPlugin(this.live.doc.getXmlFragment("script"), {
                mapping: shared.mapping,
              }),
              yCursorPlugin(this.live.awareness, {
                cursorBuilder: (user) => {
                  const cursor = document.createElement("span");
                  cursor.className = "collaboration-cursor";
                  cursor.setAttribute("aria-hidden", "true");
                  const color = /^#[0-9a-f]{6}$/i.test(user.color ?? "")
                    ? user.color
                    : "#7762bd";
                  cursor.style.borderColor = color;
                  const label = document.createElement("span");
                  label.textContent = String(user.name || "Writer").slice(
                    0,
                    100,
                  );
                  label.style.backgroundColor = color;
                  cursor.append(label);
                  return cursor;
                },
              }),
              yUndoPlugin({ undoManager: this.live.undoManager }),
            ]
          : []),
        annotationPlugin(
          (id) => this.openAnnotation(id),
          () => this.writable,
        ),
        characterCompletion(),
        beatAnchorPlugin(screenplay),
        ...(!this.live ? [history({ depth: 500, newGroupDelay: 500 })] : []),
        keymap({
          Enter: hardwareCommand("insertParagraph", screenplayEnter),
          "Shift-Enter": hardwareCommand("insertLineBreak", insertLineBreak),
          Tab: cycleBlockKind(),
          "Shift-Tab": cycleBlockKind(true),
          "Mod-z": hardwareCommand("historyUndo", undo),
          "Mod-Shift-z": hardwareCommand("historyRedo", redo),
          "Mod-y": hardwareCommand("historyRedo", redo),
          "Mod-b": hardwareCommand(
            "formatBold",
            toggleMark(screenplaySchema.marks.bold),
          ),
          "Mod-i": hardwareCommand(
            "formatItalic",
            toggleMark(screenplaySchema.marks.italic),
          ),
          "Mod-u": hardwareCommand(
            "formatUnderline",
            toggleMark(screenplaySchema.marks.underline),
          ),
          "Mod-1": setBlockKind("scene"),
          "Mod-2": setBlockKind("action"),
          "Mod-3": setBlockKind("character"),
          "Mod-4": setBlockKind("dialogue"),
          "Mod-5": setBlockKind("parenthetical"),
          "Mod-6": setBlockKind("transition"),
          // Escape provides a standard keyboard exit from the Tab-formatting surface.
          Escape: () => {
            this.view.dom.blur();
            return true;
          },
        }),
        keymap(baseKeymap),
        normalize,
        new Plugin<DecorationSet>({
          key: navigationKey,
          state: {
            init: () => DecorationSet.empty,
            apply: (tr, value) =>
              tr.getMeta(navigationKey) ??
              ((tr.docChanged && !tr.getMeta(ySyncPluginKey)?.isChangeOrigin) ||
              (tr.selectionSet && !tr.getMeta(ySyncPluginKey)?.isChangeOrigin)
                ? DecorationSet.empty
                : value.map(tr.mapping, tr.doc)),
          },
          props: { decorations: (state) => navigationKey.getState(state) },
        }),
        new Plugin<DecorationSet>({
          key: searchKey,
          state: {
            init: () => DecorationSet.empty,
            apply: (tr, decorations) =>
              tr.getMeta(searchKey) ??
              (tr.docChanged
                ? DecorationSet.empty
                : decorations.map(tr.mapping, tr.doc)),
          },
          props: { decorations: (state) => searchKey.getState(state) },
        }),
      ],
    });
  }

  private dispatch(transaction: Transaction): void {
    if (this.destroyed) return;
    if (
      this.live &&
      !this.view.composing &&
      !transaction.docChanged &&
      !transaction.selectionSet
    ) {
      // A presence redraw must not restore an old broad selection while the
      // browser's ArrowRight/click selectionchange event is still queued.
      const native = pendingNativeSelection(this.view);
      if (native) transaction.setSelection(native);
    }
    const sharedOrigin =
      transaction.getMeta(ySyncPluginKey)?.isChangeOrigin === true;
    if (transaction.docChanged && !this.writable && !sharedOrigin) return;
    let replacesText = false;
    for (const step of transaction.steps)
      step.getMap().forEach((from, to, newFrom, newTo) => {
        if (to > from && newTo > newFrom) replacesText = true;
      });
    // Native selectionchange can arrive after the DOM input. Inspect the actual
    // replacement step too, so a fast selection replacement starts its own undo event.
    if (
      transaction.docChanged &&
      !this.view.composing &&
      transaction.getMeta("composition") == null &&
      (!this.view.state.selection.empty || replacesText) &&
      !isHistoryTransaction(transaction) &&
      !sharedOrigin
    )
      closeHistory(transaction);
    if (
      !this.live &&
      transaction.docChanged &&
      !isHistoryTransaction(transaction) &&
      !transaction.getMeta("beatAssignments")
    ) {
      const anchors = beatAnchorKey.getState(this.view.state)!;
      const mapped = mapBeatAnchors(anchors, transaction.mapping);
      if (mapped !== anchors)
        transaction.step(new BeatAnchorStep(anchors, mapped));
    }
    const live = this.live;
    if (live && !sharedOrigin && transaction.getMeta("closeWritingHistory"))
      live.undoManager.stopCapturing();
    // Positional mapping is local only. Yjs remote transactions replace the PM fragment,
    // while their shared relative anchors already name the resulting passage.
    const before =
      live && !sharedOrigin && transaction.docChanged
        ? Object.fromEntries(
            [...sharedBeats(live.doc)].map(([id, beat]) => [
              id,
              resolveSharedRange(
                live.doc,
                beat.get("range"),
                this.sharedView(),
              ) ?? null,
            ]),
          )
        : undefined;
    const result = this.view.state.applyTransaction(transaction);
    const commit = () => {
      this.view.updateState(result.state);
      if (live && before) {
        let mapped = before;
        for (const tr of result.transactions)
          mapped = mapBeatAnchors(mapped, tr.mapping) as typeof before;
        const view = this.sharedView();
        for (const [id, expected] of Object.entries(mapped)) {
          if (!before[id]) continue;
          const target = sharedBeats(live.doc).get(id);
          if (!target) continue;
          const actual = resolveSharedRange(
            live.doc,
            target.get("range"),
            view,
          );
          if (!expected) target.set("range", null);
          else if (expected.from !== actual?.from || expected.to !== actual?.to)
            target.set("range", sharedRangeAt(live.doc, view, expected));
        }
      }
    };
    if (live && !sharedOrigin && transaction.docChanged)
      live.doc.transact(commit, ySyncPluginKey);
    else commit();
    if (result.transactions.some((tr) => tr.docChanged))
      this.callbacks.onChange?.(
        sharedOrigin &&
          !transaction.getMeta(ySyncPluginKey)?.isUndoRedoOperation,
      );
    this.notifySelection();
  }

  private annotationState?: string;
  private notifySelection(): void {
    const target = this.annotationAtSelection();
    const annotationState =
      !target || !this.writable
        ? "unavailable"
        : target.noteId
          ? "edit"
          : "add";
    if (annotationState !== this.annotationState) {
      this.annotationState = annotationState;
      this.callbacks.onAnnotationState?.(annotationState);
    }
    const kind = (this.view.state.selection.$from.parent.attrs.kind ||
      "action") as BlockKind;
    if (kind !== this.selectedKind) {
      this.selectedKind = kind;
      this.callbacks.onSelection?.(kind);
    }
  }

  private run(command: Command): boolean {
    if (this.destroyed || this.view.composing || !this.writable) return false;
    const result = command(this.view.state, this.view.dispatch, this.view);
    this.view.focus();
    return result;
  }

  attachCollaboration(options: EditorCollaboration): void {
    if (this.destroyed) return;
    if (this.view.composing)
      throw new Error(
        "Finish the current text composition before joining live writing.",
      );
    validateSharedDocument(options.doc);
    this.detachCollaboration();
    const old = this.view.state;
    const anchor = textAnchor(old.doc, old.selection.anchor);
    const head = textAnchor(old.doc, old.selection.head);
    const undoManager = new Y.UndoManager(
      [options.doc.getXmlFragment("script"), sharedDetails(options.doc)],
      {
        trackedOrigins: new Set([ySyncPluginKey, sharedMetadataOrigin]),
        captureTimeout: 500,
        captureTransaction: (transaction) =>
          transaction.meta.get("addToHistory") !== false,
        deleteFilter: (item) => {
          // If undo preserves a new paragraph because a peer wrote into it, preserve
          // its initial attributes as well; otherwise it becomes an invalid anonymous block.
          if (
            item.parent instanceof Y.XmlElement &&
            item.parent.nodeName === "screenplayBlock" &&
            item.parentSub &&
            !item.left &&
            item.parent.length > 0
          )
            return false;
          return defaultDeleteFilter(item, new Set(["screenplayBlock"]));
        },
      },
    );
    const metadataObserver: LiveBinding["metadataObserver"] = (
      _events,
      transaction,
    ) => {
      if (
        !(transaction.changedParentTypes as Map<unknown, unknown>).has(
          options.doc.getXmlFragment("script"),
        )
      )
        this.callbacks.onChange?.(!transaction.local);
      if (this.metadataNotification) return;
      this.metadataNotification = true;
      queueMicrotask(() => {
        this.metadataNotification = false;
        if (!this.destroyed && this.live?.doc === options.doc)
          options.onMetadata?.();
      });
    };
    const beforeRemoteTransaction = (transaction: Y.Transaction) => {
      if (!transaction.local && !this.destroyed && !this.view.composing)
        syncNativeSelection(this.view);
    };
    this.live = {
      ...options,
      undoManager,
      metadataObserver,
      beforeRemoteTransaction,
    };
    const next = this.createState(readSharedDocument(options.doc));
    const from = anchor && anchorPosition(next.doc, anchor);
    const to = head && anchorPosition(next.doc, head);
    this.view.updateState(
      from !== undefined && to !== undefined
        ? next.apply(
            next.tr.setSelection(TextSelection.create(next.doc, from, to)),
          )
        : next,
    );
    // This runs before the remote CRDT mutates. The selection-only view update
    // also refreshes ySync's relative snapshot, so remote text maps the visible
    // native caret rather than its potentially stale ProseMirror selection.
    options.doc.on("beforeTransaction", beforeRemoteTransaction);
    // Undo recreates deleted Yjs items. Its local redone links are not transmitted,
    // so publish fresh relative IDs for restored anchors before peers resolve them.
    undoManager.on("stack-item-popped", () => {
      if (this.live?.doc !== options.doc) return;
      const view = this.sharedView();
      refreshSharedRangeAliases(options.doc, view);
    });
    sharedDetails(options.doc).observeDeep(metadataObserver);
    this.notifySelection();
  }

  setCollaborationEditable(canEdit: boolean): void {
    if (!this.live || this.live.canEdit === canEdit) return;
    this.live.canEdit = canEdit;
    this.view.setProps({ editable: () => this.writable });
  }

  /** Only opening/leaving a document resets its history; peer updates never call this. */
  detachCollaboration(): Screenplay | undefined {
    const live = this.live;
    if (!live) return;
    const snapshot = readSharedDocument(live.doc, this.sharedView());
    const selection = this.view.state.selection.toJSON();
    live.doc.off("beforeTransaction", live.beforeRemoteTransaction);
    sharedDetails(live.doc).unobserveDeep(live.metadataObserver);
    this.live = undefined;
    const state = this.createState(snapshot);
    this.view.updateState(
      state.apply(
        state.tr.setSelection(Selection.fromJSON(state.doc, selection)),
      ),
    );
    this.notifySelection();
    return snapshot;
  }

  /** Navigation highlights a passage without selecting text that typing could replace. */
  revealRange(range: BeatRange): boolean {
    if (this.destroyed || this.view.composing) return false;
    const { state } = this.view;
    const from = anchorPosition(state.doc, range.start);
    const to = anchorPosition(state.doc, range.end);
    if (from === undefined || to === undefined || from > to) return false;
    const decorations =
      from === to
        ? [
            Decoration.node(
              state.doc.resolve(from).before(),
              state.doc.resolve(from).after(),
              { class: "navigation-highlight" },
            ),
          ]
        : [Decoration.inline(from, to, { class: "navigation-highlight" })];
    this.focus();
    this.view.dispatch(
      selectText(state, from, from).setMeta(
        navigationKey,
        DecorationSet.create(state.doc, decorations),
      ),
    );
    return true;
  }

  annotationAtSelection(): AnnotationTarget | undefined {
    const { $from } = this.view.state.selection;
    if (!$from.depth) return;
    const node = $from.parent;
    if (!node.textContent.trim()) return;
    const next = this.view.state.doc.nodeAt($from.after());
    const note =
      node.attrs.kind === "note"
        ? node
        : next?.attrs.kind === "note"
          ? next
          : undefined;
    return {
      blockId: node.attrs.id,
      noteId: note?.attrs.id,
      text: note?.textContent ?? "",
      canEdit: this.writable,
    };
  }

  annotateSelection(): void {
    const target = this.annotationAtSelection();
    if (target) this.callbacks.onAnnotation?.(target);
  }

  openAnnotation(blockId: string): void {
    const blocks = this.getBlocks();
    const index = blocks.findIndex((block) => block.id === blockId);
    if (index < 0) return;
    const block = blocks[index];
    if (block.kind !== "note" && !block.text.trim()) return;
    const note =
      block.kind === "note"
        ? block
        : blocks[index + 1]?.kind === "note"
          ? blocks[index + 1]
          : undefined;
    this.callbacks.onAnnotation?.({
      blockId,
      noteId: note?.id,
      text: note?.text ?? "",
      canEdit: this.writable,
    });
  }

  saveAnnotation(target: AnnotationTarget, value: string | null): void {
    if (!this.writable) throw new Error("This screenplay is view only.");
    const text = value
      ?.trim()
      .replace(/\s*\n+\s*/g, " ")
      .replaceAll("]]", "] ]");
    if (value !== null && !text) throw new Error("Enter an annotation.");
    let found: { pos: number; node: ProseMirrorNode } | undefined;
    this.view.state.doc.forEach((node, pos) => {
      if (node.attrs.id === (target.noteId ?? target.blockId))
        found = { pos, node };
    });
    if (!found)
      throw new Error(
        "This paragraph or annotation was removed. Close this dialog and choose another paragraph.",
      );
    const { pos, node } = found;
    if (
      target.noteId &&
      (node.attrs.kind !== "note" || node.textContent !== target.text)
    )
      throw new Error("This annotation changed. Reopen it before editing.");
    let tr = closeHistory(this.view.state.tr);
    if (target.noteId) {
      tr =
        value === null
          ? tr.delete(pos, pos + node.nodeSize)
          : tr.replaceWith(
              pos,
              pos + node.nodeSize,
              blockToNode({ id: target.noteId, kind: "note", text: text! }),
            );
    } else if (value !== null) {
      if (!node.textContent.trim())
        throw new Error(
          "This paragraph is empty. Add text before annotating it.",
        );
      tr = tr.insert(
        pos + node.nodeSize,
        blockToNode({ id: newId(), kind: "note", text: text! }),
      );
    } else return;
    this.view.dispatch(tr);
  }

  getBlocks(): ScriptBlock[] {
    return docToBlocks(this.view.state.doc);
  }
  getDocument(base: Screenplay): Screenplay {
    if (this.live) return readSharedDocument(this.live.doc, this.sharedView());
    return {
      ...base,
      blocks: this.getBlocks(),
      metadata: {
        ...base.metadata,
        beats: rangesFromAnchors(
          this.view.state.doc,
          base.metadata.beats,
          beatAnchorKey.getState(this.view.state)!,
        ),
      },
    };
  }

  updateBeatRanges(
    screenplay: Screenplay,
    previous: Beat[],
    previousDocument?: Screenplay,
  ): void {
    if (this.live) {
      if (!this.writable) return;
      const view = this.sharedView();
      const before = previousDocument ?? {
        ...screenplay,
        ...readSharedDetails(this.live.doc, view),
        metadata: {
          ...readSharedDetails(this.live.doc, view).metadata,
          beats: previous,
        },
      };
      this.live.undoManager.stopCapturing();
      updateSharedDetails(this.live.doc, screenplay, before, view);
      this.live.undoManager.stopCapturing();
      return;
    }
    const { state } = this.view;
    const current = beatAnchorKey.getState(state)!;
    const anchors = updateBeatAnchors(state.doc, screenplay, previous, current);
    if (anchors === current) return;
    this.view.dispatch(
      closeHistory(state.tr)
        .step(new BeatAnchorStep(current, anchors))
        .setMeta("beatAssignments", true),
    );
    // A line assignment is one undo event, separate from the next keystroke.
    this.view.dispatch(closeHistory(this.view.state.tr));
  }

  /** Expand a native selection to authored lines; soft wrapping never renumbers them. */
  selectedLines(): BeatRange | undefined {
    const { doc, selection } = this.view.state;
    const first = doc.resolve(Math.max(1, selection.from));
    let last = doc.resolve(Math.min(doc.content.size - 1, selection.to));
    if (!first.depth || !last.depth) return;
    // A selection ending at the next paragraph's start excludes that paragraph.
    if (
      !selection.empty &&
      last.parentOffset === 0 &&
      last.before() > first.before()
    ) {
      const previous = doc.resolve(last.before());
      if (previous.nodeBefore?.isTextblock)
        last = doc.resolve(last.before() - 1);
    }
    const startText = first.parent.textContent;
    const endText = last.parent.textContent;
    const startOffset =
      first.parentOffset === 0
        ? 0
        : startText.lastIndexOf("\n", first.parentOffset - 1) + 1;
    let lastOffset = last.parentOffset;
    if (!selection.empty && lastOffset > 0 && endText[lastOffset - 1] === "\n")
      lastOffset--;
    const endBreak = endText.indexOf("\n", lastOffset);
    const start = textAnchor(doc, first.start() + startOffset);
    const end = textAnchor(
      doc,
      last.start() + (endBreak < 0 ? endText.length : endBreak),
    );
    return start && end ? { start, end } : undefined;
  }

  focusRange(range: BeatRange): boolean {
    const { state } = this.view;
    const from = anchorPosition(state.doc, range.start);
    const to = anchorPosition(state.doc, range.end);
    if (from === undefined || to === undefined || from > to) return false;
    this.focus();
    this.view.dispatch(selectText(state, from, to));
    return true;
  }

  /** Replaces state and history. Call only when switching/opening a document. */
  setDocument(screenplay: Screenplay): void {
    if (this.destroyed) return;
    this.detachCollaboration();
    clearTimeout(this.compositionTimer);
    this.view.updateState(this.createState(screenplay));
    this.selectedKind = undefined;
    this.notifySelection();
  }

  setKind(kind: BlockKind): boolean {
    return this.run(setBlockKind(kind));
  }
  toggleMark(mark: TextMark): boolean {
    return this.run(toggleMark(screenplaySchema.marks[mark]));
  }
  undo(): boolean {
    return this.run(undo);
  }
  redo(): boolean {
    return this.run(redo);
  }
  focus(): void {
    if (!this.destroyed) this.view.focus();
  }

  focusBlock(id: string): boolean {
    let found = -1;
    this.view.state.doc.forEach((node, position) => {
      if (node.attrs.id === id) found = position + 1;
    });
    if (found < 0) return false;
    this.focus();
    this.view.dispatch(selectText(this.view.state, found, found));
    return true;
  }

  insertBlock(kind: BlockKind, text = ""): string {
    const id = newId();
    if (this.view.composing || !this.writable) return "";
    const { state } = this.view;
    const position = state.selection.$to.depth
      ? state.selection.$to.after(1)
      : state.doc.content.size;
    const node = blockToNode({ id, kind, text });
    const tr = closeHistory(state.tr).insert(position, node);
    tr.setSelection(TextSelection.create(tr.doc, position + 1 + text.length));
    this.view.dispatch(tr.scrollIntoView());
    this.focus();
    return id;
  }

  private matches(query: string, options: FindOptions): Match[] {
    if (!query) return [];
    const matches: Match[] = [];
    // Use a literal regular expression so Unicode case folding cannot change
    // offsets (lowercasing an entire string can change its UTF-16 length).
    const pattern = new RegExp(
      query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      options.caseSensitive ? "gu" : "giu",
    );
    this.view.state.doc.forEach((node, pos) => {
      for (const match of node.textContent.matchAll(pattern))
        matches.push({
          from: pos + 1 + match.index,
          to: pos + 1 + match.index + match[0].length,
        });
    });
    return matches;
  }

  find(query: string, options: FindOptions = {}): FindResult {
    const matches = this.matches(query, options);
    const { state } = this.view;
    const decorations = DecorationSet.create(
      state.doc,
      matches.map(({ from, to }) =>
        Decoration.inline(from, to, { class: "search-match" }),
      ),
    );
    if (!matches.length) {
      this.view.dispatch(state.tr.setMeta(searchKey, decorations));
      return { index: 0, total: 0 };
    }
    let index = matches.findIndex((match) => match.from >= state.selection.to);
    if (options.backwards) {
      index = -1;
      for (let candidate = matches.length - 1; candidate >= 0; candidate--) {
        if (matches[candidate].to <= state.selection.from) {
          index = candidate;
          break;
        }
      }
    }
    if (index < 0) index = options.backwards ? matches.length - 1 : 0;
    const match = matches[index];
    this.focus();
    this.view.dispatch(
      selectText(state, match.from, match.to).setMeta(searchKey, decorations),
    );
    this.focus();
    return { index: index + 1, total: matches.length };
  }

  replace(
    query: string,
    replacement: string,
    options: FindOptions = {},
  ): boolean {
    if (!query || this.view.composing || !this.writable) return false;
    const { from, to } = this.view.state.selection;
    const selected = this.matches(query, options).some(
      (match) => match.from === from && match.to === to,
    );
    if (!selected) {
      this.find(query, options);
      return false;
    }
    this.view.dispatch(
      closeHistory(this.view.state.tr)
        .insertText(replacement, from, to)
        .scrollIntoView(),
    );
    this.find(query, options);
    return true;
  }

  replaceAll(
    query: string,
    replacement: string,
    options: FindOptions = {},
  ): number {
    if (this.view.composing || !this.writable) return 0;
    const matches = this.matches(query, options);
    if (!matches.length) return 0;
    const tr = closeHistory(this.view.state.tr);
    for (const match of matches.reverse())
      tr.insertText(replacement, match.from, match.to);
    this.view.dispatch(tr.scrollIntoView());
    this.focus();
    return matches.length;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.detachCollaboration();
    this.destroyed = true;
    clearTimeout(this.compositionTimer);
    clearTimeout(this.hardwareInputTimer);
    this.view.destroy();
  }
}
