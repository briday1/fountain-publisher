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
    socket.emit("message", { data: JSON.stringify({ type: "sync", update: encode(Y.encodeStateAsUpdate(doc)) }) });
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
  socket.emit("message", { data: JSON.stringify({ type: "sync", update: "not!base64" }) });
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
    const [url, options] = h.fetch.mock.calls[0].arguments;
    assert.match(url, /\/files\/file-a$/);
    assert.deepEqual(JSON.parse(options.body), { content: "Previous document" });

    const current = h.connect({ fileId: "file-b", documentId: "room-b" });
    h.sync(current, h.server("Current document"));
    const statuses = [...h.statuses];
    finish(outcome === "success" ? new Response(JSON.stringify({ file: { id: "file-a" } })) : new Error("Old save failed"));
    await checkpoint;
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
