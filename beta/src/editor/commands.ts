import type { Command, EditorState, Transaction } from "prosemirror-state";
import { TextSelection } from "prosemirror-state";
import { closeHistory } from "./history";
import type { BlockKind } from "../core/model";
import { newId } from "../core/model";
import { clearSelectedDualDialogue, setDualDialogue, speechKinds } from "./dualDialogue";

export const cycleKinds: BlockKind[] = [
  "action",
  "character",
  "dialogue",
  "parenthetical",
  "transition",
  "scene",
];
export const isSceneHeading = (text: string): boolean =>
  /^(?:INT\.?\/EXT\.?|EXT\.?\/INT\.?|I\/E\.?|INT\.|EXT\.|EST\.)\s/i.test(text);
export const isTransition = (text: string): boolean =>
  /^(?:FADE (?:IN|OUT|TO BLACK)|CUT TO|DISSOLVE TO|SMASH CUT TO|MATCH CUT TO|BACK TO|TIME CUT)(?:[.:]|$)/i.test(
    text.trim(),
  );
export const isCharacterCue = (text: string): boolean => {
  const name = text.trim();
  return (
    name.length > 0 &&
    name.length <= 45 &&
    /[A-ZÀ-Þ]/.test(name) &&
    name === name.toUpperCase() &&
    name.split(/\s+/).length <= 6 &&
    !/[.!?:]$/.test(name) &&
    !isSceneHeading(name) &&
    !isTransition(name)
  );
};

export function setBlockKind(kind: BlockKind, dual = false): Command {
  return (state, dispatch, view) => {
    const currentKind = state.selection.$from.parent.attrs.kind;
    // On existing speech text this is a mode, not a conversion of dialogue to a cue.
    if (dual && (currentKind === "character" || speechKinds.has(currentKind)))
      return setDualDialogue(true)(state, dispatch, view);
    // Retain the explicit low-level operation used when creating a new character cue.
    if (dual && kind !== "character") return false;
    const { from, to, $from } = state.selection;
    const positions: number[] = [];
    if (state.selection.empty && $from.depth) positions.push($from.before(1));
    else
      state.doc.nodesBetween(from, to, (node, pos) => {
        if (node.type.name === "screenplayBlock") {
          positions.push(pos);
          return false;
        }
      });
    if (!positions.length) return false;
    if (dispatch) {
      const tr = closeHistory(state.tr);
      if (!dual) clearSelectedDualDialogue(state, tr);
      for (const pos of positions) {
        const node = tr.doc.nodeAt(pos)!;
        tr.setNodeMarkup(pos, undefined, {
          ...node.attrs,
          kind,
          manual: true,
          automatic: false,
          ...(kind === "scene" ? {} : { sceneNumber: null }),
          dual: kind === "character" ? dual : false,
        });
      }
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

export function cycleBlockKind(backwards = false): Command {
  return (state, dispatch, view) => {
    if (view?.composing) return false;
    const kind = state.selection.$from.parent.attrs.kind as BlockKind;
    const current = cycleKinds.indexOf(kind);
    return setBlockKind(
      cycleKinds[
        (current + (backwards ? -1 : 1) + cycleKinds.length) % cycleKinds.length
      ],
    )(state, dispatch, view);
  };
}

export function screenplayEnter(
  state: EditorState,
  dispatch?: (transaction: Transaction) => void,
  view?: { composing: boolean },
): boolean {
  if (view?.composing) return false;
  if (!dispatch) return true;
  const tr = closeHistory(state.tr).deleteSelection();
  const { $from } = tr.selection;
  if (!$from.depth) return false;
  const node = $from.parent;
  let kind = node.attrs.kind as BlockKind;
  const atEnd = $from.parentOffset === node.content.size;
  if (node.content.size === 0 && kind !== "action") {
    dispatch(
      tr
        .setNodeMarkup($from.before(), undefined, {
          ...node.attrs,
          kind: "action",
          dual: false,
          manual: false,
          automatic: false,
        })
        .scrollIntoView(),
    );
    return true;
  }
  if (atEnd && kind === "action" && !node.attrs.manual) {
    const text = node.textContent;
    const detected: BlockKind = isSceneHeading(text)
      ? "scene"
      : isTransition(text)
        ? "transition"
        : isCharacterCue(text)
          ? "character"
          : "action";
    if (detected !== kind) {
      kind = detected;
      tr.setNodeMarkup($from.before(), undefined, {
        ...node.attrs,
        kind,
        automatic: true,
      });
    }
  }
  const nextKind: BlockKind = atEnd
    ? ((
        {
          character: "dialogue",
          parenthetical: "dialogue",
          transition: "scene",
        } as Partial<Record<BlockKind, BlockKind>>
      )[kind] ?? "action")
    : kind;
  tr.split(tr.selection.from, 1, [
    {
      type: node.type,
      attrs: {
        ...node.attrs,
        id: newId(),
        kind: nextKind,
        sceneNumber: null,
        dual: false,
        manual: !atEnd && node.attrs.manual,
        automatic: false,
      },
    },
  ]);
  tr.setStoredMarks([]);
  dispatch(tr.scrollIntoView());
  return true;
}

export const insertLineBreak: Command = (state, dispatch, view) => {
  if (view?.composing) return false;
  if (dispatch) dispatch(state.tr.insertText("\n").scrollIntoView());
  return true;
};

export function selectText(
  state: EditorState,
  from: number,
  to: number,
): Transaction {
  return state.tr
    .setSelection(TextSelection.create(state.doc, from, to))
    .scrollIntoView();
}
