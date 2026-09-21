import type { Node as ProseMirrorNode } from "prosemirror-model";
import type { Command, EditorState } from "prosemirror-state";
import { closeHistory } from "./history";

export interface DialogueEntry {
  node: ProseMirrorNode;
  pos: number;
  index: number;
}
export interface DialogueSpeech {
  cue: DialogueEntry;
  entries: DialogueEntry[];
  end: number;
}
export interface DialoguePair {
  left: DialogueSpeech;
  right: DialogueSpeech;
}
const bodyKinds = new Set(["dialogue", "parenthetical", "lyrics", "note", "boneyard"]);

/** Keep the flat, portable screenplay schema. These are derived groups, not new nodes. */
export function dialogueStructure(doc: ProseMirrorNode) {
  const entries: DialogueEntry[] = [];
  doc.forEach((node, pos, index) => entries.push({ node, pos, index }));
  const speeches: DialogueSpeech[] = [];
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].node.attrs.kind !== "character") continue;
    const start = i;
    while (i + 1 < entries.length && bodyKinds.has(entries[i + 1].node.attrs.kind)) i++;
    speeches.push({ cue: entries[start], entries: entries.slice(start, i + 1), end: i + 1 });
  }
  const pairs: DialoguePair[] = [];
  for (let i = 0; i + 1 < speeches.length; i++) {
    const left = speeches[i];
    const right = speeches[i + 1];
    if (left.end === right.cue.index && right.cue.node.attrs.dual) {
      pairs.push({ left, right });
      i++;
    }
  }
  return { entries, speeches, pairs };
}

export function speechContains(speech: DialogueSpeech, index: number): boolean {
  return index >= speech.cue.index && index < speech.end;
}
export function pairAtSelection(state: EditorState): DialoguePair | undefined {
  const index = state.selection.$from.index(0);
  return dialogueStructure(state.doc).pairs.find(
    ({ left, right }) => speechContains(left, index) || speechContains(right, index),
  );
}

/** Select an existing pair, or pair this speech with an adjacent unpaired speech.
 * Prefer the preceding speech (Fountain convention), falling forward for the first.
 * Never reach across an action, scene heading or page break, or steal another pair.
 */
export function dualDialogueTarget(state: EditorState): DialoguePair | undefined {
  if (!state.selection.$from.depth) return;
  const structure = dialogueStructure(state.doc);
  const first = state.selection.$from.index(0);
  let last = state.selection.$to.index(0);
  if (!state.selection.empty && state.selection.$to.parentOffset === 0) last--;
  const current = structure.speeches.findIndex((speech) => speechContains(speech, first));
  if (current < 0) return;
  const speech = structure.speeches[current];
  const existing = structure.pairs.find(
    (pair) => pair.left === speech || pair.right === speech,
  );
  if (existing) return last < existing.right.end ? existing : undefined;
  const occupied = new Set(structure.pairs.flatMap((pair) => [pair.left, pair.right]));
  const previous = structure.speeches[current - 1];
  const next = structure.speeches[current + 1];
  if (last >= speech.end) {
    return next && speech.end === next.cue.index && last < next.end && !occupied.has(next)
      ? { left: speech, right: next }
      : undefined;
  }
  if (previous && previous.end === speech.cue.index && !occupied.has(previous))
    return { left: previous, right: speech };
  if (next && speech.end === next.cue.index && !occupied.has(next))
    return { left: speech, right: next };
}

export function setDualDialogue(enabled: boolean): Command {
  return (state, dispatch, view) => {
    if (view?.composing) return false;
    const pair = enabled ? dualDialogueTarget(state) : pairAtSelection(state);
    if (!pair) return false;
    if (Boolean(pair.right.cue.node.attrs.dual) === enabled) return true;
    if (dispatch) {
      const tr = closeHistory(state.tr);
      tr.setNodeMarkup(pair.right.cue.pos, undefined, {
        ...pair.right.cue.node.attrs,
        dual: enabled,
      });
      dispatch(tr.scrollIntoView());
      // Keep the layout command separate from the next typed character in local/Yjs history.
      if (view) dispatch(closeHistory(view.state.tr));
    }
    return true;
  };
}
