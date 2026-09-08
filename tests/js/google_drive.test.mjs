import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

const app = await readFile(new URL("../../src/fountain_publisher/web/app.mjs", import.meta.url), "utf8");
const worker = await readFile(new URL("../../github-worker/src/index.mjs", import.meta.url), "utf8");

function pickerHarness({ adoptError = false, configError = false, buildError = false, openError = false } = {}) {
  const views = [];
  const calls = [];
  const messages = [];
  const classes = new Set();
  const properties = new Map();
  const elements = new Map();
  const sizes = [];
  const listeners = new Set();
  const viewportListeners = new Set();
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
    setSize(width, height) { sizes.push([Math.max(566, width), Math.max(350, height)]); return this; }
    addView(view) { views.push(view); return this; }
    enableFeature() { return this; }
    setCallback(value) { callback = value; return this; }
    build() { if (buildError) throw new Error("Picker unavailable"); return this; }
    setVisible(value) { calls.push(["visible", value]); }
    dispose() { calls.push(["dispose"]); }
  }
  const context = {
    document: {
      activeElement: { blur() {}, focus: (options) => calls.push(["focus", options.preventScroll]) },
      documentElement: {
        classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name) },
        style: { setProperty: (name, value) => properties.set(name, value), removeProperty: (name) => properties.delete(name) },
      },
    },
    window: {
      location: { origin: "https://app.example" },
      scrollX: 0, scrollY: 120,
      innerWidth: 1024, innerHeight: 768,
      addEventListener: (event, listener) => listeners.add(listener),
      removeEventListener: (event, listener) => listeners.delete(listener),
      visualViewport: {
        width: 768, height: 600,
        addEventListener: (event, listener) => viewportListeners.add(listener),
        removeEventListener: (event, listener) => viewportListeners.delete(listener),
      },
      scrollTo: (x, y) => calls.push(["scroll", x, y]),
      google: { picker: { DocsView, PickerBuilder, ViewId: { DOCS: "docs" }, DocsViewMode: { LIST: "list" }, Feature: { SUPPORT_DRIVES: "drives" }, Action: { PICKED: "picked", CANCEL: "cancel", ERROR: "error" } } },
    },
    $: (selector) => {
      if (!elements.has(selector)) elements.set(selector, {
        open: false,
        close() { this.open = false; calls.push(["close"]); },
        showModal() { this.open = true; },
      });
      return elements.get(selector);
    },
    loadGooglePicker: async () => {},
    updateMobileViewport() {},
    googleRequest: async (path, options) => {
      calls.push([path, options?.method]);
      if (path.endsWith("/config")) {
        if (configError) throw new Error("Not signed in with Google");
        return { apiKey: "test-key", appId: "test-app", accessToken: "test-token" };
      }
      if (adoptError) throw new Error("Choose a .fountain or .txt screenplay");
      return {};
    },
    openGoogleDriveFile: async (id) => {
      if (openError) throw new Error("Access denied");
      calls.push(["open", id]);
    },
    toast: (message) => messages.push(message),
  };
  runInNewContext(app.slice(app.indexOf("let googlePickerActive"), app.indexOf("async function saveGoogleDrive(")), context);
  return { context, views, calls, messages, classes, elements, sizes, properties, listeners, viewportListeners, pick: (data) => callback(data) };
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

test("picker selection releases the viewport and grants access through adoption before opening", async () => {
  const harness = pickerHarness();
  await harness.context.openGooglePicker();
  assert.ok(harness.classes.has("google-picker-open"));
  assert.deepEqual(harness.sizes, [[744, 576]]);
  harness.calls.length = 0;
  await harness.pick({ action: "picked", docs: [{ id: "shared-file_123" }] });
  assert.deepEqual(harness.calls, [
    ["dispose"], ["focus", true], ["scroll", 0, 120],
    ["/api/google/drive/files/shared-file_123/adopt", "POST"], ["open", "shared-file_123"], ["close"],
  ]);
  assert.equal(harness.classes.size, 0);
  assert.equal(harness.elements.get("#google-picker-help").open, false);
  await harness.pick({ action: "picked", docs: [{ id: "shared-file_123" }] });
  assert.equal(harness.calls.filter(([action]) => action === "open").length, 1);
});

test("picker failures show persistent errors rather than silently ignoring a selection", async () => {
  const failed = pickerHarness({ adoptError: true });
  await failed.context.openGooglePicker();
  await failed.pick({ action: "picked", docs: [{ id: "unsupported_123" }] });
  assert.equal(failed.calls.some(([action]) => action === "open"), false);
  assert.equal(failed.elements.get("#google-picker-status").textContent, "Could not open the screenplay: Choose a .fountain or .txt screenplay");
  assert.equal(failed.elements.get("#google-picker-help").open, true);
  assert.equal(failed.elements.get("#google-picker-retry").disabled, false);
  assert.equal(failed.classes.size, 0);
  const denied = pickerHarness({ openError: true });
  await denied.context.openGooglePicker();
  await denied.pick({ action: "picked", docs: [{ id: "shared-file_123" }] });
  assert.match(denied.elements.get("#google-picker-status").textContent, /Access denied/);
});

test("cancelling Picker returns to the workspace without another modal", async () => {
  const harness = pickerHarness();
  await harness.context.openGooglePicker();
  await harness.pick({ action: "cancel" });
  assert.equal(harness.classes.size, 0);
  assert.equal(harness.elements.get("#google-picker-help").open, false);
  assert.equal(harness.calls.some(([action]) => action === "open" || action.endsWith("/adopt")), false);
});

test("missing documents and account errors offer recovery without opening a file", async () => {
  for (const [data, message] of [
    [{ action: "picked", docs: [] }, /did not return a selected file/],
    [{ action: "error" }, /connection may still be working/],
  ]) {
    const harness = pickerHarness();
    await harness.context.openGooglePicker();
    await harness.pick(data);
    assert.equal(harness.calls.some(([action]) => action === "open" || action.endsWith("/adopt")), false);
    assert.equal(harness.classes.size, 0);
    assert.equal(harness.elements.get("#google-picker-help").open, true);
    assert.match(harness.elements.get("#google-picker-status").textContent, message);
  }
});

test("picker setup failures release the workspace and display the error", async () => {
  for (const options of [{ configError: true }, { buildError: true }]) {
    const harness = pickerHarness(options);
    await harness.context.openGooglePicker();
    assert.equal(harness.classes.size, 0);
    assert.equal(harness.elements.get("#google-picker-help").open, true);
    assert.match(harness.elements.get("#google-picker-status").textContent, /Not signed in|Picker unavailable/);
    assert.ok(harness.calls.some(([action]) => action === "scroll"));
  }
});

test("picker ignores nonterminal events and prevents overlapping browsers and imports", async () => {
  const harness = pickerHarness();
  await harness.context.openGooglePicker();
  await harness.context.openGooglePicker();
  assert.equal(harness.views.length, 4);
  await harness.pick({ action: "loaded" });
  assert.ok(harness.classes.has("google-picker-open"));
  let finish;
  harness.context.openGoogleDriveFile = () => new Promise((resolve) => { finish = resolve; });
  const selection = harness.pick({ action: "picked", docs: [{ id: "shared-file_123" }] });
  await Promise.resolve();
  assert.equal(harness.elements.get("#google-picker-status").textContent, "Opening selected screenplay…");
  assert.equal(harness.elements.get("#google-picker-local").disabled, true);
  await harness.context.openGooglePicker();
  assert.equal(harness.views.length, 4);
  finish();
  await selection;
  assert.equal(harness.elements.get("#google-picker-local").disabled, false);
});

test("picker adapts to desktop dimensions without the Visual Viewport API", async () => {
  const harness = pickerHarness();
  delete harness.context.window.visualViewport;
  await harness.context.openGooglePicker();
  assert.deepEqual(harness.sizes, [[1000, 650]]);
});

test("owned and shared screenplays open directly from Picker after cancellation and retry", async () => {
  const harness = pickerHarness();
  await harness.context.openGooglePicker();
  await harness.pick({ action: "cancel" });
  for (const id of ["owned-file_123", "shared-file_123"]) {
    await harness.context.openGooglePicker();
    await harness.pick({ action: "picked", docs: [{ id }] });
    assert.ok(harness.calls.some(([path]) => path === `/api/google/drive/files/${id}/adopt`));
    assert.ok(harness.calls.some(([action, fileId]) => action === "open" && fileId === id));
    assert.equal(harness.elements.get("#google-picker-help").open, false);
  }
});

test("small viewports fit Picker's enforced minimum without resizing its internal iframe", async () => {
  for (const [width, height] of [[390, 844], [844, 320]]) {
    const harness = pickerHarness();
    Object.assign(harness.context.window.visualViewport, { width, height });
    await harness.context.openGooglePicker();
    const [pickerWidth, pickerHeight] = harness.sizes[0];
    const scale = Number(harness.properties.get("--google-picker-scale"));
    assert.ok(pickerWidth >= 566);
    assert.ok(pickerHeight >= 350);
    assert.ok(pickerWidth * scale <= width - 24);
    assert.ok(pickerHeight * scale <= height - 24);
    await harness.pick({ action: "cancel" });
    assert.equal(harness.properties.has("--google-picker-scale"), false);
  }
});

test("an open Picker refits on rotation and keyboard resize and removes listeners on dismissal", async () => {
  const harness = pickerHarness();
  Object.assign(harness.context.window.visualViewport, { width: 1024, height: 768 });
  await harness.context.openGooglePicker();
  const [width, height] = harness.sizes[0];
  for (const [viewportWidth, viewportHeight, listeners] of [
    [768, 1024, harness.listeners],
    [390, 320, harness.viewportListeners],
  ]) {
    Object.assign(harness.context.window.visualViewport, { width: viewportWidth, height: viewportHeight });
    for (const listener of listeners) listener();
    const scale = Number(harness.properties.get("--google-picker-scale"));
    assert.ok(width * scale <= viewportWidth - 24);
    assert.ok(height * scale <= viewportHeight - 24);
  }
  await harness.pick({ action: "cancel" });
  assert.equal(harness.listeners.size, 0);
  assert.equal(harness.viewportListeners.size, 0);
});

test("loading Picker does not change the workspace layout before the browser is ready", async () => {
  const harness = pickerHarness();
  let ready;
  let loading;
  const started = new Promise((resolve) => { loading = resolve; });
  harness.context.loadGooglePicker = () => new Promise((resolve) => { ready = resolve; loading(); });
  const opening = harness.context.openGooglePicker();
  await started;
  assert.equal(harness.classes.size, 0);
  ready();
  await opening;
  assert.ok(harness.classes.has("google-picker-open"));
});

test("initial load and page restoration reset only the document scroll, not editor scroll", () => {
  const properties = new Map();
  const source = { scrollTop: 300 };
  const preview = { scrollTop: 600 };
  const context = {
    source,
    preview,
    document: { documentElement: { style: { setProperty: (name, value) => properties.set(name, value) } } },
    window: {
      innerWidth: 1024, innerHeight: 768,
      scrollX: 20, scrollY: 300,
      scrollTo(x, y) { this.scrollX = x; this.scrollY = y; },
    },
  };
  runInNewContext(app.slice(app.indexOf("let mobileViewportFrame"), app.indexOf('window.addEventListener("pageshow"')), context);
  context.restoreWorkspaceViewport();
  assert.equal(context.window.scrollX, 0);
  assert.equal(context.window.scrollY, 0);
  assert.equal(properties.get("--visual-viewport-top"), "0px");
  assert.equal(properties.get("--visual-viewport-height"), "768px");
  assert.equal(source.scrollTop, 300);
  assert.equal(preview.scrollTop, 600);
  assert.match(app, /window\.addEventListener\("pageshow", restoreWorkspaceViewport\)/);
  assert.match(app, /async function initialize\(\) \{\s*restoreWorkspaceViewport\(\)/);
});

test("failed Picker script loads can be retried", async () => {
  const scripts = [];
  const context = {
    window: {},
    document: { createElement: () => ({}), head: { append: (script) => scripts.push(script) } },
  };
  runInNewContext(app.slice(app.indexOf("let googlePickerPromise"), app.indexOf("let googlePickerActive")), context);
  const first = context.loadGooglePicker();
  scripts[0].onerror();
  await assert.rejects(first, /failed to load/);
  const second = context.loadGooglePicker();
  assert.equal(scripts.length, 2);
  context.window.gapi = { load: (name, options) => options.callback() };
  scripts[1].onload();
  await second;
});

test("picker CSS preserves Google's iframe layout and recovery explains the local-copy fallback", async () => {
  const css = await readFile(new URL("../../src/fountain_publisher/web/styles.css", import.meta.url), "utf8");
  const html = await readFile(new URL("../../src/fountain_publisher/web/index.html", import.meta.url), "utf8");
  assert.doesNotMatch(css, /\.google-picker-open body\s*\{[^}]*position:\s*fixed/);
  const dialogStyles = css.match(/\.google-picker-open \.picker-dialog\s*\{([^}]+)\}/)[1];
  assert.match(dialogStyles, /position:\s*fixed !important/);
  assert.match(dialogStyles, /top:\s*calc\(var\(--visual-viewport-top\) \+ 12px\)/);
  assert.doesNotMatch(dialogStyles, /(?:width|height|display|overflow):/);
  assert.match(dialogStyles, /transform:\s*scale\(var\(--google-picker-scale, 1\)\)/);
  assert.doesNotMatch(css, /\.picker-dialog-content/);
  assert.match(html, /id="google-picker-status" role="status"/);
  assert.match(html, /Can't access your Google Account/);
  assert.match(html, /local copy, without Drive syncing or live collaboration/);
  assert.match(app, /\$\("#google-picker-local"\)\.addEventListener\("click", \(\) => \{[\s\S]*?openFile\(\)/);
});

test("opening a downloaded copy disconnects Drive only after a successful read", async () => {
  const calls = [];
  const oldHandle = {};
  const context = {
    state: { handle: oldHandle },
    collaboration: { disconnect: () => calls.push("disconnect") },
    setDocument: (...args) => calls.push(args),
  };
  runInNewContext(app.slice(app.indexOf("async function openLocalFile("), app.indexOf("function pdfLayoutToFountain(")), context);
  await assert.rejects(context.openLocalFile({ name: "Script.fountain", text: async () => { throw new Error("Read failed"); } }), /Read failed/);
  assert.deepEqual(calls, []);
  assert.equal(context.state.handle, oldHandle);
  await context.openLocalFile({ name: "Script.fountain", text: async () => "INT. ROOM - DAY" });
  assert.deepEqual(calls, ["disconnect", ["INT. ROOM - DAY", "Script.fountain", true]]);
  assert.equal(context.state.handle, null);
});

test("cancelling the native file chooser preserves the current Drive session", async () => {
  const oldHandle = {};
  const context = {
    state: { handle: oldHandle },
    confirmDiscard: async () => true,
    window: { showOpenFilePicker: async () => { const error = new Error("Cancelled"); error.name = "AbortError"; throw error; } },
    openLocalFile: () => assert.fail("Cancellation must not load a local file"),
    toast: () => assert.fail("Cancellation must not report an error"),
  };
  runInNewContext(app.slice(app.indexOf("async function openFile("), app.indexOf("async function openLocalFile(")), context);
  await context.openFile();
  assert.equal(context.state.handle, oldHandle);
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
