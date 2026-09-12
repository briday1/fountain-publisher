import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerWorkerClient } from "../../src/fountain_publisher/web/compiler-client.mjs";
import { attachCompilerWorker } from "../../src/fountain_publisher/web/compiler-worker.mjs";

class FakeWorker {
  listeners = new Map();
  posts = [];
  terminated = false;
  addEventListener(type, handler) { this.listeners.set(type, handler); }
  postMessage(data, transfer = []) { this.posts.push({ data, transfer }); }
  terminate() { this.terminated = true; }
  emit(type, data) { this.listeners.get(type)?.(type === "message" ? { data } : data); }
  ready() { this.emit("message", { type: "ready" }); }
  reply(result = { pageCount: 1 }) {
    const { id } = this.posts.at(-1).data;
    this.emit("message", { type: "result", id, result });
  }
}

function fixture(t, options = {}) {
  const workers = [];
  const client = createCompilerWorkerClient({ createWorker: () => { const worker = new FakeWorker(); workers.push(worker); return worker; }, ...options });
  t.after(() => client.dispose());
  return { client, workers };
}

test("worker client is lazy and snapshots jobs before startup completes", async (t) => {
  const { client, workers } = fixture(t);
  assert.equal(workers.length, 0);
  const input = { source: "Original", pageSize: "a4", sceneNumbers: "inline", sceneNumberFormat: "act" };
  const pending = client.compile("pdf", input);
  input.source = "Changed";
  assert.deepEqual(workers[0].posts.map(({ data }) => data.type), ["initialize"]);
  workers[0].ready();
  assert.equal(workers[0].posts[1].data.input.request.source, "Original");
  assert.equal(workers[0].posts[1].data.input.request.pageSize, "a4");
  workers[0].reply();
  assert.equal((await pending).pageCount, 1);
});

test("cold startup coalesces background jobs and skips obsolete snapshots", async (t) => {
  const { client, workers } = fixture(t);
  let current = true;
  const first = client.compile("pdf", { source: "Old" }, { backgroundKey: "page-count" });
  const second = client.compile("pdf", { source: "New" }, { backgroundKey: "page-count", isCurrent: () => current });
  assert.equal(await first, null);
  current = false;
  workers[0].ready();
  assert.equal(await second, null);
  assert.equal(workers[0].posts.length, 1);
});

test("explicit exports precede pending background work without cancelling active exports", async (t) => {
  const { client, workers } = fixture(t);
  const background = client.compile("pdf", { source: "Background" }, { backgroundKey: "page-count" });
  const exported = client.compile("fdx", { source: "Export" });
  workers[0].ready();
  assert.equal(workers[0].posts.at(-1).data.input.request.source, "Export");
  const latest = client.compile("pdf", { source: "Latest" }, { backgroundKey: "page-count" });
  assert.equal(await background, null);
  assert.equal(workers[0].terminated, false);
  workers[0].reply({ exported: true });
  assert.deepEqual(await exported, { exported: true });
  assert.equal(workers[0].posts.at(-1).data.input.request.source, "Latest");
  workers[0].reply();
  await latest;
});

test("active background responses become stale while new jobs remain bounded", async (t) => {
  const { client, workers } = fixture(t);
  const first = client.compile("pdf", { source: "First" }, { backgroundKey: "page-count" });
  workers[0].ready();
  const second = client.compile("pdf", { source: "Second" }, { backgroundKey: "page-count" });
  const third = client.compile("pdf", { source: "Third" }, { backgroundKey: "page-count" });
  assert.equal(await second, null);
  workers[0].reply();
  assert.equal(await first, null);
  assert.equal(workers[0].posts.at(-1).data.input.request.source, "Third");
  workers[0].reply();
  await third;
  assert.equal(workers[0].posts.length, 3);
});

test("input cancellation drops background jobs but preserves explicit exports and the worker", async (t) => {
  const { client, workers } = fixture(t);
  const background = client.compile("pdf", { source: "Background" }, { backgroundKey: "page-count" });
  const exported = client.compile("pdf", { source: "Export" });
  client.cancelBackground("page-count");
  assert.equal(await background, null);
  workers[0].ready();
  assert.equal(workers[0].posts.at(-1).data.input.request.source, "Export");
  const pending = client.compile("pdf", { source: "Next background" }, { backgroundKey: "page-count" });
  workers[0].reply({ exported: true });
  assert.deepEqual(await exported, { exported: true });
  client.cancelBackground("page-count");
  assert.equal(workers[0].terminated, false);
  workers[0].reply();
  assert.equal(await pending, null);
});

test("explicit promotion protects matching background work during startup and execution", async (t) => {
  for (const readyBeforePromotion of [false, true]) {
    const { client, workers } = fixture(t);
    const pending = client.compile("pdf", { source: "Matching preview" }, { backgroundKey: "page-count" });
    if (readyBeforePromotion) workers[0].ready();
    client.promoteBackground("page-count");
    client.cancelBackground("page-count");
    if (!readyBeforePromotion) workers[0].ready();
    assert.equal(workers[0].posts.length, 2);
    workers[0].reply({ preview: true });
    assert.deepEqual(await pending, { preview: true });
    assert.equal(workers[0].terminated, false);
  }
});

test("dispatch callbacks measure actual worker jobs, excluding coalesced or cancelled requests", async (t) => {
  const { client, workers } = fixture(t);
  const starts = [];
  const old = client.compile("pdf", { source: "Old" }, { backgroundKey: "page-count", onStart: () => starts.push("old") });
  const pending = client.compile("pdf", { source: "Latest" }, { backgroundKey: "page-count", onStart: () => starts.push("latest") });
  assert.equal(await old, null);
  assert.deepEqual(starts, []);
  workers[0].ready();
  assert.deepEqual(starts, ["latest"]);
  workers[0].ready();
  assert.deepEqual(starts, ["latest"]);
  const cancelled = client.compile("pdf", { source: "Cancelled" }, { backgroundKey: "other", onStart: () => starts.push("cancelled") });
  client.cancelBackground("other");
  assert.equal(await cancelled, null);
  workers[0].reply(); await pending;
  assert.deepEqual(starts, ["latest"]);
});

test("results are checked against current document state after worker execution", async (t) => {
  const { client, workers } = fixture(t);
  let current = true;
  const pending = client.compile("pdf", { source: "Old document" }, { isCurrent: () => current });
  workers[0].ready();
  current = false;
  workers[0].reply();
  assert.equal(await pending, null);
});

test("worker failure rejects every pending job and next request starts a fresh worker", async (t) => {
  const { client, workers } = fixture(t);
  const active = assert.rejects(client.compile("pdf", { source: "Active" }), /Worker crashed/);
  workers[0].ready();
  const queued = assert.rejects(client.compile("fdx", { source: "Queued" }), /Worker crashed/);
  workers[0].emit("error", { message: "Worker crashed" });
  await Promise.all([active, queued]);
  assert.equal(workers[0].terminated, true);
  const retry = client.compile("pdf", { source: "Retry" });
  assert.equal(workers.length, 2);
  workers[0].ready();
  assert.equal(workers[1].posts.length, 1);
  workers[1].ready();
  workers[1].reply();
  await retry;
});

test("initialization errors and missing Worker support fail locally without fallback", async (t) => {
  const { client, workers } = fixture(t);
  const pending = assert.rejects(client.compile("pdf", { source: "Private" }), /Unable to load/);
  workers[0].emit("message", { type: "fatal", error: "Unable to load local runtime" });
  await pending;
  const unsupported = createCompilerWorkerClient({ createWorker() { throw new Error("Worker unavailable"); } });
  await assert.rejects(unsupported.compile("pdf", { source: "Private" }), /Worker unavailable/);
  unsupported.dispose();
});

test("startup and job timeouts reject promises and release failed workers", async (t) => {
  const { client, workers } = fixture(t, { startupTimeoutMs: 5, jobTimeoutMs: 5 });
  await assert.rejects(client.compile("pdf", { source: "Startup" }), /initialization timed out/);
  assert.equal(workers[0].terminated, true);
  const pending = assert.rejects(client.compile("pdf", { source: "Job" }), /job timed out/);
  workers[1].ready();
  await pending;
  assert.equal(workers[1].terminated, true);
});

test("explicit queue limits reject overflow and dispose rejects remaining jobs", async (t) => {
  const { client, workers } = fixture(t, { maxQueuedJobs: 2 });
  const first = assert.rejects(client.compile("pdf", { source: "First" }), /closed/);
  const second = assert.rejects(client.compile("fdx", { source: "Second" }), /closed/);
  await assert.rejects(client.compile("pdf", { source: "Overflow" }), /busy/);
  client.dispose();
  await Promise.all([first, second]);
  assert.equal(workers[0].terminated, true);
  await assert.rejects(client.compile("pdf", { source: "After close" }), /closed/);
});

test("beat sheets and PDF imports capture independent inputs and serialize", async (t) => {
  const { client, workers } = fixture(t);
  const beats = ["Original beat"];
  const beatJob = client.beatSheet({ title: "Title", premise: "Premise", beats });
  beats[0] = "Changed";
  const bytes = Uint8Array.of(1, 2, 3);
  const importJob = client.extractPdf(bytes.buffer);
  bytes[0] = 9;
  workers[0].ready();
  assert.deepEqual(workers[0].posts.at(-1).data.input.beats, ["Original beat"]);
  workers[0].reply(new Blob(["pdf"]));
  await beatJob;
  const posted = workers[0].posts.at(-1);
  assert.deepEqual([...new Uint8Array(posted.data.input.bytes)], [1, 2, 3]);
  assert.equal(posted.transfer[0], posted.data.input.bytes);
  workers[0].reply(["Extracted page"]);
  assert.deepEqual(await importJob, ["Extracted page"]);
});

test("worker protocol initializes once and serializes jobs including failure recovery", async () => {
  const listeners = new Map();
  const replies = [];
  let initialized = 0;
  let running = 0;
  const scope = { addEventListener(type, handler) { listeners.set(type, handler); }, postMessage(data) { replies.push(data); } };
  attachCompilerWorker(scope, {
    async initialize() { initialized += 1; },
    async execute(operation) {
      assert.equal(running++, 0);
      await new Promise((resolve) => setTimeout(resolve, 2));
      running -= 1;
      if (operation === "fail") throw new Error("Malformed document");
      return operation;
    },
  });
  const send = (data) => listeners.get("message")({ data });
  send({ type: "initialize" });
  send({ type: "job", id: 1, operation: "fail" });
  send({ type: "job", id: 2, operation: "success" });
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(initialized, 1);
  assert.deepEqual(replies, [{ type: "ready" }, { type: "result", id: 1, error: "Malformed document" }, { type: "result", id: 2, result: "success" }]);
});
