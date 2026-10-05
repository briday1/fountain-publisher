import { Plugin, PluginKey, TextSelection } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import { footnotePattern, decodeFootnote } from "../core/footnotes";
export interface FootnoteTarget {
  from: number;
  to: number;
  source: string;
  deleted?: boolean;
}
export const footnoteKey = new PluginKey<FootnoteTarget | null>("bookFootnote");
export function footnotePlugin(
  open: (from: number, to: number, text: string) => void,
) {
  return new Plugin<FootnoteTarget | null>({
    key: footnoteKey,
    state: {
      init: () => null,
      apply(tr, value) {
        if (tr.getMeta(footnoteKey) !== undefined)
          return tr.getMeta(footnoteKey);
        if (!value) return null;
        const from = tr.mapping.mapResult(value.from, 1),
          to = tr.mapping.mapResult(value.to, value.from === value.to ? 1 : -1);
        return {
          ...value,
          from: from.pos,
          to: to.pos,
          deleted: value.deleted || from.deletedAcross || to.deletedAcross,
        };
      },
    },
    props: {
      handleKeyDown(view, event) {
        if (
          !view.state.selection.empty ||
          event.shiftKey ||
          event.ctrlKey ||
          event.metaKey ||
          event.altKey
        )
          return false;
        const backward = event.key === "Backspace" || event.key === "ArrowLeft";
        const forward = event.key === "Delete" || event.key === "ArrowRight";
        if (!backward && !forward) return false;
        const { $from } = view.state.selection;
        for (const m of $from.parent.textContent.matchAll(footnotePattern())) {
          const from = $from.start() + m.index!,
            to = from + m[0].length;
          if (
            (backward && $from.pos > from && $from.pos <= to) ||
            (forward && $from.pos >= from && $from.pos < to)
          ) {
            const tr = view.state.tr;
            if (event.key === "Backspace" || event.key === "Delete") {
              if (!view.editable) return false;
              tr.delete(from, to);
            } else
              tr.setSelection(
                TextSelection.create(tr.doc, backward ? from : to),
              );
            view.dispatch(tr.scrollIntoView());
            return true;
          }
        }
        return false;
      },
      decorations(state) {
        const decorations: Decoration[] = [];
        let number = 0;
        state.doc.forEach((node, pos) => {
          for (const m of node.textContent.matchAll(footnotePattern())) {
            const from = pos + 1 + m.index!,
              to = from + m[0].length,
              n = ++number;
            const text = decodeFootnote(m[1]);
            decorations.push(
              Decoration.inline(from, to, {
                class: "footnote-source",
                "aria-hidden": "true",
              }),
            );
            decorations.push(
              Decoration.widget(
                from,
                () => {
                  const button = document.createElement("button");
                  button.type = "button";
                  button.className = "book-footnote-marker";
                  button.textContent = String(n);
                  button.title = text;
                  button.setAttribute("aria-label", `Footnote ${n}: ${text}`);
                  button.addEventListener("mousedown", (e) =>
                    e.preventDefault(),
                  );
                  button.addEventListener("click", () => open(from, to, text));
                  return button;
                },
                {
                  side: -1,
                  key: `${from}:${to}:${n}:${text}`,
                  stopEvent: () => true,
                },
              ),
            );
          }
        });
        return DecorationSet.create(state.doc, decorations);
      },
    },
  });
}
