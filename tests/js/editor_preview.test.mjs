import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { parseFountainInline, replaceFountainRange } from "../../src/fountain_publisher/web/fountain-inline.mjs";
import { deletionRange, graphemeBoundaries, textDifference } from "../../src/fountain_publisher/web/text-input.mjs";

const app = await readFile(new URL("../../src/fountain_publisher/web/app.mjs", import.meta.url), "utf8");

function functionSource(name, nextName) {
  const start = app.indexOf(`function ${name}(`);
  const end = app.indexOf(`function ${nextName}(`, start);
  assert.ok(start >= 0 && end > start, `${name} must exist`);
  return app.slice(start, end);
}

function presenceHarness() {
  const source = { value: "The door opens.", setSelectionRange() {} };
  const markers = [];
  const line = {
    text: source.value,
    dataset: { line: "0", display: source.value, type: "action" },
    classList: { contains: () => false },
    get textContent() { return this.text + markers.map((marker) => marker.textContent).join(""); },
    append(marker) { markers.push(marker); },
  };
  const controls = new Map();
  const sandbox = {
    source,
    page: {},
    state: { collaborators: new Map([["remote", {
      connectionId: "remote",
      name: "Alice <Writer>",
      presence: { cursor: 3, mode: "live" },
      canEdit: true,
    }]]) },
    canEditDocument: () => true,
    parseFountainInline,
    replaceFountainRange,
    textDifference,
    $(selector) {
      if (selector === '[data-line="0"]') return line;
      if (!controls.has(selector)) controls.set(selector, {});
      return controls.get(selector);
    },
    $$: () => [...markers],
    document: {
      createElement() {
        return {
          textContent: "",
          attributes: new Map(),
          style: { setProperty() {} },
          setAttribute(name, value) { this.attributes.set(name, value); },
          remove() { markers.splice(markers.indexOf(this), 1); },
        };
      },
    },
    remoteCursorHtml: () => "",
    collaboratorColor: () => "#123456",
    escapeHtml: (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"),
    syncSourceOverlay() {},
  };
  runInNewContext(functionSource("renderCollaborationPresence", "scheduleCollaborationPresence"), sandbox);
  return { source, line, markers, sandbox };
}

test("Preview collaborator labels never become editable text or caret offsets", () => {
  const { source, line, markers, sandbox } = presenceHarness();
  sandbox.renderCollaborationPresence();
  assert.equal(markers.length, 1);
  assert.equal(markers[0].attributes.get("data-name"), "Alice <Writer>");
  assert.equal(markers[0].attributes.get("contenteditable"), "false");
  assert.equal(markers[0].attributes.get("aria-hidden"), "true");
  assert.equal(markers[0].textContent, "");
  assert.equal(line.textContent, source.value);
  assert.equal(line.textContent.length, source.value.length);

  sandbox.renderCollaborationPresence();
  assert.equal(markers.length, 1, "presence refresh replaces its decoration");
  assert.equal(line.textContent, source.value);
});

test("Preview native-input reconciliation does not save collaborator names into source", () => {
  const { source, line, sandbox } = presenceHarness();
  sandbox.renderCollaborationPresence();
  // Model native DOM input before reconciliation, with a collaborator on this line.
  line.text += "あ";
  Object.assign(sandbox, {
    line,
    docSettings: { sceneNumbers: "off" },
    fountainInlineHtml: (value) => value,
    placeCaretAtOffset() {},
    sourceChanged() {},
    classifyLines: () => [{ type: "action" }],
  });
  runInNewContext([
    functionSource("fountainInlineSourceMap", "previewTextOffset"),
    functionSource("sourceOffsetForLine", "setSourceCursorFromPreview"),
    functionSource("renderPreviewInlineContent", "replacePreviewSelection"),
    "syncPreviewLine(line);",
  ].join("\n"), sandbox);
  assert.equal(source.value, "The door opens.あ");
  assert.equal(line.dataset.display, "The door opens.あ");
});

function previewKeydownHarness() {
  let handler;
  const calls = [];
  const line = { textContent: "First line" };
  const adjacent = { textContent: "Second line" };
  const listener = app.slice(app.indexOf('page.addEventListener("keydown",'), app.indexOf('page.addEventListener("focusin",'));
  runInNewContext(listener, {
    page: { addEventListener: (_type, callback) => { handler = callback; }, focus() {} },
    state: {},
    canEditDocument: () => true,
    rememberLiteralPaste() {},
    handleVimKey: () => false,
    previewLineForNode: () => line,
    getSelection: () => ({}),
    $: () => ({ hidden: true }),
    previewCaretIsOnVisualEdge: () => true,
    previewSelection: () => ({ startLine: line, endLine: line, startOffset: 3, endOffset: 3 }),
    adjacentPreviewEditableLine: () => adjacent,
    placeCaretAtOffset: (_element, offset) => calls.push(["caret", offset]),
    setSourceCursorFromPreview() {},
    scrollPreviewTarget() {},
  });
  return {
    calls,
    keydown(options) { handler({ key: "ArrowDown", preventDefault: () => calls.push("preventDefault"), ...options }); },
  };
}

test("Preview leaves modified arrow selection and navigation to the browser", () => {
  for (const key of ["ArrowUp", "ArrowDown"]) {
    for (const modifier of ["shiftKey", "metaKey", "ctrlKey", "altKey", "isComposing"]) {
      const { calls, keydown } = previewKeydownHarness();
      keydown({ key, [modifier]: true });
      assert.deepEqual(calls, [], `${modifier} + ${key} must not collapse the selection`);
    }
  }
});

test("Preview still moves an unmodified arrow across paragraph boundaries", () => {
  for (const key of ["ArrowUp", "ArrowDown"]) {
    const { calls, keydown } = previewKeydownHarness();
    keydown({ key });
    assert.deepEqual(calls, ["preventDefault", ["caret", 3]]);
  }
});

test("Preview does not offer character completions for ordinary lowercase action", () => {
  for (const [text, character, expected] of [
    ["al", false, []],
    ["Al", false, []],
    ["AL", false, ["ALICE"]],
    ["@al", false, ["ALICE"]],
    ["al", true, ["ALICE"]],
  ]) {
    const state = { metadata: { characters: [{ name: "ALICE" }] }, previewCompletionItems: [] };
    const element = { textContent: text, classList: { contains: (name) => character && name === "character" } };
    runInNewContext(`${functionSource("showPreviewCharacterCompletions", "renderPreviewCharacterCompletions")}\nshowPreviewCharacterCompletions(element);`, {
      state,
      element,
      hidePreviewCompletions() { state.previewCompletionItems = []; },
      renderPreviewCharacterCompletions() {},
    });
    assert.deepEqual([...state.previewCompletionItems], expected, `${text}, explicit character: ${character}`);
  }
});

function previewEditHarness(raw, display, type = "action") {
  const source = { value: raw, setSelectionRange() {} };
  const line = {
    textContent: display,
    get innerHTML() { return this.html || ""; },
    set innerHTML(value) {
      this.html = value;
      this.textContent = value.replace(/<[^>]+>/g, "").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&amp;", "&");
    },
    dataset: { line: "0", type, display, prefix: "" },
    classList: { contains: (name) => name === type },
  };
  const sandbox = {
    source,
    state: {},
    canEditDocument: () => true,
    parseFountainInline,
    replaceFountainRange,
    deletionRange,
    graphemeBoundaries,
    textDifference,
    line,
    page: { focus() {} },
    docSettings: { sceneNumbers: "off" },
    placeCaretAtOffset() {},
    setSourceCursorFromPreview() {},
    sourceChanged() {},
    showPreviewCharacterCompletions() {},
    classifyLines: () => source.value.split("\n").map(() => ({ type })),
  };
  runInNewContext([
    functionSource("escapeHtml", "decodeNotePart"),
    functionSource("fountainInlineSourceMap", "previewTextOffset"),
    functionSource("sourceOffsetForLine", "setSourceCursorFromPreview"),
    functionSource("renderPreviewInlineContent", "syncPreviewLine"),
    functionSource("replacePreviewSelection", "hidePreviewCompletions"),
  ].join("\n"), sandbox);
  return {
    source,
    line,
    sandbox,
    insert(offset, text) {
      sandbox.replacePreviewSelection({ startLine: line, endLine: line, startOffset: offset, endOffset: offset }, text);
    },
    remove(offset, direction) {
      sandbox.previewDeleteSelection({ startLine: line, endLine: line, startOffset: offset, endOffset: offset }, direction);
    },
  };
}

test("Preview keeps rendered style and visible/source maps stable across consecutive edits", () => {
  const editor = previewEditHarness("**bold** and \\*literal\\*", "bold and *literal*");
  editor.insert(2, "X");
  assert.equal(editor.source.value, "**boXld** and \\*literal\\*");
  assert.equal(editor.line.dataset.display, "boXld and *literal*");
  assert.match(editor.line.innerHTML, /<strong>boXld<\/strong>/);
  editor.insert(3, "Y");
  assert.equal(editor.source.value, "**boXYld** and \\*literal\\*");
  assert.equal(editor.line.dataset.display, "boXYld and *literal*");
  assert.match(editor.line.innerHTML, /<strong>boXYld<\/strong>/);
  assert.doesNotMatch(editor.line.innerHTML, /<em>literal/);
});

test("Preview deleting a whole formatted grapheme removes its now-empty delimiters", () => {
  const editor = previewEditHarness("**👩🏽‍💻** tail", "👩🏽‍💻 tail");
  editor.remove(0, "forward");
  assert.equal(editor.source.value, " tail");
  assert.equal(editor.line.dataset.display, " tail");
});

test("Cancelled/no-change native Preview input does not create history or rewrite DOM", () => {
  const { source, line, sandbox } = presenceHarness();
  let changes = 0;
  Object.assign(sandbox, {
    canEditDocument: () => true,
    sourceChanged() { changes += 1; },
  });
  runInNewContext(functionSource("syncPreviewLine", "replacePreviewSelection"), sandbox);
  sandbox.syncPreviewLine(line);
  assert.equal(source.value, "The door opens.");
  assert.equal(changes, 0);
  assert.equal(line.innerHTML, undefined);
});

test("Soft-line deletion fallback measures the wrapped visual row rather than the paragraph", () => {
  const line = { textContent: "first second" };
  const sandbox = {
    line,
    graphemeBoundaries,
    previewTextPoint: (_line, offset) => ({ node: line, offset }),
    getSelection: () => ({ rangeCount: 1, getRangeAt: () => ({ getClientRects: () => [{ top: 20 }] }) }),
    document: {
      createRange() {
        return {
          setStart(_node, offset) { this.offset = offset; }, setEnd() {},
          getClientRects() { return [{ top: this.offset < 6 ? 0 : 20 }]; },
        };
      },
    },
  };
  runInNewContext(functionSource("previewVisualLineBounds", "previewDeleteSelection"), sandbox);
  const range = sandbox.previewVisualLineBounds(line, 9);
  assert.equal(range.start, 6);
  assert.equal(range.end, 12);
});

test("Preview typing preserves hidden forced-action markers and their indentation", () => {
  for (const prefix of ["!", "  !"]) {
    for (const offset of [0, 2, 6]) {
      const editor = previewEditHarness(`${prefix}Hello.`, "Hello.");
      editor.insert(offset, "X");
      assert.equal(editor.source.value, `${prefix}${"Hello.".slice(0, offset)}X${"Hello.".slice(offset)}`);
    }
    const editor = previewEditHarness(`${prefix} Hello.`, " Hello.");
    editor.insert(0, "X");
    assert.equal(editor.source.value, `${prefix}X Hello.`, "space after the marker remains visible");
  }
});

test("Preview deletes visible action characters without deleting the hidden force marker", () => {
  for (const prefix of ["!", "  !"]) {
    for (const [offset, direction, expected] of [[0, "forward", "ello."], [1, "backward", "ello."], [6, "backward", "Hello"]]) {
      const editor = previewEditHarness(`${prefix}Hello.`, "Hello.");
      editor.remove(offset, direction);
      assert.equal(editor.source.value, `${prefix}${expected}`);
    }
  }
});

test("Preview typing and deletion use visible offsets after single-character emphasis", () => {
  for (const marker of ["*", "**", "***", "_"]) {
    const raw = `${marker}a${marker} tail`;
    const editor = previewEditHarness(raw, "a tail");
    editor.insert(1, "X");
    assert.equal(editor.source.value, `${marker}a${marker}X tail`, marker);
    for (const [offset, direction] of [[1, "forward"], [2, "backward"]]) {
      const deletion = previewEditHarness(raw, "a tail");
      deletion.remove(offset, direction);
      assert.equal(deletion.source.value, `${marker}a${marker}tail`, `${marker} ${direction}`);
    }
    const active = editor.sandbox.activeInlineMarkers(raw, marker.length);
    assert.deepEqual([...active], [marker], "single-character formatting is recognized for line splitting too");
  }
});

test("Preview maps rendered emphasis consistently without swallowing literal text", () => {
  for (const raw of ["*a*", "**a**", "***a***", "_a_", "* a *", "unmatched *", "\\*literal", "\\_literal", "literal !"]) {
    const editor = previewEditHarness(raw, "");
    const rendered = editor.sandbox.fountainInlineHtml(raw).replace(/<[^>]+>/g, "");
    const map = editor.sandbox.fountainInlineSourceMap(raw);
    assert.equal(map.startMap.length - 1, rendered.length, raw);
    if (raw.startsWith("\\*")) {
      assert.equal(rendered, raw.slice(1), "the escape prefix is source syntax, not displayed text");
    } else if (!["*a*", "**a**", "***a***", "_a_"].includes(raw)) {
      assert.equal(rendered, raw);
      assert.deepEqual([...map.caretMap], Array.from({ length: raw.length + 1 }, (_, offset) => offset));
    }
  }
});
