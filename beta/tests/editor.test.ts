import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { AllSelection, TextSelection } from "prosemirror-state";
import { closeHistory } from "prosemirror-history";
import { EditorController } from "../src/editor/EditorController";
import { screenplayEnter, cycleBlockKind } from "../src/editor/commands";
import { emptyScreenplay } from "../src/core/model";
import type { BlockKind, Screenplay } from "../src/core/model";
import { resolveBeatRange } from "../src/core/beatRanges";

const editors: EditorController[] = [];
beforeAll(() => {
  // jsdom has no layout engine; these only support ProseMirror's scrolling.
  Range.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 10, 20);
  Range.prototype.getClientRects = () =>
    [new DOMRect(0, 0, 10, 20)] as unknown as DOMRectList;
  HTMLElement.prototype.scrollIntoView = () => {};
  window.scrollBy = () => {};
  if (!globalThis.ClipboardEvent)
    globalThis.ClipboardEvent = class extends Event {
      readonly clipboardData = null;
    } as typeof ClipboardEvent;
});
afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
  document.body.replaceChildren();
});

function create(
  blocks: Array<[BlockKind, string]> = [["action", ""]],
  onChange?: () => void,
): EditorController {
  const doc: Screenplay = {
    ...emptyScreenplay(),
    blocks: blocks.map(([kind, text], index) => ({
      id: `block-${index}`,
      kind,
      text,
    })),
  };
  const host = document.createElement("div");
  document.body.append(host);
  const editor = new EditorController(host, doc, { onChange });
  editors.push(editor);
  return editor;
}
function select(editor: EditorController, from: number, to = from): void {
  editor.view.dispatch(
    editor.view.state.tr.setSelection(
      TextSelection.create(editor.view.state.doc, from, to),
    ),
  );
}
function type(editor: EditorController, text: string): void {
  editor.view.dispatch(editor.view.state.tr.insertText(text));
}
it("excludes character cues from spellcheck while retaining typing corrections and prose settings", () => {
  const editor = create([
    ["character", "ZYLARA"],
    ["dialogue", "An ordinary sentence."],
  ]);
  const root = editor.view.dom;
  expect(root.getAttribute("autocorrect")).toBe("on");
  expect(root.getAttribute("spellcheck")).toBe("true");
  expect(
    root.querySelector('[data-kind="character"]')?.getAttribute("spellcheck"),
  ).toBe("false");
  expect(
    root.querySelector('[data-kind="dialogue"]')?.hasAttribute("spellcheck"),
  ).toBe(false);
  select(editor, 1);
  editor.setKind("action");
  expect(
    root.querySelector('[data-kind="action"]')?.hasAttribute("spellcheck"),
  ).toBe(false);
  editor.setKind("character");
  expect(
    root.querySelector('[data-kind="character"]')?.getAttribute("spellcheck"),
  ).toBe("false");
  expect(root.getAttribute("autocorrect")).toBe("on");
});
function enter(editor: EditorController): void {
  screenplayEnter(editor.view.state, editor.view.dispatch, editor.view);
}
function textAndKinds(editor: EditorController): Array<[BlockKind, string]> {
  return editor.getBlocks().map((block) => [block.kind, block.text]);
}

describe("beat line assignments follow native editing history", () => {
  function assign(editor: EditorController) {
    const range = editor.selectedLines()!;
    const base = editor.getDocument(emptyScreenplay());
    base.metadata.beats = [
      {
        id: "beat",
        title: "A turn",
        description: "",
        color: "#75a8ed",
        act: "Act I",
        range,
      },
    ];
    editor.updateBeatRanges(base, []);
    return base;
  }
  function assigned(editor: EditorController, base: Screenplay) {
    const doc = editor.getDocument(base);
    const range = doc.metadata.beats[0].range;
    return { doc, range, position: range && resolveBeatRange(doc, range) };
  }

  it("selects hard lines inside a paragraph, excluding an untouched following line", () => {
    const editor = create([
      ["action", "First line.\nSecond line.\nThird line."],
    ]);
    select(editor, 15, 25);
    expect(editor.selectedLines()).toEqual({
      start: { blockId: "block-0", offset: 12 },
      end: { blockId: "block-0", offset: 24 },
    });
    select(editor, 1);
    expect(editor.selectedLines()?.start.offset).toBe(0);
    expect(editor.selectedLines()?.end.offset).toBe(11);
  });

  it("excludes the next paragraph when a selection stops at its start", () => {
    const editor = create([
      ["action", "First."],
      ["action", "Second."],
    ]);
    select(editor, 1, 9);
    expect(editor.selectedLines()).toEqual({
      start: { blockId: "block-0", offset: 0 },
      end: { blockId: "block-0", offset: 6 },
    });
  });

  it("moves line numbers and word positions after inserting earlier text, without snapshotting on input", () => {
    const editor = create([["action", "One two.\nThree four.\nFive six."]]);
    select(editor, 12);
    const base = assign(editor);
    const original = assigned(editor, base);
    const snapshots = vi.spyOn(editor, "getBlocks");
    select(editor, 1);
    type(editor, "Earlier words here.\n");
    expect(snapshots).not.toHaveBeenCalled();
    const next = assigned(editor, base);
    expect(next.position?.words).toBe(5);
    expect(next.position?.startLine).toBe(original.position!.startLine + 1);
    expect(next.range?.start.offset).toBe(29);
    expect(editor.undo()).toBe(true);
    expect(assigned(editor, base).range).toEqual(original.range);
    expect(editor.redo()).toBe(true);
    expect(assigned(editor, base).range).toEqual(next.range);
  });

  it("keeps a range across paragraph splits and restores the original anchors on undo", () => {
    const editor = create([["action", "One two three four."]]);
    select(editor, 2);
    const base = assign(editor);
    const original = assigned(editor, base).range;
    select(editor, 9);
    enter(editor);
    const split = assigned(editor, base);
    expect(split.range?.start.blockId).toBe("block-0");
    expect(split.range?.end.blockId).toBe(split.doc.blocks[1].id);
    expect(split.position?.endLine).toBeGreaterThan(split.position!.startLine);
    editor.undo();
    expect(assigned(editor, base).range).toEqual(original);
    editor.redo();
    expect(assigned(editor, base).range).toEqual(split.range);
  });

  it("unassigns a deleted range and restores it through undo, including after a metadata save", () => {
    const editor = create([["action", "One two.\nThree four.\nFive six."]]);
    select(editor, 12);
    let base = assign(editor);
    const original = assigned(editor, base).range;
    editor.view.dispatch(closeHistory(editor.view.state.tr).delete(10, 21));
    base = editor.getDocument(base);
    expect(base.metadata.beats[0].range).toBeUndefined();
    editor.undo();
    expect(assigned(editor, base).range).toEqual(original);
    editor.redo();
    expect(assigned(editor, base).range).toBeUndefined();
  });

  it("preserves the assignment on line replacement and makes reassignment separately undoable", () => {
    const editor = create([["action", "Old line.\nNext line."]]);
    select(editor, 2);
    let base = assign(editor);
    select(editor, 1, 10);
    type(editor, "Replacement words.");
    base = editor.getDocument(base);
    expect(base.metadata.beats[0].range?.end.offset).toBe(18);
    select(editor, 22);
    const next = {
      ...base,
      metadata: {
        ...base.metadata,
        beats: base.metadata.beats.map((beat) => ({
          ...beat,
          range: editor.selectedLines(),
        })),
      },
    };
    editor.updateBeatRanges(next, base.metadata.beats);
    expect(assigned(editor, next).range?.start.offset).toBe(19);
    editor.undo();
    expect(assigned(editor, next).range).toEqual(base.metadata.beats[0].range);
    editor.undo();
    expect(assigned(editor, next).range?.end.offset).toBe(9);
  });
  it("treats imported beat IDs as data, including object property names", () => {
    const editor = create([["action", "A quiet room."]]);
    select(editor, 2);
    const base = editor.getDocument(emptyScreenplay());
    base.metadata.beats = ["constructor", "__proto__"].map((id) => ({
      id,
      title: id,
      description: "",
      color: "#75a8ed",
      act: "Act I",
      range: editor.selectedLines(),
    }));
    expect(() => editor.getDocument(base)).not.toThrow();
    editor.updateBeatRanges(base, []);
    select(editor, 1);
    type(editor, "Earlier.\n");
    expect(
      editor
        .getDocument(base)
        .metadata.beats.map((beat) => beat.range?.start.offset),
    ).toEqual([9, 9]);
    editor.undo();
    expect(
      editor
        .getDocument(base)
        .metadata.beats.map((beat) => beat.range?.start.offset),
    ).toEqual([0, 0]);
  });
});

describe("screenplay editing", () => {
  it("types in one persistent editing surface and emits dirty signals without snapshots", () => {
    const changed = vi.fn();
    const editor = create(undefined, changed);
    const surface = editor.view.dom;
    const snapshots = vi.spyOn(editor, "getBlocks");
    for (const character of "The train arrives.") type(editor, character);
    expect(editor.view.dom).toBe(surface);
    expect(surface.textContent).toBe("The train arrives.");
    expect(changed).toHaveBeenCalledTimes(18);
    expect(snapshots).not.toHaveBeenCalled();
    expect(editor.view.dom.getAttribute("aria-multiline")).toBe("true");
  });

  it("recognizes a scene while typing and advances naturally through dialogue", () => {
    const editor = create();
    type(editor, "INT. STATION - NIGHT");
    expect(editor.getBlocks()[0].kind).toBe("scene");
    enter(editor);
    type(editor, "The platform is empty.");
    enter(editor);
    type(editor, "ADA");
    enter(editor);
    type(editor, "(quietly)");
    expect(editor.getBlocks().at(-1)?.kind).toBe("parenthetical");
    enter(editor);
    type(editor, "We are early.");
    enter(editor);
    expect(textAndKinds(editor)).toEqual([
      ["scene", "INT. STATION - NIGHT"],
      ["action", "The platform is empty."],
      ["character", "ADA"],
      ["parenthetical", "(quietly)"],
      ["dialogue", "We are early."],
      ["action", ""],
    ]);
    expect(new Set(editor.getBlocks().map((block) => block.id)).size).toBe(6);
  });

  it("keeps an explicit action choice and safely cycles paragraph types", () => {
    const editor = create();
    editor.setKind("action");
    type(editor, "A SILENT ROOM");
    enter(editor);
    expect(editor.getBlocks()[0].kind).toBe("action");
    cycleBlockKind()(editor.view.state, editor.view.dispatch, editor.view);
    expect(editor.getBlocks()[1].kind).toBe("character");
    cycleBlockKind(true)(editor.view.state, editor.view.dispatch, editor.view);
    expect(editor.getBlocks()[1].kind).toBe("action");
  });

  it("splits in the middle without losing text, style, or block identity", () => {
    const editor = create([["dialogue", "Take the next train."]]);
    select(editor, 10);
    enter(editor);
    expect(textAndKinds(editor)).toEqual([
      ["dialogue", "Take the "],
      ["dialogue", "next train."],
    ]);
    expect(editor.getBlocks()[0].id).toBe("block-0");
    expect(editor.getBlocks()[1].id).not.toBe("block-0");
    editor.undo();
    expect(textAndKinds(editor)).toEqual([
      ["dialogue", "Take the next train."],
    ]);
    editor.redo();
    expect(editor.getBlocks()).toHaveLength(2);
  });

  it("deletes a selection across paragraphs and undoes it intact", () => {
    const editor = create([
      ["action", "Before train"],
      ["character", "ADA"],
      ["dialogue", "After rain"],
    ]);
    const original = editor.getBlocks();
    select(editor, 8, editor.view.state.doc.content.size - 5);
    editor.view.dispatch(closeHistory(editor.view.state.tr).deleteSelection());
    expect(editor.getBlocks()).toHaveLength(1);
    expect(editor.getBlocks()[0].text).toBe("Before rain");
    editor.undo();
    expect(editor.getBlocks()).toEqual(original);
    editor.redo();
    expect(editor.getBlocks()[0].text).toBe("Before rain");
  });

  it("can replace the entire document and keep editing", () => {
    const editor = create([
      ["scene", "INT. ROOM - DAY"],
      ["action", "The old draft."],
    ]);
    editor.view.dispatch(
      editor.view.state.tr.setSelection(
        new AllSelection(editor.view.state.doc),
      ),
    );
    editor.view.pasteText("A new beginning.\nAnother paragraph.");
    expect(textAndKinds(editor)).toEqual([
      ["action", "A new beginning."],
      ["action", "Another paragraph."],
    ]);
    expect(editor.getBlocks().every((block) => block.id)).toBe(true);
    type(editor, " More.");
    expect(editor.getBlocks()[1].text).toBe("Another paragraph. More.");
  });

  it("pastes multiline dialogue and rich text without flattening or source syntax", () => {
    const editor = create();
    editor.view.pasteText("INT. TRAIN - NIGHT\n\nADA\nAre we there?");
    expect(textAndKinds(editor)).toEqual([
      ["scene", "INT. TRAIN - NIGHT"],
      ["action", ""],
      ["character", "ADA"],
      ["dialogue", "Are we there?"],
    ]);
    editor.view.dispatch(
      editor.view.state.tr.setSelection(
        new AllSelection(editor.view.state.doc),
      ),
    );
    editor.view.pasteHTML(
      "<p>A <strong>bold</strong> choice.</p><p><em>Keep going.</em></p>",
    );
    expect(editor.getBlocks()).toMatchObject([
      {
        text: "A bold choice.",
        spans: [
          { text: "A " },
          { text: "bold", marks: ["bold"] },
          { text: " choice." },
        ],
      },
      {
        text: "Keep going.",
        spans: [{ text: "Keep going.", marks: ["italic"] }],
      },
    ]);
    const ids = editor.getBlocks().map((block) => block.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("formats a selection across blocks and preserves marks through undo and redo", () => {
    const editor = create([
      ["action", "One sentence."],
      ["action", "Another sentence."],
    ]);
    select(editor, 5, editor.view.state.doc.content.size - 1);
    editor.toggleMark("bold");
    expect(editor.getBlocks()[0].spans).toEqual([
      { text: "One " },
      { text: "sentence.", marks: ["bold"] },
    ]);
    expect(editor.getBlocks()[1].spans).toEqual([
      { text: "Another sentence.", marks: ["bold"] },
    ]);
    editor.undo();
    expect(editor.getBlocks().every((block) => !block.spans)).toBe(true);
    editor.redo();
    expect(editor.getBlocks()[1].spans?.[0].marks).toEqual(["bold"]);
  });

  it("defers autoformatting and commands during composition", async () => {
    const editor = create();
    Object.defineProperty(editor.view, "composing", {
      configurable: true,
      value: true,
    });
    type(editor, "INT. TOKYO - DAY");
    expect(editor.getBlocks()[0].kind).toBe("action");
    expect(
      screenplayEnter(editor.view.state, editor.view.dispatch, editor.view),
    ).toBe(false);
    expect(editor.setKind("character")).toBe(false);
    expect(editor.undo()).toBe(false);
    expect(editor.getBlocks()[0].text).toBe("INT. TOKYO - DAY");
    Object.defineProperty(editor.view, "composing", {
      configurable: true,
      value: false,
    });
    editor.view.dom.dispatchEvent(
      new CompositionEvent("compositionend", { bubbles: true, data: "東京" }),
    );
    await new Promise((resolve) => setTimeout(resolve, 45));
    expect(editor.getBlocks()[0].kind).toBe("scene");
  });

  it("routes mobile paragraph and undo input through screenplay transactions", () => {
    const editor = create([["character", "ADA"]]);
    select(editor, 4);
    const paragraph = new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      inputType: "insertParagraph",
    });
    editor.view.dom.dispatchEvent(paragraph);
    expect(paragraph.defaultPrevented).toBe(true);
    expect(textAndKinds(editor)).toEqual([
      ["character", "ADA"],
      ["dialogue", ""],
    ]);
    editor.view.dom.dispatchEvent(
      new InputEvent("beforeinput", {
        bubbles: true,
        cancelable: true,
        inputType: "historyUndo",
      }),
    );
    expect(textAndKinds(editor)).toEqual([["character", "ADA"]]);
    editor.view.dom.dispatchEvent(
      new InputEvent("beforeinput", {
        bubbles: true,
        cancelable: true,
        inputType: "insertParagraph",
        isComposing: true,
      }),
    );
    expect(textAndKinds(editor)).toEqual([["character", "ADA"]]);
  });

  it("preserves moved scene links while giving copied paragraphs unique IDs", () => {
    const editor = create([
      ["scene", "INT. TRAIN - DAY"],
      ["action", "A passenger waits."],
    ]);
    editor.view.dispatch(
      editor.view.state.tr.setSelection(
        new AllSelection(editor.view.state.doc),
      ),
    );
    const copied = editor.view.serializeForClipboard(
      editor.view.state.selection.content(),
    ).dom.innerHTML;
    select(editor, editor.view.state.doc.content.size - 1);
    editor.view.pasteHTML(copied);
    const ids = editor.getBlocks().map((block) => block.id);
    expect(new Set(ids).size).toBe(ids.length);
    const secondEditor = create();
    secondEditor.view.dispatch(
      secondEditor.view.state.tr.setSelection(
        new AllSelection(secondEditor.view.state.doc),
      ),
    );
    secondEditor.view.pasteHTML(copied);
    expect(secondEditor.getBlocks()[0].id).toBe("block-0");
    expect(secondEditor.getBlocks()[1].id).toBe("block-1");
  });

  it("finds literal text, wraps in both directions, and replaces in one undo step", () => {
    const editor = create([
      ["action", "A [train] and a [train]."],
      ["action", "The [TRAIN] arrives."],
    ]);
    expect(editor.find("[train]")).toEqual({ index: 1, total: 3 });
    expect(editor.find("[train]")).toEqual({ index: 2, total: 3 });
    expect(editor.find("[train]", { backwards: true })).toEqual({
      index: 1,
      total: 3,
    });
    expect(editor.find("[train]", { backwards: true })).toEqual({
      index: 3,
      total: 3,
    });
    expect(editor.replaceAll("[train]", "bus")).toBe(3);
    expect(editor.getBlocks().map((block) => block.text)).toEqual([
      "A bus and a bus.",
      "The bus arrives.",
    ]);
    editor.undo();
    expect(editor.getBlocks()[0].text).toBe("A [train] and a [train].");
    expect(editor.getBlocks()[1].text).toBe("The [TRAIN] arrives.");
    expect(editor.replaceAll("[train]", "bus", { caseSensitive: true })).toBe(
      2,
    );
  });

  it("keeps match offsets correct around Unicode case folding", () => {
    const editor = create([["action", "İstanbul train café 🚂 train"]]);
    editor.find("train");
    const { from, to } = editor.view.state.selection;
    expect(editor.view.state.doc.textBetween(from, to)).toBe("train");
    expect(editor.replace("train", "船")).toBe(true);
    expect(editor.getBlocks()[0].text).toBe("İstanbul 船 café 🚂 train");
  });

  it("inserts navigable blocks and isolates document history on switches", () => {
    const editor = create([["action", "First document."]]);
    const id = editor.insertBlock("note", "Remember the ticket.");
    expect(editor.focusBlock(id)).toBe(true);
    expect(editor.view.state.selection.$from.parent.attrs.id).toBe(id);
    editor.setDocument({
      ...emptyScreenplay(),
      blocks: [{ id: "second", kind: "action", text: "Second document." }],
    });
    expect(editor.undo()).toBe(false);
    expect(editor.getBlocks()[0].text).toBe("Second document.");
  });
});

describe("large-script responsiveness", () => {
  it("edits 3,000 blocks without rebuilding untouched paragraphs or taking snapshots", () => {
    const editor = create(
      Array.from({ length: 3000 }, (_, index) => [
        "action",
        `Paragraph ${index}. The station waits.`,
      ]),
    );
    const base = editor.getDocument(emptyScreenplay());
    base.metadata.beats = Array.from({ length: 15 }, (_, index) => {
      const block = base.blocks[(index + 1) * 150];
      return {
        id: `beat-${index}`,
        title: `Beat ${index}`,
        description: "",
        color: "#75a8ed",
        act: "Act I",
        range: {
          start: { blockId: block.id, offset: 0 },
          end: { blockId: block.id, offset: block.text.length },
        },
      };
    });
    editor.updateBeatRanges(base, []);
    const firstParagraph = editor.view.dom.firstElementChild;
    const lastParagraph = editor.view.dom.lastElementChild;
    const snapshots = vi.spyOn(editor, "getBlocks");
    select(editor, 1);
    const started = performance.now();
    for (let index = 0; index < 100; index++) type(editor, "x");
    const elapsed = performance.now() - started;
    expect(editor.view.dom.firstElementChild).toBe(firstParagraph);
    expect(editor.view.dom.lastElementChild).toBe(lastParagraph);
    expect(snapshots).not.toHaveBeenCalled();
    // A generous CI ceiling catches accidental full-document re-rendering.
    expect(elapsed).toBeLessThan(2000);
  }, 15000);
});

it("separates native text replacement from earlier typing before selectionchange arrives", () => {
  const editor = create();
  type(editor, "Good morning.");
  editor.view.dispatch(editor.view.state.tr.insertText("n", 6, 14));
  type(editor, "ight.");
  expect(editor.getBlocks()[0].text).toBe("Good night.");
  editor.undo();
  expect(editor.getBlocks()[0].text).toBe("Good morning.");
});

describe("character-name completion", () => {
  const press = (
    editor: EditorController,
    key: string,
    options: KeyboardEventInit = {},
  ) => {
    const event = new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
      ...options,
    });
    editor.view.dom.dispatchEvent(event);
  };
  it("completes existing Unicode names with Tab, separates undo, and enters dialogue naturally", () => {
    const editor = create([
      ["character", "RENÉE (V.O.)"],
      ["dialogue", "Hello."],
      ["action", ""],
    ]);
    editor.focusBlock("block-2");
    type(editor, "REN");
    expect(document.querySelector('[role="option"]')?.textContent).toContain(
      "RENÉE",
    );
    press(editor, "Tab");
    expect(textAndKinds(editor).at(-1)).toEqual(["character", "RENÉE"]);
    editor.undo();
    expect(textAndKinds(editor).at(-1)).toEqual(["action", "REN"]);
    editor.redo();
    enter(editor);
    expect(textAndKinds(editor).at(-1)).toEqual(["dialogue", ""]);
  });
  it("cycles matching names, dismisses without blurring, and retains ordinary Tab for unmatched cues", () => {
    const editor = create([
      ["character", "MARA"],
      ["dialogue", "One."],
      ["character", "MARTIN"],
      ["dialogue", "Two."],
      ["action", ""],
    ]);
    editor.focusBlock("block-4");
    type(editor, "MAR");
    press(editor, "ArrowDown");
    press(editor, "Tab");
    expect(textAndKinds(editor).at(-1)).toEqual(["character", "MARTIN"]);
    editor.undo();
    press(editor, "Escape");
    expect(editor.view.hasFocus()).toBe(true);
    expect(
      (document.querySelector(".character-completions") as HTMLElement).hidden,
    ).toBe(true);
    editor.view.dispatch(editor.view.state.tr.insertText("X"));
    press(editor, "Tab");
    expect(textAndKinds(editor).at(-1)).toEqual(["character", "MARX"]);
  });
  it("updates the cue index after rename, deletion, undo, document switches, and skips IME input", () => {
    const editor = create([
      ["character", "MARA"],
      ["dialogue", "Hello."],
      ["action", ""],
    ]);
    select(editor, 1, 5);
    type(editor, "MAYA");
    editor.focusBlock("block-2");
    type(editor, "MA");
    expect(document.querySelector('[role="option"]')?.textContent).toContain(
      "MAYA",
    );
    press(editor, "Tab", { isComposing: true });
    expect(textAndKinds(editor).at(-1)).toEqual(["action", "MA"]);
    press(editor, "Tab");
    expect(textAndKinds(editor).at(-1)).toEqual(["character", "MAYA"]);
    editor.setDocument(emptyScreenplay());
    editor.focus();
    type(editor, "MA");
    press(editor, "Tab");
    expect(textAndKinds(editor)).toEqual([["character", "MA"]]);
  });
});
