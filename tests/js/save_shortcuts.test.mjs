import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const app = await readFile(new URL("../../src/fountain_publisher/web/app.mjs", import.meta.url), "utf8");
const section = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const linkedGithub = { owner: "original-owner", repo: "original-repo", branch: "draft", path: "scripts/Original.fountain", sha: "original-sha" };
const linkedDrive = { id: "drive-file", capabilities: { canEdit: true }, appProperties: { fountainPublisherDocumentId: "room" } };

function harness() {
  const elements = new Map(), storage = new Map(), calls = [], notices = [], classes = new Set(["dirty"]);
  const state = {
    filename: "Draft.fountain", savedSource: "baseline", documentRevision: 1, editRevision: 1,
    handle: null, saveDestination: "local", saveOperation: null,
    githubConnected: true, googleConnected: true, googleAccount: { id: "user" },
    githubFile: null, googleDriveFile: null, collaborators: new Map(),
    githubRepository: "browser-owner/browser-repo", githubBranch: "main", githubPath: "elsewhere", githubColumns: [],
    cacheEnabled: true, previewMode: "live", previewZoom: "100", history: ["baseline", "draft"], historyIndex: 1,
  };
  const source = { value: "draft", selectionStart: 1, selectionEnd: 3, readOnly: false, scrollTop: 0 };
  const $ = (id) => {
    if (!elements.has(id)) elements.set(id, {
      value: "", textContent: "", innerHTML: "", hidden: true, open: false, disabled: false, dataset: {},
      listeners: {}, addEventListener(type, listener) { this.listeners[type] = listener; },
      scrollTop: 0, scrollLeft: 0, close() { this.open = false; }, showModal() { this.open = true; },
    });
    return elements.get(id);
  };
  $("#github-branch").value = "main";
  $("#github-filename").value = "Chosen.fountain";
  $("#github-commit-message").value = "Explicit destination";
  const context = {
    state, source, $, Blob, clearTimeout() {},
    window: {}, navigator: { maxTouchPoints: 0 }, document: { title: "", body: { classList: { toggle(name, value) { value ? classes.add(name) : classes.delete(name); } } } },
    localStorage: { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    WORKSPACE_CACHE_KEY: "workspace",
    toast: (message) => notices.push(message), escapeHtml: (value) => value,
    updateGoogleMenu() {}, sourceChanged() { state.editRevision += 1; },
    scheduleWorkspaceCache() { context.persistWorkspaceNow(); },
    selectedGithubRepository: () => ({ fullName: "browser-owner/browser-repo", owner: "browser-owner", repo: "browser-repo" }),
    openGithubBrowser: async (mode) => calls.push({ kind: "github-browser", mode }),
    download: async (blob, filename) => calls.push({ kind: "download", filename, content: await blob.text() }),
    collaboration: {
      synced: true, closed: false, fileId: "drive-file", disconnect() {},
      replace(content) { calls.push({ kind: "publish", content }); },
      async checkpoint() { calls.push({ kind: "checkpoint" }); return { file: { ...linkedDrive }, content: source.value }; },
    },
    googleRequest: async (path, options) => { calls.push({ kind: "drive-create", path, payload: JSON.parse(options.body) }); return { file: { ...linkedDrive } }; },
    connectDriveCollaboration() {}, openGoogleDrive: async () => {},
  };
  runInNewContext([
    section("function setDocument(", "const collaboration ="),
    section("async function saveFile(", "async function githubRequest("),
    section("async function saveGoogleDrive(", "async function shareGoogleDrive("),
    section("async function saveGithubFile(", "function conflictLines("),
    section("function prepareGithubKeyboardInputs(", "function decodeGithubContent("),
    section("function normalizedFilename(", "async function download("),
    section("function persistWorkspaceNow(", "function scheduleWorkspaceCache("),
    section("function cancelWorkspaceViewCache(", "function scheduleWorkspaceViewCache("),
  ].join("\n"), context);
  runInNewContext(section('$("#github-conflict-dialog").addEventListener("keydown"', '\n$("#github-conflict-dialog").addEventListener("beforeinput"'), context);
  context.writeGithubFile = async (target, content, sha) => {
    calls.push({ kind: "github-write", target, content, sha });
    return { sha: "committed-sha", commit: "https://github.com/commit/confirmed" };
  };
  context.readGithubVersion = async () => ({ sha: "committed-sha", content: "draft" });
  const handle = {
    async createWritable() { return { async write(content) { calls.push({ kind: "local-write", content }); }, async close() {} }; },
    async getFile() { return { name: "Local.fountain" }; },
  };
  return { context, state, source, $, storage, calls, notices, classes, handle };
}

test("opening a provider document chooses its in-place save route; new/local documents reset it", () => {
  const h = harness();
  h.context.setDocument("github", "Original.fountain", true, linkedGithub);
  assert.equal(h.state.saveDestination, "github");
  h.context.setDocument("drive", "Drive.fountain", true, null, linkedDrive);
  assert.equal(h.state.saveDestination, "drive");
  h.context.setDocument("new", "New.fountain", false);
  assert.equal(h.state.saveDestination, "local");
  assert.equal(h.$("#save-status").hidden, true);
});

test("Save reuses the linked GitHub repository, branch, path and SHA rather than browser navigation", async () => {
  const h = harness(); h.state.githubFile = { ...linkedGithub }; h.state.saveDestination = "github";
  await h.context.saveCurrentDocument();
  const write = h.calls.find((call) => call.kind === "github-write");
  assert.equal(write.target.owner, linkedGithub.owner);
  assert.equal(write.target.repo, linkedGithub.repo);
  assert.equal(write.target.branch, linkedGithub.branch);
  assert.equal(write.target.path, linkedGithub.path);
  assert.equal(write.sha, linkedGithub.sha);
  assert.equal(write.target.message, "Update Original.fountain");
  assert.equal(h.calls.length, 1);
  assert.equal(h.state.githubFile.sha, "committed-sha");
  assert.equal(h.$("#save-status").textContent, "Saved");
  assert.match(h.notices.at(-1), /Saved Original.fountain to GitHub/);
});

test("a successful explicit GitHub save becomes the next Save destination", async () => {
  const h = harness(); h.state.handle = h.handle;
  await h.context.saveGithubFile();
  assert.equal(h.state.saveDestination, "github");
  h.$("#github-branch").value = "unrelated-browser-branch";
  await h.context.saveCurrentDocument();
  const writes = h.calls.filter((call) => call.kind === "github-write");
  assert.equal(writes.length, 2);
  assert.equal(writes[1].target.branch, "main");
  assert.equal(writes[1].target.path, "elsewhere/Chosen.fountain");
  assert.ok(!h.calls.some((call) => call.kind === "local-write"));
});

test("saving a local copy of a GitHub document makes subsequent Save local without losing its association", async () => {
  const h = harness(); h.state.githubFile = { ...linkedGithub }; h.state.saveDestination = "github";
  h.context.window.showSaveFilePicker = async () => h.handle;
  await h.context.saveCurrentDocument(true);
  assert.equal(h.state.saveDestination, "local");
  assert.equal(h.state.githubFile.path, linkedGithub.path);
  await h.context.saveCurrentDocument();
  assert.equal(h.calls.filter((call) => call.kind === "local-write").length, 2);
  assert.ok(!h.calls.some((call) => call.kind === "github-write"));
});

test("downloads count as the selected save method and repeated Save downloads the same filename", async () => {
  const h = harness(); h.state.saveDestination = "github"; h.state.githubFile = { ...linkedGithub };
  await h.context.saveFile(true);
  assert.equal(h.state.saveDestination, "download");
  await h.context.saveCurrentDocument();
  assert.equal(h.calls.length, 2);
  assert.ok(h.calls.every((call) => call.kind === "download" && call.filename === "Draft.fountain"));
  assert.match(h.notices.at(-1), /Downloaded Draft.fountain/);
});

test("canceled or failed Save As never changes the previously successful destination", async () => {
  for (const failure of [new DOMException("Canceled", "AbortError"), new Error("Disk unavailable")]) {
    const h = harness(); h.state.saveDestination = "github"; h.state.githubFile = { ...linkedGithub };
    h.context.window.showSaveFilePicker = async () => { throw failure; };
    await h.context.saveFile(true);
    assert.equal(h.state.saveDestination, "github");
    assert.equal(h.state.savedSource, "baseline");
    assert.equal(h.state.saveOperation, null);
    assert.equal(h.$("#save-status").textContent, failure.name === "AbortError" ? "Canceled" : "Save failed");
    await h.context.saveCurrentDocument();
    assert.equal(h.calls[0].kind, "github-write");
  }
});

test("failed GitHub write or verification preserves the local route and baseline", async () => {
  for (const failure of ["write", "verify"]) {
    const h = harness();
    if (failure === "write") h.context.writeGithubFile = async () => { throw new Error("Network unavailable"); };
    else h.context.readGithubVersion = async () => ({ sha: "unexpected" });
    await h.context.saveGithubFile();
    assert.equal(h.state.saveDestination, "local");
    assert.equal(h.state.savedSource, "baseline");
    assert.equal(h.$("#save-status").textContent, "Save failed");
    assert.equal(h.state.saveOperation, null);
  }
});

test("repeated Save during GitHub upload is visible and cannot create another provider save", async () => {
  const h = harness(), pending = deferred();
  h.state.saveDestination = "github"; h.state.githubFile = { ...linkedGithub };
  h.context.writeGithubFile = async (...args) => { h.calls.push({ kind: "github-write", args }); return pending.promise; };
  const saving = h.context.saveCurrentDocument();
  assert.equal(h.$("#save-status").textContent, "Saving…");
  await h.context.saveCurrentDocument(); await h.context.saveFile(true); await h.context.saveGoogleDrive();
  assert.equal(h.calls.length, 1);
  assert.match(h.notices.at(-1), /Still saving Draft.fountain to GitHub/);
  pending.resolve({ sha: "committed-sha", commit: "https://github.com/commit/confirmed" }); await saving;
  assert.equal(h.state.saveOperation, null);
  assert.equal(h.state.githubSaving, false);
  assert.equal(h.$("#save-status").textContent, "Saved");
});

test("editing while GitHub saves preserves the submitted snapshot and leaves newer text dirty", async () => {
  const h = harness(), pending = deferred(); h.state.saveDestination = "github"; h.state.githubFile = { ...linkedGithub };
  h.context.writeGithubFile = async (target, content) => { h.calls.push({ target, content }); return pending.promise; };
  const saving = h.context.saveCurrentDocument();
  h.source.value = "newer"; h.state.editRevision += 1;
  pending.resolve({ sha: "committed-sha", commit: "https://github.com/commit/confirmed" }); await saving;
  assert.equal(h.calls[0].content, "draft");
  assert.equal(h.state.savedSource, "draft");
  assert.equal(h.source.value, "newer");
  assert.equal(h.classes.has("dirty"), true);
  assert.match(h.notices.at(-1), /newer editor changes were kept/);
});

test("late save completion cannot change a newly opened document's destination or identity", async () => {
  const h = harness(), pending = deferred(); h.state.githubFile = { ...linkedGithub }; h.state.saveDestination = "github";
  h.context.writeGithubFile = () => pending.promise;
  const saving = h.context.saveCurrentDocument();
  h.context.setDocument("new document", "New.fountain", true);
  pending.resolve({ sha: "committed-sha", commit: "https://github.com/commit/confirmed" }); await saving;
  assert.equal(h.state.saveDestination, "local");
  assert.equal(h.state.filename, "New.fountain");
  assert.equal(h.state.savedSource, "new document");
  assert.equal(h.$("#save-status").hidden, true);
});

test("Save on an opened Drive file checkpoints that file without creating a new Drive file", async () => {
  const h = harness(); h.state.saveDestination = "drive"; h.state.googleDriveFile = { ...linkedDrive };
  await h.context.saveCurrentDocument();
  assert.equal(h.calls.filter((call) => call.kind === "checkpoint").length, 1);
  assert.ok(!h.calls.some((call) => call.kind === "drive-create"));
  assert.equal(h.state.saveDestination, "drive");
  assert.equal(h.$("#save-status").textContent, "Saved");
});

test("successful explicit Drive upload selects Drive, while a local copy selects downloads", async () => {
  const h = harness();
  await h.context.saveGoogleDrive();
  assert.equal(h.$("#google-save-dialog").open, true);
  assert.equal(h.calls.length, 0);
  await h.context.submitGoogleDriveSave({ submitter: { value: "default" }, preventDefault() {} });
  assert.equal(h.state.saveDestination, "drive");
  assert.equal(h.calls.filter((call) => call.kind === "drive-create").length, 1);
  await h.context.saveFile(true);
  assert.equal(h.state.saveDestination, "download");
  await h.context.saveCurrentDocument();
  assert.equal(h.calls.filter((call) => call.kind === "download").length, 2);
  assert.equal(h.state.googleDriveFile.id, linkedDrive.id);
});

test("Drive read-only, conflict, disconnected and initial-sync guards stay fail-closed with feedback", async () => {
  for (const reason of ["readonly", "conflict", "signedout", "initial", "closed"]) {
    const h = harness(); h.state.saveDestination = "drive"; h.state.googleDriveFile = { ...linkedDrive, capabilities: { canEdit: true } };
    if (reason === "readonly") h.state.googleDriveFile.capabilities.canEdit = false;
    if (reason === "conflict") h.context.collaboration.syncConflict = true;
    if (reason === "signedout") h.state.googleConnected = false;
    if (reason === "initial") h.context.collaboration.synced = false;
    if (reason === "closed") h.context.collaboration.closed = true;
    await h.context.saveCurrentDocument();
    assert.equal(h.calls.length, 0);
    assert.equal(h.state.savedSource, "baseline");
    assert.equal(h.$("#save-status").textContent, "Save failed");
    assert.ok(h.notices.length > 0);
  }
});

test("Drive save dialog creates a named copy in the chosen folder, then Save updates that copy", async () => {
  const h = harness();
  h.state.googleDriveFile = { ...linkedDrive };
  h.state.saveDestination = "drive";
  h.context.openGoogleDriveSave();
  assert.equal(h.state.googleDriveSave.parentId, "root");
  assert.equal(h.$("#google-save-filename").value, "Draft.fountain");
  h.state.googleDriveSave.parentId = "chosen-folder";
  h.$("#google-save-filename").value = "Second draft";
  h.context.googleRequest = async (path, options) => {
    h.calls.push({ kind: "drive-create", payload: JSON.parse(options.body) });
    return { file: { ...linkedDrive, id: "new-copy", name: "Second draft.fountain" } };
  };
  let disconnected = false;
  h.context.collaboration.disconnect = () => { disconnected = true; };
  h.context.connectDriveCollaboration = (file) => { h.context.collaboration.fileId = file.id; };
  await h.context.submitGoogleDriveSave({ submitter: { value: "default" }, preventDefault() {} });
  assert.deepEqual(h.calls[0].payload, { name: "Second draft.fountain", parentId: "chosen-folder", content: "draft" });
  assert.equal(h.calls.some((call) => call.kind === "checkpoint"), false);
  assert.equal(disconnected, true);
  assert.equal(h.state.googleDriveFile.id, "new-copy");
  assert.equal(h.state.filename, "Second draft.fountain");
  assert.equal(h.$("#google-save-dialog").open, false);
  await h.context.saveCurrentDocument();
  assert.equal(h.calls.filter((call) => call.kind === "checkpoint").length, 1);
  assert.equal(h.calls.filter((call) => call.kind === "drive-create").length, 1);
});

test("folder selection preserves the save draft on cancel and ignores stale document/account callbacks", async () => {
  for (const change of ["none", "document", "account"]) {
    const h = harness();
    h.context.googlePickerActive = false;
    let picker;
    h.context.openGooglePicker = async (options) => { picker = options; };
    h.context.openGoogleDriveSave();
    h.$("#google-save-filename").value = "Custom.fountain";
    await h.context.chooseGoogleDriveFolder();
    assert.equal(h.$("#google-save-dialog").open, false);
    picker.onCancel();
    assert.equal(h.state.googleDriveSave.parentId, "root");
    assert.equal(h.$("#google-save-filename").value, "Custom.fountain");
    assert.equal(h.$("#google-save-dialog").open, true);
    await h.context.chooseGoogleDriveFolder();
    if (change === "document") h.state.documentRevision += 1;
    if (change === "account") h.state.googleAccount = { id: "other" };
    picker.onPicked({ id: "chosen-folder", name: "My scripts" });
    assert.equal(h.state.googleDriveSave.parentId, change === "none" ? "chosen-folder" : "root");
    assert.equal(h.$("#google-save-dialog").open, change === "none");
    assert.equal(h.calls.length, 0);
  }
});

test("cancelled, invalid, and stale Drive saves do not upload or switch destinations", async () => {
  for (const reason of ["cancel", "empty", "slashes", "long", "document", "account", "signedout"]) {
    const h = harness();
    h.context.openGoogleDriveSave();
    if (reason === "empty") h.$("#google-save-filename").value = " ";
    if (reason === "slashes") h.$("#google-save-filename").value = "folder/file";
    if (reason === "long") h.$("#google-save-filename").value = "a".repeat(200);
    if (reason === "document") h.state.documentRevision += 1;
    if (reason === "account") h.state.googleAccount = { id: "other" };
    if (reason === "signedout") h.state.googleConnected = false;
    await h.context.submitGoogleDriveSave({ submitter: { value: reason === "cancel" ? "cancel" : "default" }, preventDefault() {} });
    assert.equal(h.calls.length, 0, reason);
    assert.equal(h.state.saveDestination, "local", reason);
    assert.equal(h.state.savedSource, "baseline", reason);
  }
});

test("failed Drive copy preserves the original link and collaboration for retry", async () => {
  const h = harness();
  h.state.googleDriveFile = { ...linkedDrive };
  h.state.saveDestination = "drive";
  h.context.openGoogleDriveSave();
  h.state.googleDriveSave.parentId = "no-access-folder";
  h.context.googleRequest = async () => { throw new Error("Folder access denied"); };
  h.context.collaboration.disconnect = () => { throw new Error("Must not disconnect"); };
  await h.context.submitGoogleDriveSave({ submitter: { value: "default" }, preventDefault() {} });
  assert.equal(h.state.googleDriveFile.id, linkedDrive.id);
  assert.equal(h.state.savedSource, "baseline");
  assert.equal(h.state.saveDestination, "drive");
  assert.equal(h.$("#google-save-dialog").open, true);
  assert.equal(h.$("#google-save-confirm").disabled, false);
  assert.match(h.notices.at(-1), /Folder access denied/);
});

test("a view-only Drive file can be copied without modifying the original", async () => {
  const h = harness();
  h.state.googleDriveFile = { ...linkedDrive, capabilities: { canEdit: false } };
  h.source.readOnly = true;
  h.context.openGoogleDriveSave();
  await h.context.submitGoogleDriveSave({ submitter: { value: "default" }, preventDefault() {} });
  assert.equal(h.calls.filter((call) => call.kind === "drive-create").length, 1);
  assert.equal(h.calls.some((call) => call.kind === "checkpoint"), false);
  assert.equal(h.source.readOnly, false);
  assert.equal(h.$("#screenplay-page").contentEditable, "plaintext-only");
});

test("a late Drive copy response cannot replace a new document or account", async () => {
  for (const change of ["document", "account"]) {
    const h = harness(), pending = deferred();
    h.context.openGoogleDriveSave();
    h.context.googleRequest = () => pending.promise;
    const saving = h.context.submitGoogleDriveSave({ submitter: { value: "default" }, preventDefault() {} });
    if (change === "document") h.state.documentRevision += 1;
    else h.state.googleAccount = { id: "other" };
    pending.resolve({ file: { ...linkedDrive } });
    await saving;
    assert.equal(h.state.googleDriveFile, null);
    assert.equal(h.state.saveDestination, "local");
    assert.equal(h.state.savedSource, "baseline");
    assert.equal(h.calls.length, 0);
  }
});

test("Drive copy uploads only once and preserves edits made while saving", async () => {
  const h = harness(), pending = deferred();
  h.context.openGoogleDriveSave();
  h.context.googleRequest = async (path, options) => { h.calls.push({ kind: "drive-create", payload: JSON.parse(options.body) }); return pending.promise; };
  const event = { submitter: { value: "default" }, preventDefault() {} };
  const saving = h.context.submitGoogleDriveSave(event);
  await h.context.submitGoogleDriveSave(event);
  assert.equal(h.calls.length, 1);
  h.source.value = "newer edits";
  pending.resolve({ file: { ...linkedDrive } });
  await saving;
  assert.equal(h.state.savedSource, "draft");
  assert.equal(h.source.value, "newer edits");
  assert.equal(h.classes.has("dirty"), true);
  assert.equal(h.calls.find((call) => call.kind === "publish").content, "newer edits");
});

test("Drive dialog Enter targets Save and save shortcuts submit without browser Save Page", async () => {
  const html = await readFile(new URL("../../src/fountain_publisher/web/index.html", import.meta.url), "utf8");
  const form = html.match(/<form method="dialog" id="google-save-form">[\s\S]*?<\/form>/)[0];
  assert.match(form, /id="google-save-cancel" type="button"/);
  assert.match(form, /id="google-save-confirm"[^>]*type="submit"[^>]*value="default"/);
  const h = harness();
  runInNewContext(section('$("#google-save-form").addEventListener', '$("#google-save-choose-folder").addEventListener'), h.context);
  let submitted = 0;
  h.$("#google-save-form").requestSubmit = (button) => {
    assert.equal(button, h.$("#google-save-confirm"));
    submitted += 1;
  };
  for (const modifier of ["ctrlKey", "metaKey"]) {
    let prevented = false, stopped = false;
    h.$("#google-save-dialog").listeners.keydown({
      key: "s", [modifier]: true,
      preventDefault() { prevented = true; },
      stopPropagation() { stopped = true; },
    });
    assert.equal(prevented, true);
    assert.equal(stopped, true);
  }
  assert.equal(submitted, 2);
  h.$("#google-save-dialog").showModal();
  h.state.googleSaving = true;
  h.$("#google-save-cancel").listeners.click();
  assert.equal(h.$("#google-save-dialog").open, true);
  h.state.googleSaving = false;
  h.$("#google-save-cancel").listeners.click();
  assert.equal(h.$("#google-save-dialog").open, false);
  assert.equal(h.calls.length, 0);
});

test("provider sign-out and missing restored Drive association never silently fall back to another destination", async () => {
  const h = harness(); h.state.saveDestination = "github"; h.state.githubConnected = false; h.state.githubFile = { ...linkedGithub };
  await h.context.saveCurrentDocument();
  assert.match(h.notices.at(-1), /Connect GitHub/);
  h.state.saveDestination = "drive";
  await h.context.saveCurrentDocument();
  assert.match(h.notices.at(-1), /Reopen the Drive document/);
  assert.equal(h.calls.length, 0);
});

test("the selected method is persisted alongside the recovered document and GitHub target", async () => {
  const h = harness(); h.state.githubFile = { ...linkedGithub }; h.state.saveDestination = "github";
  await h.context.saveCurrentDocument();
  let cached = JSON.parse(h.storage.get("workspace"));
  assert.equal(cached.saveDestination, "github");
  assert.equal(cached.githubFile.path, linkedGithub.path);
  await h.context.saveFile(true);
  cached = JSON.parse(h.storage.get("workspace"));
  assert.equal(cached.saveDestination, "download");
  assert.equal(cached.githubFile.path, linkedGithub.path);
});

test("saving persists the destination immediately and cancels obsolete view-only cache work", () => {
  const h = harness(), cancelledTimers = [], cancelledIdle = [];
  h.state.saveDestination = "github"; h.state.githubFile = { ...linkedGithub };
  h.state.cacheTimer = 7; h.state.viewCacheTimer = 42; h.state.viewCacheIdle = 88;
  h.context.clearTimeout = (id) => cancelledTimers.push(id);
  h.context.window.cancelIdleCallback = (id) => cancelledIdle.push(id);
  h.context.persistWorkspaceNow();
  const cached = JSON.parse(h.storage.get("workspace"));
  assert.equal(cached.saveDestination, "github");
  assert.equal(cached.githubFile.path, linkedGithub.path);
  assert.equal(cached.source, "draft");
  assert.deepEqual(cancelledTimers, [7, 42]);
  assert.deepEqual(cancelledIdle, [88]);
  assert.equal(h.state.cacheTimer, 0);
  assert.equal(h.state.viewCacheTimer, 0);
  assert.equal(h.state.viewCacheIdle, 0);
});

test("automatic Drive checkpoints cannot mark text saved to a different selected destination", () => {
  for (const destination of ["local", "download", "github", "drive"]) {
    const h = harness(); h.state.saveDestination = destination; h.state.googleDriveFile = { ...linkedDrive };
    runInNewContext(`globalThis.checkpointAdapter = { ${section("  onCheckpoint(result) {", "  onDocument(value,")} };`, h.context);
    h.context.checkpointAdapter.onCheckpoint({ file: { id: linkedDrive.id, modifiedTime: "updated" }, content: "draft" });
    assert.equal(h.state.googleDriveFile.modifiedTime, "updated", "metadata remains current for every destination");
    assert.equal(h.state.savedSource, destination === "drive" ? "draft" : "baseline");
    assert.equal(h.classes.has("dirty"), destination !== "drive");
  }
});

test("Save shortcuts inside the GitHub browser show pending progress without falling through to browser Save Page", () => {
  const h = harness(); h.state.githubSaving = true;
  h.context.prepareGithubKeyboardInputs();
  const event = { key: "s", metaKey: true, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } };
  h.$("#github-dialog").listeners.keydown(event);
  assert.equal(event.prevented, true);
  assert.equal(event.stopped, true);
  assert.match(h.notices.at(-1), /Still saving.*GitHub/);
  assert.equal(h.calls.length, 0);
});

test("Save in the GitHub conflict editor requests review and never commits an unreviewed resolution", () => {
  const h = harness(); h.state.githubConflict = { target: { documentRevision: 1 }, busy: false };
  h.$("#github-conflict-dialog").open = true;
  const event = { key: "S", ctrlKey: true, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } };
  h.$("#github-conflict-dialog").listeners.keydown(event);
  assert.equal(event.prevented, true);
  assert.equal(event.stopped, true);
  assert.match(h.notices.at(-1), /Review the GitHub conflict/);
  assert.equal(h.calls.length, 0);
});

test("provider dialog composition and ordinary typing remain isolated without triggering saves", () => {
  const h = harness(); h.context.prepareGithubKeyboardInputs();
  for (const properties of [{ key: "s", ctrlKey: true, isComposing: true }, { key: "x" }]) {
    const event = { ...properties, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } };
    h.$("#github-dialog").listeners.keydown(event);
    assert.equal(event.prevented, undefined);
    assert.equal(event.stopped, true);
  }
  assert.equal(h.calls.length, 0);
  assert.equal(h.notices.length, 0);
});
