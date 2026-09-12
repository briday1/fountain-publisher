import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { canMutateDocument } from "../../src/fountain_publisher/web/editor-contract.mjs";

const app = await readFile(new URL("../../src/fountain_publisher/web/app.mjs", import.meta.url), "utf8");
const section = (from, to) => app.slice(app.indexOf(from), app.indexOf(to, app.indexOf(from)));
const empty = () => ({ lineCount: 3000, wordCount: 0, dialogueWords: 0, actionWords: 0, scenes: [], sections: [], characters: [], generalNotes: [], characterNotes: {}, beatSheet: { beats: [] } });

function harness(mode = "source") {
  const state = { previewMode: mode, metadata: empty(), editRevision: 0, savedSource: "", lastSourceValue: "", beatGuide: false, activeBeat: 0 };
  state.renderedInsightMetadata = state.metadata;
  const timers = new Map(), elements = new Map();
  const counts = { writes: 0, chrome: 0, sync: 0, analysis: 0, selectors: 0, classWrites: 0, charts: 0 };
  let nextTimer = 0;
  function element() {
    const classes = new Set();
    return { style: { setProperty() {} }, dataset: {}, hidden: false,
      classList: { contains: (name) => classes.has(name), toggle(name, on) { counts.classWrites++; if (on) classes.add(name); else classes.delete(name); }, remove(...names) { names.forEach((name) => classes.delete(name)); } },
      set innerHTML(value) { counts.writes++; this.markup = value; }, get innerHTML() { return this.markup || ""; },
    };
  }
  const source = { value: "", readOnly: false, selectionStart: 0, selectionEnd: 0, setSelectionRange() {} };
  const document = { hidden: false, modal: false, querySelector: (selector) => {
    if (selector.includes(":not") && document.modal?.id === "character-analytics-dialog") return null;
    return document.modal || null;
  }, body: element() };
  const page = {};
  const lines = Array.from({ length: 3000 }, (_, index) => { const line = element(); line.dataset.line = String(index); return line; });
  const context = { state, source, document, page, canMutateDocument, WeakMap,
    $: (selector) => { if (!elements.has(selector)) elements.set(selector, element()); return elements.get(selector); },
    $$: (selector) => { counts.selectors++; return selector === ".script-line" ? lines : lines.filter((line) => line.classList.contains("beat-area")); },
    setTimeout: (callback, delay) => { timers.set(++nextTimer, { callback, delay }); return nextTimer; }, clearTimeout: (id) => timers.delete(id),
    requestAnimationFrame() {}, rebaseBeatRanges: (_old, next) => next, recordHistory() {},
    analyzeLocally: (value) => { counts.analysis++; return { ...state.metadata, wordCount: value.length }; },
    renderEditorChrome: () => counts.chrome++, renderPreview() {},
    scheduleCompile() {}, scheduleWorkspaceCache() {}, collaboration: { replace: () => counts.sync++ },
    renderPageMetric() {}, renderOutline: (metadata) => JSON.stringify(metadata.scenes), escapeHtml: (value) => String(value),
    renderCharacterAnalytics() { counts.charts++; },
  };
  runInNewContext([
    section("function updateInsightHtml(", "function pageMetricParts("),
    section("function renderCharacterTable(", "function selectedBeatArea("),
    section("function sourceChanged(", "function scheduleCompile("),
  ].join("\n"), context);
  return { context, state, source, document, counts, timers, lines, elements,
    flushTimer() { const tasks = [...timers.values()]; timers.clear(); tasks.forEach(({ callback }) => callback()); },
  };
}

test("typing keeps metadata and collaboration current but coalesces sidebar DOM until a pause", () => {
  const h = harness();
  for (let index = 1; index <= 100; index++) {
    h.source.value = "word ".repeat(index);
    h.context.sourceChanged();
    assert.equal(h.state.metadata.wordCount, h.source.value.length);
  }
  assert.equal(h.counts.analysis, 100);
  assert.equal(h.counts.sync, 100);
  assert.equal(h.counts.chrome, 100);
  assert.equal(h.counts.writes, 0);
  assert.equal(h.counts.selectors, 0);
  assert.equal(h.timers.size, 1);
  assert.equal([...h.timers.values()][0].delay, 650);
  h.flushTimer();
  assert.equal(h.state.insightsDirty, false);
  assert.equal(h.state.renderedInsightMetadata.wordCount, 500);
});

test("note modals and hidden tabs retain dirty insights without drawing behind the editor", () => {
  for (const key of ["modal", "hidden"]) {
    const h = harness();
    h.document[key] = true;
    h.source.value = "Latest note source";
    h.context.sourceChanged();
    h.flushTimer();
    assert.equal(h.counts.writes, 0);
    assert.equal(h.state.insightsDirty, true);
    h.document[key] = false;
    h.context.flushInsights();
    assert.equal(h.state.insightsDirty, false);
    assert.equal(h.state.renderedInsightMetadata.wordCount, h.source.value.length);
  }
});

test("deferred flush uses the newest model and cannot resurrect an older document snapshot", () => {
  const h = harness();
  h.source.value = "Old document"; h.context.sourceChanged();
  const oldTimer = [...h.timers.values()][0].callback;
  h.state.metadata = { ...empty(), wordCount: 900, pageCount: 17 };
  h.state.insightsDirty = true;
  oldTimer();
  assert.equal(h.state.renderedInsightMetadata.wordCount, 900);
  assert.equal(h.state.metadata.pageCount, 17);
});

test("an exposed analytics chart refreshes while the covered sidebar remains paused", () => {
  const h = harness();
  h.document.modal = { id: "character-analytics-dialog" };
  h.source.value = "Collaborator changed a scene"; h.context.sourceChanged();
  h.flushTimer();
  assert.equal(h.counts.charts, 1);
  assert.equal(h.counts.writes, 0);
  assert.equal(h.state.insightsDirty, true);
});

test("changed actionable targets flush immediately instead of exposing stale note and beat controls", () => {
  const h = harness();
  for (const change of [
    { scenes: [{ line: 5, heading: "INT. ROOM" }] }, { generalNotes: [{ line: 5, text: "Note" }] },
    { characters: [{ name: "RENAMED" }] }, { beatSheet: { line: 5, beats: [{ text: "New beat" }] } },
  ]) {
    assert.equal(h.context.insightTargetsChanged(empty(), { ...empty(), ...change }), true);
  }
  assert.equal(h.context.insightTargetsChanged(empty(), { ...empty(), wordCount: 999 }), false);
});

test("Preview, PDF and Beat Sheet edits never rebuild hidden Source chrome", () => {
  for (const mode of ["live", "pdf", "beats"]) {
    const h = harness(mode);
    h.source.value = "New document text"; h.context.sourceChanged();
    assert.equal(h.counts.chrome, 0, mode);
    assert.equal(h.state.metadata.wordCount, h.source.value.length);
  }
});

test("unchanged sidebar markup retains nodes and disabled beat guides do no document queries", () => {
  const h = harness();
  h.context.renderInsights(h.state.metadata);
  const initialWrites = h.counts.writes;
  for (let index = 0; index < 100; index++) h.context.renderInsights({ ...h.state.metadata, wordCount: index });
  assert.equal(h.counts.writes, initialWrites);
  assert.equal(h.counts.selectors, 0);
});

test("a 3000-line beat area uses one selector pass and unchanged highlights do no class writes", () => {
  const h = harness("live");
  h.state.beatGuide = true;
  h.state.metadata.beatSheet = { beats: [{ text: "Full script", range: { startLine: 0, endLine: 999999999 } }] };
  h.context.renderBeatGuide();
  assert.equal(h.counts.selectors, 1);
  assert.equal(h.lines.at(-1).classList.contains("active-beat-area"), true);
  const before = h.counts.classWrites;
  const writes = h.counts.writes;
  h.context.renderBeatGuide();
  // Only the two panel/control state toggles are repeated; text-line classes stay intact.
  assert.equal(h.counts.classWrites - before, 2);
  assert.equal(h.counts.writes, writes);
  h.state.beatGuide = false;
  h.context.renderBeatGuide();
  assert.equal(h.lines[0].classList.contains("beat-area"), false);
});
