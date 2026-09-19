import type { Node as ProseMirrorNode } from "prosemirror-model";
import { Plugin } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

// Track the paragraph before an edit so deleted anchors cannot drift to other text.
function noteAnchors(doc: ProseMirrorNode) {
  const result = new Map<string, string>();
  let anchor: string | undefined;
  doc.forEach((node) => {
    if (node.attrs.kind === "note") {
      if (anchor) result.set(node.attrs.id, anchor);
    } else anchor = node.attrs.id;
  });
  return result;
}

/** Notes remain ordinary Fountain [[notes]] in the document and undo history. */
export function annotationPlugin(
  open: (id: string) => void,
  canEdit: () => boolean,
) {
  return new Plugin({
    appendTransaction(transactions, previous, state) {
      if (!canEdit() || !transactions.some((tr) => tr.docChanged)) return null;
      const before = noteAnchors(previous.doc);
      const after = noteAnchors(state.doc);
      const visible = new Set<string>();
      state.doc.forEach((node) => {
        if (node.attrs.kind !== "note" && node.textContent.trim())
          visible.add(node.attrs.id);
      });
      const removed: { from: number; to: number }[] = [];
      state.doc.forEach((node, pos) => {
        if (node.attrs.kind !== "note") return;
        const anchor = before.get(node.attrs.id);
        if (
          anchor &&
          (!visible.has(anchor) || after.get(node.attrs.id) !== anchor)
        )
          removed.push({ from: pos, to: pos + node.nodeSize });
      });
      if (!removed.length) return null;
      const tr = state.tr;
      for (const range of removed.reverse()) tr.delete(range.from, range.to);
      return tr;
    },
    props: {
      decorations(state) {
        const decorations: Decoration[] = [];
        let anchor: { pos: number; size: number } | undefined;
        let count = 0;
        state.doc.forEach((node, pos) => {
          if (node.attrs.kind !== "note") {
            anchor = { pos, size: node.nodeSize };
            count = 0;
            return;
          }
          if (!anchor) return; // A leading, unattached note remains editable.
          const id = String(node.attrs.id);
          const text = node.textContent;
          const offset = count++;
          decorations.push(
            Decoration.node(anchor.pos, anchor.pos + anchor.size, {
              class: "annotated-block",
            }),
          );
          // Reveal a note reached with the keyboard rather than hiding the caret.
          if (
            state.selection.$from.parent !== node &&
            state.selection.$to.parent !== node
          )
            decorations.push(
              Decoration.node(pos, pos + node.nodeSize, {
                class: "annotation-collapsed",
              }),
            );
          decorations.push(
            Decoration.widget(
              anchor.pos + anchor.size - 1,
              () => {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "annotation-orb";
                button.contentEditable = "false";
                button.style.setProperty("--annotation-offset", String(offset));
                button.title = text;
                button.setAttribute("aria-label", `Edit annotation: ${text}`);
                button.addEventListener("mousedown", (event) =>
                  event.preventDefault(),
                );
                button.addEventListener("click", (event) => {
                  event.preventDefault();
                  open(id);
                });
                return button;
              },
              {
                key: `${id}:${text}:${offset}`,
                side: -1,
                stopEvent: () => true,
              },
            ),
          );
        });
        return DecorationSet.create(state.doc, decorations);
      },
    },
  });
}

export interface AnnotationTarget {
  blockId: string;
  noteId?: string;
  text: string;
  canEdit: boolean;
}
