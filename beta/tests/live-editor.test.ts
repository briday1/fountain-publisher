import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import { AllSelection, TextSelection } from "prosemirror-state";
import { yCursorPluginKey } from "y-prosemirror";
import {
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
} from "y-protocols/awareness";
import { EditorController } from "../src/editor/EditorController";
import { screenplayEnter } from "../src/editor/commands";
import {
  createSharedDocument,
  readSharedDocument,
  validateSharedDocument,
  sharedBeats,
} from "../src/collaboration/sharedDocument";
import { emptyScreenplay } from "../src/core/model";
import type { Screenplay } from "../src/core/model";
import { serializeFountain, parseFountain } from "../src/core/fountain";

beforeAll(() => {
  Range.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 10, 20);
  Range.prototype.getClientRects = () =>
    [new DOMRect(0, 0, 10, 20)] as unknown as DOMRectList;
  HTMLElement.prototype.scrollIntoView = () => {};
  window.scrollBy = () => {};
});
const cleanup: (() => void)[] = [];
afterEach(() => {
  cleanup
    .splice(0)
    .reverse()
    .forEach((fn) => fn());
  document.body.replaceChildren();
});
function fixture(withBeat = false): Screenplay {
  const doc = emptyScreenplay();
  doc.blocks = [
    { id: "opening", kind: "action", text: "Before the signal." },
    { id: "passage", kind: "action", text: "One two three four." },
    { id: "ending", kind: "action", text: "After the signal." },
  ];
  if (withBeat)
    doc.metadata.beats = [
      {
        id: "beat",
        title: "The turn",
        description: "A new direction.",
        color: "#df8b51",
        act: "II",
        range: {
          start: { blockId: "passage", offset: 4 },
          end: { blockId: "passage", offset: 13 },
        },
      },
    ];
  return doc;
}
function peer(doc: Y.Doc, canEdit = true) {
  const initial = readSharedDocument(doc);
  const host = document.createElement("div");
  document.body.append(host);
  const editor = new EditorController(host, initial);
  const awareness = new Awareness(doc);
  cleanup.push(
    () => doc.destroy(),
    () => awareness.destroy(),
    () => editor.destroy(),
  );
  const element = editor.view.dom;
  editor.attachCollaboration({ doc, awareness, canEdit });
  return {
    doc,
    editor,
    awareness,
    element,
    current: () => editor.getDocument(initial),
  };
}
function pair(base = fixture()) {
  const first = createSharedDocument(base);
  const second = new Y.Doc();
  Y.applyUpdate(second, Y.encodeStateAsUpdate(first));
  const a = peer(first),
    b = peer(second);
  const sync = () => {
    const left = Y.encodeStateAsUpdate(first, Y.encodeStateVector(second));
    const right = Y.encodeStateAsUpdate(second, Y.encodeStateVector(first));
    Y.applyUpdate(first, right, "network");
    Y.applyUpdate(second, left, "network");
    validateSharedDocument(first);
    validateSharedDocument(second);
  };
  return { a, b, sync };
}
function select(editor: EditorController, from: number, to = from) {
  editor.view.dispatch(
    editor.view.state.tr.setSelection(
      TextSelection.create(editor.view.state.doc, from, to),
    ),
  );
}
function type(editor: EditorController, value: string) {
  editor.view.dispatch(editor.view.state.tr.insertText(value));
}
function at(editor: EditorController, id: string, offset: number) {
  let position = 0;
  editor.view.state.doc.forEach((node, pos) => {
    if (node.attrs.id === id) position = pos + 1 + offset;
  });
  return position;
}

describe("live screenplay editing", () => {
  it("synchronizes native insertText input without keydown and preserves select-all through detach", () => {
    const { a } = pair();
    a.editor.focus();
    a.editor.view.dispatch(
      a.editor.view.state.tr.setSelection(
        new AllSelection(a.editor.view.state.doc),
      ),
    );
    const text = a.editor.view.dom.querySelector(
      'p[data-id="ending"]',
    )!.firstChild!;
    window.getSelection()!.collapse(text, text.textContent!.length);
    a.editor.view.dom.dispatchEvent(
      new InputEvent("beforeinput", {
        inputType: "insertText",
        data: " Added.",
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(a.editor.view.state.selection.empty).toBe(true);
    type(a.editor, " Added.");
    expect(a.current().blocks[2].text).toBe("After the signal. Added.");
    a.editor.view.dispatch(
      a.editor.view.state.tr.setSelection(
        new AllSelection(a.editor.view.state.doc),
      ),
    );
    expect(() => a.editor.detachCollaboration()).not.toThrow();
    expect(a.editor.view.state.selection).toBeInstanceOf(AllSelection);
  });

  it.each(["presence", "text"])(
    "keeps a native collapsed selection when %s arrives before selectionchange",
    (incoming) => {
      const { a, b, sync } = pair();
      const original = a.editor.view.dom.querySelector('p[data-id="opening"]');
      if (incoming === "text") {
        select(b.editor, 1);
        type(b.editor, "Remote ");
      }
      a.editor.focus();
      a.editor.view.dispatch(
        a.editor.view.state.tr.setSelection(
          new AllSelection(a.editor.view.state.doc),
        ),
      );
      const text = a.editor.view.dom.querySelector(
        'p[data-id="ending"]',
      )!.firstChild!;
      // Native ArrowRight collapses first; selectionchange arrives in a later task.
      window.getSelection()!.collapse(text, text.textContent!.length);
      expect(a.editor.view.state.selection.empty).toBe(false);
      if (incoming === "presence") {
        b.awareness.setLocalState({
          user: { name: "Peer", color: "#3377bb" },
          cursor: {
            anchor: { tname: "script", assoc: -1 },
            head: { tname: "script", assoc: -1 },
          },
        });
        applyAwarenessUpdate(
          a.awareness,
          encodeAwarenessUpdate(b.awareness, [b.doc.clientID]),
          "network",
        );
        a.editor.view.dispatch(
          a.editor.view.state.tr.setMeta(yCursorPluginKey, {
            awarenessUpdated: true,
          }),
        );
      } else sync();
      expect(a.editor.view.state.selection.empty).toBe(true);
      expect(window.getSelection()!.isCollapsed).toBe(true);
      type(a.editor, " Appended.");
      sync();
      expect(a.current().blocks).toHaveLength(3);
      expect(a.current().blocks[2].text).toBe("After the signal. Appended.");
      expect(a.editor.view.dom.querySelector('p[data-id="opening"]')).toBe(
        original,
      );
      expect(a.current()).toEqual(b.current());
    },
  );

  it("initializes and round-trips portable screenplay metadata, marks, and precise ranges", () => {
    const base = fixture(true);
    base.titlePage.title = "Shared draft";
    base.metadata.notes = "Keep the quiet opening.";
    base.blocks[1].spans = [
      { text: "One two ", marks: ["italic"] },
      { text: "three four." },
    ];
    base.metadata.characterColors = { MARA: "#3388aa" };
    const doc = createSharedDocument(base);
    cleanup.push(() => doc.destroy());
    const parsed = readSharedDocument(doc);
    expect(parsed).toEqual(base);
    expect(
      parseFountain(serializeFountain(parsed)).metadata.beats[0].range,
    ).toEqual(base.metadata.beats[0].range);
  });

  it("converges simultaneous typing and lets each writer undo only their own input", () => {
    const { a, b, sync } = pair();
    select(a.editor, 1);
    select(b.editor, 1);
    type(a.editor, "MARA ");
    type(b.editor, "JUNE ");
    sync();
    expect(a.current()).toEqual(b.current());
    expect(a.current().blocks[0].text).toContain("MARA ");
    expect(a.current().blocks[0].text).toContain("JUNE ");
    expect(a.editor.undo()).toBe(true);
    sync();
    expect(a.current()).toEqual(b.current());
    expect(b.current().blocks[0].text).not.toContain("MARA ");
    expect(b.current().blocks[0].text).toContain("JUNE ");
    expect(a.editor.redo()).toBe(true);
    sync();
    expect(a.current().blocks[0].text).toContain("MARA ");
    expect(a.editor.view.dom).toBe(a.element);
    expect(b.editor.view.dom).toBe(b.element);
  });

  it("keeps shared ranges through remote earlier typing, paragraph split, and local undo", () => {
    const { a, b, sync } = pair(fixture(true));
    select(a.editor, 1);
    type(a.editor, "Earlier writing. ");
    sync();
    expect(b.current().metadata.beats[0].range).toEqual(
      fixture(true).metadata.beats[0].range,
    );
    select(a.editor, at(a.editor, "passage", 8));
    screenplayEnter(a.editor.view.state, a.editor.view.dispatch, a.editor.view);
    sync();
    const range = a.current().metadata.beats[0].range!;
    expect(range.start).toEqual({ blockId: "passage", offset: 4 });
    expect(range.end.blockId).not.toBe("passage");
    expect(range.end.offset).toBe(5);
    expect(b.current().metadata.beats[0].range).toEqual(range);
    a.editor.undo();
    sync();
    expect(a.current().metadata.beats[0].range).toEqual(
      fixture(true).metadata.beats[0].range,
    );
    expect(a.current()).toEqual(b.current());
    a.editor.redo();
    sync();
    expect(a.current()).toEqual(b.current());
    expect(a.current().metadata.beats[0].range?.end.blockId).not.toBe(
      "passage",
    );
    a.editor.undo();
    sync();
    expect(a.current()).toEqual(b.current());
    expect(a.current().metadata.beats[0].range).toEqual(
      fixture(true).metadata.beats[0].range,
    );
  });

  it("unassigns swallowed passages and restores anchors with text undo on both peers", () => {
    const { a, b, sync } = pair(fixture(true));
    select(a.editor, at(a.editor, "passage", 0), at(a.editor, "passage", 18));
    type(a.editor, "Gone.");
    sync();
    expect(a.current().metadata.beats[0].range).toBeUndefined();
    expect(b.current().metadata.beats[0].range).toBeUndefined();
    a.editor.undo();
    sync();
    expect(a.current()).toEqual(b.current());
    expect(a.current().metadata.beats[0].range).toEqual(
      fixture(true).metadata.beats[0].range,
    );
  });

  it("syncs assignment-only operations and undoes them independently of nearby typing", () => {
    const { a, b, sync } = pair(fixture(true));
    const before = a.current(),
      next = structuredClone(before);
    next.metadata.beats[0].range = {
      start: { blockId: "ending", offset: 0 },
      end: { blockId: "ending", offset: 5 },
    };
    a.editor.updateBeatRanges(next, before.metadata.beats, before);
    sync();
    expect(b.current().metadata.beats[0].range).toEqual(
      next.metadata.beats[0].range,
    );
    select(a.editor, 1);
    type(a.editor, "New ");
    a.editor.undo();
    sync();
    expect(a.current().metadata.beats[0].range).toEqual(
      next.metadata.beats[0].range,
    );
    a.editor.undo();
    sync();
    expect(b.current().metadata.beats[0].range).toEqual(
      before.metadata.beats[0].range,
    );
  });

  it("keeps exact replacement assigned and does not undo another writer's edits inside a new paragraph", () => {
    const { a, b, sync } = pair(fixture(true));
    select(a.editor, at(a.editor, "passage", 4), at(a.editor, "passage", 13));
    type(a.editor, "replaced passage");
    sync();
    expect(a.current().metadata.beats[0].range?.end.offset).toBe(20);
    expect(a.current()).toEqual(b.current());
    a.editor.undo();
    sync();
    expect(a.current().metadata.beats[0].range).toEqual(
      fixture(true).metadata.beats[0].range,
    );
    select(a.editor, at(a.editor, "ending", 17));
    screenplayEnter(a.editor.view.state, a.editor.view.dispatch, a.editor.view);
    type(a.editor, "Owner words ");
    sync();
    const id = a.current().blocks.at(-1)!.id;
    select(b.editor, at(b.editor, id, 12));
    type(b.editor, "Peer words");
    sync();
    a.editor.undo();
    sync();
    expect(a.current()).toEqual(b.current());
    expect(
      a
        .current()
        .blocks.map((block) => block.text)
        .join("\n"),
    ).toContain("Peer words");
  });

  it("merges title, notes, and different beat fields without overwriting unrelated changes", () => {
    const { a, b, sync } = pair(fixture(true));
    const oldA = a.current(),
      oldB = b.current(),
      nextA = structuredClone(oldA),
      nextB = structuredClone(oldB);
    nextA.titlePage.title = "The next draft";
    nextA.metadata.beats[0].title = "A turn";
    nextB.titlePage.author = "Two writers";
    nextB.metadata.notes = "Remember the ending.";
    nextB.metadata.beats[0].description = "A changed direction.";
    a.editor.updateBeatRanges(nextA, oldA.metadata.beats, oldA);
    b.editor.updateBeatRanges(nextB, oldB.metadata.beats, oldB);
    sync();
    expect(a.current()).toEqual(b.current());
    expect(a.current().titlePage).toMatchObject({
      title: "The next draft",
      author: "Two writers",
    });
    expect(a.current().metadata.beats[0]).toMatchObject({
      title: "A turn",
      description: "A changed direction.",
    });
    expect(a.current().metadata.notes).toBe("Remember the ending.");
    a.editor.undo();
    sync();
    expect(b.current().titlePage.author).toBe("Two writers");
    expect(b.current().titlePage.title).toBe("");
  });

  it("blocks read-only commands and mobile input while applying authorized remote text", () => {
    const seed = createSharedDocument(fixture());
    const copy = new Y.Doc();
    Y.applyUpdate(copy, Y.encodeStateAsUpdate(seed));
    const writer = peer(seed),
      reader = peer(copy, false);
    expect(reader.editor.view.dom.getAttribute("contenteditable")).toBe(
      "false",
    );
    expect(reader.editor.setKind("character")).toBe(false);
    expect(reader.editor.insertBlock("action", "no")).toBe("");
    expect(reader.editor.replaceAll("Before", "bad")).toBe(0);
    type(reader.editor, "Forbidden");
    expect(reader.current().blocks[0].text).toBe("Before the signal.");
    const before = reader.current(),
      next = structuredClone(before);
    next.titlePage.title = "Forbidden";
    reader.editor.updateBeatRanges(next, before.metadata.beats, before);
    expect(reader.current().titlePage.title).toBe("");
    select(writer.editor, 1);
    type(writer.editor, "Allowed ");
    Y.applyUpdate(copy, Y.encodeStateAsUpdate(seed));
    expect(reader.current().blocks[0].text).toBe("Allowed Before the signal.");
    expect(reader.editor.undo()).toBe(false);
  });

  it("preserves native selection when joining/leaving and never replaces editor DOM", () => {
    const doc = fixture(),
      shared = createSharedDocument(doc),
      awareness = new Awareness(shared);
    const host = document.createElement("div");
    document.body.append(host);
    const editor = new EditorController(host, doc);
    cleanup.push(
      () => shared.destroy(),
      () => awareness.destroy(),
      () => editor.destroy(),
    );
    select(editor, 5, 12);
    const element = editor.view.dom;
    editor.attachCollaboration({ doc: shared, awareness, canEdit: true });
    expect(editor.view.state.selection.toJSON()).toMatchObject({
      anchor: 5,
      head: 12,
    });
    const detached = editor.detachCollaboration();
    expect(detached).toEqual(doc);
    expect(editor.view.state.selection.toJSON()).toMatchObject({
      anchor: 5,
      head: 12,
    });
    expect(editor.view.dom).toBe(element);
    type(editor, "new");
    expect(editor.undo()).toBe(true);
    expect(editor.getDocument(doc)).toEqual(doc);
  });

  it("makes navigation a transient highlight and typing inserts without replacing the passage", () => {
    const { a } = pair(fixture(true));
    const range = a.current().metadata.beats[0].range!;
    expect(a.editor.revealRange(range)).toBe(true);
    expect(a.editor.view.state.selection.empty).toBe(true);
    expect(
      a.editor.view.dom.querySelector(".navigation-highlight")?.textContent,
    ).toBe("two three");
    type(a.editor, "NEW ");
    expect(a.current().blocks[1].text).toBe("One NEW two three four.");
    expect(a.editor.view.dom.querySelector(".navigation-highlight")).toBeNull();
    a.editor.undo();
    expect(a.current().blocks[1].text).toBe("One two three four.");
  });

  it("exposes composition readiness and routes mobile undo through collaborative history", () => {
    const { a, b, sync } = pair();
    select(a.editor, 1);
    type(a.editor, "東京 ");
    sync();
    a.editor.view.dom.dispatchEvent(
      new InputEvent("beforeinput", {
        inputType: "historyUndo",
        bubbles: true,
        cancelable: true,
      }),
    );
    sync();
    expect(b.current().blocks[0].text).toBe("Before the signal.");
    Object.defineProperty(a.editor.view, "composing", {
      configurable: true,
      get: () => true,
    });
    expect(a.editor.isComposing).toBe(true);
    expect(a.editor.undo()).toBe(false);
    expect(a.editor.setKind("scene")).toBe(false);
    Object.defineProperty(a.editor.view, "composing", {
      configurable: true,
      get: () => false,
    });
  });

  it("rejects unsupported schema, extra roots, malformed ranges, and oversized metadata", () => {
    const doc = createSharedDocument(fixture(true));
    cleanup.push(() => doc.destroy());
    sharedBeats(doc)
      .get("beat")!
      .set("range", {
        start: { item: { client: "bad", clock: 0 } },
        end: {},
        empty: false,
      });
    expect(() => validateSharedDocument(doc)).toThrow(/invalid/);
    const other = createSharedDocument(fixture());
    cleanup.push(() => other.destroy());
    other.getMap("unexpected").set("payload", true);
    expect(() => validateSharedDocument(other)).toThrow(/invalid/);
  });

  it("keeps local keystrokes independent of snapshot conversion on a long screenplay", () => {
    const doc = fixture(true);
    doc.blocks.push(
      ...Array.from({ length: 1900 }, (_, index) => ({
        id: `large-${index}`,
        kind: "action" as const,
        text: "The light changes slowly across the room.",
      })),
    );
    doc.metadata.beats.push(
      ...Array.from({ length: 99 }, (_, index) => ({
        ...doc.metadata.beats[0],
        id: `beat-${index}`,
        range: {
          start: { blockId: `large-${index * 19}`, offset: 4 },
          end: { blockId: `large-${index * 19}`, offset: 30 },
        },
      })),
    );
    const { a } = pair(doc);
    const getBlocks = vi.spyOn(a.editor, "getBlocks");
    select(a.editor, at(a.editor, "large-1899", 1));
    const start = performance.now();
    for (let index = 0; index < 30; index++) type(a.editor, "a");
    expect(getBlocks).not.toHaveBeenCalled();
    expect(performance.now() - start).toBeLessThan(1500);
  });
});
