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

function harness({ idle = false } = {}) {
  const elements = new Map();
  const jobs = [], downloads = [], metrics = [], urls = [], revoked = [], notices = [];
  const timers = new Map(), timerDelays = new Map(), idleCallbacks = new Map(), listeners = new Map();
  const cancelled = [], promoted = [];
  let nextTimer = 0, now = 0;
  const state = { documentRevision: 1, compileRevision: 1, pdfRevision: 0, filename: "First.fountain", previewMode: "live", metadata: { titleFields: [], pageCount: 5, lastPageEighths: 6 } };
  const source = { value: "INT. FIRST - DAY\n\nFirst draft." };
  const docSettings = { sceneNumbers: "margin", sceneNumberFormat: "sequential" };
  const $ = id => {
    if (!elements.has(id)) elements.set(id, { value: "letter", hidden: false, disabled: false, innerHTML: "", textContent: "", title: "", classList: { add() {}, remove() {}, contains() { return false; } }, close() { this.closed = true; } });
    return elements.get(id);
  };
  const context = {
    state, source, docSettings, $, Error,
    document: { hidden: false, addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(handler);
    } },
    window: idle ? {
      requestIdleCallback(callback, options) {
        assert.equal(options, undefined, "Idle work must never be forced through a busy-frame timeout");
        const id = ++nextTimer; idleCallbacks.set(id, callback); return id;
      },
      cancelIdleCallback(id) { idleCallbacks.delete(id); },
    } : {},
    performance: { now: () => now },
    setTimeout(callback, delay) { const id = ++nextTimer; timers.set(id, callback); timerDelays.set(id, delay); return id; },
    clearTimeout(id) { timers.delete(id); timerDelays.delete(id); },
    compilerClient: {
      cancelBackground(key) { cancelled.push(key); },
      promoteBackground(key) { promoted.push(key); },
    },
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
  return {
    context, state, source, docSettings, $, jobs, downloads, metrics, urls, revoked, notices,
    timers, timerDelays, idleCallbacks, cancelled, promoted,
    advance(milliseconds) { now += milliseconds; },
    dispatch(type, event = {}) { for (const handler of listeners.get(type) || []) handler(event); },
    runTimer() {
      const [id, callback] = timers.entries().next().value;
      now += timerDelays.get(id); timers.delete(id); timerDelays.delete(id);
      return callback();
    },
    runIdle(remaining = 50) {
      const [id, callback] = idleCallbacks.entries().next().value;
      idleCallbacks.delete(id); return callback({ timeRemaining: () => remaining });
    },
  };
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
  h.source.value += "\nNewer draft"; ++h.state.compileRevision;
  const second = h.context.refreshPdf();
  h.jobs[1].resolve(result("newest"));
  await second;
  h.jobs[0].resolve(result("obsolete"));
  await first;
  assert.equal(h.urls.length, 1);
  assert.equal(await h.urls[0].blob.text(), "newest");
  h.source.value += "\nLatest draft"; ++h.state.compileRevision;
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

test("automatic page counts wait ten quiet seconds even when callers request an immediate refresh", async () => {
  const h = harness();
  h.context.installCompileActivityTracking();
  h.context.scheduleCompile(0);
  assert.deepEqual([...h.timerDelays.values()], [10000]);
  const textarea = { matches: () => true };
  for (let index = 0; index < 120; index += 1) {
    h.advance(500);
    h.dispatch("input", { target: textarea });
    assert.equal(h.jobs.length, 0, "Typing in a note/search draft must not run the PDF engine");
    assert.equal(h.timers.size, 1);
    assert.deepEqual([...h.timerDelays.values()], [10000]);
  }
  const pending = h.runTimer();
  assert.equal(h.jobs.length, 1);
  assert.equal(h.jobs[0].options.backgroundKey, "page-count");
  h.jobs[0].resolve(result("quiet"));
  await pending;
});

test("automatic work additionally waits for an idle frame and typing cancels its pending idle callback", async () => {
  const h = harness({ idle: true });
  h.context.installCompileActivityTracking();
  h.context.scheduleCompile();
  h.runTimer();
  assert.equal(h.jobs.length, 0);
  assert.equal(h.idleCallbacks.size, 1);
  h.runIdle(0);
  assert.equal(h.jobs.length, 0);
  assert.equal(h.idleCallbacks.size, 1);
  const staleIdle = [...h.idleCallbacks.values()][0];
  h.dispatch("beforeinput", { target: { isContentEditable: true } });
  assert.equal(h.idleCallbacks.size, 0);
  await staleIdle({ timeRemaining: () => 50 });
  assert.equal(h.jobs.length, 0);
  h.runTimer();
  const pending = h.runIdle();
  h.jobs[0].resolve(result("idle"));
  await pending;
});

test("hidden tabs defer automatic work until another ten seconds of foreground quiet", async () => {
  const h = harness();
  h.context.installCompileActivityTracking();
  h.context.scheduleCompile();
  h.context.document.hidden = true;
  h.dispatch("visibilitychange");
  assert.equal(h.timers.size, 0);
  assert.equal(h.jobs.length, 0);
  h.advance(120000);
  h.context.document.hidden = false;
  h.dispatch("visibilitychange");
  assert.deepEqual([...h.timerDelays.values()], [10000]);
  const pending = h.runTimer();
  h.jobs[0].resolve(result("foreground"));
  await pending;
});

test("note/search IME candidate pauses do not start automatic work until composition ends or blurs", async () => {
  for (const finish of ["compositionend", "focusout"]) {
    const h = harness();
    h.context.installCompileActivityTracking();
    h.context.scheduleCompile();
    const textarea = { matches: () => true };
    h.dispatch("compositionstart", { target: textarea });
    await h.runTimer();
    assert.equal(h.jobs.length, 0);
    assert.equal(h.timers.size, 0);
    assert.equal(h.state.compilePending, true);
    h.advance(120000);
    h.dispatch(finish, { target: textarea });
    assert.deepEqual([...h.timerDelays.values()], [10000]);
    const pending = h.runTimer();
    h.jobs[0].resolve(result("finished composition"));
    await pending;
  }
});

test("automatic cadence is at least a minute and rechecks delayed worker startup", async () => {
  const h = harness();
  h.context.scheduleCompile();
  const first = h.runTimer(); // Queued at ten seconds, engine still loading.
  h.source.value += "\nNew edit";
  h.context.scheduleCompile();
  assert.deepEqual([...h.timerDelays.values()], [60000]);
  h.advance(20000);
  h.jobs[0].options.onStart(); // Actual worker dispatch at thirty seconds.
  h.jobs[0].resolve(result("old"));
  await first;
  // The original timeout was due at seventy seconds; startup moved the
  // earliest next dispatch to ninety seconds, which is rechecked here.
  h.advance(40000);
  [...h.timers.values()][0]();
  assert.equal(h.jobs.length, 1);
  assert.deepEqual([...h.timerDelays.values()], [20000]);
  const second = h.runTimer();
  assert.equal(h.jobs.length, 2);
  h.jobs[1].resolve(result("new"));
  await second;
});

test("draft input discards queued or active automatic results without interrupting an export", async () => {
  const h = harness();
  h.context.installCompileActivityTracking();
  h.context.scheduleCompile();
  const pending = h.runTimer();
  const exporting = h.context.exportDocument("pdf");
  h.dispatch("compositionstart", { target: { matches: () => true } });
  assert.equal(h.$("#compile-status").textContent, "Count pending", "Discarded work must not leave a Compiling badge while the user types");
  assert.match(h.$("#compile-status").title, /10 seconds.*once a minute.*Open PDF or export.*private/);
  assert.equal(h.jobs[0].options.isCurrent(), false);
  assert.equal(h.jobs[1].options, undefined, "Explicit exports must not use a background cancellation guard");
  h.jobs[0].resolve(result("discard", 99));
  await pending;
  assert.equal(h.metrics.length, 0);
  h.jobs[1].resolve(result("export", 4));
  await exporting;
  assert.equal(h.downloads.length, 1);
  assert.equal(h.state.metadata.pageCount, 4);
});

test("repeated typing does not rewrite an unchanged pending-count badge", () => {
  const h = harness();
  h.context.installCompileActivityTracking();
  const status = h.$("#compile-status");
  let text = "", title = "", textWrites = 0, titleWrites = 0;
  Object.defineProperties(status, {
    textContent: { get: () => text, set(value) { text = value; textWrites += 1; } },
    title: { get: () => title, set(value) { title = value; titleWrites += 1; } },
  });
  h.context.scheduleCompile();
  for (let index = 0; index < 100; index += 1) h.dispatch("input", { target: { matches: () => true } });
  assert.equal(textWrites, 1);
  assert.equal(titleWrites, 1);
  assert.equal(text, "Count pending");
});

test("explicit PDF requests bypass quiet/cadence, coalesce and reuse the exact local result", async () => {
  const h = harness({ idle: true });
  h.state.lastAutomaticCompileAt = 0;
  h.state.previewMode = "pdf";
  h.context.scheduleCompile(0);
  const first = h.context.refreshPdf();
  const second = h.context.refreshPdf();
  assert.equal(h.timers.size, 0);
  assert.equal(h.idleCallbacks.size, 0);
  assert.equal(h.jobs.length, 1);
  assert.equal(h.jobs[0].options.backgroundKey, null);
  h.jobs[0].resolve(result("preview", 7, 6));
  await Promise.all([first, second]);
  assert.equal(h.state.metadata.pageCount, 7);
  assert.equal(h.urls.length, 1);
  await h.context.refreshPdf();
  assert.equal(h.jobs.length, 1);
  assert.equal(h.urls.length, 1, "Reopening an unchanged PDF must not reset its iframe URL");
  assert.equal(h.revoked.length, 0);
});

test("explicit PDF preview promotes matching background work instead of compiling twice", async () => {
  const h = harness();
  h.context.installCompileActivityTracking();
  h.context.scheduleCompile();
  const background = h.runTimer();
  h.state.previewMode = "pdf";
  const preview = h.context.refreshPdf();
  assert.deepEqual(h.promoted, ["page-count"]);
  assert.equal(h.jobs.length, 1);
  h.dispatch("input", { target: { matches: () => true } });
  assert.equal(h.jobs[0].options.isCurrent(), true);
  assert.equal(h.timers.size, 0);
  h.jobs[0].resolve(result("shared", 8));
  await Promise.all([background, preview]);
  assert.equal(h.urls.length, 1);
  assert.equal(h.state.metadata.pageCount, 8);
});

test("PDF exports update only matching current settings and seed preview reuse", async () => {
  for (const change of [null, "page-size", "source", "sceneNumbers", "sceneNumberFormat", "documentRevision"]) {
    const h = harness();
    const pending = h.context.exportDocument("pdf");
    if (change === "page-size") h.$("#page-size").value = "a4";
    else if (change === "source") h.source.value += "\nNew text";
    else if (change === "documentRevision") ++h.state.documentRevision;
    else if (change) h.docSettings[change] = "changed";
    h.jobs[0].resolve(result("export", 8));
    await pending;
    assert.equal(h.downloads.length, 1);
    assert.equal(h.metrics.length, change ? 0 : 1);
    if (!change) {
      h.state.previewMode = "pdf";
      await h.context.refreshPdf();
      assert.equal(h.jobs.length, 1);
      assert.equal(h.urls.length, 1);
    }
  }
});

test("PDF cache never guesses that notes or managed annotation edits are unchanged", async () => {
  const h = harness(); h.state.previewMode = "pdf";
  const first = h.context.refreshPdf();
  h.jobs[0].resolve(result("first")); await first;
  h.source.value += "\n[[A new note]]";
  h.context.scheduleCompile();
  const second = h.context.refreshPdf();
  assert.equal(h.jobs.length, 2);
  h.jobs[1].resolve(result("new note")); await second;
});
