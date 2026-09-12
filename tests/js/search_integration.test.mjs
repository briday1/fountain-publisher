import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";
import { canMutateDocument } from "../../src/fountain_publisher/web/editor-contract.mjs";
import { CollaborationClient } from "../../src/fountain_publisher/web/collaboration.mjs";
import * as Y from "../../src/fountain_publisher/web/vendor/yjs.mjs";

const app = await readFile(new URL("../../src/fountain_publisher/web/app.mjs", import.meta.url), "utf8");
const slice = (start, end) => {
  const first = app.indexOf(start);
  const last = app.indexOf(end, first);
  assert.ok(first >= 0 && last > first, `Missing integration boundary: ${start}`);
  return app.slice(first, last);
};
const metadataCode = `${app.match(/^const MANAGED_NOTE_RE = .+;$/m)[0]}
${slice("function decodeNotePart(", "function isScene(")}
${slice("function transformBeatRange(", "function sourceChanged(")}
${slice("function managedBeatSheetSource(", "function beatCard(")}`;
const historyCode = slice("function recordHistory(", "function transformBeatRange(");
const sourceChangedCode = slice("function sourceChanged(", "function scheduleCompile(");
const editCode = slice("function planSearchEdits(", "state.documentSearch = createDocumentSearch(");
const navigationCode = `${slice("function previewLineIsEditable(", "function adjacentPreviewEditableLine(")}
${slice("function captureSearchSelection(", "function planSearchEdits(")}`;
const plain = (value) => JSON.parse(JSON.stringify(value));

function harness(value) {
  const events = [];
  const source = { value, selectionStart: 0, selectionEnd: 0, selectionDirection: "forward", readOnly: false,
    setSelectionRange(start, end, direction = "forward") { this.selectionStart = start; this.selectionEnd = end; this.selectionDirection = direction; },
    focus() {},
  };
  const state = { documentRevision: 4, editRevision: 9, previewMode: "source", previewComposing: false, sourceComposing: false,
    collaborationHistoryActive: false, collaborationApplying: false, history: [value], historyIndex: 0, historyExact: [false],
    lastSourceValue: value, savedSource: value,
  };
  const collaboration = { replace(text) { events.push({ type: "replace", text }); }, applyEdits() { return false; } };
  const context = vm.createContext({ state, source, collaboration, canMutateDocument,
    document: { activeElement: source, querySelector: () => null, body: { classList: { toggle() {} } } },
    page: { contains: () => false },
    renderEditorChrome() {}, renderPreview() {}, renderInsights() {}, analyzeLocally() {},
    clearTimeout() {}, setTimeout() { return 0; },
    scheduleCompile() {}, scheduleWorkspaceCache() {},
  });
  vm.runInContext(`${metadataCode}\n${historyCode}\n${sourceChangedCode}\n${editCode}`, context);
  const changed = context.sourceChanged;
  context.sourceChanged = (options) => { events.push({ type: "sourceChanged", options: plain(options || {}) }); return changed(options); };
  const target = () => ({ text: source.value, documentRevision: state.documentRevision, editRevision: state.editRevision });
  const sheet = () => plain(context.parseManagedNotes(source.value.split("\n")).beatSheet);
  return { context, state, source, events, target, sheet };
}

function screenplay(h, body = ["alpha ONE", "middle", "anchor a", "anchor b", "between", "omega TWO", "tail"]) {
  return [...body, "", h.context.managedBeatSheetSource("Premise", [{ text: "Keep this passage", range: { startLine: 2, endLine: 3 } }])].join("\n");
}
function editWord(value, word, text) { const start = value.indexOf(word); assert.ok(start >= 0); return { start, end: start + word.length, text }; }
function applyPlan(value, edits) {
  for (let index = edits.length - 1; index >= 0; index -= 1) value = value.slice(0, edits[index].start) + edits[index].text + value.slice(edits[index].end);
  return value;
}

test("distant newline insertions rebase each beat interval without consuming untouched passages", () => {
  const h = harness("");
  const original = screenplay(h);
  const edits = [editWord(original, "ONE", "ONE\nnew first line"), editWord(original, "TWO", "TWO\nnew last line")];
  const plan = h.context.planSearchEdits(original, edits);
  assert.equal(plan.length, 3, "two text edits and the rebased beat assignment");
  const result = applyPlan(original, plan);
  const beats = plain(h.context.parseManagedNotes(result.split("\n")).beatSheet.beats);
  assert.deepEqual(beats[0].range, { startLine: 3, endLine: 4 });
  assert.equal(result.split("\n").slice(3, 5).join("\n"), "anchor a\nanchor b");
  assert.deepEqual(edits, [editWord(original, "ONE", "ONE\nnew first line"), editWord(original, "TWO", "TWO\nnew last line")], "planner does not mutate caller edits");
});

test("distant whole-line deletions retain and shift the assigned beat passage", () => {
  const h = harness("");
  const original = screenplay(h, ["opening", "DELETE A", "anchor a", "anchor b", "DELETE B", "ending"]);
  const edits = [editWord(original, "DELETE A\n", ""), editWord(original, "DELETE B\n", "")];
  const result = applyPlan(original, h.context.planSearchEdits(original, edits));
  const beats = plain(h.context.parseManagedNotes(result.split("\n")).beatSheet.beats);
  assert.deepEqual(beats[0].range, { startLine: 1, endLine: 2 });
  assert.equal(result.split("\n").slice(1, 3).join("\n"), "anchor a\nanchor b");
});

test("ordinary word replacement does not normalize unrelated managed metadata", () => {
  const h = harness("");
  const note = `  [[FP-BEATS:${encodeURIComponent(JSON.stringify({ beats: [{ text: "Beat", range: { startLine: 1, endLine: 1 }, custom: "preserve" }], premise: "Premise", extra: 42 }))}]]  `;
  const original = `first\nsecond\n\n${note}`;
  const plan = h.context.planSearchEdits(original, [editWord(original, "first", "opening")]);
  assert.equal(plan.length, 1, "unrelated word replacement must not rewrite FP-BEATS");
  assert.ok(applyPlan(original, plan).endsWith(note));
});

test("newlines after all assigned beats do not normalize unaffected metadata", () => {
  const h = harness("");
  const note = ` [[FP-BEATS:${encodeURIComponent(JSON.stringify({ beats: [{ text: "Beat", range: { startLine: 0, endLine: 0 } }], premise: "Premise" }))}]] `;
  const original = `first\nlater\n${note}`;
  const plan = h.context.planSearchEdits(original, [editWord(original, "later", "later\nmore")]);
  assert.equal(plan.length, 1);
  assert.ok(applyPlan(original, plan).endsWith(note));
});

test("explicit metadata matches remain exactly the requested edit with no second metadata rewrite", () => {
  const h = harness("");
  const original = screenplay(h);
  const edits = [editWord(original, "Premise", "Revised")];
  const plan = h.context.planSearchEdits(original, edits);
  assert.deepEqual(plain(plan), edits);
  assert.equal(h.context.parseManagedNotes(applyPlan(original, plan).split("\n")).beatSheet.premise, "Revised");
});

test("replacement ending just before a managed note still rebases earlier line changes", () => {
  const h = harness("");
  const note = h.context.managedBeatSheetSource("Premise", [{ text: "Beat", range: { startLine: 2, endLine: 2 } }]);
  const original = `opening\n\nanchor\n\nending\n\n${note}`;
  const edits = [...original.matchAll(/\n\n/g)].map((match) => ({ start: match.index, end: match.index + 2, text: "\n" }));
  const result = applyPlan(original, h.context.planSearchEdits(original, edits));
  const beat = h.context.parseManagedNotes(result.split("\n")).beatSheet.beats[0];
  assert.deepEqual(plain(beat.range), { startLine: 1, endLine: 1 });
  assert.equal(result.split("\n")[beat.range.startLine], "anchor");
});

test("newline replacement ending at an untouched beat line start does not absorb that line", () => {
  const h = harness("");
  const note = h.context.managedBeatSheetSource("Premise", [{ text: "Beat", range: { startLine: 2, endLine: 2 } }]);
  const original = `opening\n\nanchor\nending\n\n${note}`;
  const start = original.indexOf("\n\n");
  const result = applyPlan(original, h.context.planSearchEdits(original, [{ start, end: start + 2, text: "\n" }]));
  const beat = h.context.parseManagedNotes(result.split("\n")).beatSheet.beats[0];
  assert.deepEqual(plain(beat.range), { startLine: 1, endLine: 1 });
});

test("local replace-all is one exact undo/redo step including rebased beat assignments", () => {
  const setup = harness("");
  const original = screenplay(setup);
  const h = harness(original);
  const edits = [editWord(original, "ONE", "ONE\ninserted"), editWord(original, "TWO", "TWO\ninserted")];
  assert.equal(h.context.applySearchEdits(edits, h.target()), true);
  const replaced = h.source.value;
  assert.deepEqual(h.sheet().beats[0].range, { startLine: 3, endLine: 4 });
  assert.equal(h.state.history.length, 2);
  const change = h.events.find((event) => event.type === "sourceChanged");
  assert.equal(change.options.rebaseBeats, false);
  assert.equal(change.options.exactHistory, true);
  h.context.undoDocument();
  assert.equal(h.source.value, original);
  h.context.redoDocument();
  assert.equal(h.source.value, replaced);
});

test("search replacement inside a managed note can be undone exactly", () => {
  const setup = harness("");
  const original = screenplay(setup);
  const h = harness(original);
  assert.equal(h.context.applySearchEdits([editWord(original, "Premise", "Revised")], h.target()), true);
  assert.equal(h.sheet().premise, "Revised");
  h.context.undoDocument();
  assert.equal(h.source.value, original);
});

test("a normal edit after undoing replacement drops its redo edge and keeps ordinary metadata behavior", () => {
  const setup = harness("");
  const original = screenplay(setup);
  const h = harness(original);
  h.context.applySearchEdits([editWord(original, "Premise", "Revised")], h.target());
  h.context.undoDocument();
  h.source.value = original.replace("alpha", "opening");
  h.context.sourceChanged();
  assert.deepEqual(plain(h.state.historyExact), [false, false], "normal branch must not inherit the discarded exact redo edge");
  const branch = h.source.value;
  h.context.redoDocument();
  assert.equal(h.source.value, branch, "discarded search replacement cannot be redone");
  // Managed notes changed outside a text edit stay current during ordinary undo.
  h.source.value = branch.replace("Premise", "Updated");
  h.context.sourceChanged({ record: false });
  h.context.undoDocument();
  assert.equal(h.sheet().premise, "Updated");
  assert.ok(h.source.value.startsWith("alpha ONE"));
});

test("bounded history retains exact replacement edges after dropping the oldest entries", () => {
  const h = harness("entry 0");
  const snapshots = [h.source.value];
  for (let index = 1; index <= 252; index += 1) {
    if (index % 2) {
      h.context.applySearchEdits([{ start: 0, end: h.source.value.length, text: `entry ${index}` }], h.target());
    } else {
      h.source.value = `entry ${index}`;
      h.context.sourceChanged();
    }
    snapshots.push(h.source.value);
  }
  assert.equal(h.state.history.length, 250);
  assert.equal(h.state.historyExact.length, 250);
  assert.equal(h.state.historyIndex, 249);
  assert.deepEqual(plain(h.state.history), snapshots.slice(-250));
  assert.deepEqual(plain(h.state.historyExact), snapshots.slice(-250).map((text) => Number(text.split(" ")[1]) % 2 === 1));
  for (let index = 251; index >= 3; index -= 1) {
    h.context.undoDocument();
    assert.equal(h.source.value, snapshots[index]);
  }
  h.context.undoDocument();
  assert.equal(h.source.value, snapshots[3], "oldest retained entry is an undo boundary");
  for (let index = 4; index <= 252; index += 1) {
    h.context.redoDocument();
    assert.equal(h.source.value, snapshots[index]);
  }
});

test("read-only, composition, stale revisions and stale content reject before mutation or publication", () => {
  for (const problem of ["readOnly", "sourceComposing", "previewComposing", "documentRevision", "editRevision", "text"]) {
    const h = harness("old text");
    const target = h.target();
    if (problem === "readOnly") h.source.readOnly = true;
    else if (problem.endsWith("Composing")) h.state[problem] = true;
    else if (problem === "text") target.text = "stale text";
    else target[problem] -= 1;
    assert.equal(h.context.applySearchEdits([{ start: 0, end: 3, text: "new" }], target), false, problem);
    assert.equal(h.source.value, "old text", problem);
    assert.equal(h.events.length, 0, problem);
    assert.equal(h.state.history.length, 1, problem);
  }
});

function attachCollaboration(h, t) {
  const client = new CollaborationClient({ onDocument() {}, onPresence() {}, onStatus() {} });
  const doc = new Y.Doc();
  const text = doc.getText("source");
  text.insert(0, h.source.value);
  Object.assign(client, { doc, text, closed: false, synced: true, canEdit: true,
    undoManager: new Y.UndoManager(text, { trackedOrigins: new Set([client.localOrigin]) }),
  });
  h.state.collaborationHistoryActive = true;
  h.context.collaboration = client;
  text.observe((event, transaction) => h.events.push({ type: "crdt", editorBefore: h.source.value,
    text: text.toString(), delta: plain(event.delta), origin: transaction.origin }));
  t.after(() => { client.undoManager.destroy(); doc.destroy(); });
  return client;
}

test("collaborative replace-all publishes a sparse atomic batch before changing the editor", (t) => {
  const setup = harness("");
  const original = screenplay(setup);
  const h = harness(original);
  const client = attachCollaboration(h, t);
  const anchorOffset = original.indexOf("anchor a");
  const relative = Y.createRelativePositionFromTypeIndex(client.text, anchorOffset);
  const edits = [editWord(original, "ONE", "ONE\ninserted"), editWord(original, "TWO", "TWO\ninserted")];
  assert.equal(h.context.applySearchEdits(edits, h.target()), true);
  const transactions = h.events.filter((event) => event.type === "crdt");
  assert.equal(transactions.length, 1);
  assert.equal(transactions[0].editorBefore, original);
  assert.equal(transactions[0].origin, client.localOrigin);
  assert.equal(client.text.toString(), h.source.value);
  assert.ok(transactions[0].delta.some((part) => part.retain > "anchor a\nanchor b".length), "untouched middle CRDT identities survive");
  const resolved = Y.createAbsolutePositionFromRelativePosition(relative, client.doc);
  assert.equal(resolved.index, h.source.value.indexOf("anchor a"));
  assert.ok(h.events.findIndex((event) => event.type === "crdt") < h.events.findIndex((event) => event.type === "sourceChanged"));
  assert.equal(h.events.find((event) => event.type === "sourceChanged").options.rebaseBeats, false);
  assert.equal(client.undo(), true);
  assert.equal(client.text.toString(), original, "CRDT undo includes both replacements and metadata in one transaction");
});

test("connected initial-sync, paused, revoked and diverged rooms cannot fall back to a buffer replacement", (t) => {
  for (const condition of ["initial-sync", "paused", "revoked", "diverged"]) {
    const h = harness("old text");
    const client = attachCollaboration(h, t);
    if (condition === "initial-sync") client.synced = false;
    if (condition === "paused") client.closed = true;
    if (condition === "revoked") client.canEdit = false;
    if (condition === "diverged") client.text.insert(0, "remote ");
    h.events.length = 0;
    assert.equal(h.context.applySearchEdits([{ start: 0, end: 3, text: "new" }], h.target()), false, condition);
    assert.equal(h.source.value, "old text", condition);
    assert.equal(h.events.length, 0, condition);
  }
});

function navigationHarness({ value = "MAYA", rangeText = value, types = ["script-line", "action"], readOnly = false } = {}) {
  const calls = [];
  const query = { focus() { document.activeElement = query; calls.push("query-focus"); } };
  const source = { value, readOnly, selectionStart: 0, selectionEnd: 0,
    setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; },
    focus() { document.activeElement = source; calls.push("source-focus"); },
  };
  const page = { focus() { document.activeElement = page; }, contains: () => false };
  const state = { previewMode: "live", documentRevision: 4, vimMode: "normal" };
  const line = { classList: { contains: (name) => types.includes(name) } };
  const range = { setStart() {}, setEnd() {}, toString: () => rangeText,
    cloneRange() { return { collapse() {}, marker: "clone" }; },
  };
  const document = { activeElement: query, body: { classList: { remove: (name) => calls.push(name) } }, createRange: () => range };
  const highlight = new Map();
  const context = vm.createContext({ state, source, page, document,
    CSS: { highlights: highlight }, Highlight: class { constructor(range) { this.range = range; } },
    captureEditorSelection: () => ({ anchor: 3, head: 1, relative: "relative", documentRevision: 4 }),
    vimLinePosition: (offset) => ({ line: value.slice(0, offset).split("\n").length - 1 }),
    $: (selector) => selector.startsWith("[data-line=") ? line : { textContent: "" },
    previewPointAtSourceOffset: (offset) => ({ node: line, offset }),
    sourceTabEnabled: () => false,
    localStorage: { setItem: (...args) => calls.push(args) },
    setPreviewMode: (mode) => { state.previewMode = mode; document.activeElement = source; calls.push(mode); },
    getSelection: () => ({ removeAllRanges() {}, addRange() { document.activeElement = page; } }),
    scrollPreviewTarget() { calls.push("scroll-preview"); }, scrollSourceTarget() { calls.push("scroll-source"); },
    updateCursor() {}, scheduleWorkspaceCache() {}, focusVimSelection() { calls.push("visual-selection"); },
  });
  vm.runInContext(navigationCode, context);
  return { context, state, source, page, query, document, calls, highlight };
}

test("search capture preserves direction and relative anchor while remembering the editor surface", () => {
  const h = navigationHarness();
  assert.deepEqual(plain(h.context.captureSearchSelection()), { anchor: 3, head: 1, relative: "relative", documentRevision: 4, surface: "preview" });
  h.state.previewMode = "source";
  assert.equal(h.context.captureSearchSelection().surface, "source");
});

test("read-only Preview matches remain in Preview and preserve focus in the search input", () => {
  const h = navigationHarness({ readOnly: true });
  assert.equal(h.context.navigateSearchMatch({ start: 0, end: 4 }, { surface: "preview" }), "");
  assert.equal(h.state.previewMode, "live");
  assert.equal(h.document.activeElement, h.query);
  assert.equal(h.source.selectionEnd, 4);
  assert.equal(h.highlight.has("document-search-current"), true);
  assert.ok(h.calls.includes("scroll-preview"));
});

test("hidden Fountain markers or managed metadata fall back to Source without stealing search focus", () => {
  for (const options of [{ value: "!ACTION", rangeText: "ACTION" },
    { value: "[[FP-GENERAL:private]]", types: ["script-line", "note"] }]) {
    const h = navigationHarness(options);
    assert.equal(h.context.navigateSearchMatch({ start: 0, end: h.source.value.length }, { surface: "preview" }), "Shown in Source (hidden Fountain text)");
    assert.equal(h.state.previewMode, "source");
    assert.equal(h.document.activeElement, h.query);
    assert.equal(h.highlight.size, 0);
    assert.ok(h.calls.some((call) => Array.isArray(call) && call[0] === "fountain-publisher.source-tab" && call[1] === "true"));
    assert.ok(h.calls.includes("scroll-source"));
  }
});

test("explicit navigation can focus the result, but composition blocks all navigation side effects", () => {
  const h = navigationHarness();
  h.context.navigateSearchMatch({ start: 0, end: 4 }, { focus: true, surface: "preview" });
  assert.equal(h.document.activeElement, h.page);
  h.calls.length = 0;
  h.state.previewComposing = true;
  assert.equal(h.context.navigateSearchMatch({ start: 1, end: 2 }), "Finish composing text first");
  assert.equal(h.calls.length, 0);
  assert.equal(h.source.selectionStart, 0);
  assert.equal(h.source.selectionEnd, 4);
});
