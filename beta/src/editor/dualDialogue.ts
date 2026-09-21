import type { Node as ProseMirrorNode } from "prosemirror-model";
import type { Command, EditorState, Transaction } from "prosemirror-state";
import { closeHistory } from "./history";

export const speechKinds = new Set(["dialogue", "parenthetical", "lyrics"]);
export interface DialogueBlock {
  node: ProseMirrorNode;
  pos: number;
  index: number;
}
export interface Speech {
  cue: DialogueBlock;
  blocks: DialogueBlock[];
  previous?: Speech;
}
export interface DialoguePair {
  left: Speech;
  right: Speech;
}
export interface DialogueStructure {
  blocks: DialogueBlock[];
  speeches: Speech[];
  pairs: DialoguePair[];
}
const cache = new WeakMap<ProseMirrorNode, DialogueStructure>();

/** A presentation index over the existing flat document, never a second copy of its text. */
export function dialogueStructure(doc: ProseMirrorNode): DialogueStructure {
  const known = cache.get(doc);
  if (known) return known;
  const blocks: DialogueBlock[] = [];
  const speeches: Speech[] = [];
  let current: Speech | undefined;
  doc.forEach((node, pos, index) => {
    const block = { node, pos, index };
    blocks.push(block);
    if (node.attrs.kind === "character") {
      current = { cue: block, blocks: [block], previous: current };
      speeches.push(current);
    } else if (current && (speechKinds.has(node.attrs.kind) || node.attrs.kind === "note")) {
      current.blocks.push(block);
    } else {
      current = undefined;
    }
  });
  const pairs: DialoguePair[] = [];
  const used = new Set<Speech>();
  for (const right of speeches) {
    const left = right.previous;
    if (right.cue.node.attrs.dual && left && !used.has(left)) {
      pairs.push({ left, right });
      used.add(left);
      used.add(right);
    }
  }
  const result = { blocks, speeches, pairs };
  cache.set(doc, result);
  return result;
}

function contains(speech: Speech, pos: number): boolean {
  return speech.blocks.some((block) => pos > block.pos && pos < block.pos + block.node.nodeSize);
}
function speechAt(structure: DialogueStructure, pos: number): Speech | undefined {
  return structure.speeches.find((speech) => contains(speech, pos));
}
export function selectedDialoguePair(state: EditorState): DialoguePair | undefined {
  const structure = dialogueStructure(state.doc);
  const pos = state.selection.$from.pos;
  return structure.pairs.find((pair) => contains(pair.left, pos) || contains(pair.right, pos));
}

/** Prefer the previous speech, or the following one when this is the first cue.
 * Existing pairs stay intact; a scene/action boundary is never crossed. */
export function candidateDialoguePair(state: EditorState): DialoguePair | undefined {
  const structure = dialogueStructure(state.doc);
  const current = speechAt(structure, state.selection.from);
  if (!current) return;
  const existing = selectedDialoguePair(state);
  if (existing) return existing;
  const used = new Set(structure.pairs.flatMap((pair) => [pair.left, pair.right]));
  const last = speechAt(structure, state.selection.to);
  if (last && last !== current) {
    return last.previous === current && !used.has(last)
      ? { left: current, right: last }
      : undefined;
  }
  const previous = current.previous;
  if (previous && !used.has(previous)) return { left: previous, right: current };
  const next = structure.speeches.find((speech) => speech.previous === current);
  if (next && !used.has(next)) return { left: current, right: next };
}

export function setDualDialogue(enabled: boolean): Command {
  return (state, dispatch, view) => {
    if (view?.composing) return false;
    const pair = enabled ? candidateDialoguePair(state) : selectedDialoguePair(state);
    if (!pair) return false;
    const cue = pair.right.cue;
    if (Boolean(cue.node.attrs.dual) === enabled) return true;
    if (dispatch) {
      dispatch(closeHistory(state.tr).setNodeMarkup(cue.pos, undefined, {
        ...cue.node.attrs,
        dual: enabled,
      }).scrollIntoView());
      // The formatting change is one undo event, independent of subsequent typing.
      if (view) view.dispatch(closeHistory(view.state.tr));
    }
    return true;
  };
}

/** Clear the pair when returning selected text to an ordinary element type. */
export function clearSelectedDualDialogue(state: EditorState, tr: Transaction): void {
  const { from, to, empty } = state.selection;
  for (const pair of dialogueStructure(state.doc).pairs) {
    const intersects = [...pair.left.blocks, ...pair.right.blocks].some((block) =>
      empty
        ? contains({ ...pair.left, blocks: [block] }, from)
        : from < block.pos + block.node.nodeSize && to > block.pos,
    );
    if (intersects) {
      const cue = pair.right.cue;
      tr.setNodeMarkup(cue.pos, undefined, { ...cue.node.attrs, dual: false });
    }
  }
}
