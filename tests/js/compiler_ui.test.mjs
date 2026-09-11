import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

const app = await readFile(new URL("../../src/fountain_publisher/web/app.mjs", import.meta.url), "utf8");
function section(start, end) {
  const offset = app.indexOf(start);
  const limit = app.indexOf(end, offset);
  assert.ok(offset >= 0 && limit > offset, `Missing production section: ${start}`);
  return app.slice(offset, limit);
}

function harness() {
  const elements = new Map();
  const jobs = [], downloads = [], metrics = [], urls = [], revoked = [], notices = [];
  const timers = new Map();
  let nextTimer = 0;
  const state = { documentRevision: 1, compileRevision: 1, pdfRevision: 0, filename: "First.fountain", previewMode: "live", metadata: { titleFields: [], pageCount: 5, lastPageEighths: 6 } };
  const source = { value: "INT. FIRST - DAY\n\nFirst draft." };
  const docSettings = { sceneNumbers: "margin", sceneNumberFormat: "sequential" };
  const $ = id => {
    if (!elements.has(id)) elements.set(id, { value: "letter", hidden: false, disabled: false, innerHTML: "", textContent: "", title: "", classList: { add() {}, remove() {} }, close() { this.closed = true; } });
    return elements.get(id);
  };
  const context = {
    state, source, docSettings, $, Error,
    setTimeout(callback) { const id = ++nextTimer; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); },
    compileLocally(kind, request, options) {
      return new Promise((resolve, reject) => jobs.push({ kind, request, options, resolve, reject }));
    },
    renderPageMetric(metadata) { metrics.push({ ...metadata }); },
    shareOrDownload: async (blob, filename) => downloads.push({ blob, filename }),
    toast: message => notices.push(message),
    escapeHtml: text => text.replaceAll("<", "&lt;"),
    URL: { createObjectURL(blob) { const url = `blob:local-${urls.length}`; urls.push({ url, blob }); return url; }, revokeObjectURL: url => revoked.push(url) },
    fetch() { assert.fail("Compilation must never contact a server"); },
  };
  runInNewContext([
    section("function scheduleCompile(", "function completionCandidates("),
    section("function normalizedFilename(", "async function download("),
    section("async function exportDocument(", "function openExport("),
    section("function showPdfLoading(", "function setTheme("),
  ].join("\n"), context);
  return { context, state, source, docSettings, $, jobs, downloads, metrics, urls, revoked, notices, timers };
}

const result = (label, pageCount = 2, lastPageEighths = 3) => ({ blob: new Blob([label]), pageCount, lastPageEighths });

test("export retains click-time source, page size, scene settings and filename during document switches", async () => {
  for (const format of ["pdf", "fdx"]) {
    const h = harness();
    h.$("#export-page-size").value = "a4";
    const oldSource = h.source.value;
    const exporting = h.context.exportDocument(format);
    assert.equal(h.$("#confirm-export").disabled, true);
    const job = h.jobs[0];
    assert.ok(Object.isFrozen(job.request));
    h.source.value = "Different document";
    h.state.filename = "Different.fountain";
    ++h.state.documentRevision;
    h.docSettings.sceneNumbers = "off";
    h.docSettings.sceneNumberFormat = "act";
    h.$("#export-page-size").value = "letter";
    const pdf = result("first snapshot");
    job.resolve(pdf);
    await exporting;
    assert.equal(job.kind, format);
    assert.equal(job.request.source, oldSource);
    assert.equal(job.request.pageSize, format === "pdf" ? "a4" : "letter");
    assert.equal(job.request.sceneNumbers, "margin");
    assert.equal(job.request.sceneNumberFormat, "sequential");
    assert.deepEqual(h.downloads, [{ blob: pdf.blob, filename: `First.${format}` }]);
    assert.equal(h.$("#confirm-export").disabled, false);
  }
});

test("duplicate export clicks do not start extra jobs, and failure remains local and retryable", async () => {
  const h = harness();
  const first = h.context.exportDocument("pdf");
  await h.context.exportDocument("pdf");
  assert.equal(h.jobs.length, 1);
  h.jobs[0].reject(new Error("WASM could not load"));
  await first;
  assert.equal(h.downloads.length, 0);
  assert.equal(h.$("#confirm-export").disabled, false);
  assert.deepEqual(h.notices, ["WASM could not load"]);
  const retry = h.context.exportDocument("pdf");
  h.jobs[1].resolve(result("retry"));
  await retry;
  assert.equal(h.downloads.length, 1);
});

test("exports do not compile transient uncommitted composition text", async () => {
  for (const surface of ["source", "preview"]) {
    const h = harness();
    h.state[`${surface}Composing`] = true;
    await h.context.exportDocument("pdf");
    assert.equal(h.jobs.length, 0);
    assert.deepEqual(h.notices, ["Finish composing text before exporting"]);
  }
});

test("cancelling unchanged composition resumes a discarded compile without creating an edit", async () => {
  const h = harness();
  h.state.sourceComposing = true;
  const composition = { documentRevision: h.state.documentRevision, value: h.source.value };
  h.state.sourceComposition = composition;
  await h.context.compilePageCount(1);
  assert.equal(h.jobs.length, 0);
  Object.assign(h.context, {
    collaboration: {},
    flushDeferredCollaborationDocument() {},
    sourceChanged() { assert.fail("Cancelled composition must not create an edit"); },
  });
  runInNewContext(section("function finishEditorComposition(", "function endEditorComposition("), h.context);
  h.context.finishEditorComposition("source", composition);
  assert.equal(h.timers.size, 1);
  const pending = [...h.timers.values()][0]();
  h.jobs[0].resolve(result("after cancellation", 8, 2));
  await pending;
  assert.equal(h.$("#compile-status").textContent, "Compiled");
  assert.equal(h.state.metadata.pageCount, 8);
});

test("out-of-order page counts cannot replace current metrics or compile status", async () => {
  const h = harness();
  const first = h.context.compilePageCount(1);
  h.source.value = "Newer local or remote edit";
  ++h.state.compileRevision;
  const second = h.context.compilePageCount(2);
  h.jobs[1].resolve(result("new", 7, 2));
  await second;
  h.jobs[0].resolve(result("old", 99, 8));
  await first;
  assert.equal(h.state.metadata.pageCount, 7);
  assert.equal(h.state.metadata.lastPageEighths, 2);
  assert.equal(h.state.metadata.estimatedSeconds, 420);
  assert.equal(h.metrics.length, 1);
  assert.equal(h.$("#compile-status").textContent, "Compiled");
});

test("a title-page metadata rerender cannot change result-scoped page metrics", async () => {
  const h = harness();
  const pending = h.context.compilePageCount(1);
  h.state.metadata.titleFields = ["Title", "Author"];
  h.jobs[0].resolve(result("compiled title decision", 3, 4));
  await pending;
  assert.equal(h.state.metadata.pageCount, 3);
  assert.equal(h.state.metadata.lastPageEighths, 4);
});

test("old compile failures cannot overwrite a newer document's status", async () => {
  const h = harness();
  const pending = h.context.compilePageCount(1);
  ++h.state.documentRevision;
  h.$("#compile-status").textContent = "New document";
  h.jobs[0].reject(new Error("old failure"));
  await pending;
  assert.equal(h.$("#compile-status").textContent, "New document");
  assert.equal(h.metrics.length, 0);
});

test("current compiler failure never falls back to HTTP", async () => {
  const h = harness();
  const pending = h.context.compilePageCount(1);
  h.jobs[0].reject(new Error("local runtime failed"));
  await pending;
  assert.match(h.$("#compile-status").textContent, /Reload the page.*not sent to a server for compilation/);
  assert.equal(h.metrics.length, 0);
});

test("compile validity checks text, local settings, document/revision and active composition", () => {
  const changes = [
    h => ++h.state.documentRevision,
    h => ++h.state.compileRevision,
    h => { h.source.value += " change"; },
    h => { h.$("#page-size").value = "a4"; },
    h => { h.docSettings.sceneNumbers = "off"; },
    h => { h.docSettings.sceneNumberFormat = "act"; },
    h => { h.state.sourceComposing = true; },
    h => { h.state.previewComposing = true; },
  ];
  for (const change of changes) {
    const h = harness();
    const snapshot = h.context.captureCompileRequest();
    assert.equal(h.context.isCurrentCompile(snapshot), true);
    change(h);
    assert.equal(h.context.isCurrentCompile(snapshot), false);
  }
});

test("debounced compilation skips superseded jobs and runs only in its owning tab", async () => {
  const alice = harness(), bob = harness();
  bob.$("#page-size").value = "a4";
  alice.context.scheduleCompile();
  const oldRevision = alice.state.compileRevision;
  alice.context.scheduleCompile();
  assert.equal(alice.timers.size, 1);
  await alice.context.compilePageCount(oldRevision);
  assert.equal(alice.jobs.length, 0);
  const pending = [...alice.timers.values()][0]();
  alice.jobs[0].resolve(result("alice", 9, 8));
  await pending;
  assert.equal(alice.state.metadata.pageCount, 9);
  assert.equal(bob.state.metadata.pageCount, 5);
  assert.equal(bob.jobs.length, 0);
  assert.equal(bob.$("#page-size").value, "a4");
});

test("PDF preview publishes only the latest request and revokes replaced local URLs", async () => {
  const h = harness(); h.state.previewMode = "pdf";
  const first = h.context.refreshPdf();
  const second = h.context.refreshPdf();
  h.jobs[1].resolve(result("newest"));
  await second;
  h.jobs[0].resolve(result("obsolete"));
  await first;
  assert.equal(h.urls.length, 1);
  assert.equal(await h.urls[0].blob.text(), "newest");
  const third = h.context.refreshPdf();
  h.jobs[2].resolve(result("replacement"));
  await third;
  assert.deepEqual(h.revoked, ["blob:local-0"]);
  assert.equal(h.$("#pdf-frame").src, "blob:local-1");
});

test("document, text, settings and mode changes suppress stale PDF successes and failures", async () => {
  for (const change of [
    h => ++h.state.documentRevision,
    h => { h.source.value += " remote edit"; },
    h => { h.$("#page-size").value = "a4"; },
    h => { h.docSettings.sceneNumbers = "off"; },
    h => { h.state.previewMode = "live"; },
  ]) {
    for (const failed of [false, true]) {
      const h = harness(); h.state.previewMode = "pdf";
      const pending = h.context.refreshPdf();
      change(h);
      assert.equal(h.jobs[0].options.isCurrent(), false);
      h.$("#pdf-placeholder").innerHTML = "New view";
      if (failed) h.jobs[0].reject(new Error("<old failure>"));
      else h.jobs[0].resolve(result("obsolete"));
      await pending;
      assert.equal(h.urls.length, 0);
      assert.equal(h.$("#pdf-placeholder").innerHTML, "New view");
    }
  }
});

test("editing while PDF is visible hides the old document and reuses its local page-count result", async () => {
  const h = harness(); h.state.previewMode = "pdf";
  h.context.scheduleCompile();
  assert.equal(h.$("#pdf-frame").hidden, true);
  const pending = [...h.timers.values()][0]();
  h.jobs[0].resolve(result("updated preview"));
  await pending;
  assert.equal(h.jobs.length, 1);
  assert.equal(h.$("#pdf-frame").hidden, false);
  assert.equal(h.$("#pdf-placeholder").hidden, true);
  assert.equal(await h.urls[0].blob.text(), "updated preview");
});

test("a PDF failure is escaped and the next attempt restores the loading state", async () => {
  const h = harness(); h.state.previewMode = "pdf";
  const pending = h.context.refreshPdf();
  h.jobs[0].reject(new Error("<script>"));
  await pending;
  assert.match(h.$("#pdf-placeholder").innerHTML, /&lt;script>/);
  const retry = h.context.refreshPdf();
  assert.match(h.$("#pdf-placeholder").innerHTML, /Compiling PDF in this browser/);
  h.jobs[1].resolve(result("recovered"));
  await retry;
  assert.equal(h.$("#pdf-placeholder").hidden, true);
});
