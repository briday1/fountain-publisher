import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

const app = await readFile(new URL("../../src/fountain_publisher/web/app.mjs", import.meta.url), "utf8");
const between = (start, end) => {
  const from = app.indexOf(start);
  const to = app.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `${start} must precede ${end}`);
  return app.slice(from, to);
};

function selectionHarness() {
  const calls = { cursor: 0, preview: 0, geometry: 0, cache: 0, completions: 0 };
  const listeners = new Map(), frames = new Map();
  let nextFrame = 0;
  const source = {
    value: "The first line\nThe second line", selectionStart: 0, selectionEnd: 0, selectionDirection: "forward",
    addEventListener(type, callback) { listeners.set(type, callback); },
  };
  const state = { sourceComposing: false, previewComposing: false };
  const document = { activeElement: source };
  const labels = { "#cursor-position": {}, "#editor-status": {} };
  const sandbox = {
    source, state, document,
    $: (selector) => labels[selector],
    currentPosition() {
      calls.cursor += 1;
      const offset = source.selectionDirection === "backward" ? source.selectionStart : source.selectionEnd;
      const lines = source.value.slice(0, offset).split("\n");
      return { line: lines.length - 1, column: lines.at(-1).length };
    },
    classifyLines: () => [{ type: "action" }, { type: "action" }],
    syncSourceCurrentLine() { calls.geometry += 1; },
    updatePreviewCursor() { calls.preview += 1; },
    scheduleWorkspaceViewCache() { calls.cache += 1; },
    hideCompletions() { calls.completions += 1; },
    requestAnimationFrame(callback) { const id = ++nextFrame; frames.set(id, callback); return id; },
  };
  runInNewContext([
    between("function updateCursor(", "function renderInsights("),
    between('source.addEventListener("click",', "let sourceTouchMenuTimer"),
  ].join("\n"), sandbox);
  sandbox.updateCursor();
  for (const key of Object.keys(calls)) calls[key] = 0;
  return {
    source, state, document, calls, sandbox, frames, labels,
    emit(type, event = {}) { listeners.get(type)(event); },
    flush() { for (const [id, callback] of [...frames]) { frames.delete(id); callback(); } },
  };
}

test("ordinary Source keyup does no extra editor work after the input commit", () => {
  const h = selectionHarness();
  for (const key of ["a", " ", "Backspace", "Delete", "Enter", "Tab", "Escape", "Shift", "Control", "Process"]) h.emit("keyup", { key });
  assert.equal(h.frames.size, 0);
  assert.deepEqual(h.calls, { cursor: 0, preview: 0, geometry: 0, cache: 0, completions: 0 });
});

test("Source navigation/select bursts paint only the latest selection once", () => {
  const h = selectionHarness();
  for (let index = 1; index < 20; index += 1) {
    h.source.selectionEnd = index;
    h.emit("select");
    h.emit("keyup", { key: "ArrowRight" });
  }
  assert.equal(h.frames.size, 1);
  assert.equal(h.calls.cursor, 0);
  h.flush();
  assert.equal(h.calls.cursor, 1);
  assert.equal(h.calls.preview, 1);
  assert.equal(h.calls.geometry, 1);
  assert.equal(h.calls.cache, 1);
  assert.equal(h.labels["#cursor-position"].textContent, "Ln 2, Col 5");
  h.emit("select"); h.emit("keyup", { key: "ArrowRight" }); h.flush();
  assert.equal(h.calls.cursor, 1, "duplicate notifications must not rewrite Preview decorations");
});

test("synchronous input painting consumes a pending select without a second update", () => {
  const h = selectionHarness();
  h.source.value += "!";
  h.source.selectionStart = h.source.selectionEnd = h.source.value.length;
  h.emit("select");
  h.sandbox.updateCursor(); // sourceChanged's immediate native-input paint
  h.flush();
  assert.equal(h.calls.cursor, 1);
  assert.equal(h.calls.preview, 1);
  assert.equal(h.calls.cache, 0, "the edit path already schedules its recovery save");
});

test("Source selection work ignores inactive fields and cancels when a note gains focus", () => {
  const h = selectionHarness();
  h.source.selectionEnd = 5;
  h.emit("select");
  h.document.activeElement = { id: "general-note-text" };
  h.flush();
  h.emit("select"); // e.g. a programmatic Source range while a note is open
  h.emit("keyup", { key: "ArrowLeft" });
  assert.equal(h.frames.size, 0);
  assert.equal(h.calls.cursor, 0);
  assert.equal(h.calls.cache, 0);
  h.document.activeElement = h.source;
  h.emit("select"); h.flush();
  assert.equal(h.calls.cursor, 1);
});

test("selection scheduling never interferes with Source or Preview composition", () => {
  const h = selectionHarness();
  h.source.selectionEnd = 5;
  h.state.sourceComposing = true;
  h.emit("select"); h.emit("keyup", { key: "ArrowLeft", isComposing: true });
  assert.equal(h.frames.size, 0);
  h.state.sourceComposing = false;
  h.emit("select");
  h.state.previewComposing = true;
  h.flush();
  assert.equal(h.calls.cursor, 0);
  h.state.previewComposing = false;
  h.emit("select"); h.flush();
  assert.equal(h.calls.cursor, 1, "cancelled composition-time work must not leave the scheduler stuck");
});

test("selection direction changes and explicit clicks retain cursor/scroll behavior", () => {
  const h = selectionHarness();
  h.source.selectionEnd = 6;
  h.emit("select"); h.flush();
  assert.equal(h.labels["#cursor-position"].textContent, "Ln 1, Col 7");
  h.source.selectionDirection = "backward";
  h.emit("select"); h.flush();
  assert.equal(h.labels["#cursor-position"].textContent, "Ln 1, Col 1");
  h.emit("click"); h.emit("select"); h.flush();
  assert.equal(h.calls.cursor, 3, "clicking an unchanged caret still reveals its Preview location");
  assert.equal(h.calls.completions, 1);
});

function beatHarness() {
  const calls = { classify: 0, cards: 0, writes: 0, graphWrites: 0, inserted: 0, prevented: 0 };
  const listeners = new Map(), timers = new Map();
  let timerId = 0;
  const listen = (id) => ({ addEventListener(type, callback) { listeners.set(`${id}:${type}`, callback); } });
  const form = listen("form"), list = listen("list");
  const premise = { value: "A premise" };
  const cards = [{ dataset: { startLine: "", endLine: "" }, input: { value: "First beat" } }];
  let graphHtml = "";
  const graph = {
    hidden: false,
    get innerHTML() { return graphHtml; },
    set innerHTML(value) { calls.graphWrites += 1; graphHtml = value; },
  };
  const dialog = { open: false, showModal() { this.open = true; } };
  const initial = `[[FP-BEATS:${encodeURIComponent(JSON.stringify({ premise: premise.value, beats: [{ text: cards[0].input.value, range: null }] }))}]]`;
  const source = { value: `One screenplay line.\n${initial}` };
  const state = { documentRevision: 1, beatSheetDocumentRevision: 1, metadata: { beatSheet: { line: 1 } } };
  const sandbox = {
    source, state,
    $(selector, card) {
      if (selector === ".beat-text") return card.input;
      const nodes = { "#beat-sheet-form": form, "#beat-list": list, "#beat-premise": premise, "#beat-progress-graph": graph, "#beat-progress-dialog": dialog };
      assert.ok(nodes[selector], `unexpected selector: ${selector}`);
      return nodes[selector];
    },
    $$(selector, root) { assert.equal(selector, ".beat-card"); assert.equal(root, list); calls.cards += 1; return cards; },
    classifyLines(value) { calls.classify += 1; return value.split("\n").map((raw) => ({ type: raw.startsWith("[[FP-") ? "note" : "action", display: raw })); },
    escapeHtml: (text) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"),
    sourceLines: () => source.value.split("\n"),
    setSourceLines(lines) { calls.writes += 1; source.value = lines.join("\n"); },
    appendManagedNote(value) { calls.writes += 1; state.metadata.beatSheet = { line: source.value.split("\n").length }; source.value += `\n${value}`; },
    deleteNoteLine(line) { calls.writes += 1; source.value = source.value.split("\n").filter((_, index) => index !== line).join("\n"); state.metadata.beatSheet = null; },
    setTimeout(callback) { const id = ++timerId; timers.set(id, callback); return id; },
    clearTimeout: (id) => timers.delete(id),
    beatCard: () => "<li></li>", renumberBeatCards() {},
  };
  runInNewContext([
    between("function managedBeatSheetSource(", "function beatCard("),
    between("function screenplayWordProgress(", "async function saveBeatProgressPng("),
    between("function currentBeatCards(", "function renderBeatSheetView("),
    between('$("#beat-list").addEventListener("keydown",', '$("#annotation-form").addEventListener("submit",'),
  ].join("\n"), sandbox);
  return {
    calls, source, state, premise, cards, graph, dialog, timers, sandbox,
    emit(type, properties = {}, id = "form") {
      const event = { preventDefault() { calls.prevented += 1; }, ...properties };
      listeners.get(`${id}:${type}`)(event);
      return event;
    },
    flush() { for (const [id, callback] of [...timers]) { timers.delete(id); callback(); } },
  };
}

test("a hidden beat graph does not inspect cards, classify screenplay text, or rewrite SVG", () => {
  const h = beatHarness();
  for (let index = 0; index < 100; index += 1) h.sandbox.renderBeatProgressGraph();
  assert.equal(h.calls.cards, 0);
  assert.equal(h.calls.classify, 0);
  assert.equal(h.calls.graphWrites, 0);
  h.cards[0].input.value = "Latest <beat>";
  h.sandbox.openBeatProgressGraph();
  assert.equal(h.dialog.open, true);
  assert.equal(h.calls.cards, 1);
  assert.equal(h.calls.classify, 1);
  assert.equal(h.calls.graphWrites, 1);
  assert.match(h.graph.innerHTML, /Latest &lt;beat&gt;/);
});

test("beat typing only schedules one trailing save and does not rebuild a hidden pacing graph", () => {
  const h = beatHarness();
  for (let index = 0; index < 100; index += 1) {
    h.cards[0].input.value = `Beat ${index}`;
    h.emit("input", { inputType: "insertText" });
  }
  assert.equal(h.timers.size, 1);
  assert.equal(h.calls.cards, 0);
  assert.equal(h.calls.classify, 0);
  assert.equal(h.calls.graphWrites, 0);
  assert.equal(h.calls.writes, 0);
  h.flush();
  assert.equal(h.calls.writes, 1);
  assert.match(decodeURIComponent(h.source.value), /Beat 99/);
  assert.equal(h.calls.classify, 0);
  assert.equal(h.calls.graphWrites, 0);
  h.emit("change"); h.flush();
  assert.equal(h.calls.writes, 1, "native change after input must not re-commit the same metadata");
});

test("beat composition cancels a pending autosave and commits only the final IME text", () => {
  const h = beatHarness();
  h.emit("input");
  h.emit("compositionstart");
  assert.equal(h.timers.size, 0);
  h.cards[0].input.value = "未確定";
  h.emit("input", { isComposing: true });
  h.emit("input", { isComposing: false }); // engines differ for composition input flags
  h.emit("change");
  h.sandbox.persistBeatSheet();
  h.flush();
  assert.equal(h.calls.writes, 0);
  assert.equal(h.calls.cards, 0);
  h.cards[0].input.value = "確定したビート";
  h.emit("compositionend");
  h.emit("input", { inputType: "insertFromComposition" });
  assert.equal(h.timers.size, 1);
  h.flush();
  assert.equal(h.calls.writes, 1);
  assert.match(decodeURIComponent(h.source.value), /確定したビート/);
});

test("IME confirmation Enter never inserts a new beat or prevents native composition", () => {
  const h = beatHarness();
  const target = { closest() { throw new Error("composing Enter must not inspect or mutate the beat card"); } };
  h.emit("keydown", { key: "Enter", isComposing: true, target }, "list");
  h.emit("keydown", { key: "Enter", keyCode: 229, target }, "list");
  h.emit("compositionstart");
  h.emit("keydown", { key: "Enter", isComposing: false, target }, "list");
  assert.equal(h.calls.prevented, 0);
  assert.equal(h.timers.size, 0);
});

test("explicit beat persistence cancels its trailing timer and an empty unchanged sheet is a no-op", () => {
  const h = beatHarness();
  h.premise.value = "Changed premise";
  h.emit("input");
  h.sandbox.persistBeatSheet();
  assert.equal(h.calls.writes, 1);
  assert.equal(h.timers.size, 0);
  h.flush();
  assert.equal(h.calls.writes, 1);
  h.premise.value = ""; h.cards[0].input.value = "";
  h.emit("input"); h.flush();
  assert.equal(h.calls.writes, 2);
  assert.equal(h.state.metadata.beatSheet, null);
  h.emit("change"); h.flush();
  assert.equal(h.calls.writes, 2);
});

test("a pending beat autosave cannot write into a replacement document", () => {
  const h = beatHarness();
  h.cards[0].input.value = "Old document's unsaved beat";
  h.emit("input");
  const oldCallback = [...h.timers.values()][0];
  h.state.documentRevision += 1;
  h.source.value = "A different screenplay";
  h.state.metadata.beatSheet = { line: null };
  h.flush();
  assert.equal(h.source.value, "A different screenplay");
  assert.equal(h.calls.writes, 0);
  assert.equal(h.calls.cards, 0);
  h.emit("compositionend");
  assert.equal(h.timers.size, 0, "an old field's late compositionend must not enqueue a save for the new document");
  h.state.beatSheetDocumentRevision = h.state.documentRevision; // new document's beat view has now rendered
  h.cards[0].input.value = "New document's beat";
  h.emit("input");
  oldCallback();
  assert.equal(h.timers.size, 1, "a superseded callback must not consume the new document's timer");
  h.flush();
  assert.equal(h.calls.writes, 1);
  assert.match(decodeURIComponent(h.source.value), /New document's beat/);
  assert.doesNotMatch(decodeURIComponent(h.source.value), /Old document's/);
});

function installModeSwitch(h) {
  const select = h.sandbox.$, selectAll = h.sandbox.$$;
  const panels = new Map();
  h.state.previewMode = "beats";
  Object.assign(h.sandbox, {
    $(selector, root) {
      if (["#beat-sheet-form", "#beat-list", "#beat-premise", "#beat-progress-graph", "#beat-progress-dialog", ".beat-text"].includes(selector)) return select(selector, root);
      if (!panels.has(selector)) panels.set(selector, { hidden: false, classList: { toggle() {} } });
      return panels.get(selector);
    },
    $$(selector, root) { return selector === '[data-preview-mode]' ? [] : selectAll(selector, root); },
    page: {}, document: { body: { dataset: {} } }, localStorage: { setItem() {} },
    sourceTabEnabled: () => true, isMobilePreview: () => false,
    renderBeatGuide() {}, applyZoom() {}, requestAnimationFrame() {}, scheduleWorkspaceCache() {},
    renderPreview() {}, renderEditorChrome() {}, shouldAutofocusSource: () => false,
  });
  runInNewContext(between("async function setPreviewMode(", "function showPdfLoading("), h.sandbox);
}

test("leaving the beat sheet flushes the latest draft before changing modes", async () => {
  const h = beatHarness(); installModeSwitch(h);
  h.cards[0].input.value = "A just-typed final beat";
  h.emit("input");
  let savedInMode;
  const write = h.sandbox.setSourceLines;
  h.sandbox.setSourceLines = (lines) => { savedInMode = h.state.previewMode; write(lines); };
  const changingMode = h.sandbox.setPreviewMode("live");
  assert.equal(h.calls.writes, 1);
  assert.equal(savedInMode, "beats");
  assert.equal(h.state.previewMode, "live");
  assert.equal(h.timers.size, 0);
  assert.match(decodeURIComponent(h.source.value), /A just-typed final beat/);
  await changingMode;
  h.flush();
  assert.equal(h.calls.writes, 1);
});

test("leaving the beat sheet during composition never commits partial IME text", async () => {
  const h = beatHarness(); installModeSwitch(h);
  h.emit("compositionstart");
  h.cards[0].input.value = "未確定";
  h.emit("input", { isComposing: true });
  await h.sandbox.setPreviewMode("live");
  assert.equal(h.calls.writes, 0);
  assert.equal(h.calls.cards, 0);
  h.cards[0].input.value = "確定";
  h.emit("compositionend"); h.flush();
  assert.equal(h.calls.writes, 1);
  assert.match(decodeURIComponent(h.source.value), /確定/);
});

test("leaving a stale beat view after document replacement cannot save its old cards", async () => {
  const h = beatHarness(); installModeSwitch(h);
  h.cards[0].input.value = "Old draft beat";
  h.emit("input");
  h.state.documentRevision += 1;
  h.source.value = "A new screenplay without any beats";
  h.state.metadata.beatSheet = { line: null };
  await h.sandbox.setPreviewMode("live");
  h.flush();
  assert.equal(h.calls.cards, 0);
  assert.equal(h.calls.writes, 0);
  assert.equal(h.source.value, "A new screenplay without any beats");
});

test("reselecting Beats flushes a draft before rerender, but preserves a composing field", async () => {
  const h = beatHarness(); installModeSwitch(h);
  h.state.metadata.beatSheet = { line: 1, premise: "A premise", beats: [{ text: "First beat", range: null }] };
  runInNewContext(between("function renderBeatSheetView(", "function openBeatSheet("), h.sandbox);
  let writtenSource;
  const write = h.sandbox.setSourceLines;
  h.sandbox.setSourceLines = (lines) => {
    write(lines); writtenSource = h.source.value;
    h.state.metadata.beatSheet.beats[0].text = h.cards[0].input.value;
  };
  h.cards[0].input.value = "Newest beat";
  h.emit("input");
  await h.sandbox.setPreviewMode("beats");
  assert.equal(h.calls.writes, 1);
  assert.match(decodeURIComponent(writtenSource), /Newest beat/);
  assert.equal(h.timers.size, 0);
  h.emit("compositionstart");
  h.cards[0].input.value = "未確定";
  const priorOwner = h.state.beatSheetDocumentRevision;
  h.sandbox.$("#beat-list").innerHTML = "Existing input nodes";
  await h.sandbox.setPreviewMode("beats");
  assert.equal(h.calls.writes, 1);
  assert.equal(h.sandbox.$("#beat-list").innerHTML, "Existing input nodes");
  assert.equal(h.state.beatSheetDocumentRevision, priorOwner);
});
