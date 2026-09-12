import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { canMutateDocument } from "../../src/fountain_publisher/web/editor-contract.mjs";

const app = await readFile(new URL("../../src/fountain_publisher/web/app.mjs", import.meta.url), "utf8");
function slice(start, end) {
  const first = app.indexOf(start);
  const last = app.indexOf(end, first);
  assert.ok(first >= 0 && last > first, `Missing function boundary: ${start}`);
  return app.slice(first, last);
}
const code = [
  slice("function renderPreview(", "function placeCaretAtOffset("),
  slice("function updatePreviewCursor(", "function updateCursor("),
  slice("function sourceChanged(", "function scheduleCompile("),
  slice("async function setPreviewMode(", "function showPdfLoading("),
].join("\n");

function harness(mode = "source") {
  const count = { parses: 0, html: 0, writes: 0, lineQueries: 0, chrome: 0, history: 0, sync: 0, insights: 0, compile: 0, pdf: 0 };
  const state = { previewMode: mode, previewDirty: false, previewComposing: false, sourceComposing: false,
    savedSource: "original", lastSourceValue: "original", editRevision: 0, livePreviewScrollTop: 330, livePreviewScrollLeft: 30 };
  const source = { value: "original", readOnly: false, selectionStart: 0, selectionEnd: 0, selectionDirection: "forward", focus() {}, setSelectionRange() {} };
  let content = "original";
  const page = { hidden: mode !== "live", get innerHTML() { return content; }, set innerHTML(value) { count.writes += 1; content = value; } };
  const elements = new Map();
  const element = (selector) => {
    if (!elements.has(selector)) elements.set(selector, { hidden: false, checked: true, scrollTop: 0, scrollLeft: 0, classList: { toggle() {}, add() {} } });
    return elements.get(selector);
  };
  const frames = [];
  const context = { state, source, page, canMutateDocument,
    $: (selector) => { if (selector.startsWith("[data-line=")) count.lineQueries += 1; return element(selector); },
    $$: () => [],
    document: { querySelector: () => null, body: { dataset: {}, classList: { toggle() {} } } },
    localStorage: { setItem() {} },
    classifyLines: (text) => { count.parses += 1; return text.split("\n").map((raw, index) => ({ raw, index })); },
    renderPreviewLines: (lines) => { count.html += 1; return lines.map((line) => line.raw).join("\n"); },
    renderBeatGuide() {}, renderCollaborationPresence() {}, alignAnnotationOrbs() {},
    currentPosition: () => ({ line: 0 }), revealPreviewEmptyRun() {}, scrollPreviewTarget() {},
    applyZoom() {}, clampPreviewScroll() {},
    renderEditorChrome: () => { count.chrome += 1; context.updatePreviewCursor(); },
    rebaseBeatRanges: (_before, after) => after,
    recordHistory: () => { count.history += 1; },
    analyzeLocally: (text) => ({ source: text }),
    renderInsights: (metadata) => { count.insights += 1; state.metadata = state.renderedInsightMetadata = metadata; },
    collaboration: { replace() { count.sync += 1; } },
    clearTimeout() {}, setTimeout: () => 0,
    scheduleCompile: () => { count.compile += 1; }, scheduleWorkspaceCache() {},
    sourceTabEnabled: () => true, isMobilePreview: () => false, shouldAutofocusSource: () => false,
    renderBeatSheetView() {}, persistBeatSheet() {}, refreshPdf: async () => { count.pdf += 1; },
    requestAnimationFrame: (callback) => frames.push(callback),
  };
  runInNewContext(code, context);
  return { context, state, source, page, count, element, frames };
}

test("Source typing avoids all hidden Preview classification, HTML, DOM and cursor work", async () => {
  const h = harness();
  for (let index = 0; index < 30; index += 1) {
    h.source.value = `current text ${index}`;
    assert.equal(h.context.sourceChanged(), true);
  }
  assert.equal(h.page.innerHTML, "original");
  assert.equal(h.state.previewDirty, true);
  for (const name of ["parses", "html", "writes", "lineQueries"]) assert.equal(h.count[name], 0, name);
  for (const name of ["chrome", "history", "sync", "compile"]) assert.equal(h.count[name], 30, `${name} is not deferred with Preview`);
  assert.equal(h.count.insights, 1, "only the initial sidebar is painted during continuous typing");
  assert.equal(h.state.metadata.source, "current text 29", "character-completion metadata stays current");
  await h.context.setPreviewMode("live");
  assert.equal(h.page.innerHTML, "current text 29");
  assert.equal(h.count.html, 1);
  assert.equal(h.count.writes, 1);
  assert.equal(h.state.previewDirty, false);
  assert.equal(h.page.hidden, false);
});

test("PDF and Beat Sheet changes, including read-only remote updates, refresh on return to Preview", async () => {
  for (const mode of ["pdf", "beats"]) {
    const h = harness(mode);
    h.source.readOnly = true;
    h.state.collaborationApplying = true;
    h.source.value = `remote current ${mode}\nnew line`;
    assert.equal(h.context.sourceChanged({ origin: "remote", record: false, rebaseBeats: false }), true);
    assert.equal(h.count.writes, 0, mode);
    assert.equal(h.count.history, 0, mode);
    assert.equal(h.count.sync, 0, mode);
    await h.context.setPreviewMode("live");
    assert.equal(h.page.innerHTML, h.source.value, mode);
    assert.equal(h.state.previewDirty, false, mode);
    assert.equal(h.count.writes, 1, mode);
    while (h.frames.length) h.frames.shift()();
    if (mode === "pdf") {
      assert.equal(h.element("#preview-scroll").scrollTop, 330);
      assert.equal(h.element("#preview-scroll").scrollLeft, 30);
    }
  }
});

test("edits and remote updates to the visible Preview still refresh immediately", () => {
  const h = harness("live");
  h.source.value = "new visible document";
  h.context.sourceChanged({ origin: "remote", rebaseBeats: false });
  assert.equal(h.page.innerHTML, h.source.value);
  assert.equal(h.count.writes, 1);
  assert.equal(h.state.previewDirty, false);
});

test("native Preview line edits retain the incremental DOM path without marking it stale", () => {
  const h = harness("live");
  h.source.value = "native line edit";
  h.context.sourceChanged({ fromPreview: true });
  assert.equal(h.count.writes, 0);
  assert.equal(h.count.chrome, 0);
  assert.equal(h.state.previewDirty, false);
});

test("clean view switching does not rebuild Preview and explicit rendering clears pending dirtiness", async () => {
  const h = harness();
  await h.context.setPreviewMode("live");
  assert.equal(h.count.writes, 0);
  await h.context.setPreviewMode("source");
  h.source.value = "explicitly refreshed while hidden";
  h.context.sourceChanged();
  h.context.renderPreview();
  assert.equal(h.state.previewDirty, false);
  assert.equal(h.page.innerHTML, h.source.value);
  assert.equal(h.count.writes, 1);
  await h.context.setPreviewMode("live");
  assert.equal(h.count.writes, 1, "view activation reuses the current explicit render");
});

test("composition and rejected edits never falsely mark stale Preview as current", () => {
  const h = harness();
  h.state.previewDirty = true;
  h.state.previewComposing = true;
  h.context.renderPreview();
  assert.equal(h.count.writes, 0);
  assert.equal(h.state.previewDirty, true);
  h.context.updatePreviewCursor();
  assert.equal(h.count.lineQueries, 0);
  h.state.previewComposing = false;
  h.source.readOnly = true;
  h.source.value = "unapproved change";
  assert.equal(h.context.sourceChanged(), false);
  assert.equal(h.source.value, "original");
  assert.equal(h.state.previewDirty, true);
  assert.equal(h.count.writes, 0);
});
