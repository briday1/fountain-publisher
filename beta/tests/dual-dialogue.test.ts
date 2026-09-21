import { describe, expect, it } from "vitest";
import { EditorState, TextSelection } from "prosemirror-state";
import type { Command } from "prosemirror-state";
import { history, undo, redo } from "prosemirror-history";
import { blocksToDoc, docToBlocks, screenplaySchema } from "../src/editor/schema";
import { setBlockKind, screenplayEnter } from "../src/editor/commands";
import { dualDialogueAt, setDualDialogue } from "../src/editor/dualDialogue";
import { emptyScreenplay } from "../src/core/model";
import type { ScriptBlock } from "../src/core/model";
import { parseFountain, serializeFountain } from "../src/core/fountain";

const source = "MARA\nFirst speech.\n(quietly)\nStill the first speech.\n\nELI\nSecond speech.\n\n!After the conversation.";
function setup(index: number, text = source) {
  const document = parseFountain(text);
  let state = EditorState.create({ schema: screenplaySchema, doc: blocksToDoc(document.blocks), plugins: [history()] });
  const select = (block: number) => {
    let position = 1;
    for (let i = 0; i < block; i++) position += state.doc.child(i).nodeSize;
    state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, position)));
  };
  select(index);
  return {
    get state() { return state; },
    select,
    run(command: Command) { return command(state, (tr) => { state = state.apply(tr); }); },
    blocks() { return docToBlocks(state.doc); },
  };
}
const content = (blocks: ScriptBlock[]) => blocks.map(({ kind, text }) => [kind, text]);

describe("whole-speech dual dialogue", () => {
  it.each([0, 1, 2, 3, 4, 5])("pairs from cue, parenthetical or dialogue at block %s without retyping it", (index) => {
    const editor = setup(index);
    const before = editor.blocks();
    const selection = editor.state.selection.toJSON();
    expect(editor.run(setBlockKind("character", true))).toBe(true);
    expect(content(editor.blocks())).toEqual(content(before));
    expect(editor.blocks().map((block) => block.id)).toEqual(before.map((block) => block.id));
    expect(editor.state.selection.toJSON()).toEqual(selection);
    expect(editor.blocks().filter((block) => block.dual).map((block) => block.text)).toEqual(["ELI"]);
    expect(dualDialogueAt(editor.state)?.active).toBe(true);
    expect(editor.run(setDualDialogue(false))).toBe(true);
    expect(content(editor.blocks())).toEqual(content(before));
    expect(editor.blocks().some((block) => block.dual)).toBe(false);
  });

  it("round-trips one standard Fountain caret and preserves all dialogue", () => {
    const editor = setup(5);
    editor.run(setBlockKind("character", true));
    const document = { ...emptyScreenplay(), blocks: editor.blocks() };
    const fountain = serializeFountain(document);
    expect(fountain).toContain("ELI ^");
    expect(content(parseFountain(fountain).blocks)).toEqual(content(document.blocks));
    editor.select(1);
    expect(dualDialogueAt(editor.state)?.active).toBe(true);
    editor.run(setBlockKind("dialogue"));
    expect(editor.blocks().some((block) => block.dual)).toBe(false);
    expect(content(editor.blocks())).toEqual(content(document.blocks));
  });

  it("has a reversible flag-only history event", () => {
    const editor = setup(5);
    const before = content(editor.blocks());
    editor.run(setBlockKind("character", true));
    expect(editor.run(undo)).toBe(true);
    expect(editor.blocks().some((block) => block.dual)).toBe(false);
    expect(content(editor.blocks())).toEqual(before);
    expect(editor.run(redo)).toBe(true);
    expect(editor.blocks()[4].dual).toBe(true);
  });

  it.each([
    "MARA\nOnly one speech.",
    "MARA\nFirst.\n\n!A deliberate interruption.\n\nELI\nSecond.",
    "MARA\nFirst.\n\nINT. A DIFFERENT ROOM - DAY\n\nELI\nSecond.",
    "!Ordinary action is not a character cue.",
  ])("does not silently convert text or pair across a structural boundary: %s", (text) => {
    const editor = setup(0, text);
    const before = editor.blocks();
    expect(editor.run(setBlockKind("character", true))).toBe(false);
    expect(editor.blocks()).toEqual(before);
  });

  it("does not absorb a third speech into an existing pair", () => {
    const editor = setup(4, "MARA\nFirst.\n\nELI ^\nSecond.\n\nJUNE\nThird.");
    expect(editor.run(setDualDialogue(true))).toBe(false);
    expect(editor.blocks().filter((block) => block.dual).map((block) => block.text)).toEqual(["ELI"]);
  });

  it("Enter continues a dual speech; a second empty Enter exits it", () => {
    const editor = setup(3, "MARA\nFirst.\n\nELI ^\nSecond.");
    const end = editor.state.selection.$from.end();
    editor.run((state, dispatch) => {
      dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, end)));
      return true;
    });
    editor.run(screenplayEnter);
    expect(editor.blocks().at(-1)?.kind).toBe("dialogue");
    expect(dualDialogueAt(editor.state)?.active).toBe(true);
    editor.run(screenplayEnter);
    expect(editor.blocks().at(-1)?.kind).toBe("action");
    expect(editor.blocks()[2].dual).toBe(true);
  });
});
