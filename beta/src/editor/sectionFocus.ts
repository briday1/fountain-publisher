import type { Node as PMNode } from "prosemirror-model";
import { Plugin, TextSelection } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

/** Stable block IDs define the section; positions are recomputed after every edit. */
export function sectionBounds(doc: PMNode, id?: string) {
  if (!id) return undefined;
  let start = -1,
    end = doc.content.size,
    level = 0,
    kind = "";
  doc.forEach((node, pos) => {
    if (node.attrs.id === id) {
      start = pos;
      kind = node.attrs.kind;
      level = Number(node.attrs.level) || 1;
    } else if (
      start >= 0 &&
      end === doc.content.size &&
      pos > start &&
      (kind === "section"
        ? node.attrs.kind === "section" &&
          (Number(node.attrs.level) || 1) <= level
        : ["scene", "section"].includes(node.attrs.kind))
    )
      end = pos;
  });
  return start < 0 ? undefined : { from: start, to: end };
}
export function sectionFocusPlugin(focused: () => string | undefined) {
  return new Plugin({
    filterTransaction(tr, state) {
      if (!tr.docChanged) return true;
      const before = sectionBounds(state.doc, focused());
      if (!before) return true;
      const after = sectionBounds(tr.doc, focused());
      if (!after) return false;
      // A focus view may edit only its section, even with native select-all,
      // drag/drop, replace-all, or a selection reaching into hidden nodes.
      return (
        state.doc.content
          .cut(0, before.from)
          .eq(tr.doc.content.cut(0, after.from)) &&
        state.doc.content.cut(before.to).eq(tr.doc.content.cut(after.to))
      );
    },
    appendTransaction(_trs, _old, state) {
      const bounds = sectionBounds(state.doc, focused());
      if (!bounds) return null;
      const from = bounds.from + 1,
        to = bounds.to - 1;
      const anchor = Math.max(from, Math.min(to, state.selection.anchor));
      const head = Math.max(from, Math.min(to, state.selection.head));
      return anchor === state.selection.anchor && head === state.selection.head
        ? null
        : state.tr.setSelection(TextSelection.create(state.doc, anchor, head));
    },
    props: {
      decorations(state) {
        const bounds = sectionBounds(state.doc, focused());
        if (!bounds) return DecorationSet.empty;
        const decorations: Decoration[] = [];
        state.doc.forEach((node, pos) => {
          if (pos < bounds.from || pos >= bounds.to)
            decorations.push(
              Decoration.node(pos, pos + node.nodeSize, {
                style: "display:none",
                contenteditable: "false",
                "aria-hidden": "true",
              }),
            );
        });
        return DecorationSet.create(state.doc, decorations);
      },
      handleKeyDown(view, event) {
        const bounds = sectionBounds(view.state.doc, focused());
        if (
          bounds &&
          (event.metaKey || event.ctrlKey) &&
          event.key.toLowerCase() === "a"
        ) {
          view.dispatch(
            view.state.tr.setSelection(
              TextSelection.create(
                view.state.doc,
                bounds.from + 1,
                bounds.to - 1,
              ),
            ),
          );
          return true;
        }
        return false;
      },
    },
  });
}
