import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { AllSelection, TextSelection } from "prosemirror-state";
import { closeHistory } from "prosemirror-history";
import { EditorController } from "../src/editor/EditorController";
import { DocumentSession } from "../src/core/session";
import { emptyScreenplay } from "../src/core/model";
import type { BeatRange, Screenplay } from "../src/core/model";
import { resolveBeatRange } from "../src/core/beatRanges";
import { beatAnchorKey, BeatAnchorStep } from "../src/editor/beatAnchors";
import { Step, Mapping, StepMap } from "prosemirror-transform";

const editors: EditorController[] = [];
const sessions: DocumentSession[] = [];
beforeAll(() => {
  Range.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 10, 20);
  Range.prototype.getClientRects = () =>
    [new DOMRect(0, 0, 10, 20)] as unknown as DOMRectList;
  HTMLElement.prototype.scrollIntoView = () => {};
  window.scrollBy = () => {};
});
afterEach(() => {
  sessions.splice(0).forEach((session) => session.dispose());
  editors.splice(0).forEach((editor) => editor.destroy());
  document.body.replaceChildren();
});

function documentWithRange(texts: string[], range: BeatRange): Screenplay {
  const doc = emptyScreenplay();
  doc.titlePage.credit = "";
  doc.blocks = texts.map((text, index) => ({
    id: `p${index}`,
    kind: "action",
    text,
  }));
  doc.metadata.beats = [
    {
      id: "beat",
      title: "A turn",
      description: "",
      act: "Act I",
      color: "#75a8ed",
      range,
    },
  ];
  return doc;
}
function mount(doc: Screenplay, onChange?: () => void) {
  const host = document.createElement("div");
  document.body.append(host);
  const editor = new EditorController(host, doc, { onChange });
  editors.push(editor);
  return editor;
}
function select(editor: EditorController, from: number, to = from) {
  editor.view.dispatch(
    editor.view.state.tr.setSelection(
      TextSelection.create(editor.view.state.doc, from, to),
    ),
  );
}
const assignment = (editor: EditorController, doc: Screenplay) =>
  editor.getDocument(doc).metadata.beats[0]?.range;

describe("beat anchors under compound editing", () => {
  it("restores the final anchor snapshot for grouped typing undo and redo", () => {
    const original = {
      start: { blockId: "p0", offset: 7 },
      end: { blockId: "p0", offset: 16 },
    };
    const doc = documentWithRange(["Before\nA moment.\nAfter"], original);
    const editor = mount(doc);
    select(editor, 1);
    editor.view.dispatch(editor.view.state.tr.insertText("X"));
    editor.view.dispatch(editor.view.state.tr.insertText("Y"));
    editor.view.dispatch(editor.view.state.tr.insertText("Z"));
    const typed = assignment(editor, doc);
    expect(typed?.start.offset).toBe(10);
    expect(editor.undo()).toBe(true);
    expect(editor.getBlocks()[0].text).toBe(doc.blocks[0].text);
    expect(assignment(editor, doc)).toEqual(original);
    expect(editor.redo()).toBe(true);
    expect(editor.getBlocks()[0].text).toBe("XYZBefore\nA moment.\nAfter");
    expect(assignment(editor, doc)).toEqual(typed);
  });

  it("anchor history steps preserve document identity and serialize imported IDs safely", () => {
    const doc = documentWithRange(["A moment."], {
      start: { blockId: "p0", offset: 0 },
      end: { blockId: "p0", offset: 9 },
    });
    const editor = mount(doc);
    const before = Object.assign(Object.create(null), {
      constructor: { from: 1, to: 4 },
    });
    before.__proto__ = { from: 5, to: 8 };
    const after = Object.assign(Object.create(null), before, {
      constructor: { from: 2, to: 5 },
    });
    const step = new BeatAnchorStep(before, after);
    expect(step.apply(editor.view.state.doc).doc).toBe(editor.view.state.doc);
    const mappedSegments: number[] = [];
    step.getMap().forEach((from) => mappedSegments.push(from));
    expect(mappedSegments).toEqual([]);
    const restored = Step.fromJSON(
      editor.view.state.schema,
      JSON.parse(JSON.stringify(step.toJSON())),
    ) as BeatAnchorStep;
    expect(restored.before).toEqual(before);
    expect(restored.after).toEqual(after);
    expect(Object.getPrototypeOf(restored.after)).toBe(null);
    expect(restored.invert().after).toEqual(before);
    const rebased = restored.map(new Mapping([new StepMap([0, 0, 3])]));
    expect(rebased.before.constructor).toEqual({ from: 4, to: 7 });
    expect(rebased.after.constructor).toEqual({ from: 5, to: 8 });
  });
  it("joins a second-paragraph range into the surviving paragraph and reverses through history", () => {
    const original = {
      start: { blockId: "p1", offset: 0 },
      end: { blockId: "p1", offset: 8 },
    };
    const doc = documentWithRange(["Before.", "A turn." + "!"], original);
    const editor = mount(doc);
    editor.view.dispatch(
      closeHistory(editor.view.state.tr).join(
        editor.view.state.doc.child(0).nodeSize,
      ),
    );
    expect(editor.getBlocks().map((block) => block.text)).toEqual([
      "Before.A turn.!",
    ]);
    const joined = assignment(editor, doc);
    expect(joined).toEqual({
      start: { blockId: "p0", offset: 7 },
      end: { blockId: "p0", offset: 15 },
    });
    const snapshot = editor.getDocument(doc);
    expect(resolveBeatRange(snapshot, joined!)?.words).toBe(0);
    expect(editor.undo()).toBe(true);
    expect(assignment(editor, doc)).toEqual(original);
    expect(editor.redo()).toBe(true);
    expect(assignment(editor, doc)).toEqual(joined);
  });

  it("does not reattach an interior beat to unrelated text after Select All replacement", () => {
    const original = {
      start: { blockId: "p0", offset: 7 },
      end: { blockId: "p0", offset: 16 },
    };
    const doc = documentWithRange(["Before\nA moment.\nAfter"], original);
    const editor = mount(doc);
    editor.view.dispatch(
      editor.view.state.tr.setSelection(
        new AllSelection(editor.view.state.doc),
      ),
    );
    editor.view.dispatch(
      editor.view.state.tr.insertText("A completely new screenplay."),
    );
    expect(editor.getBlocks().map((block) => block.text)).toEqual([
      "A completely new screenplay.",
    ]);
    expect(assignment(editor, doc)).toBeUndefined();
    expect(editor.undo()).toBe(true);
    expect(assignment(editor, doc)).toEqual(original);
    expect(editor.redo()).toBe(true);
    expect(assignment(editor, doc)).toBeUndefined();
  });

  it("invalidates a beat swallowed inside a broader text selection replacement", () => {
    const original = {
      start: { blockId: "p0", offset: 7 },
      end: { blockId: "p0", offset: 16 },
    };
    const doc = documentWithRange(["Before\nA moment.\nAfter"], original);
    const editor = mount(doc);
    select(editor, 1, editor.view.state.doc.child(0).content.size + 1);
    editor.view.dispatch(
      editor.view.state.tr.insertText("A different passage altogether."),
    );
    expect(assignment(editor, doc)).toBeUndefined();
    expect(editor.undo()).toBe(true);
    expect(assignment(editor, doc)).toEqual(original);
    expect(editor.redo()).toBe(true);
    expect(assignment(editor, doc)).toBeUndefined();
  });

  it("prunes deleted beat IDs from the positions mapped on every input", () => {
    const doc = documentWithRange(["A moment."], {
      start: { blockId: "p0", offset: 0 },
      end: { blockId: "p0", offset: 9 },
    });
    const editor = mount(doc);
    const empty = { ...doc, metadata: { ...doc.metadata, beats: [] } };
    editor.updateBeatRanges(empty, doc.metadata.beats);
    expect(Object.keys(beatAnchorKey.getState(editor.view.state)!)).toEqual([]);
    expect(editor.undo()).toBe(true);
    // Undo may restore the positions for its history item, but removed beats never render.
    expect(editor.getDocument(empty).metadata.beats).toEqual([]);
    editor.updateBeatRanges(empty, []);
    expect(Object.keys(beatAnchorKey.getState(editor.view.state)!)).toEqual([]);
  });

  it("keeps live mapped anchors when title metadata is saved before the idle snapshot", () => {
    const original = {
      start: { blockId: "p0", offset: 7 },
      end: { blockId: "p0", offset: 16 },
    };
    const doc = documentWithRange(["Before\nA moment.\nAfter"], original);
    const repository = {
      save: vi.fn(async (data) => ({
        ...data,
        revision: 1,
        createdAt: 0,
        updatedAt: 0,
      })),
      writeRecovery: vi.fn(),
      setActiveId: vi.fn(),
    };
    const session = new DocumentSession(
      { id: "draft", name: "Draft.fountain", screenplay: doc, epoch: 0 },
      repository,
    );
    sessions.push(session);
    const editor = mount(doc, () => session.markChanged());
    session.editor = editor;
    select(editor, 1);
    editor.view.dispatch(editor.view.state.tr.insertText("Earlier words.\n"));
    const liveRange = assignment(editor, doc)!;
    expect(liveRange.start.offset).toBe(original.start.offset + 15);
    expect(session.current.screenplay.blocks[0].text).toBe(doc.blocks[0].text);
    session.updateMetadata({
      ...doc,
      titlePage: { ...doc.titlePage, title: "A new title" },
    });
    expect(session.current.screenplay.metadata.beats[0].range).toEqual(
      liveRange,
    );
    expect(session.current.screenplay.blocks[0].text).toBe(
      "Earlier words.\nBefore\nA moment.\nAfter",
    );
    expect(editor.undo()).toBe(true);
    const reverted = session.capture().screenplay;
    expect(reverted.metadata.beats[0].range).toEqual(original);
    expect(reverted.titlePage.title).toBe("A new title");
  });

  it("maps cleared assignments through older history without reviving stale positions", () => {
    const original = {
      start: { blockId: "p0", offset: 7 },
      end: { blockId: "p0", offset: 16 },
    };
    let doc = documentWithRange(["Before\nA moment.\nAfter"], original);
    const editor = mount(doc);
    select(editor, 1);
    editor.view.dispatch(editor.view.state.tr.insertText("Earlier.\n"));
    doc = editor.getDocument(doc);
    const afterTyping = doc.metadata.beats[0].range;
    const cleared = {
      ...doc,
      metadata: {
        ...doc.metadata,
        beats: doc.metadata.beats.map((beat) => ({
          ...beat,
          range: undefined,
        })),
      },
    };
    editor.updateBeatRanges(cleared, doc.metadata.beats);
    expect(assignment(editor, cleared)).toBeUndefined();
    expect(editor.undo()).toBe(true);
    expect(assignment(editor, cleared)).toEqual(afterTyping);
    expect(editor.undo()).toBe(true);
    expect(assignment(editor, cleared)).toEqual(original);
    expect(editor.redo()).toBe(true);
    expect(assignment(editor, cleared)).toEqual(afterTyping);
    expect(editor.redo()).toBe(true);
    expect(assignment(editor, cleared)).toBeUndefined();
  });
});
