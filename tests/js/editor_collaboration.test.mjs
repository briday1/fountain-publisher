import assert from "node:assert/strict";
import test from "node:test";
import { CollaborationClient } from "../../src/fountain_publisher/web/collaboration.mjs";
import * as Y from "../../src/fountain_publisher/web/vendor/yjs.mjs";

function harness(t) {
  const sockets = [];
  const documents = [];
  const presence = [];
  const statuses = [];
  const timers = new Map();
  let timerId = 0;
  class Socket {
    static OPEN = 1;
    constructor(url) {
      this.url = String(url);
      this.readyState = 0;
      this.listeners = new Map();
      this.sent = [];
      this.closeCalls = 0;
      sockets.push(this);
    }
    addEventListener(type, listener) { this.listeners.set(type, listener); }
    send(message) { this.sent.push(JSON.parse(message)); }
    close() { this.closeCalls += 1; this.readyState = 3; }
    emit(type, event = {}) {
      if (type === "open") this.readyState = Socket.OPEN;
      if (type === "close") this.readyState = 3;
      this.listeners.get(type)?.(event);
    }
  }
  const previousSocket = Object.getOwnPropertyDescriptor(globalThis, "WebSocket");
  Object.defineProperty(globalThis, "WebSocket", { value: Socket, configurable: true, writable: true });
  t.mock.method(globalThis, "setTimeout", (callback) => { timers.set(++timerId, callback); return timerId; });
  t.mock.method(globalThis, "clearTimeout", (id) => timers.delete(id));
  const fetch = t.mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected network request"); });
  const client = new CollaborationClient({
    onDocument: (value, remote) => documents.push({ value, remote }),
    onPresence: (value) => presence.push(value),
    onStatus: (...value) => statuses.push(value),
  });
  t.after(() => {
    client.disconnect();
    if (previousSocket) Object.defineProperty(globalThis, "WebSocket", previousSocket);
    else delete globalThis.WebSocket;
  });
  function server(value) {
    const doc = new Y.Doc();
    doc.getText("source").insert(0, value);
    t.after(() => doc.destroy());
    return doc;
  }
  function connect(options = {}) {
    client.connect({ fileId: "file-a", documentId: "room-a", canEdit: true, ...options });
    const socket = sockets.at(-1);
    socket.emit("open");
    return socket;
  }
  function sync(socket, doc) {
    socket.emit("message", { data: JSON.stringify({ type: "sync", protocol: 2, update: encode(Y.encodeStateAsUpdate(doc)), stateVector: encode(Y.encodeStateVector(doc)) }) });
  }
  return { client, sockets, documents, presence, statuses, timers, fetch, server, connect, sync };
}

function encode(update) { return Buffer.from(update).toString("base64url"); }

test("typing before initial collaboration sync applies once after the baseline, without exposing old content", (t) => {
  const h = harness(t);
  const server = h.server("Original");
  const socket = h.connect({ baselineContent: "Original" });
  h.client.replace("Original + first edit");
  h.client.replace("Original + latest edit");
  assert.equal(h.client.text.toString(), "");
  assert.deepEqual(h.documents, []);
  assert.deepEqual(socket.sent, []);

  h.sync(socket, server);

  assert.equal(h.client.text.toString(), "Original + latest edit");
  assert.deepEqual(h.documents, [{ value: "Original + latest edit", remote: true }]);
  assert.equal(socket.sent.length, 1);
  assert.equal(socket.sent[0].type, "update");
  Y.applyUpdate(server, Buffer.from(socket.sent[0].update, "base64url"));
  assert.equal(server.getText("source").toString(), "Original + latest edit");
});

test("deleting all text before initial sync preserves the empty document", (t) => {
  const h = harness(t);
  const socket = h.connect({ baselineContent: "Original" });
  h.client.replace("First queued text");
  h.client.replace("");
  h.sync(socket, h.server("Original"));
  assert.equal(h.client.text.toString(), "");
  assert.deepEqual(h.documents, [{ value: "", remote: true }]);
});

test("a newly created Drive file can preserve edits made during its upload", (t) => {
  const h = harness(t);
  const socket = h.connect({ pendingContent: "Saved content plus a newer edit", baselineContent: "Saved content" });
  h.sync(socket, h.server("Saved content"));
  assert.deepEqual(h.documents, [{ value: "Saved content plus a newer edit", remote: true }]);
  assert.equal(socket.sent.length, 1);
});

test("read-only collaboration never applies queued editable content", (t) => {
  const h = harness(t);
  const socket = h.connect({ canEdit: false, pendingContent: "Must not be applied" });
  h.client.replace("Also must not be applied");
  h.sync(socket, h.server("Read-only original"));
  assert.deepEqual(h.documents, [{ value: "Read-only original", remote: true }]);
  assert.deepEqual(socket.sent, []);
  assert.equal(h.timers.size, 0);
});

test("an invalid first sync does not discard the queued edit or report a synchronized document", (t) => {
  const h = harness(t);
  const socket = h.connect({ baselineContent: "Original" });
  h.client.replace("Original plus edit");
  socket.emit("message", { data: JSON.stringify({ type: "sync", protocol: 2, update: "not!base64" }) });
  assert.equal(h.client.synced, false);
  assert.deepEqual(h.documents, []);
  assert.equal(h.statuses.at(-1)[0], "error");
  h.sync(socket, h.server("Original"));
  assert.equal(h.client.text.toString(), "Original plus edit");
});

test("concurrent room edits prevent queued local snapshots from overwriting either version", async (t) => {
  const h = harness(t);
  const server = h.server("Hello world");
  const socket = h.connect({ baselineContent: "Hello" });
  let editorBuffer = "Hello!";
  h.client.onDocument = (value) => { editorBuffer = value; };
  h.client.replace(editorBuffer);
  h.sync(socket, server);

  assert.equal(editorBuffer, "Hello!");
  assert.equal(server.getText("source").toString(), "Hello world");
  assert.deepEqual(socket.sent, []);
  assert.equal(h.client.closed, true);
  assert.equal(h.client.socket, null);
  assert.equal(h.client.doc, null);
  assert.equal(h.client.syncConflict, true);
  assert.equal(h.timers.size, 0);
  assert.equal(h.statuses.at(-1)[0], "sync-conflict");
  assert.match(h.statuses.at(-1)[1], /Save a local copy.*reopen the Drive document/);
  await h.client.checkpoint();
  assert.equal(h.fetch.mock.callCount(), 0);

  socket.emit("close", { code: 1006 });
  assert.equal(h.timers.size, 0);
  assert.equal(h.client.syncConflict, true);
});

test("a queued snapshot without an explicit baseline fails closed when the room differs", (t) => {
  const h = harness(t);
  const socket = h.connect({ pendingContent: "Local edits" });
  h.sync(socket, h.server("Room content"));
  assert.equal(h.client.syncConflict, true);
  assert.deepEqual(h.documents, []);
  assert.deepEqual(socket.sent, []);
});

test("queued content already equal to the room needs no replay even when the baseline differs", (t) => {
  const h = harness(t);
  const socket = h.connect({ pendingContent: "Hello world", baselineContent: "Hello" });
  h.sync(socket, h.server("Hello world"));
  assert.equal(h.client.syncConflict, false);
  assert.equal(h.client.synced, true);
  assert.deepEqual(h.documents, [{ value: "Hello world", remote: true }]);
  assert.deepEqual(socket.sent, []);
  assert.equal(h.timers.size, 0);
});

test("a queued snapshot equal to the explicit baseline accepts newer room edits without replay", (t) => {
  const h = harness(t);
  const socket = h.connect({ pendingContent: "Hello", baselineContent: "Hello" });
  const server = h.server("Hello world");
  h.sync(socket, server);
  assert.equal(h.client.syncConflict, false);
  assert.equal(h.client.synced, true);
  assert.equal(h.client.text.toString(), "Hello world");
  assert.equal(server.getText("source").toString(), "Hello world");
  assert.deepEqual(h.documents, [{ value: "Hello world", remote: true }]);
  assert.deepEqual(socket.sent, []);
  assert.equal(h.timers.size, 0);
});

test("normal disconnect and subsequent connections clear the synchronization conflict flag", (t) => {
  const h = harness(t);
  const first = h.connect({ pendingContent: "Local edits" });
  h.sync(first, h.server("Room content"));
  assert.equal(h.client.syncConflict, true);
  h.client.disconnect();
  assert.equal(h.client.syncConflict, false);
  const second = h.connect({ pendingContent: "Other local edits" });
  h.sync(second, h.server("Other room content"));
  assert.equal(h.client.syncConflict, true);
  const third = h.connect();
  assert.equal(h.client.syncConflict, false);
  h.sync(third, h.server("Newly opened room"));
  assert.equal(h.client.text.toString(), "Newly opened room");
});

test("late socket events from another document cannot alter content, presence, connection state, or reconnect timers", (t) => {
  const h = harness(t);
  const previous = h.connect();
  h.client.replace("Old queued content");
  const current = h.connect({ fileId: "file-b", documentId: "room-b" });
  h.sync(current, h.server("Current document"));
  const statusCount = h.statuses.length;
  const documentCount = h.documents.length;

  previous.emit("open");
  h.sync(previous, h.server("Unrelated old document"));
  previous.emit("message", { data: JSON.stringify({ type: "presence", user: { id: "old-user" } }) });
  previous.emit("message", { data: JSON.stringify({ type: "error" }) });
  previous.emit("error");
  previous.emit("close", { code: 1006, reason: "Old room closed" });

  assert.equal(h.client.socket, current);
  assert.equal(current.closeCalls, 0);
  assert.equal(h.client.text.toString(), "Current document");
  assert.equal(h.documents.length, documentCount);
  assert.equal(h.statuses.length, statusCount);
  assert.deepEqual(h.presence, []);
  assert.equal(h.timers.size, 0);
});

test("late events after a complete disconnect cannot restart collaboration", (t) => {
  const h = harness(t);
  const previous = h.connect();
  h.client.disconnect();
  const statusCount = h.statuses.length;
  previous.emit("open");
  previous.emit("error");
  previous.emit("close", { code: 1006 });
  h.sync(previous, h.server("Old document"));
  h.client.receive(JSON.stringify({ type: "error" }));
  assert.equal(h.client.doc, null);
  assert.equal(h.client.socket, null);
  assert.equal(h.statuses.length, statusCount);
  assert.deepEqual(h.documents, []);
  assert.equal(h.timers.size, 0);
});

test("a replaced socket for the same document cannot close or corrupt the new connection", (t) => {
  const h = harness(t);
  const previous = h.connect();
  const server = h.server("Original");
  h.sync(previous, server);
  previous.emit("close", { code: 1006, reason: "Network interruption" });
  const reconnect = [...h.timers.values()][0];
  reconnect();
  const current = h.sockets.at(-1);
  current.emit("open");
  h.sync(current, server);
  const statusCount = h.statuses.length;
  previous.emit("error");
  previous.emit("close", { code: 1006 });
  h.sync(previous, h.server("Stale unrelated state"));
  assert.equal(current.closeCalls, 0);
  assert.equal(h.client.socket, current);
  assert.equal(h.client.text.toString(), "Original");
  assert.equal(h.statuses.length, statusCount);
});

test("a previously queued reconnect cannot replace a newly opened document's socket", (t) => {
  const h = harness(t);
  const previous = h.connect();
  previous.emit("close", { code: 1006 });
  const staleReconnect = [...h.timers.values()][0];
  const current = h.connect({ fileId: "file-b", documentId: "room-b" });
  staleReconnect();
  assert.equal(h.sockets.length, 2);
  assert.equal(h.client.socket, current);
  assert.equal(current.closeCalls, 0);
});

for (const outcome of ["success", "failure"]) {
  test(`a ${outcome} checkpoint response for the previous document cannot change the new document's status`, async (t) => {
    const h = harness(t);
    const previous = h.connect();
    h.sync(previous, h.server("Previous document"));
    let finish;
    h.fetch.mock.mockImplementation(() => new Promise((resolve, reject) => { finish = outcome === "success" ? resolve : reject; }));
    const checkpoint = h.client.checkpoint();
    await Promise.resolve();
    const [url, options] = h.fetch.mock.calls[0].arguments;
    assert.match(url, /\/collaboration\/room-a\/checkpoint\?fileId=file-a$/);
    assert.deepEqual(JSON.parse(options.body), { expectedContent: "Previous document" });

    const current = h.connect({ fileId: "file-b", documentId: "room-b" });
    h.sync(current, h.server("Current document"));
    const statuses = [...h.statuses];
    finish(outcome === "success" ? new Response(JSON.stringify({ file: { id: "file-a" } })) : new Error("Old save failed"));
    if (outcome === "success") await checkpoint;
    else await assert.rejects(checkpoint, /Old save failed/);
    assert.deepEqual(h.statuses, statuses);
    assert.equal(h.client.text.toString(), "Current document");
  });
}

test("reopening the same Drive file still ignores a checkpoint from its previous session", async (t) => {
  const h = harness(t);
  const previous = h.connect();
  h.sync(previous, h.server("Before reopening"));
  let finish;
  h.fetch.mock.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  const checkpoint = h.client.checkpoint();
  await Promise.resolve();
  const current = h.connect();
  h.sync(current, h.server("After reopening"));
  const statuses = [...h.statuses];
  finish(new Response(JSON.stringify({ file: { id: "file-a" } })));
  await checkpoint;
  assert.deepEqual(h.statuses, statuses);
  assert.equal(h.client.text.toString(), "After reopening");
});

test("checkpoint results still report success for the active document", async (t) => {
  const h = harness(t);
  const socket = h.connect();
  h.sync(socket, h.server("Current document"));
  h.fetch.mock.mockImplementation(async () => new Response(JSON.stringify({ file: { id: "file-a" } })));
  await h.client.checkpoint();
  assert.equal(h.statuses.at(-1)[0], "saved");
});

test("checkpoint does not upload an empty baseline before initial sync", async (t) => {
  const h = harness(t);
  h.connect();
  h.client.replace("Queued document");
  await h.client.checkpoint();
  assert.equal(h.fetch.mock.callCount(), 0);
});

function deliver(socket, payload) { socket.emit("message", { data: JSON.stringify(payload) }); }
function acknowledge(socket, update, server) {
  Y.applyUpdate(server, Buffer.from(update.update, "base64url"));
  deliver(socket, { type: "ack", id: update.id, stateVector: encode(Y.encodeStateVector(server)) });
}

test("offline changes merge with remote changes on reconnect, with acknowledged retry-safe deltas", (t) => {
  const h = harness(t);
  const server = h.server("Hello world");
  const first = h.connect();
  h.sync(first, server);
  first.emit("close", { code: 1006 });
  h.client.replace("Hello brave world");
  server.getText("source").insert(11, "!");
  h.client.openSocket();
  const second = h.sockets.at(-1);
  second.emit("open");
  h.sync(second, server);
  assert.equal(h.client.text.toString(), "Hello brave world!");
  assert.equal(second.sent.length, 1);
  acknowledge(second, second.sent[0], server);
  assert.equal(server.getText("source").toString(), "Hello brave world!");
  assert.equal(h.client.inFlight, null);
  assert.equal(h.client.needsFlush, false);
  // A delayed duplicate is idempotent and cannot resurrect deleted content.
  acknowledge(second, second.sent[0], server);
  assert.equal(server.getText("source").toString(), h.client.text.toString());
});

test("local undo and redo preserve remote insertions and invoke the selection capture hook", (t) => {
  const h = harness(t);
  const server = h.server("Hello");
  const socket = h.connect();
  h.sync(socket, server);
  h.client.replace("Hello local");
  acknowledge(socket, socket.sent.at(-1), server);
  h.client.stopCapturing();
  let update;
  server.once("update", (value) => { update = value; });
  server.getText("source").insert(0, "Remote ");
  let captureCount = 0;
  h.client.onBeforeRemoteUpdate = () => { captureCount += 1; return "selection"; };
  deliver(socket, { type: "update", update: encode(update) });
  assert.equal(h.client.text.toString(), "Remote Hello local");
  assert.equal(h.client.canUndo(), true);
  assert.equal(h.client.undo(), true);
  assert.equal(h.client.text.toString(), "Remote Hello");
  assert.equal(h.documents.at(-1).remote, true);
  assert.equal(h.client.canRedo(), true);
  assert.equal(h.client.redo(), true);
  assert.equal(h.client.text.toString(), "Remote Hello local");
  assert.equal(captureCount, 3);
});

test("relative forward and backward selections track remote insertions before them", (t) => {
  const h = harness(t);
  const server = h.server("abcdef");
  const socket = h.connect();
  h.sync(socket, server);
  const forward = h.client.captureSelection({ anchor: 2, head: 4 });
  const backward = h.client.captureSelection({ anchor: 4, head: 2 });
  server.getText("source").insert(0, "prefix ");
  deliver(socket, { type: "update", update: encode(Y.encodeStateAsUpdate(server)) });
  assert.deepEqual(h.client.resolveSelection(forward), { anchor: 9, head: 11 });
  assert.deepEqual(h.client.resolveSelection(backward), { anchor: 11, head: 9 });
  h.client.disconnect();
  assert.equal(h.client.resolveSelection(forward), null);
});

test("composition suspends remote CRDT updates until the local composition commits", (t) => {
  const h = harness(t);
  const server = h.server("Start");
  const socket = h.connect();
  h.sync(socket, server);
  h.client.suspendRemoteUpdates();
  server.getText("source").insert(0, "Remote ");
  deliver(socket, { type: "update", update: encode(Y.encodeStateAsUpdate(server)) });
  assert.equal(h.client.text.toString(), "Start");
  assert.equal(h.documents.length, 1);
  h.client.replace("Start 日本語");
  h.client.resumeRemoteUpdates();
  assert.equal(h.client.text.toString(), "Remote Start 日本語");
  acknowledge(socket, socket.sent.at(-1), server);
  assert.equal(server.getText("source").toString(), "Remote Start 日本語");
});

test("lost acknowledgment retries the same update with bounded memory and timeout", (t) => {
  const h = harness(t);
  const server = h.server("Start");
  const socket = h.connect();
  h.sync(socket, server);
  h.client.replace("Start one");
  const pending = socket.sent[0];
  h.client.replace("Start one two");
  assert.equal(socket.sent.length, 1);
  h.timers.get(h.client.retryTimer)();
  assert.deepEqual(socket.sent[1], pending);
  acknowledge(socket, pending, server);
  assert.equal(socket.sent.length, 3);
  acknowledge(socket, socket.sent[2], server);
  assert.equal(server.getText("source").toString(), "Start one two");
  assert.equal(h.client.inFlight, null);
});

test("a large paste exceeds the old 64 KiB update limit without being truncated", (t) => {
  const h = harness(t);
  const server = h.server("Start");
  const socket = h.connect();
  h.sync(socket, server);
  const value = "large paste 🌍\n".repeat(15_000);
  h.client.replace(value);
  assert.ok(Buffer.from(socket.sent[0].update, "base64url").length > 65_536);
  acknowledge(socket, socket.sent[0], server);
  assert.equal(server.getText("source").toString(), value);
});

test("read-only downgrade pauses without exposing or transmitting queued offline work", (t) => {
  const h = harness(t);
  const server = h.server("Original");
  const socket = h.connect();
  h.sync(socket, server);
  h.client.replace("Original local work");
  socket.emit("close", { code: 4003, reason: "Editing permission was removed; save a local copy" });
  assert.equal(h.client.canEdit, false);
  assert.equal(h.client.syncConflict, true);
  assert.equal(h.statuses.at(-1)[0], "read-only");
  assert.equal(h.documents.at(-1).value, "Original local work");
  assert.equal(h.timers.size, 0);
});

test("manual checkpoint waits for durable acknowledgment and times out without uploading a snapshot", async (t) => {
  const h = harness(t);
  const socket = h.connect();
  h.sync(socket, h.server("Original"));
  h.client.replace("Unacknowledged");
  const pending = h.client.checkpoint();
  h.timers.get([...h.client.syncWaiters][0].timer)();
  await assert.rejects(pending, /still syncing/);
  assert.equal(h.fetch.mock.callCount(), 0);
});

test("Save immediately after typing waits for acknowledgment then reports the authoritative checkpoint", async (t) => {
  const h = harness(t);
  const socket = h.connect();
  const server = h.server("Original");
  h.sync(socket, server);
  h.client.replace("Original edited");
  const result = { file: { id: "file-a" }, content: "Original edited", saved: true };
  h.fetch.mock.mockImplementation(async () => new Response(JSON.stringify(result)));
  let saved;
  h.client.onCheckpoint = (value) => { saved = value; };
  const pending = h.client.checkpoint();
  assert.equal(h.fetch.mock.callCount(), 0);
  acknowledge(socket, socket.sent[0], server);
  assert.deepEqual(await pending, result);
  assert.deepEqual(saved, result);
});

test("an old server fails closed rather than reverting to unsafe snapshot saves", (t) => {
  const h = harness(t);
  const socket = h.connect();
  h.client.replace("Local work");
  deliver(socket, { type: "sync", update: encode(Y.encodeStateAsUpdate(h.server("Original"))) });
  assert.equal(h.client.syncConflict, true);
  assert.equal(h.client.closed, true);
  assert.deepEqual(h.documents, []);
  assert.deepEqual(socket.sent, []);
});

test("emoji replacement never splits surrogate pairs in Yjs transactions or local undo", (t) => {
  const h = harness(t);
  const server = h.server("Hello 😀!");
  const socket = h.connect();
  h.sync(socket, server);
  h.client.replace("Hello 😁!");
  acknowledge(socket, socket.sent.at(-1), server);
  assert.equal(server.getText("source").toString(), "Hello 😁!");
  server.getText("source").insert(0, "Remote ");
  deliver(socket, { type: "update", update: encode(Y.encodeStateAsUpdate(server)) });
  h.client.undo();
  assert.equal(h.client.text.toString(), "Remote Hello 😀!");
});

test("malformed acknowledgments pause safely without throwing out of the socket handler", (t) => {
  const h = harness(t);
  const socket = h.connect();
  h.sync(socket, h.server("Original"));
  h.client.replace("Original edit");
  assert.doesNotThrow(() => deliver(socket, { type: "ack", id: socket.sent[0].id, stateVector: "!bad" }));
  assert.equal(h.client.syncConflict, true);
  assert.equal(h.documents.at(-1).value, "Original edit");
});

test("nonobject protocol messages cannot throw from the socket listener", (t) => {
  const h = harness(t);
  const socket = h.connect();
  for (const value of [null, false, "text", [], 4]) assert.doesNotThrow(() => deliver(socket, value));
});

test("two clients converge through repeated disconnections and keep each other's work on undo", (t) => {
  const h = harness(t);
  const server = h.server("Base");
  const alice = h.client;
  let aliceSocket = h.connect();
  h.sync(aliceSocket, server);
  const bob = new CollaborationClient({ onDocument() {}, onPresence() {}, onStatus() {} });
  t.after(() => bob.disconnect());
  bob.connect({ fileId: "file-a", documentId: "room-a", canEdit: true });
  const bobSocket = h.sockets.at(-1);
  bobSocket.emit("open");
  h.sync(bobSocket, server);
  const relay = (from, peer) => {
    const pending = from.sent.at(-1);
    acknowledge(from, pending, server);
    deliver(peer, { type: "update", update: pending.update });
  };
  for (let round = 0; round < 3; round += 1) {
    aliceSocket.emit("close", { code: 1006 });
    alice.stopCapturing();
    alice.replace(`${alice.text.toString()} Alice${round}`);
    bob.stopCapturing();
    bob.replace(`Bob${round} ${bob.text.toString()}`);
    acknowledge(bobSocket, bobSocket.sent.at(-1), server);
    alice.openSocket();
    aliceSocket = h.sockets.at(-1);
    aliceSocket.emit("open");
    h.sync(aliceSocket, server);
    relay(aliceSocket, bobSocket);
    assert.equal(alice.text.toString(), bob.text.toString());
    assert.equal(alice.text.toString(), server.getText("source").toString());
  }
  alice.undo();
  relay(aliceSocket, bobSocket);
  assert.match(alice.text.toString(), /Bob2 Bob1 Bob0/);
  assert.doesNotMatch(alice.text.toString(), /Alice2/);
  assert.equal(alice.text.toString(), bob.text.toString());
});

test("long network outages keep offline CRDT edits mergeable instead of discarding the session", (t) => {
  const h = harness(t);
  const server = h.server("Base");
  let socket = h.connect();
  h.sync(socket, server);
  h.client.replace("Base offline");
  for (let attempt = 0; attempt < 12; attempt += 1) {
    socket.emit("close", { code: 1006 });
    h.client.openSocket();
    socket = h.sockets.at(-1);
  }
  assert.equal(h.client.closed, false);
  assert.equal(h.client.text.toString(), "Base offline");
  server.getText("source").insert(0, "Remote ");
  socket.emit("open");
  h.sync(socket, server);
  acknowledge(socket, socket.sent.at(-1), server);
  assert.equal(server.getText("source").toString(), "Remote Base offline");
});

test("permission downgrade during initial handshake preserves the editor's queued text", (t) => {
  const h = harness(t);
  const socket = h.connect({ baselineContent: "Original" });
  h.client.replace("Original unsynced local edit");
  const server = h.server("Original");
  deliver(socket, { type: "sync", protocol: 2, self: { canEdit: false }, update: encode(Y.encodeStateAsUpdate(server)), stateVector: encode(Y.encodeStateVector(server)) });
  assert.deepEqual(h.documents, []);
  assert.equal(h.client.syncConflict, true);
  assert.equal(h.statuses.at(-1)[0], "read-only");
  assert.deepEqual(socket.sent, []);
});
