import { Plugin, PluginKey } from "prosemirror-state";
import type { EditorState } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import type { DialogueStructure } from "./dualDialogue";
import { dialogueStructure } from "./dualDialogue";
import "./dualDialogue.css";

interface Layout {
  structure: DialogueStructure;
  decorations: DecorationSet;
}
const layoutKey = new PluginKey<Layout>("dualDialogueLayout");
let nextLayoutId = 0;

function buildLayout(state: EditorState): Layout {
  const structure = dialogueStructure(state.doc);
  if (!structure.pairs.length) return { structure, decorations: DecorationSet.empty };
  const columns = new Map<number, { row: number; side: "left" | "right" }>();
  const starts = new Map(structure.pairs.map((pair) => [pair.left.cue.index, pair]));
  const decorations: Decoration[] = [];
  let row = 1;
  for (const block of structure.blocks) {
    const pair = starts.get(block.index);
    if (pair) {
      for (const side of ["left", "right"] as const)
        for (const member of pair[side].blocks) columns.set(member.index, { row, side });
      row++;
    }
    const column = columns.get(block.index);
    decorations.push(Decoration.node(block.pos, block.pos + block.node.nodeSize,
      column ? {
        class: `dual-dialogue-block dual-dialogue-${column.side}`,
        "data-dual-side": column.side,
        "data-dual-slot": String(block.index),
        style: `grid-row:${column.row};grid-column:${column.side === "left" ? 1 : 2};`,
      } : {
        style: `grid-row:${row++};grid-column:1 / -1;`,
      },
    ));
  }
  return { structure, decorations: DecorationSet.create(state.doc, decorations) };
}

/** Layout only: all paragraphs remain the same ProseMirror nodes in source order.
 * Each pair shares a grid row; measured offsets allow both columns to flow
 * independently, even with different paragraph counts and wrapping. */
export function dualDialogueLayout(): Plugin<Layout> {
  const id = `dialogue-${++nextLayoutId}`;
  return new Plugin<Layout>({
    key: layoutKey,
    state: {
      init: (_config, state) => buildLayout(state),
      apply: (tr, previous, _old, state) => tr.docChanged ? buildLayout(state) : previous,
    },
    props: {
      decorations: (state) => layoutKey.getState(state)?.decorations,
      attributes: (state): Record<string, string> => layoutKey.getState(state)?.structure.pairs.length
        ? { class: "screenplay-has-dual", "data-dual-layout": id }
        : { "data-dual-layout": id },
    },
    view(initialView) {
      let view = initialView;
      const owner = view.dom.ownerDocument;
      const win = owner.defaultView;
      const sheet = owner.createElement("style");
      sheet.dataset.dualDialogueStyles = id;
      owner.head.append(sheet);
      let destroyed = false;
      let frame: number | undefined;
      let css = "";
      const measure = () => {
        if (destroyed) return;
        const structure = layoutKey.getState(view.state)?.structure;
        if (!structure?.pairs.length) {
          if (css) { css = ""; sheet.textContent = ""; }
          return;
        }
        const line = parseFloat(win?.getComputedStyle(view.dom).lineHeight ?? "") || 16;
        const rules: string[] = [];
        // Complete reads before updating the stylesheet, and never mutate PM's DOM.
        for (const pair of structure.pairs) {
          const before = structure.blocks[pair.left.cue.index - 1];
          const gap = !before || before.node.attrs.kind === "scene" ? 0 : line;
          for (const side of ["left", "right"] as const) {
            let top = gap;
            for (const block of pair[side].blocks) {
              const element = view.nodeDOM(block.pos);
              if (!element || element.nodeType !== 1) continue;
              rules.push(`[data-dual-layout="${id}"] > [data-dual-slot="${block.index}"]{--dual-top:${top}px}`);
              // Layout pixels, not transformed screen pixels: zoom must not compound offsets.
              top += (element as HTMLElement).offsetHeight;
            }
          }
        }
        const next = rules.join("\n");
        if (next !== css) {
          css = next;
          sheet.textContent = next;
        }
      };
      const schedule = () => {
        if (destroyed || frame !== undefined || !win) return;
        frame = win.requestAnimationFrame(() => { frame = undefined; measure(); });
      };
      const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(schedule);
      observer?.observe(view.dom);
      win?.addEventListener("resize", schedule);
      owner.fonts?.addEventListener("loadingdone", schedule);
      void owner.fonts?.ready.then(schedule);
      measure();
      return {
        update(nextView, previousState) {
          view = nextView;
          if (view.state.doc !== previousState.doc) measure();
        },
        destroy() {
          destroyed = true;
          if (frame !== undefined) win?.cancelAnimationFrame(frame);
          observer?.disconnect();
          win?.removeEventListener("resize", schedule);
          owner.fonts?.removeEventListener("loadingdone", schedule);
          sheet.remove();
        },
      };
    },
  });
}
