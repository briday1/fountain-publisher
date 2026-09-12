import assert from "node:assert/strict";
import test from "node:test";
import { SearchSession, createDocumentSearch, matchIndex } from "../../src/fountain_publisher/web/document-search.mjs";
import { runEx, runSearch } from "../../src/fountain_publisher/web/search-engine.mjs";

const cancelled = () => new DOMException("Search cancelled", "AbortError");
const tick = async () => { for (let index = 0; index < 8; index += 1) await Promise.resolve(); };

function fakeClient({ honorCancellation = true } = {}) {
  const jobs = [];
  let pending = null;
  let cancellations = 0;
  return {
    jobs,
    get cancellations() { return cancellations; },
    run(task, payload) {
      return new Promise((resolve, reject) => {
        const job = {
          task, payload, settled: false,
          resolve(value) { this.settled = true; if (pending === job) pending = null; resolve(value); },
          reject(error) { this.settled = true; if (pending === job) pending = null; reject(error); },
        };
        jobs.push(job); pending = job;
      });
    },
    cancel() { cancellations += 1; if (honorCancellation) pending?.reject(cancelled()); },
  };
}

function sessionHarness(options = {}) {
  const client = fakeClient(options);
  const snapshot = { text: "cat cat", documentRevision: 1, editRevision: 1, composing: false, readOnly: false };
  const applied = [];
  let accepted = true;
  const session = new SearchSession({
    client,
    getSnapshot: () => ({ ...snapshot }),
    canEdit: () => !snapshot.readOnly && !snapshot.composing,
    applyEdits(edits, target) { applied.push({ edits, target }); return accepted; },
  });
  return { client, snapshot, applied, session, rejectEdits() { accepted = false; } };
}

const catMatches = [{ start: 0, end: 3, line: 1, column: 1 }, { start: 4, end: 7, line: 1, column: 5 }];
const dogEdits = [{ start: 0, end: 3, text: "dog" }, { start: 4, end: 7, text: "dog" }];

test("match navigation wraps in both directions with explicit inclusive first-search behavior", () => {
  const matches = [{ start: 2, end: 3 }, { start: 8, end: 9 }, { start: 12, end: 14 }];
  assert.equal(matchIndex([], 0), -1);
  assert.equal(matchIndex(matches, 2), 1);
  assert.equal(matchIndex(matches, 2, 1, true), 0);
  assert.equal(matchIndex(matches, 12), 0);
  assert.equal(matchIndex(matches, 8, -1), 0);
  assert.equal(matchIndex(matches, 8, -1, true), 1);
  assert.equal(matchIndex(matches, 0, -1), 2);
});

test("search sessions attach the exact document target and never accept caller-supplied source text", async () => {
  const h = sessionHarness();
  const pending = h.session.run("search", { query: "cat", text: "Different document" });
  assert.equal(h.client.jobs[0].payload.text, "cat cat");
  h.client.jobs[0].resolve({ matches: catMatches });
  const result = await pending;
  assert.deepEqual(result.target, h.snapshot);
  assert.equal(h.session.isCurrent(result), true);
});

test("cancellation invalidates a late completion even if a worker ignores cancellation", async () => {
  const h = sessionHarness({ honorCancellation: false });
  const pending = assert.rejects(h.session.run("search", { query: "cat" }), { name: "AbortError" });
  h.session.cancel();
  h.client.jobs[0].resolve({ matches: catMatches });
  await pending;
  assert.equal(h.client.cancellations, 1);
});

test("a newer session run supersedes an older result without changing document text", async () => {
  const h = sessionHarness({ honorCancellation: false });
  const first = assert.rejects(h.session.run("search", { query: "old" }), { name: "AbortError" });
  const second = h.session.run("search", { query: "cat" });
  h.client.jobs[1].resolve({ matches: catMatches });
  assert.deepEqual((await second).matches, catMatches);
  h.client.jobs[0].resolve({ matches: [{ start: 99, end: 100 }] });
  await first;
});

test("document changes invalidate search even when a new document or revision contains identical text", async () => {
  for (const mutate of [
    (state) => { state.documentRevision += 1; },
    (state) => { state.editRevision += 1; },
    (state) => { state.text = "cat remote cat"; },
    (state) => { state.composing = true; },
  ]) {
    const h = sessionHarness();
    const pending = assert.rejects(h.session.run("search", { query: "cat" }), /document changed/i);
    mutate(h.snapshot);
    h.client.jobs[0].resolve({ matches: catMatches });
    await pending;
    assert.deepEqual(h.applied, []);
  }
});

test("view-only documents can search but cannot commit replacements", async () => {
  const h = sessionHarness(); h.snapshot.readOnly = true;
  const pending = h.session.run("search", { query: "cat", replacement: "dog" });
  h.client.jobs[0].resolve({ matches: catMatches, edits: dogEdits });
  const result = await pending;
  assert.equal(h.session.isCurrent(result), true);
  assert.throws(() => h.session.commit(result), /view only/);
  assert.deepEqual(h.applied, []);
});

test("active composition prevents worker searches and replacement commits", async () => {
  const h = sessionHarness(); h.snapshot.composing = true;
  await assert.rejects(h.session.run("search", { query: "cat" }), /Finish composing/);
  assert.equal(h.client.jobs.length, 0);
  assert.throws(() => h.session.commit({ edits: dogEdits, target: { ...h.snapshot } }), /composing/);
  assert.deepEqual(h.applied, []);
});

test("replacement commit rechecks permissions, revisions and collaboration readiness", async () => {
  for (const change of ["revision", "readonly", "composition", "rejected"]) {
    const h = sessionHarness();
    const pending = h.session.run("search", { query: "cat", replacement: "dog" });
    h.client.jobs[0].resolve({ matches: catMatches, edits: dogEdits });
    const result = await pending;
    if (change === "revision") h.snapshot.editRevision += 1;
    else if (change === "readonly") h.snapshot.readOnly = true;
    else if (change === "composition") h.snapshot.composing = true;
    else h.rejectEdits();
    assert.throws(() => h.session.commit(result), /document changed|view only|composing|collaboration/i);
    assert.equal(h.applied.length, change === "rejected" ? 1 : 0);
    assert.equal(h.snapshot.text, "cat cat");
  }
});

test("valid replacement plans pass one atomic batch with its original target; empty plans do not apply", async () => {
  const h = sessionHarness();
  const pending = h.session.run("search", { query: "cat", replacement: "dog" });
  h.client.jobs[0].resolve({ matches: catMatches, edits: dogEdits });
  const result = await pending;
  assert.equal(h.session.commit(result), true);
  assert.equal(h.applied.length, 1);
  assert.equal(h.applied[0].edits, dogEdits);
  assert.equal(h.applied[0].target, result.target);
  assert.equal(h.session.commit(result, []), false);
  assert.equal(h.applied.length, 1);
});

function controllerHarness(t, { invalidateOnApply = true } = {}) {
  const timers = new Map();
  let timerId = 0;
  t.mock.method(globalThis, "setTimeout", (callback) => { const id = ++timerId; timers.set(id, callback); return id; });
  t.mock.method(globalThis, "clearTimeout", (id) => timers.delete(id));
  const snapshot = { text: "cat cat", documentRevision: 1, editRevision: 1, composing: false, readOnly: false };
  let selection = { anchor: 0, head: 0, surface: "preview" };
  const navigations = [], restores = [], applications = [], notices = [];
  const client = fakeClient();
  const elements = new Map();
  let dialog = null;
  const root = {
    activeElement: null,
    body: { classList: { toggle() {} } },
    querySelector(selector) {
      if (selector === "dialog[open]") return dialog;
      assert.ok(selector.startsWith("#"));
      return get(selector.slice(1));
    },
    createElement: (tag) => new Element("", tag),
  };
  class Element {
    constructor(id, tag = "div") {
      this.id = id; this.tag = tag; this.hidden = false; this.disabled = false;
      this.value = ""; this.checked = false; this.textContent = "";
      this.dataset = {}; this.attributes = new Map(); this.listeners = new Map(); this.children = [];
    }
    addEventListener(type, callback) {
      const handlers = this.listeners.get(type) || []; handlers.push(callback); this.listeners.set(type, handlers);
    }
    emit(type, properties = {}) {
      const event = { target: this, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; }, ...properties };
      for (const handler of this.listeners.get(type) || []) handler(event);
      return event;
    }
    setAttribute(key, value) { this.attributes.set(key, value); }
    focus() { root.activeElement = this; }
    select() { this.selected = true; }
    append(element) { element.parent = this; this.children.push(element); }
    replaceChildren(...elements) { this.children = elements; }
    contains(target) { return target === this || (this.id === "search-dock" && /^(search-|document-search|vim-command)/.test(target?.id)) || this.children.some((child) => child.contains(target)); }
    closest(selector) {
      if (selector === "[data-result-index]") return this.dataset.resultIndex === undefined ? this.parent?.closest(selector) : this;
      return ["input", "textarea"].includes(this.tag) ? this : null;
    }
  }
  function get(id) {
    if (!elements.has(id)) elements.set(id, new Element(id, /(?:query|replacement|input)$/.test(id) ? "input" : "div"));
    return elements.get(id);
  }
  for (const id of ["search-dock", "document-search", "vim-command-form", "search-results-panel", "search-replace-row"]) get(id).hidden = true;
  const editor = new Element("editor", "textarea"); root.activeElement = editor;
  let controller;
  let acceptEdits = true;
  const adapter = {
    client,
    getSnapshot: () => ({ ...snapshot }),
    canEdit: () => !snapshot.readOnly && !snapshot.composing,
    captureSelection: () => ({ ...selection }),
    restoreSelection(value) { restores.push(value); selection = { ...value }; root.activeElement = editor; },
    navigate(match, options) {
      navigations.push({ match, options });
      selection = { anchor: match.start, head: options.vim ? match.start : match.end, surface: options.surface || selection.surface };
      if (options.focus) root.activeElement = editor;
      return "";
    },
    applyEdits(edits, target) {
      if (!acceptEdits) return false;
      applications.push({ edits, target });
      for (const edit of [...edits].reverse()) snapshot.text = snapshot.text.slice(0, edit.start) + edit.text + snapshot.text.slice(edit.end);
      snapshot.editRevision += 1;
      if (invalidateOnApply) controller.invalidate();
      return true;
    },
    isEditorTarget: (target) => target === editor,
    clearHighlight() {},
    onOpen() {}, onVimComplete() {},
    notify: (message) => notices.push(message),
  };
  controller = createDocumentSearch(adapter, root);
  t.after(() => controller.close({ restore: false }));
  return {
    controller, snapshot, client, navigations, restores, applications, notices, root, editor, get, timers,
    select(value) { selection = { ...selection, ...value }; },
    rejectEdits() { acceptEdits = false; },
    setDialog(value) { dialog = value; },
    fireTimers() { for (const [id, callback] of [...timers]) { timers.delete(id); callback(); } },
    async finishJob() {
      const job = client.jobs.at(-1);
      assert.ok(job, "a worker request must precede its response");
      assert.equal(job.settled, false, "each engine response must answer a new, pending worker request");
      try { job.resolve(job.task === "ex" ? runEx(job.payload) : runSearch(job.payload)); }
      catch (error) { job.reject(error); }
      await tick();
    },
    async findWithEngine(value, { regex = false } = {}) {
      controller.open(); get("search-query").value = value; get("search-regex").checked = regex;
      get("search-query").emit("input"); this.fireTimers(); await this.finishJob();
    },
    async command(value, context = {}, kind = ":") {
      controller.openVim(kind, context); get("vim-command-input").value = value;
      get("vim-command-form").emit("submit"); await this.finishJob();
    },
    async find(query = "cat", matches = catMatches) {
      controller.open(); get("search-query").value = query; get("search-query").emit("input");
      this.fireTimers(); client.jobs.at(-1).resolve({ matches }); await tick();
    },
  };
}

test("opening Find focuses its field, preserves editor focus during incremental navigation and wraps matches", async (t) => {
  const h = controllerHarness(t);
  await h.find();
  assert.equal(h.root.activeElement, h.get("search-query"));
  assert.deepEqual(h.navigations[0].match, catMatches[0]);
  assert.equal(h.navigations[0].options.focus, false);
  assert.match(h.get("search-status").textContent, /1 of 2/);
  h.get("search-form").emit("submit"); await tick();
  assert.deepEqual(h.navigations.at(-1).match, catMatches[1]);
  h.get("search-form").emit("submit"); await tick();
  assert.deepEqual(h.navigations.at(-1).match, catMatches[0]);
  h.get("search-previous").emit("click"); await tick();
  assert.deepEqual(h.navigations.at(-1).match, catMatches[1]);
  assert.equal(h.root.activeElement, h.get("search-query"));
});

test("changing a query cancels its in-flight result and only the latest query navigates", async (t) => {
  const h = controllerHarness(t);
  h.controller.open();
  h.get("search-query").value = "old"; h.get("search-query").emit("input"); h.fireTimers();
  const old = h.client.jobs.at(-1);
  h.get("search-query").value = "cat"; h.get("search-query").emit("input"); h.fireTimers();
  h.client.jobs.at(-1).resolve({ matches: catMatches }); await tick();
  old.resolve({ matches: [{ start: 99, end: 100 }] }); await tick();
  assert.equal(h.navigations.length, 1);
  assert.deepEqual(h.navigations[0].match, catMatches[0]);
  assert.match(h.get("search-status").textContent, /1 of 2/);
});

test("closing Find while a search is pending prevents stale navigation or focus theft", async (t) => {
  const h = controllerHarness(t);
  h.controller.open(); h.get("search-query").value = "cat"; h.get("search-query").emit("input"); h.fireTimers();
  const pending = h.client.jobs.at(-1);
  h.controller.close();
  assert.equal(h.root.activeElement, h.editor);
  pending.resolve({ matches: catMatches }); await tick();
  assert.equal(h.navigations.length, 0);
  assert.equal(h.root.activeElement, h.editor);
  assert.equal(h.get("search-dock").hidden, true);
});

test("document invalidation refreshes match counts without moving the user's new selection", async (t) => {
  const h = controllerHarness(t); await h.find();
  h.snapshot.text = "remote cat cat"; h.snapshot.editRevision += 1;
  h.select({ anchor: 2, head: 2 });
  h.controller.invalidate(); h.fireTimers();
  h.client.jobs.at(-1).resolve({ matches: [{ start: 7, end: 10 }, { start: 11, end: 14 }] }); await tick();
  assert.equal(h.navigations.length, 1, "passive refresh must not steal the editor caret");
  assert.equal(h.get("search-next").disabled, false);
  assert.match(h.get("search-status").textContent, /2 matches|of 2/);
});

test("view-only Find leaves navigation available but replacement controls and mutation blocked", async (t) => {
  const h = controllerHarness(t); h.snapshot.readOnly = true;
  await h.find();
  assert.equal(h.get("search-next").disabled, false);
  assert.equal(h.get("search-replace").disabled, true);
  assert.equal(h.get("search-replace-all").disabled, true);
  assert.match(h.get("search-status").textContent, /View only/);
});

test("Replace All commits once and refreshes correctly through sourceChanged invalidation", async (t) => {
  const h = controllerHarness(t); await h.find();
  h.get("search-replacement").value = "dog";
  h.get("search-replace-all").emit("click");
  h.client.jobs.at(-1).resolve({ matches: catMatches, edits: dogEdits }); await tick();
  assert.equal(h.applications.length, 1);
  assert.equal(h.snapshot.text, "dog dog");
  assert.equal(h.client.jobs.at(-1).payload.text, "dog dog");
  h.client.jobs.at(-1).resolve({ matches: [] }); await tick();
  assert.match(h.get("search-status").textContent, /Replaced 2 matches/);
  assert.equal(h.timers.size, 0, "explicit post-replacement refresh consumes the invalidation debounce");
  assert.equal(h.get("search-replace-all").disabled, true);
});

test("an older Replace All refresh cannot overwrite a newer query's pending status or navigation", async (t) => {
  const h = controllerHarness(t); await h.find();
  h.get("search-replacement").value = "dog";
  h.get("search-replace-all").emit("click");
  h.client.jobs.at(-1).resolve({ matches: catMatches, edits: dogEdits }); await tick();
  const oldRefresh = h.client.jobs.at(-1);
  h.get("search-query").value = "dog"; h.get("search-query").emit("input");
  await tick();
  assert.equal(h.get("search-status").textContent, "Searching…");
  oldRefresh.resolve({ matches: [] }); await tick();
  assert.equal(h.get("search-status").textContent, "Searching…");
  h.fireTimers(); h.client.jobs.at(-1).resolve({ matches: catMatches }); await tick();
  assert.match(h.get("search-status").textContent, /1 of 2/);
});

test("failed atomic collaboration replacement preserves text and exposes the failure", async (t) => {
  const h = controllerHarness(t); await h.find(); h.rejectEdits();
  h.get("search-replacement").value = "dog"; h.get("search-replace-all").emit("click");
  h.client.jobs.at(-1).resolve({ matches: catMatches, edits: dogEdits }); await tick();
  assert.equal(h.snapshot.text, "cat cat");
  assert.deepEqual(h.applications, []);
  assert.match(h.get("search-status").textContent, /collaboration is not ready/);
});

test("typing a new replacement cancels the outstanding plan before it can change the document", async (t) => {
  const h = controllerHarness(t); await h.find();
  h.get("search-replacement").value = "dog"; h.get("search-replace-all").emit("click");
  const pending = h.client.jobs.at(-1);
  h.get("search-replacement").value = "fox"; h.get("search-replacement").emit("input");
  pending.resolve({ matches: catMatches, edits: dogEdits }); await tick();
  assert.deepEqual(h.applications, []);
  assert.equal(h.snapshot.text, "cat cat");
  assert.equal(h.get("search-replacement").value, "fox");
});

test("Replace selects the next match first if the user has moved the editor selection", async (t) => {
  const h = controllerHarness(t); await h.find(); h.select({ anchor: 3, head: 3 });
  h.get("search-replacement").value = "dog"; h.get("search-replace").emit("click");
  h.client.jobs.at(-1).resolve({ matches: catMatches, edits: dogEdits }); await tick();
  assert.deepEqual(h.applications, []);
  assert.deepEqual(h.navigations.at(-1).match, catMatches[1]);
  assert.match(h.get("search-status").textContent, /Match selected/);
  h.get("search-replace").emit("click");
  h.client.jobs.at(-1).resolve({ matches: catMatches, edits: dogEdits }); await tick();
  assert.equal(h.applications.length, 1);
  assert.deepEqual(h.applications[0].edits, [dogEdits[1]]);
  assert.equal(h.snapshot.text, "cat dog");
  h.client.jobs.at(-1).resolve({ matches: [catMatches[0]] }); await tick();
  assert.match(h.get("search-status").textContent, /Replaced 1 match/);
});

test("same-text document switches cancel pending navigation and reset the old document's search fields", async (t) => {
  const h = controllerHarness(t);
  h.controller.open(); h.get("search-query").value = "cat"; h.get("search-query").emit("input"); h.fireTimers();
  const pending = h.client.jobs.at(-1);
  h.snapshot.documentRevision += 1;
  h.controller.invalidate({ reset: true });
  pending.resolve({ matches: catMatches }); await tick();
  assert.deepEqual(h.navigations, []);
  assert.equal(h.get("search-dock").hidden, true);
  assert.equal(h.get("search-query").value, "");
  assert.equal(h.timers.size, 0);
});

test("editor Find Next shortcuts return focus to the editor without stealing search-field focus", async (t) => {
  const h = controllerHarness(t); await h.find();
  const shortcut = (target) => ({ key: "F3", target, preventDefault() {} });
  assert.equal(h.controller.handleShortcut(shortcut(h.get("search-query"))), true);
  assert.equal(h.navigations.at(-1).options.focus, false);
  assert.equal(h.root.activeElement, h.get("search-query"));
  h.editor.focus();
  assert.equal(h.controller.handleShortcut(shortcut(h.editor)), true);
  assert.equal(h.navigations.at(-1).options.focus, true);
  assert.equal(h.root.activeElement, h.editor);
});

test("Vim search cancellation restores its entry selection and rejects pending navigation", async (t) => {
  const h = controllerHarness(t); h.select({ anchor: 4, head: 4 });
  h.controller.openVim("/"); h.get("vim-command-input").value = "cat";
  h.get("vim-command-form").emit("submit");
  const pending = h.client.jobs.at(-1);
  h.get("vim-command-close").emit("click");
  pending.resolve({ matches: catMatches }); await tick();
  assert.deepEqual(h.navigations, []);
  assert.equal(h.restores.at(-1).head, 4);
  assert.equal(h.root.activeElement, h.editor);
});

test("search shortcuts respect composition, unrelated fields and open dialogs", (t) => {
  const h = controllerHarness(t);
  const event = (target = h.editor) => ({ key: "f", ctrlKey: true, target, preventDefault() { this.defaultPrevented = true; } });
  h.snapshot.composing = true; assert.equal(h.controller.handleShortcut(event()), false);
  h.snapshot.composing = false;
  h.setDialog({}); assert.equal(h.controller.handleShortcut(event()), false);
  h.setDialog(null);
  assert.equal(h.controller.handleShortcut(event(h.get("unrelated-input"))), false);
  assert.equal(h.controller.handleShortcut(event()), true);
  assert.equal(h.root.activeElement, h.get("search-query"));
});

test("Vim forward/backward searches and n/N repeat their original direction using actual engine offsets", async (t) => {
  const h = controllerHarness(t); h.snapshot.text = "cat cat cat";
  await h.command("cat", {}, "/");
  assert.equal(h.navigations.at(-1).match.start, 4);
  assert.equal(h.get("vim-command-form").hidden, true);
  assert.equal(h.root.activeElement, h.editor);
  assert.equal(h.client.jobs.at(-1).payload.regex, true);
  assert.equal(h.client.jobs.at(-1).payload.vim, true);
  let repeated = h.controller.repeatVim(); await h.finishJob(); await repeated;
  assert.equal(h.navigations.at(-1).match.start, 8);
  repeated = h.controller.repeatVim(true); await h.finishJob(); await repeated;
  assert.equal(h.navigations.at(-1).match.start, 4);
  await h.command("cat", {}, "?");
  assert.equal(h.navigations.at(-1).match.start, 0);
  repeated = h.controller.repeatVim(); await h.finishJob(); await repeated;
  assert.equal(h.navigations.at(-1).match.start, 8);
  repeated = h.controller.repeatVim(true); await h.finishJob(); await repeated;
  assert.equal(h.navigations.at(-1).match.start, 0);
  assert.deepEqual(h.applications, []);
});

test("an empty Vim pattern reuses the last search and missing matches leave the command open", async (t) => {
  const h = controllerHarness(t);
  await h.command("cat", {}, "/");
  await h.command("", {}, "/");
  assert.equal(h.navigations.at(-1).match.start, 0);
  assert.equal(h.client.jobs.at(-1).payload.query, "cat");
  await h.command("missing", {}, "/");
  assert.equal(h.get("vim-command-form").hidden, false);
  assert.equal(h.root.activeElement, h.get("vim-command-input"));
  assert.match(h.get("vim-command-status").textContent, /Pattern not found/);
});

test("Ex substitution preserves the entry current-line context and commits one batch", async (t) => {
  const h = controllerHarness(t); h.snapshot.text = "cat cat\ncat cat\ncat";
  await h.command("s/cat/dog/", { currentLine: 2 });
  assert.equal(h.client.jobs.at(-1).payload.currentLine, 2);
  assert.equal(h.snapshot.text, "cat cat\ndog cat\ncat");
  assert.equal(h.applications.length, 1);
  assert.deepEqual(h.applications[0].edits, [{ start: 8, end: 11, text: "dog" }]);
  assert.deepEqual(h.notices, ["1 substitutions"]);
  assert.equal(h.get("vim-command-form").hidden, true);
});

test("Ex visual substitution sends the captured range and supports capture/newline replacement semantics", async (t) => {
  const h = controllerHarness(t); h.snapshot.text = "cat\ncat cat\ncat\ncat";
  h.select({ anchor: 4, head: 15 });
  h.controller.openVim(":", { currentLine: 3, visualRange: [3, 2] });
  assert.equal(h.get("vim-command-input").value, "'<,'>");
  h.get("vim-command-input").value += String.raw`s/(c)(at)/\2\1\r/g`;
  h.get("vim-command-form").emit("submit"); await h.finishJob();
  assert.deepEqual(h.client.jobs.at(-1).payload.visualRange, [3, 2]);
  assert.equal(h.snapshot.text, "cat\natc\n atc\n\natc\n\ncat");
  assert.equal(h.applications.length, 1);
  assert.equal(h.applications[0].edits.length, 3);
});

test("count-only Ex substitutions remain available in view-only documents and do not dirty text", async (t) => {
  const h = controllerHarness(t); h.snapshot.text = "cat CAT\ncat"; h.snapshot.readOnly = true;
  await h.command("%s/cat/dog/gin");
  assert.deepEqual(h.applications, []);
  assert.equal(h.snapshot.text, "cat CAT\ncat");
  assert.equal(h.snapshot.editRevision, 1);
  assert.deepEqual(h.notices, ["3 matches (no changes)"]);
  assert.equal(h.get("vim-command-form").hidden, true);
  await h.command("%s/cat/dog/g");
  assert.deepEqual(h.applications, []);
  assert.match(h.get("vim-command-status").textContent, /view only/);
  assert.equal(h.get("vim-command-form").hidden, false);
});

test("a command opened on an older revision cannot substitute even when the document text returns to the same value", async (t) => {
  const h = controllerHarness(t);
  h.controller.openVim(":", { currentLine: 1 });
  h.snapshot.editRevision += 1;
  h.get("vim-command-input").value = "%s/cat/dog/g";
  h.get("vim-command-form").emit("submit"); await tick();
  assert.equal(h.client.jobs.length, 0);
  assert.deepEqual(h.applications, []);
  assert.match(h.get("vim-command-status").textContent, /document changed while entering/);
});

test("quickfix results navigate the complete match set while rendering only a 100-line window", async (t) => {
  const h = controllerHarness(t); h.snapshot.text = Array.from({ length: 150 }, (_, index) => `cat ${index}`).join("\n");
  await h.command("grep /cat/");
  assert.equal(h.get("search-results-panel").hidden, false);
  assert.equal(h.get("search-results").children.length, 100);
  assert.equal(h.navigations.at(-1).match.line, 1);
  assert.match(h.get("search-results-summary").textContent, /150 matching lines.*showing 1–100/);
  await h.command("clast");
  assert.equal(h.navigations.at(-1).match.line, 150);
  assert.equal(h.get("search-results").children.length, 50);
  assert.match(h.get("search-results-summary").textContent, /showing 101–150/);
  await h.command("cprev"); assert.equal(h.navigations.at(-1).match.line, 149);
  await h.command("cfirst"); assert.equal(h.navigations.at(-1).match.line, 1);
  await h.command("cnext"); assert.equal(h.navigations.at(-1).match.line, 2);
  await h.command("cclose"); assert.equal(h.get("search-results-panel").hidden, true);
  await h.command("copen"); assert.equal(h.get("search-results-panel").hidden, false);
  assert.deepEqual(h.applications, []);
});

test("quickfix click navigation uses source offsets, renders hostile text literally and rejects stale results", async (t) => {
  const h = controllerHarness(t); h.snapshot.text = "cat <script>\ncat &lt;b&gt;";
  await h.command("grep /cat/");
  const list = h.get("search-results");
  const button = list.children[1].children[0];
  assert.equal(button.textContent, "2:1  cat &lt;b&gt;");
  list.emit("click", { target: button });
  assert.deepEqual(h.navigations.at(-1).match, { start: 13, end: 16, line: 2, column: 1 });
  const before = h.navigations.length;
  h.snapshot.editRevision += 1; h.controller.invalidate();
  assert.equal(list.children.length, 0);
  assert.match(h.get("search-results-summary").textContent, /Document changed/);
  await h.command("cnext");
  assert.equal(h.navigations.length, before);
  assert.match(h.get("vim-command-status").textContent, /stale/);
  assert.equal(h.get("vim-command-form").hidden, false);
});

test("literal Find replacements preserve dollar/backslash text and inserted newlines", async (t) => {
  const h = controllerHarness(t); await h.findWithEngine("cat");
  const replacement = "$& $1 \\1\nsecond";
  h.get("search-replacement").value = replacement;
  h.get("search-replace").emit("click"); await h.finishJob(); await h.finishJob();
  assert.equal(h.snapshot.text, `${replacement} cat`);
  assert.deepEqual(h.applications[0].edits, [{ start: 0, end: 3, text: replacement }]);
  assert.equal(h.navigations.at(-1).match.start, replacement.length + 1);
  h.get("search-replace").emit("click"); await h.finishJob(); await h.finishJob();
  assert.equal(h.snapshot.text, `${replacement} ${replacement}`);
  assert.match(h.get("search-status").textContent, /0 remaining/);
});

test("consecutive zero-width Replace advances past the replaced source position", async (t) => {
  const h = controllerHarness(t); h.snapshot.text = "a a";
  await h.findWithEngine("(?=a)", { regex: true });
  h.get("search-replacement").value = "x";
  h.get("search-replace").emit("click"); await h.finishJob(); await h.finishJob();
  assert.equal(h.snapshot.text, "xa a");
  assert.equal(h.navigations.at(-1).match.start, 3, "the next match must be the second original a, not the shifted first a");
  h.get("search-replace").emit("click"); await h.finishJob(); await h.finishJob();
  assert.equal(h.snapshot.text, "xa xa");
});

test("Vim command history never inserts an Ex command into a forward-search prompt", async (t) => {
  const h = controllerHarness(t); await h.command("1");
  h.controller.openVim("/");
  h.get("search-dock").emit("keydown", { key: "ArrowUp", target: h.get("vim-command-input") });
  assert.equal(h.get("vim-command-input").value, "");
});

test("search results refresh counts without stealing a selection or focus moved during the request", async (t) => {
  const h = controllerHarness(t);
  h.controller.open(); h.get("search-query").value = "cat"; h.get("search-query").emit("input"); h.fireTimers();
  h.select({ anchor: 4, head: 4 }); h.editor.focus();
  await h.finishJob();
  assert.deepEqual(h.navigations, []);
  assert.equal(h.root.activeElement, h.editor);
  assert.match(h.get("search-status").textContent, /2 matches/);
  assert.equal(h.get("search-next").disabled, false);
});

test("Vim search does not steal focus after the user leaves its pending command", async (t) => {
  const h = controllerHarness(t);
  h.controller.openVim("/"); h.get("vim-command-input").value = "cat";
  h.get("vim-command-form").emit("submit");
  h.get("unrelated-input").focus(); await h.finishJob();
  assert.deepEqual(h.navigations, []);
  assert.equal(h.root.activeElement, h.get("unrelated-input"));
  assert.equal(h.get("vim-command-form").hidden, false);
});

test("a pending single Replace cannot move a caret the user repositioned before its plan returned", async (t) => {
  const h = controllerHarness(t); await h.findWithEngine("cat");
  h.get("search-replacement").value = "dog"; h.get("search-replace").emit("click");
  const before = h.navigations.length;
  h.select({ anchor: 4, head: 4 }); h.editor.focus();
  await h.finishJob();
  assert.deepEqual(h.applications, []);
  assert.equal(h.navigations.length, before);
  assert.equal(h.root.activeElement, h.editor);
});

test("query and Vim command composition do not dispatch searches or consume confirmation Enter", async (t) => {
  const h = controllerHarness(t);
  h.controller.open(); h.get("search-query").emit("compositionstart");
  h.get("search-query").value = "猫"; h.get("search-query").emit("input");
  h.get("search-form").emit("submit"); h.fireTimers(); await tick();
  assert.equal(h.client.jobs.length, 0);
  h.get("search-query").emit("compositionend"); h.fireTimers(); await h.finishJob();
  assert.equal(h.client.jobs.length, 1);
  assert.equal(h.client.jobs[0].payload.query, "猫");
  h.controller.openVim("/"); h.get("vim-command-input").emit("compositionstart");
  h.get("vim-command-input").value = "cat"; h.get("vim-command-form").emit("submit");
  await tick(); assert.equal(h.client.jobs.length, 1);
  h.get("vim-command-input").emit("compositionend"); h.get("vim-command-form").emit("submit");
  await h.finishJob(); assert.equal(h.client.jobs.length, 2);
});
