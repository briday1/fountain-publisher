import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { TextSelection } from "prosemirror-state";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import { EditorController } from "../src/editor/EditorController";
import { dialogueStructure } from "../src/editor/dualDialogue";
import { emptyScreenplay } from "../src/core/model";
import type { Screenplay } from "../src/core/model";
import { parseFountain, serializeFountain } from "../src/core/fountain";
import { createSharedDocument, readSharedDocument, validateSharedDocument } from "../src/collaboration/sharedDocument";

const cleanup: (() => void)[] = [];
beforeAll(() => {
  Range.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 10, 20);
  Range.prototype.getClientRects = () => [new DOMRect(0, 0, 10, 20)] as unknown as DOMRectList;
  HTMLElement.prototype.scrollIntoView = () => {};
  window.scrollBy = () => {};
});
afterEach(() => {
  cleanup.splice(0).reverse().forEach((fn) => fn());
  document.body.replaceChildren();
});
function fixture(): Screenplay {
  return {
    ...emptyScreenplay(),
    blocks: [
      { id: "scene", kind: "scene", text: "INT. ROOM - DAY" },
      { id: "left-cue", kind: "character", text: "MARA" },
      { id: "parenthetical", kind: "parenthetical", text: "(quietly)" },
      { id: "left", kind: "dialogue", text: "One voice." },
      { id: "right-cue", kind: "character", text: "ELI" },
      { id: "right", kind: "dialogue", text: "Another voice." },
      { id: "after", kind: "action", text: "They stop talking." },
      { id: "other-cue", kind: "character", text: "JUNE" },
      { id: "other", kind: "dialogue", text: "A separate speech." },
    ],
  };
}
function create(initial = fixture(), onSelection = vi.fn()) {
  const host = document.createElement("div");
  document.body.append(host);
  const editor = new EditorController(host, initial, { onSelection });
  cleanup.push(() => editor.destroy());
  return editor;
}
function at(editor: EditorController, id: string) {
  const block = editor.getBlocks().find((block) => block.id === id)!;
  editor.focusBlock(block.id);
}
function flags(editor: EditorController) {
  return editor.getBlocks().filter((block) => block.dual).map((block) => block.id);
}
it.each(["left-cue", "parenthetical", "left", "right-cue", "right"])(
  "pairs from %s without changing any text, kind, id or caret", (id) => {
    const editor = create();
    const before = editor.getBlocks();
    const dom = editor.view.dom;
    at(editor, id);
    const selection = editor.view.state.selection.toJSON();
    expect(editor.setKind("character", true)).toBe(true);
    expect(flags(editor)).toEqual(["right-cue"]);
    expect(editor.getBlocks().map(({ dual: _, ...block }) => block)).toEqual(before);
    expect(editor.view.state.selection.toJSON()).toEqual(selection);
    expect(editor.view.dom).toBe(dom);
    expect(dom.querySelectorAll('[data-dual-side="1"]')).toHaveLength(3);
    expect(dom.querySelectorAll('[data-dual-side="2"]')).toHaveLength(2);
    expect(serializeFountain(editor.getDocument(emptyScreenplay()))).toContain("ELI ^");
    expect(editor.undo()).toBe(true);
    expect(editor.getBlocks()).toEqual(before);
    expect(dom.querySelectorAll("[data-dual-side]")).toHaveLength(0);
    expect(editor.redo()).toBe(true);
    expect(flags(editor)).toEqual(["right-cue"]);
  },
);
it("unpairs from either speech and updates the picker between same-kind dialogue blocks", () => {
  const notify = vi.fn();
  const editor = create(fixture(), notify);
  at(editor, "right");
  editor.setKind("character", true);
  expect(notify).toHaveBeenLastCalledWith("dialogue", true);
  at(editor, "other");
  expect(notify).toHaveBeenLastCalledWith("dialogue", false);
  at(editor, "left");
  expect(notify).toHaveBeenLastCalledWith("dialogue", true);
  expect(editor.setKind("dialogue", false)).toBe(true);
  expect(flags(editor)).toEqual([]);
  expect(editor.getBlocks().find((block) => block.id === "left")?.kind).toBe("dialogue");
  expect(editor.undo()).toBe(true);
  expect(flags(editor)).toEqual(["right-cue"]);
});
it("does not pair across action, steal an existing pair, or convert an isolated speech to a cue", () => {
  const editor = create();
  at(editor, "other");
  const before = editor.getBlocks();
  expect(editor.setKind("character", true)).toBe(false);
  expect(editor.getBlocks()).toEqual(before);
  at(editor, "right");
  editor.setKind("character", true);
  const next = editor.getDocument(emptyScreenplay());
  next.blocks = next.blocks.filter((block) => block.id !== "after");
  editor.setDocument(next);
  at(editor, "other");
  expect(editor.setKind("character", true)).toBe(false);
  expect(flags(editor)).toEqual(["right-cue"]);
});
it("keeps pairing separate from typing undo and supports a selected pair", () => {
  const editor = create();
  at(editor, "left-cue");
  const start = editor.view.state.selection.from;
  at(editor, "right");
  editor.view.dispatch(editor.view.state.tr.setSelection(TextSelection.create(editor.view.state.doc, start, editor.view.state.selection.from + 3)));
  expect(editor.setKind("character", true)).toBe(true);
  at(editor, "right");
  editor.view.dispatch(editor.view.state.tr.insertText("New "));
  expect(editor.undo()).toBe(true);
  expect(flags(editor)).toEqual(["right-cue"]);
  expect(editor.getBlocks().find((block) => block.id === "right")?.text).toBe("Another voice.");
  expect(editor.undo()).toBe(true);
  expect(flags(editor)).toEqual([]);
});
it("renders imported Fountain flags and strips layout-only state from a save/reopen", () => {
  const source = "MARA\nLeft.\n\nELI ^\nRight.\n\n!After.";
  const editor = create(parseFountain(source));
  expect(editor.view.dom.classList.contains("has-dual-dialogue")).toBe(true);
  const serialized = serializeFountain(editor.getDocument(emptyScreenplay()));
  expect(serialized).not.toMatch(/dual-offset|data-dual-side|grid-row/);
  editor.setDocument(parseFountain(serialized));
  expect(dialogueStructure(editor.view.state.doc).pairs).toHaveLength(1);
  expect(editor.view.dom.querySelectorAll("[data-dual-side]")).toHaveLength(4);
});
it("shares dual flags and local undo without schema changes; viewers cannot change them", () => {
  const first = createSharedDocument(fixture());
  const second = new Y.Doc();
  Y.applyUpdate(second, Y.encodeStateAsUpdate(first));
  const a = create(readSharedDocument(first));
  const b = create(readSharedDocument(second));
  const awarenessA = new Awareness(first);
  const awarenessB = new Awareness(second);
  a.attachCollaboration({ doc: first, awareness: awarenessA, canEdit: true });
  b.attachCollaboration({ doc: second, awareness: awarenessB, canEdit: false });
  cleanup.unshift(() => first.destroy(), () => second.destroy(), () => awarenessA.destroy(), () => awarenessB.destroy());
  const sync = () => {
    Y.applyUpdate(second, Y.encodeStateAsUpdate(first, Y.encodeStateVector(second)), "network");
    validateSharedDocument(first);
    validateSharedDocument(second);
  };
  at(a, "right");
  expect(a.setKind("character", true)).toBe(true);
  sync();
  expect(flags(b)).toEqual(["right-cue"]);
  expect(b.view.dom.querySelectorAll("[data-dual-side]")).toHaveLength(5);
  at(b, "left");
  expect(b.setKind("dialogue", false)).toBe(false);
  expect(a.undo()).toBe(true);
  sync();
  expect(flags(b)).toEqual([]);
  expect(a.redo()).toBe(true);
  sync();
  expect(flags(b)).toEqual(["right-cue"]);
});
