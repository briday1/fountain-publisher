import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const app = await readFile(new URL("../../src/fountain_publisher/web/app.mjs", import.meta.url), "utf8");
const section = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));
const code = [
  section("async function githubRequest(", "function updateGithubMenu("),
  section("function githubContentPath(", "function renderGithubBreadcrumbs("),
  section("function decodeGithubContent(", "function normalizedFilename("),
  section("function setDocument(", "async function saveFile("),
  section('$("#github-save-here").addEventListener', 'window.addEventListener("message"'),
].join("\n");
const remote = (sha, content = "remote text") => ({ sha, content: Buffer.from(content).toString("base64"), encoding: "base64", type: "file", name: "draft.fountain" });
const committed = { sha: "committed", commit: "https://github.com/owner/repo/commit/123" };
const fail = (status, message = `Failure ${status}`) => ({ status, body: { error: message } });
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

function harness({ sha = "old", linked = true } = {}) {
  const elements = new Map();
  const $ = (id) => {
    if (!elements.has(id)) elements.set(id, {
      value: "", textContent: "", innerHTML: "", checked: false, disabled: false,
      hidden: false, open: false, listeners: {},
      showModal() { this.open = true; },
      close() { this.open = false; },
      focus() {},
      addEventListener(name, callback) { this.listeners[name] = callback; },
    });
    return elements.get(id);
  };
  $("#github-branch").value = "main";
  $("#github-filename").value = "draft.fountain";
  $("#github-commit-message").value = "My message";
  const state = {
    githubRepository: "owner/repo", githubBranch: "main", githubPath: "scripts",
    githubColumns: [{ path: "scripts", entries: sha ? [{ type: "file", path: "scripts/draft.fountain", sha }] : [] }],
    githubFile: linked && sha ? { owner: "owner", repo: "repo", branch: "main", path: "scripts/draft.fountain", sha } : null,
    savedSource: "original baseline", filename: "draft.fountain",
    documentRevision: 1, editRevision: 1, githubSaving: false, githubConflict: null,
  };
  const source = { value: "local text" };
  const classes = new Set(["dirty"]);
  const requests = [];
  const replies = [];
  const confirmations = [];
  const toasts = [];
  let confirmAnswer = true;
  let persisted = 0;
  const context = {
    $, state, source, URLSearchParams, TextDecoder, Uint8Array, atob,
    GITHUB_API: "https://api.example",
    selectedGithubRepository: () => ({ fullName: "owner/repo", owner: "owner", repo: "repo" }),
    toast: (text) => toasts.push(text),
    escapeHtml: (text) => text,
    confirmDiscard: async () => true,
    window: { confirm: (text) => { confirmations.push(text); return confirmAnswer; } },
    document: { title: "", body: { classList: {
      toggle(name, value) { if (value) classes.add(name); else classes.delete(name); },
    } } },
    sourceChanged() { state.editRevision += 1; context.document.body.classList.toggle("dirty", source.value !== state.savedSource); },
    persistWorkspaceNow() { persisted += 1; },
    async fetch(url, options) {
      requests.push({ url, ...options, body: options.body ? JSON.parse(options.body) : undefined });
      assert.ok(replies.length, `Unexpected request: ${options.method || "GET"} ${url}`);
      let reply = replies.shift();
      if (typeof reply === "function") reply = await reply();
      if (reply instanceof Error) throw reply;
      return { ok: !reply.status || reply.status < 400, status: reply.status || 200, json: async () => reply.body || reply };
    },
  };
  runInNewContext(code, context);
  return {
    context, state, source, $, requests, replies, classes, confirmations, toasts,
    get persisted() { return persisted; },
    confirm(answer) { confirmAnswer = answer; },
    edit(text) { source.value = text; context.sourceChanged(); },
    approve() { $("#github-conflict-reviewed").checked = true; context.updateGithubConflictControls(); },
    async conflict(status = 409) {
      replies.push(fail(status), remote("latest"));
      await context.saveGithubFile();
      assert.equal($("#github-conflict-dialog").open, true);
    },
  };
}

test("stale linked SHA opens whole-file conflict references without modifying source", async () => {
  const h = harness();
  await h.conflict();
  assert.equal(h.requests[0].body.sha, "old");
  assert.equal(h.requests[0].body.content, "local text");
  assert.equal(h.$("#github-conflict-local").value, "local text");
  assert.equal(h.$("#github-conflict-remote").value, "remote text");
  assert.equal(h.$("#github-conflict-result").value, "local text");
  assert.equal(h.$("#github-conflict-save").disabled, true);
  assert.equal(h.source.value, "local text");
  assert.equal(h.state.savedSource, "original baseline");
  assert.equal(h.requests[1].cache, "no-store");
});

test("folder SHA conflicts and new-file 422 collisions are recoverable", async () => {
  for (const options of [{ linked: false }, { sha: null, linked: false }]) {
    const h = harness(options);
    await h.conflict(options.sha === null ? 422 : 409);
    if (options.sha === null) assert.equal(h.requests[0].body.sha, undefined);
    assert.equal(h.state.githubConflict.remote.sha, "latest");
  }
});

test("omitted content and unsupported encodings never open a conflict resolver", async () => {
  for (const file of [
    { ...remote("latest"), content: "", encoding: "none", size: 2_000_000 },
    { ...remote("latest"), encoding: "utf-8" },
    { ...remote("latest"), encoding: undefined },
    { ...remote("latest"), content: undefined },
    { ...remote("latest"), content: null },
  ]) {
    const h = harness();
    h.replies.push(fail(409), file);
    await h.context.saveGithubFile();
    assert.equal(h.state.githubConflict, null);
    assert.equal(h.$("#github-conflict-dialog").open, false);
    assert.match(h.$("#github-save-status").textContent, /did not return a readable file/);
    assert.equal(h.source.value, "local text");
    assert.equal(h.state.savedSource, "original baseline");
    assert.equal(h.state.githubFile.sha, "old");
    assert.equal(h.requests.length, 2);
  }
});

test("genuinely empty base64 files can be reviewed and saved as a resolution", async () => {
  const h = harness();
  h.replies.push(fail(409), remote("latest", ""));
  await h.context.saveGithubFile();
  assert.equal(h.$("#github-conflict-dialog").open, true);
  assert.equal(h.$("#github-conflict-remote").value, "");
  h.context.chooseGithubConflictVersion("theirs");
  h.approve();
  h.replies.push(committed, remote("committed", ""));
  await h.context.saveGithubResolution();
  assert.equal(h.requests[2].body.content, "");
  assert.equal(h.source.value, "");
  assert.equal(h.state.savedSource, "");
  assert.equal(h.state.githubConflict, null);
});

test("omitted content during conflict refresh keeps references and blocks resolution", async () => {
  const h = harness();
  await h.conflict();
  h.$("#github-conflict-result").value = "precious draft";
  h.approve();
  h.replies.push(fail(409), { ...remote("newest"), content: "", encoding: "none", size: 2_000_000 });
  await h.context.saveGithubResolution();
  assert.equal(h.state.githubConflict.needsRefresh, true);
  assert.equal(h.state.githubConflict.remote.sha, "latest");
  assert.equal(h.$("#github-conflict-remote").value, "remote text");
  assert.equal(h.$("#github-conflict-result").value, "precious draft");
  assert.match(h.$("#github-conflict-status").textContent, /did not return a readable file/);
  h.approve();
  await h.context.saveGithubResolution();
  assert.equal(h.$("#github-conflict-save").disabled, true);
  assert.equal(h.source.value, "local text");
  assert.equal(h.state.savedSource, "original baseline");
  assert.equal(h.requests.length, 4);
});

test("auth, network, validation, unchanged SHA and unreadable remote are not presented as conflicts", async () => {
  for (const responses of [
    [fail(401)], [fail(403)], [fail(422)], [new Error("offline")],
    [fail(409), remote("old")], [fail(409), fail(404)],
    [fail(409), fail(500)], [fail(409), { sha: "latest", type: "dir" }],
  ]) {
    const h = harness();
    h.replies.push(...responses);
    await h.context.saveGithubFile();
    assert.equal(h.state.githubConflict, null);
    assert.equal(h.$("#github-save-status").className, "error");
    assert.equal(h.source.value, "local text");
    assert.equal(h.state.savedSource, "original baseline");
    assert.equal(h.state.githubSaving, false);
  }
  const h = harness({ sha: null });
  h.replies.push(fail(422), fail(404));
  await h.context.saveGithubFile();
  assert.equal(h.state.githubConflict, null);
});

test("choosing either reference confirms replacement and cancel never changes the editor", async () => {
  const h = harness();
  await h.conflict();
  h.$("#github-conflict-result").value = "careful edits";
  h.approve();
  h.confirm(false);
  h.context.chooseGithubConflictVersion("theirs");
  assert.equal(h.$("#github-conflict-result").value, "careful edits");
  h.context.cancelGithubConflict();
  assert.equal(h.$("#github-conflict-dialog").open, true);
  h.confirm(true);
  h.context.chooseGithubConflictVersion("theirs");
  assert.equal(h.$("#github-conflict-result").value, "remote text");
  assert.equal(h.$("#github-conflict-reviewed").checked, false);
  h.context.chooseGithubConflictVersion("mine");
  assert.equal(h.$("#github-conflict-result").value, "local text");
  const event = { preventDefault() { this.prevented = true; } };
  h.$("#github-conflict-dialog").listeners.cancel(event);
  assert.equal(event.prevented, true);
  assert.equal(h.state.githubConflict, null);
  assert.equal(h.source.value, "local text");
  assert.equal(h.state.savedSource, "original baseline");
  assert.equal(h.requests.length, 2);
});

test("resolution saves exact captured target, message and refreshed SHA despite navigation", async () => {
  const h = harness();
  await h.conflict();
  h.state.githubPath = "elsewhere";
  h.state.githubRepository = "different/repo";
  h.$("#github-branch").value = "different-branch";
  h.$("#github-filename").value = "other.fountain";
  h.$("#github-commit-message").value = "different message";
  h.$("#github-conflict-result").value = "resolved 🎬";
  h.approve();
  h.replies.push(committed, remote("committed", "resolved 🎬"));
  await h.context.saveGithubResolution();
  const retry = h.requests[2];
  assert.deepEqual(Object.fromEntries(new URL(retry.url).searchParams), { owner: "owner", repo: "repo", branch: "main", path: "scripts/draft.fountain" });
  assert.deepEqual(retry.body, { content: "resolved 🎬", sha: "latest", message: "My message" });
  assert.equal(h.source.value, "resolved 🎬");
  assert.equal(h.state.savedSource, "resolved 🎬");
  assert.equal(h.state.githubFile.sha, "committed");
  assert.equal(h.state.githubFile.branch, "main");
  assert.equal(h.classes.has("dirty"), false);
  assert.equal(h.$("#github-conflict-dialog").open, false);
  assert.equal(h.state.githubConflict, null);
  assert.equal(h.persisted, 1);
});

test("another remote change preserves resolution draft and requires renewed review", async () => {
  const h = harness();
  await h.conflict();
  h.$("#github-conflict-result").value = "manual combined text";
  h.approve();
  h.replies.push(fail(409), remote("even-newer", "another remote edit"));
  await h.context.saveGithubResolution();
  assert.equal(h.state.githubConflict.remote.sha, "even-newer");
  assert.equal(h.$("#github-conflict-result").value, "manual combined text");
  assert.equal(h.$("#github-conflict-local").value, "local text");
  assert.equal(h.$("#github-conflict-remote").value, "another remote edit");
  assert.equal(h.$("#github-conflict-reviewed").checked, false);
  assert.equal(h.$("#github-conflict-save").disabled, true);
  await h.context.saveGithubResolution();
  assert.equal(h.requests.length, 4);
  h.approve();
  h.replies.push(committed, remote("committed", "manual combined text"));
  await h.context.saveGithubResolution();
  assert.equal(h.requests[4].body.sha, "even-newer");
  assert.equal(h.source.value, "manual combined text");
});

test("failed conflict refresh retains draft and blocks saving until reload and review", async () => {
  const h = harness();
  await h.conflict();
  h.$("#github-conflict-result").value = "precious draft";
  h.approve();
  h.replies.push(fail(409), new Error("offline"));
  await h.context.saveGithubResolution();
  assert.equal(h.state.githubConflict.needsRefresh, true);
  assert.equal(h.$("#github-conflict-refresh").hidden, false);
  assert.equal(h.$("#github-conflict-result").value, "precious draft");
  h.approve();
  await h.context.saveGithubResolution();
  assert.equal(h.requests.length, 4);
  h.replies.push(remote("newest"));
  await h.context.refreshGithubConflict();
  assert.equal(h.state.githubConflict.needsRefresh, false);
  assert.equal(h.$("#github-conflict-reviewed").checked, false);
  assert.equal(h.$("#github-conflict-result").value, "precious draft");
  assert.equal(h.source.value, "local text");
});

test("an unchanged remote on retry reports the write error rather than claiming a new conflict", async () => {
  const h = harness();
  await h.conflict();
  h.$("#github-conflict-result").value = "retained result";
  h.approve();
  h.replies.push(fail(409, "Branch cannot be updated"), remote("latest"));
  await h.context.saveGithubResolution();
  assert.match(h.$("#github-conflict-status").textContent, /Branch cannot be updated.*version is unchanged/);
  assert.equal(h.$("#github-conflict-result").value, "retained result");
  assert.equal(h.$("#github-conflict-reviewed").checked, false);
});

test("resolution write and verification failures preserve draft, source and saved baseline", async () => {
  for (const responses of [
    [new Error("offline")], [fail(403)], [fail(422)],
    [{}], [committed, fail(503)], [committed, remote("unverified")],
  ]) {
    const h = harness();
    await h.conflict();
    h.$("#github-conflict-result").value = "draft to retain";
    h.approve();
    h.replies.push(...responses);
    await h.context.saveGithubResolution();
    assert.equal(h.$("#github-conflict-dialog").open, true);
    assert.equal(h.$("#github-conflict-result").value, "draft to retain");
    assert.equal(h.source.value, "local text");
    assert.equal(h.state.savedSource, "original baseline");
    assert.equal(h.state.githubFile.sha, "old");
    assert.equal(h.state.githubConflict.busy, false);
    assert.match(h.$("#github-conflict-status").textContent, /kept/);
  }
});

test("normal save snapshots submitted content across PUT and verification requests", async () => {
  for (const phase of ["write", "verify"]) {
    const h = harness();
    const pending = deferred();
    h.replies.push(phase === "write" ? () => pending.promise : committed, phase === "verify" ? () => pending.promise : remote("committed", "local text"));
    const save = h.context.saveGithubFile();
    if (phase === "verify") while (h.requests.length < 2) await Promise.resolve();
    h.edit("new editor text");
    pending.resolve(phase === "write" ? committed : remote("committed", "local text"));
    await save;
    assert.equal(h.requests[0].body.content, "local text");
    assert.equal(h.state.savedSource, "local text");
    assert.equal(h.source.value, "new editor text");
    assert.equal(h.classes.has("dirty"), true);
  }
});

test("normal verified save clears dirty state and persists its SHA", async () => {
  const h = harness();
  h.replies.push(committed, remote("committed", "local text"));
  await h.context.saveGithubFile();
  assert.equal(h.state.savedSource, "local text");
  assert.equal(h.state.githubFile.sha, "committed");
  assert.equal(h.classes.has("dirty"), false);
  assert.equal(h.persisted, 1);
});

test("resolution keeps edits made during initial write, resolution write or verification", async () => {
  for (const phase of ["initial", "write", "verify"]) {
    const h = harness();
    if (phase === "initial") {
      const pending = deferred();
      h.replies.push(() => pending.promise, remote("latest"));
      const save = h.context.saveGithubFile();
      h.edit("new editor text");
      pending.resolve(fail(409));
      await save;
    } else await h.conflict();
    h.$("#github-conflict-result").value = "resolved text";
    h.approve();
    const pending = deferred();
    h.replies.push(phase === "write" ? () => pending.promise : committed, phase === "verify" ? () => pending.promise : remote("committed", "resolved text"));
    const save = h.context.saveGithubResolution();
    if (phase === "verify") while (h.requests.length < 4) await Promise.resolve();
    if (phase !== "initial") h.edit("new editor text");
    pending.resolve(phase === "write" ? committed : remote("committed", "resolved text"));
    await save;
    assert.equal(h.source.value, "new editor text");
    assert.equal(h.state.savedSource, "resolved text");
    assert.equal(h.classes.has("dirty"), true);
  }
});

test("changing documents in flight never associates the old save with the new document", async () => {
  for (const resolution of [false, true]) {
    const h = harness();
    if (resolution) { await h.conflict(); h.approve(); }
    const pending = deferred();
    h.replies.push(() => pending.promise, remote("committed", "local text"));
    const save = resolution ? h.context.saveGithubResolution() : h.context.saveGithubFile();
    h.context.setDocument("other document", "other.fountain", true);
    pending.resolve(committed);
    await save;
    assert.equal(h.source.value, "other document");
    assert.equal(h.state.savedSource, "other document");
    assert.equal(h.state.filename, "other.fountain");
    assert.equal(h.state.githubFile, null);
    assert.equal(h.persisted, 0);
  }
});

test("duplicate submits and cancellation during a resolution request are disabled", async () => {
  const h = harness();
  const pendingInitial = deferred();
  h.replies.push(() => pendingInitial.promise, remote("latest"));
  const initial = h.context.saveGithubFile();
  await h.context.saveGithubFile();
  assert.equal(h.requests.length, 1);
  pendingInitial.resolve(fail(409));
  await initial;
  h.approve();
  const pending = deferred();
  h.replies.push(() => pending.promise, remote("committed", "local text"));
  const save = h.context.saveGithubResolution();
  await h.context.saveGithubResolution();
  h.context.cancelGithubConflict();
  h.context.chooseGithubConflictVersion("theirs");
  assert.equal(h.requests.length, 3);
  assert.equal(h.$("#github-conflict-dialog").open, true);
  assert.equal(h.$("#github-conflict-cancel").disabled, true);
  assert.equal(h.$("#github-conflict-result").readOnly, true);
  pending.resolve(committed);
  await save;
});

test("opening a GitHub file does not overwrite edits made during the fetch", async () => {
  const h = harness();
  const pending = deferred();
  h.replies.push(() => pending.promise);
  const open = h.context.openGithubFile("scripts/draft.fountain");
  while (!h.requests.length) await Promise.resolve();
  h.edit("new editor text");
  pending.resolve(remote("latest"));
  await open;
  assert.equal(h.source.value, "new editor text");
  assert.equal(h.state.githubFile.sha, "old");
  assert.match(h.toasts.at(-1), /editor changed/);
});
