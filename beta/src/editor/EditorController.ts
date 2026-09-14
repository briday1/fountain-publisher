import { Fragment, Slice } from "prosemirror-model";
import {
  EditorState,
  Plugin,
  PluginKey,
  TextSelection,
} from "prosemirror-state";
import type { Command, Transaction } from "prosemirror-state";
import { Decoration, DecorationSet, EditorView } from "prosemirror-view";
import { baseKeymap, toggleMark } from "prosemirror-commands";
import {
  closeHistory,
  history,
  isHistoryTransaction,
  redo,
  undo,
} from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import type {
  BlockKind,
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
import "./editor.css";

export interface EditorCallbacks {
  /** A dirty signal, never a whole-document snapshot. Use getBlocks on idle/save. */
  onChange?: () => void;
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

/** All editing state belongs to ProseMirror. React should mount this once per open document. */
export class EditorController {
  readonly view: EditorView;
  private callbacks: EditorCallbacks;
  private destroyed = false;
  private compositionTimer?: ReturnType<typeof setTimeout>;
  private selectedKind?: BlockKind;

  constructor(
    host: HTMLElement,
    screenplay: Screenplay,
    callbacks: EditorCallbacks = {},
  ) {
    this.callbacks = callbacks;
    this.view = new EditorView(host, {
      state: this.createState(screenplay),
      attributes: {
        class: "screenplay-editor",
        role: "textbox",
        "aria-label": "Screenplay editor",
        "aria-multiline": "true",
        spellcheck: "true",
        autocapitalize: "sentences",
      },
      dispatchTransaction: (transaction) => this.dispatch(transaction),
      handleDOMEvents: {
        beforeinput: (view, event) => {
          const input = event as InputEvent;
          if (input.isComposing || view.composing || !input.cancelable)
            return false;
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
        return new Slice(
          freshenPastedIds(slice.content, usedIds),
          slice.openStart,
          slice.openEnd,
        );
      },
      clipboardTextParser: (text, $context) => {
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
    const normalize = new Plugin({
      key: normalizeKey,
      appendTransaction: (transactions, _previous, state) => {
        if (
          this.view?.composing ||
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
    return EditorState.create({
      schema: screenplaySchema,
      doc: blocksToDoc(screenplay.blocks),
      plugins: [
        history({ depth: 500, newGroupDelay: 500 }),
        keymap({
          Enter: screenplayEnter,
          "Shift-Enter": insertLineBreak,
          Tab: cycleBlockKind(),
          "Shift-Tab": cycleBlockKind(true),
          "Mod-z": undo,
          "Mod-Shift-z": redo,
          "Mod-y": redo,
          "Mod-b": toggleMark(screenplaySchema.marks.bold),
          "Mod-i": toggleMark(screenplaySchema.marks.italic),
          "Mod-u": toggleMark(screenplaySchema.marks.underline),
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
      !isHistoryTransaction(transaction)
    )
      closeHistory(transaction);
    const result = this.view.state.applyTransaction(transaction);
    this.view.updateState(result.state);
    if (result.transactions.some((tr) => tr.docChanged))
      this.callbacks.onChange?.();
    this.notifySelection();
  }

  private notifySelection(): void {
    const kind = (this.view.state.selection.$from.parent.attrs.kind ||
      "action") as BlockKind;
    if (kind !== this.selectedKind) {
      this.selectedKind = kind;
      this.callbacks.onSelection?.(kind);
    }
  }

  private run(command: Command): boolean {
    if (this.destroyed || this.view.composing) return false;
    const result = command(this.view.state, this.view.dispatch, this.view);
    this.view.focus();
    return result;
  }

  getBlocks(): ScriptBlock[] {
    return docToBlocks(this.view.state.doc);
  }
  getDocument(base: Screenplay): Screenplay {
    return { ...base, blocks: this.getBlocks() };
  }

  /** Replaces state and history. Call only when switching/opening a document. */
  setDocument(screenplay: Screenplay): void {
    if (this.destroyed) return;
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
    this.view.dispatch(selectText(this.view.state, found, found));
    this.focus();
    return true;
  }

  insertBlock(kind: BlockKind, text = ""): string {
    const id = newId();
    if (this.view.composing) return "";
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
    if (!query || this.view.composing) return false;
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
    if (this.view.composing) return 0;
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
    this.destroyed = true;
    clearTimeout(this.compositionTimer);
    this.view.destroy();
  }
}
