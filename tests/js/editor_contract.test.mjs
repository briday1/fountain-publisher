import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { canMutateDocument, captureEditTarget, isCurrentEditTarget } from "../../src/fountain_publisher/web/editor-contract.mjs";

const app = await readFile(new URL("../../src/fountain_publisher/web/app.mjs", import.meta.url), "utf8");
const section = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));

function harness(readOnly = true) {
  const events = [];
  const source = {
    value: "original", readOnly, selectionStart: 2, selectionEnd: 4,
    setRangeText(text, start, end) { this.value = this.value.slice(0, start) + text + this.value.slice(end); },
    setSelectionRange(start, end, direction) { this.selectionStart = start; this.selectionEnd = end; this.selectionDirection = direction; },
    focus() { events.push("focus"); }, select() { events.push("select"); },
  };
  const state = { previewMode: "source", documentRevision: 1, editRevision: 1, lastSourceValue: source.value, savedSource: source.value, history: ["first", source.value], historyIndex: 1 };
  const context = {
    state, source, events, canMutateDocument, captureEditTarget, isCurrentEditTarget, clearTimeout,
    document: { body: { classList: { toggle: () => events.push("dirty") } }, activeElement: null },
    page: { contains: () => false },
    $: () => ({ dataset: {} }),
    collaboration: { replace: () => events.push("sync"), undo: () => events.push("undo"), redo: () => events.push("redo") },
    renderPreview: () => events.push("preview"), renderEditorChrome: () => events.push("chrome"),
    rebaseBeatRanges: (_old, value) => value, recordHistory: () => events.push("history"),
    renderInsights() {}, analyzeLocally() {}, scheduleCompile: () => events.push("compile"), scheduleWorkspaceCache: () => events.push("cache"),
    navigator: { clipboard: { async writeText(text) { events.push(["clipboard", text]); }, async readText() { return "pasted"; } } },
  };
  runInNewContext([
    section("function canEditDocument(", "function transformBeatRange("),
    section("function sourceChanged(", "function scheduleCompile("),
    section("function changeVimSource(", "function syncVimPreviewPosition("),
    section("function setSourceLines(", "function appendManagedNote("),
    section("function insertAtDocumentStart(", "function parseTitleBlock("),
    section("function restoreHistory(", "function canEditDocument("),
    section("function toggleFountainEmphasis(", "async function runPreviewClipboardAction("),
    section("async function runSourceContextAction(", "function replaceExactAsteriskEmphasis("),
    section("async function runPreviewClipboardAction(", "function openCharacterNoteEditor("),
    section("function acceptCompletion(", "async function newFile("),
  ].join("\n"), context);
  return context;
}

test("the document boundary distinguishes native affordances, local commands, and explicit load/remote origins", () => {
  assert.equal(canMutateDocument({ readOnly: true }), false);
  assert.equal(canMutateDocument({ composing: true }), false);
  assert.equal(canMutateDocument({ readOnly: true }, "unknown"), false);
  assert.equal(canMutateDocument({ readOnly: true }, "load"), true);
  assert.equal(canMutateDocument({ readOnly: true }, "remote"), true);
  assert.equal(canMutateDocument({}), true);
});

test("scripted edits cannot change a view-only document, history, dirty state, or sync", async () => {
  const h = harness();
  h.changeVimSource("changed", 0, false);
  h.setSourceLines(["changed"]);
  h.insertAtDocumentStart("changed"); h.appendToSource("changed");
  h.acceptCompletion(); h.undoDocument(); h.redoDocument(); h.restoreHistory(0);
  h.toggleFountainEmphasis("bold", { start: 0, end: 2 }, "source");
  for (const action of ["cut", "paste"]) {
    await h.runSourceContextAction(action, { start: 0, end: 2 });
    await h.runPreviewClipboardAction(action, 0);
  }
  assert.equal(h.source.value, "original");
  assert.equal(h.state.historyIndex, 1);
  assert.deepEqual(h.events, []);
});

test("a missed legacy guard is rejected centrally before all editing side effects", () => {
  const h = harness(); h.source.value = "unintended scripted mutation";
  assert.equal(h.sourceChanged(), false);
  assert.equal(h.source.value, "original");
  assert.equal(h.state.editRevision, 1);
  assert.deepEqual(h.events, []);
});

test("remote and load updates still render a view-only document without granting permission", () => {
  for (const origin of ["remote", "load"]) {
    const h = harness(); h.state.collaborationApplying = true;
    h.state.previewMode = "live";
    h.source.value = "authoritative";
    assert.equal(h.sourceChanged({ origin, record: false }), true);
    assert.equal(h.source.value, "authoritative");
    assert.equal(h.source.readOnly, true);
    assert.equal(h.state.lastSourceValue, "authoritative");
    assert.ok(h.events.includes("preview"));
    assert.ok(!h.events.includes("history")); assert.ok(!h.events.includes("sync"));
  }
});

test("viewers can still copy and select all", async () => {
  const h = harness();
  await h.runSourceContextAction("copy", { start: 0, end: 3 });
  await h.runSourceContextAction("select-all", {});
  assert.deepEqual(h.events, [["clipboard", "ori"], "focus", "select"]);
});

test("clipboard completion cannot apply stale ranges after edits, document switches or permission revocation", async () => {
  for (const action of ["cut", "paste"]) for (const invalidate of [h => h.state.documentRevision++, h => h.state.editRevision++, h => h.source.readOnly = true]) {
    const h = harness(false); let finish;
    const pending = new Promise(resolve => { finish = resolve; });
    h.navigator.clipboard.writeText = () => pending;
    h.navigator.clipboard.readText = () => pending;
    const operation = h.runSourceContextAction(action, { start: 0, end: 2 });
    invalidate(h); finish("pasted");
    assert.match(await operation, /document changed/);
    assert.equal(h.source.value, "original"); assert.deepEqual(h.events, []);
  }
});

test("Drive undo and redo never fall back to stale full-document snapshots", () => {
  const h = harness(false); h.state.googleDriveFile = { id: "drive-file" }; h.state.collaborationHistoryActive = true;
  h.undoDocument(); h.redoDocument();
  assert.deepEqual(h.events, ["undo", "redo"]);
  assert.equal(h.source.value, "original"); assert.equal(h.state.historyIndex, 1);
});

test("a context menu opened before a remote edit can copy its selection but cannot cut stale coordinates", async () => {
  const h = harness(false);
  const target = captureEditTarget(h.state, h.source.value);
  const context = { start: 0, end: 3, text: "ori", target };
  h.state.editRevision++; h.source.value = "inserted original";
  assert.match(await h.runSourceContextAction("cut", context), /document changed/);
  await h.runSourceContextAction("copy", context);
  assert.deepEqual(h.events, [["clipboard", "ori"]]);
  assert.equal(h.source.value, "inserted original");
});

test("async target identity includes both revision counters and content", () => {
  const state = { documentRevision: 1, editRevision: 2 };
  const target = captureEditTarget(state, "same");
  assert.ok(isCurrentEditTarget(target, state, "same"));
  assert.equal(isCurrentEditTarget(null, state, "same"), false);
  assert.equal(isCurrentEditTarget(target, state, "other"), false);
  assert.equal(isCurrentEditTarget(target, { ...state, documentRevision: 2 }, "same"), false);
  assert.equal(isCurrentEditTarget(target, { ...state, editRevision: 3 }, "same"), false);
  assert.equal(isCurrentEditTarget(target, { ...state, previewComposing: true }, "same"), false);
});
