import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { deletionRange, graphemeBoundaries, nativeHistoryAction, textDifference } from "../../src/fountain_publisher/web/text-input.mjs";
import { canMutateDocument } from "../../src/fountain_publisher/web/editor-contract.mjs";

const app = await readFile(new URL("../../src/fountain_publisher/web/app.mjs", import.meta.url), "utf8");

test("Preview character deletion treats emoji, combining marks, flags and joined emoji as graphemes", () => {
  for (const grapheme of ["😀", "e\u0301", "👩🏽‍💻", "🇺🇸", "👨‍👩‍👧‍👦", "한", "क्‍ष"]) {
    const value = `A${grapheme}B`;
    assert.deepEqual(deletionRange(value, 1, "deleteContentForward"), { start: 1, end: 1 + grapheme.length }, grapheme);
    assert.deepEqual(deletionRange(value, 1 + grapheme.length, "deleteContentBackward"), { start: 1, end: 1 + grapheme.length }, grapheme);
  }
});

test("Unexpected selection offsets inside a surrogate/combining sequence still delete whole graphemes", () => {
  for (const direction of ["Backward", "Forward"]) {
    assert.deepEqual(deletionRange("A😀B", 2, `deleteContent${direction}`), { start: 1, end: 3 });
    assert.deepEqual(deletionRange("Ae\u0301B", 2, `deleteContent${direction}`), { start: 1, end: 3 });
  }
});

test("Word, wrapped-line and hard-line deletion have distinct scopes", () => {
  const value = "First word. Second word.";
  const caret = value.indexOf("Second") + 6;
  assert.deepEqual(deletionRange(value, caret, "deleteWordBackward"), { start: 12, end: 18 });
  assert.deepEqual(deletionRange(value, caret, "deleteSoftLineBackward", { start: 11, end: 24 }), { start: 11, end: 18 });
  assert.deepEqual(deletionRange(value, caret, "deleteHardLineBackward"), { start: 0, end: 18 });
  assert.deepEqual(deletionRange(value, 12, "deleteWordForward"), { start: 12, end: 18 });
  assert.deepEqual(deletionRange(value, 12, "deleteSoftLineForward", { start: 11, end: 18 }), { start: 12, end: 18 });
  assert.deepEqual(deletionRange(value, 12, "deleteEntireSoftLine", { start: 11, end: 18 }), { start: 11, end: 18 });
});

test("Word deletion consumes adjacent whitespace and punctuation without negative offsets", () => {
  assert.deepEqual(deletionRange("word   ", 7, "deleteWordBackward"), { start: 0, end: 7 });
  assert.deepEqual(deletionRange("   word", 0, "deleteWordForward"), { start: 0, end: 7 });
  assert.deepEqual(deletionRange("   ", 2, "deleteWordBackward"), { start: 0, end: 2 });
  assert.deepEqual(deletionRange("hello, world", 6, "deleteWordBackward"), { start: 5, end: 6 });
});

test("Native reconciliation expands shared UTF-16 prefixes to safe grapheme edits", () => {
  for (const [before, after] of [["A😀Z", "A😁Z"], ["Ae\u0301Z", "Ae\u0300Z"], ["A👩🏽‍💻Z", "A👩🏽‍🔬Z"], ["a", "a\u0301"]]) {
    const edit = textDifference(before, after);
    assert.equal(before.slice(0, edit.start) + after.slice(edit.start, edit.newEnd) + before.slice(edit.oldEnd), after);
    assert.ok(graphemeBoundaries(before).includes(edit.start));
    assert.ok(graphemeBoundaries(before).includes(edit.oldEnd));
    assert.ok(graphemeBoundaries(after).includes(edit.start));
    assert.ok(graphemeBoundaries(after).includes(edit.newEnd));
  }
});

function inputHarness({ readOnly = false, multiline = false } = {}) {
  const listeners = { source: new Map(), preview: new Map() };
  const timers = new Map();
  const calls = [];
  let timerId = 0;
  const line = { textContent: "Before", dataset: { line: "0", display: "Before" }, isConnected: true, closest() { return this; } };
  const endLine = multiline ? { textContent: "After", dataset: { line: "1", display: "After" }, isConnected: true } : line;
  const state = { documentRevision: 1, lastSourceValue: "Before", vimMode: "insert" };
  const source = {
    value: "Before", readOnly, selectionStart: 1, selectionEnd: 2,
    addEventListener(type, handler) { listeners.source.set(type, handler); },
    setRangeText(text) { this.value = text; calls.push(["sourcePaste", text]); },
  };
  const selection = { startLine: line, endLine, startOffset: 1, endOffset: 2 };
  const sandbox = {
    state, source, nativeHistoryAction,
    document: { addEventListener() {}, activeElement: source },
    page: { addEventListener(type, handler) { listeners.preview.set(type, handler); }, contains() { return false; } },
    canEditDocument: () => canMutateDocument({ readOnly: source.readOnly, composing: state.previewComposing || state.sourceComposing }),
    collaboration: { suspendRemoteUpdates() { calls.push("suspend"); } },
    flushDeferredCollaborationDocument() { calls.push("resume"); },
    scheduleCompile() { state.compileSchedules = (state.compileSchedules || 0) + 1; },
    previewLineForNode: (node) => node?.line || line,
    previewTextOffset: (_line, _node, offset) => offset,
    previewSelection: () => selection,
    getSelection: () => ({}),
    sourceChanged() { calls.push(["commit", source.value]); state.lastSourceValue = source.value; },
    syncPreviewLine(target) { source.value = target.textContent; calls.push(["reconcile", target.textContent]); },
    renderPreview() { calls.push("render"); },
    replacePreviewSelection(edit, text) { calls.push(["replace", edit, text]); },
    previewDeleteSelection(edit, direction, inputType) { calls.push(["delete", edit, direction, inputType]); },
    hideCompletions() {}, hidePreviewCompletions() {}, showCompletions() {}, showPreviewCharacterCompletions() {},
    scheduleCollaborationPresence() {},
    vimActive: () => false,
    normalizeScreenplayPaste: (text) => ({ text: `normalized:${text}`, reconstructed: true }),
    toast(message) { calls.push(["toast", message]); },
    undoDocument() { calls.push("undo"); },
    redoDocument() { calls.push("redo"); },
    setTimeout(callback) { const id = ++timerId; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); },
    Date,
  };
  const helperStart = app.indexOf("function beginEditorComposition(");
  const helperEnd = app.indexOf('source.addEventListener("scroll",', helperStart);
  const pageStart = app.indexOf('page.addEventListener("compositionstart",');
  const pageEnd = app.indexOf('page.addEventListener("keydown",', pageStart);
  runInNewContext(app.slice(helperStart, helperEnd) + app.slice(pageStart, pageEnd), sandbox);
  return {
    state, source, line, endLine, calls, sandbox, timers,
    send(surface, type, properties = {}) {
      let prevented = false;
      listeners[surface].get(type)({ target: line, preventDefault() { prevented = true; }, ...properties });
      return prevented;
    },
    finish() { for (const [id, callback] of [...timers]) { timers.delete(id); callback(); } },
  };
}

test("Preview composition owns native DOM until the final input after compositionend", () => {
  const editor = inputHarness();
  editor.send("preview", "compositionstart");
  editor.line.textContent = "Beforeあ";
  assert.equal(editor.send("preview", "beforeinput", { inputType: "insertCompositionText", isComposing: true }), false);
  editor.send("preview", "input", { inputType: "insertCompositionText", isComposing: true });
  assert.deepEqual(editor.calls, ["suspend"]);
  assert.equal(editor.source.value, "Before");
  editor.send("preview", "compositionend", { data: "愛" });
  editor.line.textContent = "Before愛";
  assert.equal(editor.send("preview", "beforeinput", { inputType: "insertText", data: "愛" }), false);
  editor.send("preview", "input", { inputType: "insertText", data: "愛" });
  assert.equal(editor.state.previewComposing, true);
  assert.deepEqual(editor.calls, ["suspend"]);
  editor.finish();
  assert.equal(editor.state.previewComposing, false);
  assert.deepEqual(editor.calls, ["suspend", ["reconcile", "Before愛"], "resume"]);
});

test("Source composition publishes one completed value, without intermediate history or rerenders", () => {
  const editor = inputHarness();
  editor.send("source", "compositionstart");
  for (const value of ["Beforeㅎ", "Before하", "Before한"]) {
    assert.equal(editor.send("source", "beforeinput", { isComposing: true, inputType: "insertCompositionText" }), false);
    editor.source.value = value;
    editor.send("source", "input", { isComposing: true, inputType: "insertCompositionText" });
  }
  assert.deepEqual(editor.calls, ["suspend"]);
  editor.send("source", "compositionend", { data: "한" });
  editor.send("source", "input", { inputType: "insertText", data: "한" });
  editor.finish();
  assert.deepEqual(editor.calls, ["suspend", ["commit", "Before한"], "resume"]);
  editor.send("source", "input", { inputType: "insertText", data: "한" });
  assert.equal(editor.calls.filter((call) => call[0] === "commit").length, 1);
});

test("Cancelled Source composition creates no edit transaction", () => {
  const editor = inputHarness();
  editor.send("source", "compositionstart");
  editor.source.value = "BeforeX";
  editor.send("source", "input", { isComposing: true });
  editor.source.value = "Before";
  editor.send("source", "compositionend", { data: "" });
  editor.finish();
  assert.deepEqual(editor.calls, ["suspend", "resume"]);
  assert.equal(editor.state.compileSchedules, 1, "cancelled input retries any compile discarded during composition");
});

test("A completed composition from a replaced document cannot mutate or resume a new session", () => {
  for (const surface of ["source", "preview"]) {
    const editor = inputHarness();
    editor.send(surface, "compositionstart");
    editor.send(surface, "compositionend", { data: "Old" });
    editor.state.documentRevision += 1;
    editor.source.value = "New document";
    editor.finish();
    assert.equal(editor.source.value, "New document");
    assert.deepEqual(editor.calls, ["suspend"]);
  }
});

test("Cross-paragraph IME replacement uses the original selection, not removed native DOM text", () => {
  const editor = inputHarness({ multiline: true });
  editor.send("preview", "compositionstart");
  editor.line.textContent = "B愛ter";
  editor.endLine.textContent = "";
  editor.endLine.isConnected = false;
  editor.send("preview", "compositionend", { data: "愛" });
  editor.finish();
  const replacement = editor.calls.find((call) => call[0] === "replace");
  assert.equal(replacement[1].startDisplay, "Before");
  assert.equal(replacement[1].endDisplay, "After");
  assert.equal(replacement[2], "愛");
});

test("Composition initialization ignores read-only documents", () => {
  const editor = inputHarness({ readOnly: true });
  for (const surface of ["source", "preview"]) {
    editor.send(surface, "compositionstart");
    assert.equal(editor.state[`${surface}Composing`], undefined);
    assert.equal(editor.send(surface, "beforeinput", { inputType: "insertCompositionText", isComposing: true }), true);
  }
  assert.deepEqual(editor.calls, []);
});

test("Native browser/menu Undo and Redo route through document history on both surfaces", () => {
  for (const surface of ["source", "preview"]) {
    const editor = inputHarness();
    assert.equal(editor.send(surface, "beforeinput", { inputType: "historyUndo" }), true);
    assert.equal(editor.send(surface, "beforeinput", { inputType: "historyRedo" }), true);
    assert.deepEqual(editor.calls, ["undo", "redo"]);
  }
});

test("Read-only browser history, paste and drop cannot mutate document history or text", () => {
  for (const surface of ["source", "preview"]) {
    const editor = inputHarness({ readOnly: true });
    for (const inputType of ["historyUndo", "historyRedo", "insertFromDrop", "deleteByCut"]) {
      assert.equal(editor.send(surface, "beforeinput", { inputType }), true);
    }
    assert.equal(editor.send(surface, "paste", { clipboardData: { getData: () => "pasted" } }), true);
    assert.deepEqual(editor.calls, []);
  }
});

test("Preview autocorrection/replacement uses native target ranges instead of stale caret selection", () => {
  const editor = inputHarness();
  const start = { line: editor.line };
  const end = { line: editor.line };
  editor.send("preview", "beforeinput", {
    inputType: "insertReplacementText", data: "After",
    getTargetRanges: () => [{ startContainer: start, startOffset: 0, endContainer: end, endOffset: 6 }],
  });
  const replacement = editor.calls.find((call) => call[0] === "replace");
  assert.equal(replacement[1].startOffset, 0);
  assert.equal(replacement[1].endOffset, 6);
  assert.equal(replacement[2], "After");
});

test("Non-cancelable native replacements are reconciled once instead of applied twice", () => {
  const editor = inputHarness();
  assert.equal(editor.send("preview", "beforeinput", { inputType: "insertReplacementText", data: "After", cancelable: false }), false);
  assert.deepEqual(editor.calls, []);
  editor.line.textContent = "After";
  editor.send("preview", "input", { inputType: "insertReplacementText", data: "After" });
  assert.deepEqual(editor.calls, [["reconcile", "After"]]);
});

test("Replacement events without a text payload do not silently delete the selection", () => {
  const editor = inputHarness();
  assert.equal(editor.send("preview", "beforeinput", { inputType: "insertReplacementText", data: null }), false);
  assert.deepEqual(editor.calls, []);
  editor.line.textContent = "Autocorrected";
  editor.send("preview", "input", { inputType: "insertReplacementText", data: null });
  assert.deepEqual(editor.calls, [["reconcile", "Autocorrected"]]);
});

test("Preview line/word deletion retains the browser's target range and input type", () => {
  for (const inputType of ["deleteWordBackward", "deleteSoftLineBackward", "deleteHardLineForward", "deleteEntireSoftLine"]) {
    const editor = inputHarness();
    editor.send("preview", "beforeinput", {
      inputType,
      getTargetRanges: () => [{ startContainer: { line: editor.line }, startOffset: 0, endContainer: { line: editor.line }, endOffset: 3 }],
    });
    const deletion = editor.calls.find((call) => call[0] === "delete");
    assert.equal(deletion[1].endOffset, 3);
    assert.equal(deletion[3], inputType);
  }
});

test("Ctrl/Command+Shift+V bypasses PDF heuristics once in either surface", () => {
  for (const modifier of ["ctrlKey", "metaKey"]) {
    for (const surface of ["source", "preview"]) {
      const editor = inputHarness();
      editor.sandbox.rememberLiteralPaste({ [modifier]: true, shiftKey: true, key: "V" });
      editor.send(surface, "paste", { clipboardData: { getData: () => "    Literal\r\n    lines" } });
      const paste = editor.calls.find((call) => ["sourcePaste", "replace"].includes(call[0]));
      assert.equal(paste.at(-1), "    Literal\n    lines");
      assert.equal(editor.calls.some((call) => call[0] === "toast"), false);
      assert.equal(editor.state.literalPasteUntil, 0);
      editor.calls.length = 0;
      editor.send(surface, "paste", { clipboardData: { getData: () => "Next" } });
      assert.equal(editor.calls.find((call) => ["sourcePaste", "replace"].includes(call[0])).at(-1), "normalized:Next");
      assert.match(editor.calls.find((call) => call[0] === "toast")[1], /paste literally/);
    }
  }
});
