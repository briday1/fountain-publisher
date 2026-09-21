import type { Node as ProseMirrorNode } from "prosemirror-model";
import { Plugin, PluginKey } from "prosemirror-state";
import type { Command, EditorState } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import { closeHistory } from "./history";
import "./dualDialogue.css";

interface Entry {
  node: ProseMirrorNode;
  pos: number;
  index: number;
}
interface Speech {
  cue: Entry;
  blocks: Entry[];
  segment: number;
}
interface Pair {
  left: Speech;
  right: Speech;
}
interface Structure {
  entries: Entry[];
  speeches: Speech[];
  pairs: Pair[];
}
const speechKinds = new Set(["character", "dialogue", "parenthetical", "lyrics"]);
const structures = new WeakMap<ProseMirrorNode, Structure>();

/** Keep the authored document flat: IDs, selections, annotations and Yjs stay unchanged. */
function structure(doc: ProseMirrorNode): Structure {
  const cached = structures.get(doc);
  if (cached) return cached;
  const entries: Entry[] = [];
  const speeches: Speech[] = [];
  let speech: Speech | undefined;
  let segment = 0;
  doc.forEach((node, pos, index) => {
    const entry = { node, pos, index };
    entries.push(entry);
    const kind = node.attrs.kind as string;
    if (kind === "character") {
      speech = { cue: entry, blocks: [entry], segment };
      speeches.push(speech);
    } else if (speechKinds.has(kind) || kind === "note" || kind === "boneyard") {
      speech?.blocks.push(entry);
    } else {
      speech = undefined;
      segment++;
    }
  });
  const pairs: Pair[] = [];
  for (let i = 0; i + 1 < speeches.length; i++) {
    const left = speeches[i];
    const right = speeches[i + 1];
    if (left.segment === right.segment && right.cue.node.attrs.dual) {
      pairs.push({ left, right });
      i++; // A speech cannot occupy two pairs or create a three-column chain.
    }
  }
  const result = { entries, speeches, pairs };
  structures.set(doc, result);
  return result;
}

/** Resolve a cue OR any line of its speech, rather than retyping the selected text. */
export function dualDialogueAt(state: EditorState):
  | { active: boolean; pair?: Pair }
  | undefined {
  const { $from, $to, empty } = state.selection;
  if (!$from.depth || !speechKinds.has($from.parent.attrs.kind)) return;
  const data = structure(state.doc);
  const from = $from.before(1);
  const current = data.speeches.find((speech) =>
    speech.blocks.some((entry) => entry.pos === from),
  );
  if (!current) return;
  // A range ending at the start of the next paragraph does not include it.
  const end = !empty && $to.depth && $to.parentOffset === 0
    ? Math.max(state.selection.from, $to.before(1) - 1)
    : state.selection.to;
  const resolvedEnd = state.doc.resolve(end);
  const last = resolvedEnd.depth
    ? data.speeches.find((speech) =>
        speech.blocks.some((entry) => entry.pos === resolvedEnd.before(1)),
      )
    : undefined;
  if (!last) return;
  const existing = data.pairs.find((pair) => pair.left === current || pair.right === current);
  if (existing) {
    if (last !== existing.left && last !== existing.right) return;
    return { active: true, pair: existing };
  }
  const paired = new Set(data.pairs.flatMap((pair) => [pair.left, pair.right]));
  const index = data.speeches.indexOf(current);
  const usable = (other: Speech | undefined): other is Speech =>
    !!other && other.segment === current.segment && !paired.has(other);
  if (last !== current) {
    return usable(last) && data.speeches[index + 1] === last
      ? { active: false, pair: { left: current, right: last } }
      : undefined;
  }
  const previous = data.speeches[index - 1];
  const next = data.speeches[index + 1];
  if (usable(previous)) return { active: false, pair: { left: previous, right: current } };
  if (usable(next)) return { active: false, pair: { left: current, right: next } };
  return { active: false };
}

export function setDualDialogue(enabled: boolean): Command {
  return (state, dispatch, view) => {
    if (view?.composing || view?.editable === false) return false;
    const target = dualDialogueAt(state);
    if (!target?.pair || (!enabled && !target.active)) return false;
    if (enabled && target.active) return true;
    if (dispatch) {
      const tr = closeHistory(state.tr);
      const { left, right } = target.pair;
      // Fountain stores one marker, on the second cue, never on the dialogue text.
      if (enabled && left.cue.node.attrs.dual)
        tr.setNodeMarkup(left.cue.pos, undefined, { ...left.cue.node.attrs, dual: false });
      tr.setNodeMarkup(right.cue.pos, undefined, { ...right.cue.node.attrs, dual: enabled });
      dispatch(tr.scrollIntoView());
      if (view) dispatch(closeHistory(view.state.tr));
    }
    return true;
  };
}

interface Layout {
  decorations: DecorationSet;
  pairs: Pair[];
  heights: Map<string, number>;
}
const layoutKey = new PluginKey<Layout>("dualDialogueLayout");

function layout(doc: ProseMirrorNode, heights = new Map<string, number>()): Layout {
  const data = structure(doc);
  if (!data.pairs.length) return { decorations: DecorationSet.empty, pairs: [], heights: new Map() };
  const starts = new Map(data.pairs.map((pair) => [pair.left.cue.index, pair]));
  const decorations: Decoration[] = [];
  let row = 1;
  for (let i = 0; i < data.entries.length; row++) {
    const pair = starts.get(i);
    if (!pair) {
      const entry = data.entries[i++];
      decorations.push(Decoration.node(entry.pos, entry.pos + entry.node.nodeSize, {
        style: `grid-row: ${row};`,
      }));
      continue;
    }
    const leading = i === 0 ? 0 : 1;
    for (const [column, speech] of [["left", pair.left], ["right", pair.right]] as const) {
      let offset = 0;
      for (const entry of speech.blocks) {
        decorations.push(Decoration.node(entry.pos, entry.pos + entry.node.nodeSize, {
          "data-dual-column": column,
          style: `grid-row: ${row}; margin-top: calc(${leading}em + ${offset}px);`,
        }));
        offset += heights.get(String(entry.node.attrs.id)) ?? 16;
      }
    }
    i = pair.right.blocks[pair.right.blocks.length - 1].index + 1;
  }
  return { decorations: DecorationSet.create(doc, decorations), pairs: data.pairs, heights };
}

/** Two independently flowing columns, without replacing or duplicating editable paragraphs.
 * Each pair shares a grid row. Measured offsets stack its paragraphs within each column;
 * the grid itself reserves the taller column's height and positions everything following it.
 * Layout-only transactions never enter document history, exports or collaboration updates.
 */
export function dualDialoguePlugin(): Plugin<Layout> {
  return new Plugin<Layout>({
    key: layoutKey,
    state: {
      init: (_, state) => layout(state.doc),
      apply: (tr, previous) => {
        const heights = tr.getMeta(layoutKey) as Map<string, number> | undefined;
        return tr.docChanged || heights ? layout(tr.doc, heights ?? previous.heights) : previous;
      },
    },
    props: {
      decorations: (state) => layoutKey.getState(state)?.decorations,
      attributes: (state): Record<string, string> => layoutKey.getState(state)?.pairs.length
        ? { class: "has-dual-dialogue" }
        : {},
    },
    view: (view) => {
      const win = view.dom.ownerDocument.defaultView;
      let frame = 0;
      let destroyed = false;
      const schedule = () => {
        if (destroyed || frame || !win?.requestAnimationFrame) return;
        if (!layoutKey.getState(view.state)?.pairs.length) return;
        frame = win.requestAnimationFrame(() => {
          frame = 0;
          if (destroyed || view.composing || !view.dom.getClientRects().length) return;
          const current = layoutKey.getState(view.state);
          if (!current?.pairs.length) return;
          const heights = new Map<string, number>();
          let changed = false;
          for (const pair of current.pairs) {
            for (const entry of [...pair.left.blocks, ...pair.right.blocks]) {
              const element = view.nodeDOM(entry.pos) as HTMLElement | null;
              if (!element || element.nodeType !== 1) continue;
              // offsetHeight is in CSS pixels, including when the screenplay is zoomed.
              const height = element.offsetHeight;
              const id = String(entry.node.attrs.id);
              heights.set(id, height);
              if (current.heights.get(id) !== height) changed = true;
            }
          }
          if (changed)
            view.dispatch(view.state.tr.setMeta(layoutKey, heights).setMeta("addToHistory", false));
        });
      };
      const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(schedule);
      observer?.observe(view.dom);
      win?.addEventListener("resize", schedule);
      void view.dom.ownerDocument.fonts?.ready.then(schedule);
      schedule();
      return {
        update: (_view, previous) => {
          if (previous.doc !== view.state.doc) schedule();
        },
        destroy: () => {
          destroyed = true;
          if (frame) win?.cancelAnimationFrame(frame);
          observer?.disconnect();
          win?.removeEventListener("resize", schedule);
        },
      };
    },
  });
}
