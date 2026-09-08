import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

const app = await readFile(new URL("../../src/fountain_publisher/web/app.mjs", import.meta.url), "utf8");
const worker = await readFile(new URL("../../github-worker/src/index.mjs", import.meta.url), "utf8");

function pickerHarness({ adoptError = false } = {}) {
  const views = [];
  const calls = [];
  const messages = [];
  let callback;
  class DocsView {
    constructor(id) { this.id = id; }
    setIncludeFolders(value) { this.includeFolders = value; return this; }
    setSelectFolderEnabled(value) { this.selectFolders = value; return this; }
    setMode(value) { this.mode = value; return this; }
    setOwnedByMe(value) { this.ownedByMe = value; return this; }
    setParent(value) { this.parent = value; return this; }
    setLabel(value) { this.label = value; return this; }
    setEnableDrives(value) { this.drives = value; return this; }
  }
  class PickerBuilder {
    setAppId() { return this; }
    setDeveloperKey() { return this; }
    setOAuthToken() { return this; }
    setOrigin() { return this; }
    setTitle() { return this; }
    addView(view) { views.push(view); return this; }
    enableFeature() { return this; }
    setCallback(value) { callback = value; return this; }
    build() { return this; }
    setVisible(value) { calls.push(["visible", value]); }
  }
  const context = {
    window: {
      location: { origin: "https://app.example" },
      google: { picker: { DocsView, PickerBuilder, ViewId: { DOCS: "docs" }, DocsViewMode: { LIST: "list" }, Feature: { SUPPORT_DRIVES: "drives" }, Action: { PICKED: "picked" } } },
    },
    $: () => ({ close: () => calls.push(["close"]) }),
    loadGooglePicker: async () => {},
    googleRequest: async (path, options) => {
      calls.push([path, options?.method]);
      if (path.endsWith("/config")) return { apiKey: "test-key", appId: "test-app", accessToken: "test-token" };
      if (adoptError) throw new Error("Choose a .fountain or .txt screenplay");
      return {};
    },
    openGoogleDriveFile: async (id) => calls.push(["open", id]),
    toast: (message) => messages.push(message),
  };
  runInNewContext(app.slice(app.indexOf("async function openGooglePicker()"), app.indexOf("async function saveGoogleDrive(")), context);
  return { context, views, calls, messages, pick: (data) => callback(data) };
}

test("native Drive picker separates shared files, root folders, global search, and shared drives", async () => {
  const harness = pickerHarness();
  await harness.context.openGooglePicker();
  assert.deepEqual(harness.messages, []);
  assert.deepEqual(harness.views.map((view) => view.label), ["Shared with me", "My Drive", "All files", "Shared drives"]);
  const [shared, mine, all, drives] = harness.views;
  assert.equal(shared.ownedByMe, false);
  assert.equal(shared.parent, undefined);
  assert.equal(shared.drives, undefined);
  assert.equal(mine.parent, "root");
  assert.equal(mine.ownedByMe, undefined);
  assert.equal(all.parent, undefined);
  assert.equal(all.ownedByMe, undefined);
  assert.equal(drives.drives, true);
  assert.equal(drives.ownedByMe, undefined);
  for (const view of harness.views) {
    assert.equal(view.id, "docs");
    assert.equal(view.includeFolders, true);
    assert.equal(view.selectFolders, false);
    assert.equal(view.mode, "list");
  }
  assert.ok(harness.calls.findIndex(([action]) => action === "close") < harness.calls.findIndex(([action]) => action === "visible"));
  const html = await readFile(new URL("../../src/fountain_publisher/web/index.html", import.meta.url), "utf8");
  assert.match(html, /Filter this list only/);
  assert.match(html, /id="google-drive-browse"/);
  assert.match(app, /\$\("#google-drive-browse"\)\.addEventListener\("click", openGooglePicker\)/);
});

test("picker selection grants access through adoption before opening; cancellation and errors never open", async () => {
  const harness = pickerHarness();
  await harness.context.openGooglePicker();
  harness.calls.length = 0;
  await harness.pick({ action: "cancel" });
  await harness.pick({ action: "picked", docs: [] });
  assert.deepEqual(harness.calls, []);
  await harness.pick({ action: "picked", docs: [{ id: "shared-file_123" }] });
  assert.deepEqual(harness.calls, [["/api/google/drive/files/shared-file_123/adopt", "POST"], ["open", "shared-file_123"]]);
  const failed = pickerHarness({ adoptError: true });
  await failed.context.openGooglePicker();
  await failed.pick({ action: "picked", docs: [{ id: "unsupported_123" }] });
  assert.equal(failed.calls.some(([action]) => action === "open"), false);
  assert.deepEqual(failed.messages, ["Choose a .fountain or .txt screenplay"]);
});

function adoptionHarness(file) {
  const requests = [];
  const context = {
    URL,
    getGoogleSession: async () => ({ access_token: "test-token" }),
    safeDriveId: (id) => /^[A-Za-z0-9_-]{10,200}$/.test(id),
    randomToken: () => "new-document-id",
    json: (body, status = 200) => ({ body, status }),
    driveFetch: async (path, token, init = {}) => {
      requests.push({ path, ...init });
      return { json: async () => file };
    },
  };
  runInNewContext(worker.slice(worker.indexOf("async function googleApiRequest("), worker.indexOf("async function authorizeCollaboration(")), context);
  return {
    requests,
    adopt: () => context.googleApiRequest({ method: "POST" }, {}, new URL("https://api.example/api/google/drive/files/shared-file_123/adopt")),
  };
}

test("shared view-only screenplays open without attempting a metadata write", async () => {
  for (const mimeType of ["text/plain", "text/x-fountain", "application/x-fountain", "application/octet-stream"]) {
    const file = { id: "shared-file_123", name: "Shared.FOUNTAIN", mimeType, capabilities: { canEdit: false } };
    const harness = adoptionHarness(file);
    const result = await harness.adopt();
    assert.equal(result.status, 200);
    assert.equal(result.body.file, file);
    assert.equal(harness.requests.length, 1);
    assert.equal(harness.requests[0].method, undefined);
  }
});

test("editable screenplays are adopted once and unsupported files remain rejected", async () => {
  const file = { name: "Script.txt", mimeType: "text/plain", capabilities: { canEdit: true } };
  const editable = adoptionHarness(file);
  assert.equal((await editable.adopt()).status, 200);
  assert.equal(editable.requests[1].method, "PATCH");
  assert.equal(JSON.parse(editable.requests[1].body).appProperties.fountainPublisherDocumentId, "new-document-id");
  const prepared = adoptionHarness({ ...file, appProperties: { fountainPublisherDocumentId: "existing-id" } });
  assert.equal((await prepared.adopt()).status, 200);
  assert.equal(prepared.requests.length, 1);
  for (const invalid of [
    { ...file, name: "notes.pdf" },
    { ...file, mimeType: "application/vnd.google-apps.document" },
    { ...file, mimeType: "application/vnd.google-apps.folder" },
  ]) {
    const harness = adoptionHarness(invalid);
    assert.equal((await harness.adopt()).status, 400);
    assert.equal(harness.requests.length, 1);
  }
});

test("Drive requests support shared drives while preserving queries, methods, and errors", async () => {
  const requests = [];
  let ok = true;
  const context = {
    URL,
    fetch: async (url, init) => {
      requests.push({ url, init });
      return { ok, status: 403, json: async () => ({ error: { message: "Access denied" } }) };
    },
    json: (body, status) => new Response(JSON.stringify(body), { status }),
  };
  runInNewContext(worker.slice(worker.indexOf("async function driveFetch("), worker.indexOf("function safeDriveId(")), context);
  for (const [path, method] of [
    ["/drive/v3/files/shared-file_123?fields=id,name", "GET"],
    ["/drive/v3/files/shared-file_123?alt=media", "GET"],
    ["/upload/drive/v3/files/shared-file_123?uploadType=media", "PATCH"],
    ["/drive/v3/files/shared-file_123/permissions/permission_123", "DELETE"],
  ]) {
    await context.driveFetch(path, "test-token", { method });
    const { url, init } = requests.at(-1);
    assert.equal(url.origin, "https://www.googleapis.com");
    assert.equal(url.searchParams.get("supportsAllDrives"), "true");
    for (const [key, value] of new URL(path, url.origin).searchParams) assert.equal(url.searchParams.get(key), value);
    assert.equal(init.method, method);
    assert.equal(init.headers.authorization, ["Bearer", "test-token"].join(" "));
  }
  ok = false;
  await assert.rejects(context.driveFetch("/drive/v3/files/shared-file_123", "test-token"), (error) => error.status === 403);
});

test("opening a view-only share disconnects the previous collaboration and preserves read-only state", async () => {
  const file = { id: "shared-file_123", name: "Shared.fountain", capabilities: { canEdit: false } };
  const calls = [];
  const elements = new Map();
  const context = {
    state: { documentRevision: 0 },
    source: {},
    document: {},
    $: (selector) => {
      if (!elements.has(selector)) elements.set(selector, { close() {} });
      return elements.get(selector);
    },
    sourceChanged: () => calls.push("document"),
    googleRequest: async () => ({ file, content: "INT. ROOM - DAY" }),
    collaboration: { disconnect: () => calls.push("disconnect") },
    connectDriveCollaboration: () => {},
    toast: () => {},
  };
  runInNewContext(app.slice(app.indexOf("function setDocument("), app.indexOf("const collaboration =")), context);
  runInNewContext(app.slice(app.indexOf("async function openGoogleDriveFile("), app.indexOf("let googlePickerPromise")), context);
  await context.openGoogleDriveFile(file.id);
  assert.deepEqual(calls, ["disconnect", "document"]);
  assert.equal(context.source.value, "INT. ROOM - DAY");
  assert.equal(context.source.readOnly, true);
  assert.equal(elements.get("#screenplay-page").contentEditable, "false");
  assert.equal(context.state.googleDriveFile, file);
});
