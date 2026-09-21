import { Plugin, PluginKey } from "prosemirror-state";
import type { EditorState } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import { dialogueStructure } from "./dualDialogue";
import "./dualDialogue.css";

type Structure = ReturnType<typeof dialogueStructure>;
interface Layout {
  structure: Structure;
  decorations: DecorationSet;
  heights: Map<string, number>;
  paired: Set<number>;
}
const layoutKey = new PluginKey<Layout>("dualDialogueLayout");

function layout(state: EditorState, heights: Map<string, number>, structure = dialogueStructure(state.doc)): Layout {
  const decorations: Decoration[] = [];
  const paired = new Set<number>();
  if (!structure.pairs.length)
    return { structure, heights: new Map(), paired, decorations: DecorationSet.empty };
  const starts = new Map(structure.pairs.map((pair) => [pair.left.cue.index, pair]));
  const usedHeights = new Map<string, number>();
  let row = 1;
  for (let index = 0; index < structure.entries.length;) {
    const pair = starts.get(index);
    if (pair) {
      for (const [column, speech] of [[1, pair.left], [2, pair.right]] as const) {
        let offset = 0;
        for (const entry of speech.entries) {
          paired.add(entry.index);
          decorations.push(Decoration.node(entry.pos, entry.pos + entry.node.nodeSize, {
            "data-dual-side": String(column),
            style: `grid-row:${row};grid-column:${column};--dual-offset:${offset}px`,
          }));
          const height = heights.get(entry.node.attrs.id);
          if (height !== undefined) usedHeights.set(entry.node.attrs.id, height);
          // Measurements never become document attributes, undo items or Yjs updates.
          offset += height ?? (entry.node.attrs.kind === "note" ? 0 : 16);
        }
      }
      index = pair.right.end;
    } else {
      const entry = structure.entries[index++];
      decorations.push(Decoration.node(entry.pos, entry.pos + entry.node.nodeSize, {
        style: `grid-row:${row};grid-column:1 / -1`,
      }));
    }
    row++;
  }
  return { structure, heights: usedHeights, paired, decorations: DecorationSet.create(state.doc, decorations) };
}

export function isDualDialogueSelection(state: EditorState): boolean {
  const { $from } = state.selection;
  return Boolean(
    layoutKey.getState(state)?.paired.has($from.index(0)) ||
    ($from.parent.attrs.kind === "character" && $from.parent.attrs.dual),
  );
}

/** All paragraphs remain native ProseMirror nodes in their original order.
 * Each pair shares one grid row. Measured offsets stack each column independently;
 * that row sizes itself to the taller speech, keeping subsequent text below both.
 */
export function dualDialogueLayout(): Plugin<Layout> {
  return new Plugin<Layout>({
    key: layoutKey,
    state: {
      init: (_, state) => layout(state, new Map()),
      apply: (tr, previous, _, state) => {
        const heights = tr.getMeta(layoutKey) as Map<string, number> | undefined;
        if (tr.docChanged) return layout(state, heights ?? previous.heights);
        return heights ? layout(state, heights, previous.structure) : previous;
      },
    },
    props: {
      decorations: (state) => layoutKey.getState(state)?.decorations,
      attributes: (state) => ({
        class: layoutKey.getState(state)?.structure.pairs.length ? "has-dual-dialogue" : "",
      }),
    },
    view: (view) => {
      let destroyed = false;
      let queued = false;
      let observer: ResizeObserver | undefined;
      const observed = new Set<HTMLElement>();
      const measure = () => {
        queued = false;
        if (destroyed || view.composing) return;
        const current = layoutKey.getState(view.state);
        if (!current) return;
        const rootWidth = view.dom.offsetWidth;
        const scale = rootWidth ? view.dom.getBoundingClientRect().width / rootWidth : 1;
        if (!scale) return;
        const heights = new Map<string, number>();
        const targets = new Set<HTMLElement>([view.dom]);
        let changed = false;
        for (const pair of current.structure.pairs) {
          for (const speech of [pair.left, pair.right]) {
            for (const entry of speech.entries) {
              const element = view.nodeDOM(entry.pos);
              if (!(element instanceof HTMLElement)) continue;
              targets.add(element);
              // Ignore zoom transforms; offsets are unscaled CSS pixels. Round upward
              // to hundredths so fractional font metrics cannot overlap a later line.
              const height = Math.ceil(element.getBoundingClientRect().height / scale * 100) / 100;
              heights.set(entry.node.attrs.id, height);
              if (current.heights.get(entry.node.attrs.id) !== height) changed = true;
            }
          }
        }
        // Observe individual paragraphs too: revealing an annotation or changing
        // a font need not resize the root when the opposite column is taller.
        for (const element of observed) {
          if (!targets.has(element)) {
            observer?.unobserve(element);
            observed.delete(element);
          }
        }
        for (const element of targets) {
          if (!observed.has(element)) {
            observer?.observe(element);
            observed.add(element);
          }
        }
        if (changed)
          view.dispatch(view.state.tr.setMeta(layoutKey, heights).setMeta("addToHistory", false));
      };
      const schedule = () => {
        if (queued || destroyed) return;
        queued = true;
        // Finish the current transaction, then measure before the browser paints.
        queueMicrotask(measure);
      };
      observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : undefined;
      observer?.observe(view.dom);
      observed.add(view.dom);
      view.dom.ownerDocument.fonts?.ready.then(schedule);
      view.dom.addEventListener("compositionend", schedule);
      schedule();
      return {
        update: (next, previous) => {
          if (next.state.doc !== previous.doc || !next.state.selection.eq(previous.selection)) schedule();
        },
        destroy: () => {
          destroyed = true;
          observer?.disconnect();
          observed.clear();
          view.dom.removeEventListener("compositionend", schedule);
        },
      };
    },
  });
}
