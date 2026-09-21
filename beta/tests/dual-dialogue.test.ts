import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { TextSelection } from "prosemirror-state";
import { EditorController } from "../src/editor/EditorController";
import { parseFountain, serializeFountain } from "../src/core/fountain";
import { emptyScreenplay } from "../src/core/model";
import { dialogueStructure } from "../src/editor/dualDialogue";

const editors: EditorController[] = [];
const source = "INT. ROOM - DAY\n\nMARA\n*First speech.*\n(beat)\nStill first.\n\nELI\n(quietly)\nSecond speech.\n\n!Afterwards.";
beforeAll(() => {
  Range.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 10, 20);
  Range.prototype.getClientRects = () => [new DOMRect(0, 0, 10, 20)] as unknown as DOMRectList;
  HTMLElement.prototype.scrollIntoView = () => {};
  window.scrollBy = () => {};
});
afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
  document.body.replaceChildren();
  expect(document.querySelectorAll("[data-dual-dialogue-styles]")).toHaveLength(0);
});
function create(text = source) {
  const host = document.createElement("div");
  document.body.append(host);
  const onSelection = vi.fn();
  const editor = new EditorController(host, parseFountain(text), { onSelection });
  editors.push(editor);
  return { editor, onSelection };
}
function focus(editor: EditorController, text: string) {
  const block = editor.getBlocks().find((block) => block.text === text)!;
  expect(block).toBeDefined();
  expect(editor.focusBlock(block.id)).toBe(true);
}
const content = (editor: EditorController) => editor.getBlocks().map(({ dual: _dual, ...block }) => block);

describe("dual dialogue as a speech-level editing mode", () => {
  it.each(["ELI", "Second speech.", "(quietly)", "MARA", "First speech."])(
    "pairs adjacent speeches from %s without changing any text or paragraph kinds", (text) => {
      const { editor, onSelection } = create();
      const before = content(editor);
      focus(editor, text);
      const selection = editor.view.state.selection.toJSON();
      // Also covers the original toolbar's character/dual API call on dialogue text.
      expect(editor.setKind("character", true)).toBe(true);
      expect(content(editor)).toEqual(before);
      expect(editor.view.state.selection.toJSON()).toEqual(selection);
      expect(editor.getBlocks().filter((block) => block.dual).map((block) => block.text)).toEqual(["ELI"]);
      expect(editor.view.dom.querySelectorAll('[data-dual-side="left"]').length).toBeGreaterThan(1);
      expect(editor.view.dom.querySelectorAll('[data-dual-side="right"]').length).toBeGreaterThan(1);
      expect(onSelection.mock.lastCall?.[1]).toBe(true);
      const exported = serializeFountain(editor.getDocument(emptyScreenplay()));
      expect(exported).toContain("ELI ^");
      expect(parseFountain(exported).blocks).toEqual(editor.getBlocks());
      expect(editor.undo()).toBe(true);
      expect(content(editor)).toEqual(before);
      expect(editor.getBlocks().some((block) => block.dual)).toBe(false);
      expect(editor.redo()).toBe(true);
      expect(editor.getBlocks().find((block) => block.text === "ELI")?.dual).toBe(true);
    },
  );

  it("reports dual mode when moving between either cue, dialogue, and parenthetical", () => {
    const { editor, onSelection } = create(source.replace("ELI\n", "ELI ^\n"));
    for (const text of ["MARA", "First speech.", "(beat)", "ELI", "Second speech."]) {
      focus(editor, text);
      expect(onSelection.mock.lastCall?.[1]).toBe(true);
    }
    focus(editor, "Afterwards.");
    expect(onSelection.mock.lastCall?.[1]).toBe(false);
  });

  it("removes the mode from a whole-pair selection without converting its paragraphs", () => {
    const { editor } = create(source.replace("ELI\n", "ELI ^\n"));
    const before = content(editor);
    const pair = dialogueStructure(editor.view.state.doc).pairs[0];
    const last = pair.right.blocks.at(-1)!;
    editor.view.dispatch(editor.view.state.tr.setSelection(TextSelection.create(
      editor.view.state.doc, pair.left.cue.pos + 1, last.pos + last.node.nodeSize - 1,
    )));
    expect(editor.setKind("character")).toBe(true);
    expect(content(editor)).toEqual(before);
    expect(editor.getBlocks().some((block) => block.dual)).toBe(false);
    expect(editor.view.dom.classList.contains("screenplay-has-dual")).toBe(false);
    expect(editor.undo()).toBe(true);
    expect(editor.getBlocks().find((block) => block.text === "ELI")?.dual).toBe(true);
  });

  it("keeps following typing separate from the formatting undo event", () => {
    const { editor } = create();
    focus(editor, "Second speech.");
    editor.setKind("dialogue", true);
    editor.view.dispatch(editor.view.state.tr.insertText("New "));
    expect(editor.undo()).toBe(true);
    expect(editor.getBlocks().some((block) => block.text === "Second speech.")).toBe(true);
    expect(editor.getBlocks().some((block) => block.dual)).toBe(true);
    expect(editor.undo()).toBe(true);
    expect(editor.getBlocks().some((block) => block.dual)).toBe(false);
  });

  it.each(["!An action interrupts.", "INT. ANOTHER ROOM - DAY", "==="])(
    "does not pair across %s", (boundary) => {
      const { editor } = create(`MARA\nFirst.\n\n${boundary}\n\nELI\nSecond.`);
      const before = editor.getBlocks();
      focus(editor, "ELI");
      expect(editor.setKind("character", true)).toBe(false);
      expect(editor.getBlocks()).toEqual(before);
    },
  );

  it("supports independent pairs, keeps annotations, and does not steal a paired speech", () => {
    const { editor } = create("MARA\nOne.\n[[An annotation.]]\n\nELI ^\nTwo.\n\nJUNE\nThree.\n\nREN\nFour.");
    focus(editor, "Three.");
    expect(editor.setKind("dialogue", true)).toBe(true);
    expect(editor.getBlocks().filter((block) => block.dual).map((block) => block.text)).toEqual(["ELI", "REN"]);
    expect(editor.getBlocks().find((block) => block.kind === "note")?.text).toBe("An annotation.");
    focus(editor, "One.");
    editor.setKind("dialogue");
    expect(editor.getBlocks().filter((block) => block.dual).map((block) => block.text)).toEqual(["REN"]);
  });

  it("updates imported pairs through deletion, undo, and document switches", () => {
    const { editor } = create(source.replace("ELI\n", "ELI ^\n"));
    const pair = dialogueStructure(editor.view.state.doc).pairs[0];
    editor.view.dispatch(editor.view.state.tr.delete(pair.right.cue.pos, pair.right.cue.pos + pair.right.cue.node.nodeSize));
    expect(editor.view.dom.querySelectorAll("[data-dual-side]")).toHaveLength(0);
    editor.undo();
    expect(editor.view.dom.querySelectorAll("[data-dual-side]").length).toBeGreaterThan(0);
    editor.setDocument(emptyScreenplay());
    expect(editor.view.dom.querySelectorAll("[data-dual-side]")).toHaveLength(0);
    expect(document.querySelectorAll("[data-dual-dialogue-styles]")).toHaveLength(1);
  });
});
