import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const app = await readFile(new URL("../../src/fountain_publisher/web/app.mjs", import.meta.url), "utf8");
const section = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

function harness() {
  const elements = new Map();
  const events = [], writes = [], requests = [];
  const classes = new Set(["dirty"]);
  const state = {
    documentRevision: 1, editRevision: 1, filename: "Draft.fountain", savedSource: "saved",
    history: ["saved", "draft"], historyIndex: 1, collaborators: new Map([["other", {}]]),
    collaborationApplying: false, googleConnected: true, googleAccount: { id: "account" },
    googleDriveFile: null, githubFile: null, handle: null,
  };
  const source = { value: "draft", selectionStart: 2, selectionEnd: 4, selectionDirection: "backward", focus() {} };
  const handle = {
    async createWritable() { return { async write(value) { writes.push(value); }, async close() {} }; },
    async getFile() { return { name: "Saved.fountain" }; },
  };
  const h = { state, source, events, writes, requests, classes, handle, linkedRoom: "old-room" };
  const context = {
    state, source, Blob, clearTimeout,
    window: {}, document: { title: "", body: { classList: { toggle: (name, value) => value ? classes.add(name) : classes.delete(name) } } },
    $: id => {
      if (!elements.has(id)) elements.set(id, { dataset: {}, innerHTML: "old presence", textContent: "old status", title: "old title", open: false, close() { this.open = false; } });
      return elements.get(id);
    },
    collaboration: {
      fileId: "existing-file", closed: false, synced: true,
      disconnect() { events.push("disconnect"); h.linkedRoom = null; },
      replace(value) { if (h.linkedRoom) events.push(["publish", h.linkedRoom, value]); },
      async checkpoint() { requests.push({ kind: "checkpoint" }); return { file: { id: "existing-file" }, content: source.value }; },
    },
    sourceChanged() { events.push("sourceChanged"); context.collaboration.replace(source.value); },
    updateGoogleMenu() {}, scheduleWorkspaceCache: () => events.push("cache"),
    normalizedFilename: () => state.filename,
    toast: message => events.push(message),
    download: async blob => { writes.push(await blob.text()); },
    googleRequest: async (url, options) => {
      requests.push({ url, ...options, body: JSON.parse(options.body) });
      return { file: { id: "created-file", capabilities: { canEdit: true } } };
    },
    connectDriveCollaboration(file, baselineContent) { h.linkedRoom = file.id; h.connectBaseline = baselineContent; events.push("connect"); },
    openGoogleDrive: async () => {},
  };
  runInNewContext([
    section("function setDocument(", "const collaboration ="),
    section("async function saveFile(", "async function githubRequest("),
    section("async function saveGoogleDrive(", "async function shareGoogleDrive("),
    section("async function openLocalFile(", "function pdfLayoutToFountain("),
    section("async function openGoogleDriveFile(", "let googlePickerPromise"),
  ].join("\n"), context);
  return Object.assign(h, { context, elements });
}

test("all document replacements disconnect before changing or publishing source", () => {
  for (const replacement of ["", "local file", "GitHub file", "Drive file"]) {
    const h = harness();
    h.context.setDocument(replacement, "New.fountain", true);
    assert.deepEqual(h.events, ["disconnect", "sourceChanged"]);
    assert.equal(h.source.value, replacement);
    assert.equal(h.state.documentRevision, 2);
    assert.equal(h.state.collaborators.size, 0);
    assert.equal(h.elements.get("#collaboration-cursors").innerHTML, "");
    assert.equal(h.elements.get("#collaboration-status").textContent, "");
  }
});

test("a new view-only document cannot inherit the old document's editability", () => {
  const h = harness();
  const file = { id: "readonly-file", capabilities: { canEdit: false } };
  h.context.setDocument("read only", "Shared.fountain", true, null, file);
  assert.equal(h.source.readOnly, true);
  assert.equal(h.elements.get("#screenplay-page").contentEditable, "false");
  assert.equal(h.state.googleDriveFile, file);
});

test("a local save preserves undo history, selection, document revision, and associations", async () => {
  const h = harness(); h.state.handle = h.handle;
  const history = h.state.history;
  const linked = h.state.githubFile = { sha: "old-sha" };
  await h.context.saveFile();
  assert.deepEqual(h.writes, ["draft"]);
  assert.equal(h.state.history, history);
  assert.equal(h.state.historyIndex, 1);
  assert.equal(h.state.documentRevision, 1);
  assert.equal(h.state.githubFile, linked);
  assert.equal(h.source.selectionStart, 2);
  assert.equal(h.source.selectionEnd, 4);
  assert.equal(h.source.selectionDirection, "backward");
  assert.equal(h.state.savedSource, "draft");
  assert.equal(h.classes.has("dirty"), false);
  assert.ok(!h.events.includes("disconnect"));
});

test("typing during a local write stays dirty and does not change the submitted snapshot", async () => {
  const h = harness(); const wait = deferred(); h.state.handle = h.handle;
  h.handle.createWritable = () => wait.promise;
  const saving = h.context.saveFile();
  h.source.value = "draft plus newer edits";
  wait.resolve({ write: async text => h.writes.push(text), close: async () => {} });
  await saving;
  assert.deepEqual(h.writes, ["draft"]);
  assert.equal(h.state.savedSource, "draft");
  assert.equal(h.source.value, "draft plus newer edits");
  assert.equal(h.classes.has("dirty"), true);
  assert.match(h.events.at(-1), /newer edits/);
});

test("finishing a local write after a document switch never marks the new document saved", async () => {
  const h = harness(); const wait = deferred(); h.state.handle = h.handle;
  h.handle.createWritable = () => wait.promise;
  const saving = h.context.saveFile();
  h.context.setDocument("new file", "Other.fountain", false);
  const baseline = h.state.savedSource;
  wait.resolve({ write: async text => h.writes.push(text), close: async () => {} });
  await saving;
  assert.equal(h.state.filename, "Other.fountain");
  assert.equal(h.state.savedSource, baseline);
  assert.equal(h.source.value, "new file");
  assert.equal(h.state.localSaving, false);
});

test("cancelling or failing Save As keeps the original handle and save baseline", async () => {
  for (const failure of ["AbortError", "WriteError"]) {
    const h = harness(); const original = h.state.handle = {};
    h.context.window.showSaveFilePicker = async () => {
      if (failure === "AbortError") throw Object.assign(new Error("Cancelled"), { name: failure });
      return { createWritable: async () => { throw new Error("Write failed"); } };
    };
    await h.context.saveFile(true);
    assert.equal(h.state.handle, original);
    assert.equal(h.state.savedSource, "saved");
    assert.equal(h.state.localSaving, false);
    assert.equal(h.state.history.length, 2);
  }
});

test("document switching during a save picker cancels the write; repeat Save clicks do not create competing writes", async () => {
  const h = harness(); const wait = deferred(); let picks = 0;
  h.context.window.showSaveFilePicker = () => { picks++; return wait.promise; };
  const saving = h.context.saveFile(); await h.context.saveFile();
  h.context.setDocument("other", "Other.fountain", true);
  wait.resolve(h.handle); await saving;
  assert.equal(picks, 1);
  assert.equal(h.writes.length, 0);
  assert.equal(h.state.handle, null);
  assert.equal(h.state.filename, "Other.fountain");
});

test("download fallback also preserves undo and acknowledges only the downloaded content", async () => {
  const h = harness(); const wait = deferred();
  h.context.download = async blob => { h.writes.push(await blob.text()); await wait.promise; };
  const saving = h.context.saveFile(); h.source.value = "newer";
  wait.resolve(); await saving;
  assert.deepEqual(h.writes, ["draft"]);
  assert.equal(h.state.savedSource, "draft");
  assert.equal(h.state.history.length, 2);
  assert.equal(h.classes.has("dirty"), true);
});

test("Drive save acknowledges the captured snapshot without losing edits made during upload", async () => {
  const h = harness(); const wait = deferred();
  h.state.googleDriveFile = { id: "existing-file", capabilities: { canEdit: true } };
  h.context.collaboration.checkpoint = async () => { h.requests.push({ content: h.source.value, kind: "checkpoint" }); return wait.promise; };
  const saving = h.context.saveGoogleDrive();
  h.source.value = "newer"; wait.resolve({ file: { id: "existing-file" }, content: "draft" }); await saving;
  assert.equal(h.requests[0].content, "draft");
  assert.equal(h.requests[0].kind, "checkpoint");
  assert.equal(h.state.savedSource, "draft");
  assert.equal(h.classes.has("dirty"), true);
  assert.equal(h.state.history.length, 2);
});

test("new Drive file preserves in-flight typing for initial collaboration sync", async () => {
  const h = harness(); const wait = deferred();
  h.context.googleRequest = () => wait.promise;
  const saving = h.context.saveGoogleDrive(); h.source.value = "newer";
  wait.resolve({ file: { id: "created-file" } }); await saving;
  assert.equal(h.state.savedSource, "draft");
  assert.deepEqual(h.events.find(event => Array.isArray(event)), ["publish", "created-file", "newer"]);
  assert.equal(h.connectBaseline, "draft");
});

test("late Drive saves cannot attach a file to another document or signed-out account", async () => {
  for (const invalidate of [h => h.context.setDocument("other", "Other.fountain", true), h => h.state.googleConnected = false, h => h.state.googleAccount = { id: "other-account" }]) {
    const h = harness(); const wait = deferred();
    h.context.googleRequest = () => wait.promise;
    const saving = h.context.saveGoogleDrive(); invalidate(h);
    const baseline = h.state.savedSource;
    wait.resolve({ file: { id: "created-file" } }); await saving;
    assert.equal(h.state.googleDriveFile, null);
    assert.equal(h.state.savedSource, baseline);
    assert.ok(!h.events.includes("connect"));
    assert.equal(h.state.googleSaving, false);
  }
});

test("Drive save is single-flight and rejects read-only or signed-out writes", async () => {
  const h = harness(); const wait = deferred();
  h.context.googleRequest = () => { h.requests.push("request"); return wait.promise; };
  const saving = h.context.saveGoogleDrive(); await h.context.saveGoogleDrive();
  assert.equal(h.requests.length, 1);
  wait.resolve({ file: { id: "created-file" } }); await saving;
  h.state.googleDriveFile = { capabilities: { canEdit: false } };
  await h.context.saveGoogleDrive();
  h.state.googleDriveFile = null; h.state.googleConnected = false;
  await h.context.saveGoogleDrive();
  assert.equal(h.requests.length, 1);
});

test("slow local and Drive opens never overwrite newer edits or a switched document", async () => {
  for (const type of ["local", "drive"]) for (const change of [h => h.state.documentRevision++, h => h.state.editRevision++, h => h.state.previewComposing = true, h => h.state.sourceComposing = true]) {
    const h = harness(); const wait = deferred();
    h.context.googleRequest = () => wait.promise;
    const opening = type === "local"
      ? h.context.openLocalFile({ name: "Other.fountain", text: () => wait.promise })
      : h.context.openGoogleDriveFile("file-id");
    change(h);
    wait.resolve(type === "local" ? "old content" : { content: "old content", file: { name: "Other.fountain" } });
    await assert.rejects(opening, /editor changed while opening/);
    assert.equal(h.source.value, "draft");
    assert.ok(!h.events.includes("disconnect"));
  }
});

test("opening a writable legacy Drive file adopts a stable collaboration identity before connecting", async () => {
  const h = harness();
  h.context.googleRequest = async (url, options) => {
    h.requests.push({ url, method: options?.method || "GET" });
    return options?.method === "POST"
      ? { file: { id: "legacy-file", name: "Legacy.fountain", capabilities: { canEdit: true }, appProperties: { fountainPublisherDocumentId: "stable-room" } } }
      : { content: "legacy text", file: { id: "legacy-file", name: "Legacy.fountain", capabilities: { canEdit: true } } };
  };
  await h.context.openGoogleDriveFile("legacy-file");
  assert.equal(h.requests.length, 2);
  assert.match(h.requests[1].url, /legacy-file\/adopt$/);
  assert.equal(h.source.value, "legacy text");
  assert.equal(h.state.googleDriveFile.appProperties.fountainPublisherDocumentId, "stable-room");
  assert.ok(h.events.includes("connect"));
});

test("manual Drive saves use the room's acknowledged content, never a stale client PUT", async () => {
  const h = harness(); h.state.googleDriveFile = { id: "existing-file", capabilities: { canEdit: true } };
  h.context.collaboration.checkpoint = async () => ({ file: { id: "existing-file" }, content: "merged room version" });
  await h.context.saveGoogleDrive();
  assert.equal(h.requests.length, 0);
  assert.equal(h.state.savedSource, "merged room version");
  assert.equal(h.source.value, "draft"); assert.equal(h.classes.has("dirty"), true);
});

test("saves do not export transient composition text", async () => {
  for (const surface of ["previewComposing", "sourceComposing"]) {
    const h = harness(); h.state[surface] = true;
    await h.context.saveFile(); await h.context.saveGoogleDrive();
    assert.equal(h.requests.length, 0); assert.equal(h.writes.length, 0);
    assert.equal(h.state.savedSource, "saved");
  }
});

test("Save during initial sync or an invalid checkpoint reports recovery guidance without claiming a save", async () => {
  for (const failure of ["initial-sync", "invalid-result"]) {
    const h = harness(); h.state.googleDriveFile = { id: "existing-file", capabilities: { canEdit: true } };
    h.context.collaboration.synced = failure !== "initial-sync";
    h.context.collaboration.checkpoint = async () => undefined;
    await h.context.saveGoogleDrive();
    assert.equal(h.state.savedSource, "saved"); assert.equal(h.state.googleSaving, false);
    assert.match(h.events.at(-1), /local copy/);
    assert.ok(!h.events.some(event => typeof event === "string" && event.includes("Cannot read properties")));
  }
});

test("a collaboration sync conflict blocks Drive overwrite but allows a local recovery copy", async () => {
  const h = harness();
  h.context.collaboration.syncConflict = true;
  h.state.googleDriveFile = { id: "shared-file", capabilities: { canEdit: true } };
  await h.context.saveGoogleDrive();
  assert.equal(h.requests.length, 0);
  assert.match(h.events.at(-1), /Save a local copy/);
  await h.context.saveFile();
  assert.deepEqual(h.writes, ["draft"]);
  assert.equal(h.context.collaboration.syncConflict, true);
});
