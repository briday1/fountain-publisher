import type { Node as PMNode } from "prosemirror-model";
import { Plugin, PluginKey, TextSelection } from "prosemirror-state";
import type { EditorState } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { closeHistory } from "prosemirror-history";
import { characterName } from "../core/insights";
import { newId } from "../core/model";

type Cue = { name: string };
type CompletionState = {
  cues: Map<string, Cue>;
  active: number;
  dismissed?: string;
};
const key = new PluginKey<CompletionState>("characterCompletion");
function addCue(cues: Map<string, Cue>, node: PMNode) {
  if (
    node.type.name === "screenplayBlock" &&
    node.attrs.kind === "character" &&
    node.textContent.trim()
  )
    cues.set(node.attrs.id, { name: characterName(node.textContent) });
}
function options(state: EditorState) {
  const { selection } = state;
  const { $from } = selection;
  if (
    !selection.empty ||
    !$from.depth ||
    $from.parentOffset !== $from.parent.content.size
  )
    return;
  const node = $from.parent;
  const text = node.textContent;
  if (
    !["character", "action"].includes(node.attrs.kind) ||
    !text.trim() ||
    /[\n()]/.test(text) ||
    text.length > 60
  )
    return;
  if (node.attrs.kind === "action" && text !== text.toLocaleUpperCase()) return;
  const snapshot = key.getState(state)!;
  const identity = `${node.attrs.id}:${text}:${selection.from}`;
  if (snapshot.dismissed === identity) return;
  const prefix = text.trim().toLocaleUpperCase();
  const names = [
    ...new Set(
      [...snapshot.cues]
        .filter(([id]) => id !== node.attrs.id)
        .map(([, cue]) => cue.name),
    ),
  ]
    .filter(
      (name) =>
        name.startsWith(prefix) &&
        (name !== prefix || node.attrs.kind !== "character"),
    )
    .sort((a, b) => a.localeCompare(b));
  if (!names.length) return;
  return {
    names,
    identity,
    active: Math.min(snapshot.active, names.length - 1),
  };
}
function accept(view: EditorView, name: string) {
  if (view.composing) return;
  const { state } = view;
  const { $from } = state.selection;
  const start = $from.start();
  const tr = closeHistory(state.tr).insertText(name, start, $from.end());
  tr.setNodeMarkup($from.before(), undefined, {
    ...$from.parent.attrs,
    kind: "character",
    manual: true,
    automatic: false,
  });
  tr.setSelection(TextSelection.create(tr.doc, start + name.length));
  view.dispatch(tr.scrollIntoView());
  view.dispatch(closeHistory(view.state.tr));
  view.focus();
}

/** Incremental cue index: ordinary input inspects only changed paragraphs. */
export function characterCompletion(): Plugin<CompletionState> {
  let render: (() => void) | undefined;
  let hide: (() => void) | undefined;
  return new Plugin<CompletionState>({
    key,
    state: {
      init: (_, state) => {
        const cues = new Map<string, Cue>();
        state.doc.forEach((node) => addCue(cues, node));
        return { cues, active: 0 };
      },
      apply: (tr, previous) => {
        let cues = previous.cues;
        if (tr.docChanged) {
          const writable = () => {
            if (cues === previous.cues) cues = new Map(cues);
            return cues;
          };
          tr.mapping.maps.forEach((map, index) =>
            map.forEach((oldStart, oldEnd, start, end) => {
              const before = tr.docs[index];
              const after = tr.docs[index + 1] ?? tr.doc;
              const visit = (
                doc: PMNode,
                from: number,
                to: number,
                fn: (node: PMNode) => void,
              ) => {
                const left = Math.max(0, from - 1),
                  right = Math.min(doc.content.size, to + 1);
                if (left < right)
                  doc.nodesBetween(left, right, (node) => {
                    fn(node);
                    return false;
                  });
              };
              visit(before, oldStart, oldEnd, (node) => {
                if (cues.has(node.attrs.id)) writable().delete(node.attrs.id);
              });
              visit(after, start, end, (node) => {
                if (node.attrs.kind === "character") addCue(writable(), node);
              });
            }),
          );
        }
        const meta = tr.getMeta(key) as Partial<CompletionState> | undefined;
        return {
          cues,
          active: tr.docChanged ? 0 : previous.active,
          dismissed: previous.dismissed,
          ...meta,
        };
      },
    },
    props: {
      handleKeyDown: (view, event) => {
        if (
          view.composing ||
          event.isComposing ||
          event.ctrlKey ||
          event.metaKey ||
          event.altKey
        )
          return false;
        const choice = options(view.state);
        if (!choice) return false;
        if (event.key === "Tab" && !event.shiftKey) {
          accept(view, choice.names[choice.active]);
          return true;
        }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          const active =
            (choice.active +
              (event.key === "ArrowDown" ? 1 : choice.names.length - 1)) %
            choice.names.length;
          view.dispatch(view.state.tr.setMeta(key, { active }));
          return true;
        }
        if (event.key === "Escape") {
          event.stopPropagation();
          view.dispatch(
            view.state.tr.setMeta(key, { dismissed: choice.identity }),
          );
          return true;
        }
        return false;
      },
      handleDOMEvents: {
        focus: () => {
          queueMicrotask(() => render?.());
          return false;
        },
        blur: () => {
          hide?.();
          return false;
        },
        compositionstart: () => {
          hide?.();
          return false;
        },
      },
    },
    view: (view) => {
      const panel = document.createElement("div");
      const listId = `character-completions-${newId()}`;
      panel.id = listId;
      panel.className = "character-completions";
      panel.setAttribute("role", "listbox");
      panel.setAttribute("aria-label", "Character name suggestions");
      document.body.append(panel);
      hide = () => {
        panel.hidden = true;
        view.dom.removeAttribute("aria-activedescendant");
        view.dom.removeAttribute("aria-controls");
        view.dom.removeAttribute("aria-autocomplete");
      };
      render = () => {
        const choice =
          !view.composing && view.hasFocus() ? options(view.state) : undefined;
        if (!choice) {
          hide?.();
          return;
        }
        panel.replaceChildren();
        // Keep the active option in a small, scroll-free window for large casts.
        const offset = Math.max(0, choice.active - 5);
        choice.names.slice(offset, offset + 6).forEach((name, i) => {
          const button = document.createElement("button");
          const selected = offset + i === choice.active;
          button.type = "button";
          button.tabIndex = -1;
          button.id = `${listId}-${offset + i}`;
          button.setAttribute("role", "option");
          button.setAttribute("aria-selected", String(selected));
          button.textContent = name;
          if (selected) {
            const hint = document.createElement("kbd");
            hint.textContent = "Tab";
            button.append(hint);
          }
          button.onpointerdown = (event) => event.preventDefault();
          button.onclick = () => accept(view, name);
          panel.append(button);
        });
        view.dom.setAttribute("aria-controls", listId);
        view.dom.setAttribute("aria-autocomplete", "list");
        view.dom.setAttribute(
          "aria-activedescendant",
          `${listId}-${choice.active}`,
        );
        panel.hidden = false;
        const caret = view.coordsAtPos(view.state.selection.from);
        panel.style.left = `${Math.max(6, Math.min(caret.left, innerWidth - panel.offsetWidth - 6))}px`;
        panel.style.top = `${caret.bottom + panel.offsetHeight + 8 < innerHeight ? caret.bottom + 4 : Math.max(6, caret.top - panel.offsetHeight - 4)}px`;
      };
      const reposition = () => render?.();
      document.addEventListener("scroll", reposition, true);
      window.addEventListener("resize", reposition);
      render();
      return {
        update: () => render?.(),
        destroy: () => {
          hide?.();
          panel.remove();
          render = undefined;
          hide = undefined;
          document.removeEventListener("scroll", reposition, true);
          window.removeEventListener("resize", reposition);
        },
      };
    },
  });
}
