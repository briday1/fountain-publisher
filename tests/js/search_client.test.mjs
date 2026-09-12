import assert from "node:assert/strict";
import test from "node:test";
import { Worker } from "node:worker_threads";
import { createSearchClient } from "../../src/fountain_publisher/web/search-client.mjs";

class FakeWorker {
  listeners = new Map();
  posts = [];
  terminated = false;
  addEventListener(type, handler) { this.listeners.set(type, handler); }
  postMessage(data) { this.posts.push(data); }
  terminate() { this.terminated = true; }
  emit(type, value) { this.listeners.get(type)?.(type === "message" ? { data: value } : value); }
  ready() { this.emit("message", { type: "ready" }); }
  reply(result) { this.emit("message", { id: this.posts.at(-1).id, result }); }
}

function fixture(t, options = {}) {
  const workers = [];
  const client = createSearchClient({ workerFactory() { const worker = new FakeWorker(); workers.push(worker); return worker; }, ...options });
  t.after(() => client.dispose());
  return { client, workers };
}

test("search worker starts lazily, snapshots inputs, and waits for readiness before dispatch", async (t) => {
  const { client, workers } = fixture(t);
  assert.equal(workers.length, 0);
  const input = { text: "Original", command: ":'<,'>s/a/b/", visualRange: [1, 2] };
  const pending = client.run("ex", input);
  input.text = "Changed";
  input.visualRange[0] = 9;
  assert.equal(workers[0].posts.length, 0);
  workers[0].ready();
  assert.deepEqual(workers[0].posts[0], { id: 1, task: "ex", payload: { text: "Original", command: ":'<,'>s/a/b/", visualRange: [1, 2] } });
  workers[0].reply({ count: 2 });
  assert.deepEqual(await pending, { count: 2 });
});

test("completed searches reuse a ready worker without creating a queue", async (t) => {
  const { client, workers } = fixture(t);
  const first = client.run("search", { text: "cat", query: "cat" });
  workers[0].ready();
  workers[0].reply({ count: 1 });
  await first;
  const second = client.run("search", { text: "dog", query: "cat" });
  assert.equal(workers.length, 1);
  assert.equal(workers[0].posts.length, 2);
  workers[0].reply({ count: 0 });
  assert.deepEqual(await second, { count: 0 });
});

test("a newer search terminates executing regex work and rejects the previous request with AbortError", async (t) => {
  const { client, workers } = fixture(t);
  const old = assert.rejects(client.run("search", { text: "Old", query: "Old" }), { name: "AbortError" });
  workers[0].ready();
  const latest = client.run("search", { text: "New", query: "New" });
  await old;
  assert.equal(workers[0].terminated, true);
  assert.equal(workers.length, 2);
  workers[0].reply({ count: 99 });
  workers[1].ready();
  workers[1].reply({ count: 1 });
  assert.deepEqual(await latest, { count: 1 });
});

test("cancel during startup rejects the promise and ignores late ready/error messages", async (t) => {
  const { client, workers } = fixture(t);
  const cancelled = assert.rejects(client.run("search", { text: "a", query: "a" }), { name: "AbortError" });
  client.cancel();
  await cancelled;
  workers[0].ready();
  workers[0].emit("error", { message: "Late failure" });
  assert.equal(workers[0].posts.length, 0);
  const retry = client.run("search", { text: "a", query: "a" });
  workers[1].ready();
  workers[1].reply({ count: 1 });
  await retry;
});

test("startup and execution timeouts are separate and timed-out workers can be replaced", async (t) => {
  const { client, workers } = fixture(t, { startupTimeoutMs: 10, timeoutMs: 10 });
  await assert.rejects(client.run("search", { text: "a", query: "a" }), /could not start/);
  assert.equal(workers[0].terminated, true);
  const timedOut = assert.rejects(client.run("search", { text: "a", query: "a" }), /Search took too long/);
  workers[1].ready();
  await timedOut;
  assert.equal(workers[1].terminated, true);
  const successful = client.run("search", { text: "b", query: "b" });
  workers[2].ready();
  workers[2].reply({ count: 1 });
  await successful;
});

test("a worker-reported query error rejects only that request and allows reuse", async (t) => {
  const { client, workers } = fixture(t);
  const invalid = assert.rejects(client.run("search", { text: "a", query: "[", regex: true }), /Invalid regex/);
  workers[0].ready();
  workers[0].emit("message", { id: 1, error: "Invalid regex" });
  await invalid;
  assert.equal(workers[0].terminated, false);
  const next = client.run("parse-ex", { text: "a", command: ":1" });
  workers[0].reply({ type: "line", line: 1 });
  assert.deepEqual(await next, { type: "line", line: 1 });
});

test("worker crashes and unreadable responses reject requests and stop the worker", async (t) => {
  const { client, workers } = fixture(t);
  const crashed = assert.rejects(client.run("search", { text: "a", query: "a" }), /Worker crashed/);
  workers[0].emit("error", { message: "Worker crashed" });
  await crashed;
  assert.equal(workers[0].terminated, true);
  const unreadable = assert.rejects(client.run("search", { text: "a", query: "a" }), /unreadable response/);
  workers[1].ready();
  workers[1].emit("messageerror", {});
  await unreadable;
  assert.equal(workers[1].terminated, true);
});

test("missing worker support and post failures have no main-thread regex fallback", async (t) => {
  const unavailable = createSearchClient({ workerFactory() { throw new Error("Worker unavailable"); } });
  await assert.rejects(unavailable.run("search", { text: "a".repeat(100), query: "(a+)+$", regex: true }), /Worker unavailable/);
  unavailable.dispose();
  const { client, workers } = fixture(t);
  const failed = assert.rejects(client.run("search", { text: "a", query: "a" }), /Cannot post/);
  workers[0].postMessage = () => { throw new Error("Cannot post"); };
  workers[0].ready();
  await failed;
  assert.equal(workers[0].terminated, true);
});

test("unknown tasks, uncloneable inputs, and disposal cannot leave dangling work", async (t) => {
  const { client, workers } = fixture(t);
  await assert.rejects(client.run("eval", {}), /Unknown search task/);
  await assert.rejects(client.run("search", { bad: () => {} }), Error);
  assert.equal(workers.length, 0);
  const closed = assert.rejects(client.run("search", { text: "a", query: "a" }), { name: "AbortError" });
  client.dispose();
  await closed;
  await assert.rejects(client.run("search", { text: "a", query: "a" }), /closed/);
});

test("actual worker terminates catastrophic regex while the main thread remains responsive", { timeout: 10_000 }, async (t) => {
  const instances = [];
  const workerUrl = new URL("../../src/fountain_publisher/web/search-worker.mjs", import.meta.url).href;
  const bootstrap = `
const { parentPort } = require("node:worker_threads");
globalThis.self = {
  addEventListener(type, listener) { parentPort.on(type, (data) => listener({ data })); },
  postMessage(data) { parentPort.postMessage(data); },
};
import(${JSON.stringify(workerUrl)});
`;
  const client = createSearchClient({
    timeoutMs: 100,
    startupTimeoutMs: 3_000,
    workerFactory() {
      const worker = new Worker(bootstrap, { eval: true, execArgv: [] });
      instances.push(worker);
      return {
        addEventListener(type, listener) { worker.on(type, (data) => listener(type === "message" ? { data } : data)); },
        postMessage(data) { worker.postMessage(data); },
        terminate() { void worker.terminate(); },
      };
    },
  });
  t.after(async () => { client.dispose(); await Promise.all(instances.map((worker) => worker.terminate())); });
  const warmed = await client.run("search", { text: "😀 cat", query: "cat" });
  assert.deepEqual(warmed.matches, [{ start: 3, end: 6, line: 1, column: 4 }]);
  let heartbeats = 0;
  const ticker = setInterval(() => { heartbeats += 1; }, 5);
  try {
    await assert.rejects(client.run("search", { text: "a".repeat(500) + "!", query: "(a+)+$", regex: true }), { name: "SearchTimeoutError" });
    assert.ok(heartbeats >= 2, "The main thread must remain available while a pathological regex is stopped");
  } finally { clearInterval(ticker); }
  const recovered = await client.run("ex", { text: "cat cat", command: ":s/cat/dog/g" });
  assert.equal(recovered.count, 2);
  assert.equal(instances.length, 2);
});
