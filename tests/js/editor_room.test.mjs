import assert from "node:assert/strict";
import test from "node:test";
import { webcrypto } from "node:crypto";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import worker, { CollaborationRoom } from "../../github-worker/src/index.mjs";

// Resolve the same worker-local Yjs module in both installed and fresh-CI trees.
const workerRequire = createRequire(new URL("../../github-worker/src/index.mjs", import.meta.url));
const Y = await import(pathToFileURL(workerRequire.resolve("yjs").replace(/yjs\.cjs$/, "yjs.mjs")));

const fileId = "drive_file_123456";
const documentId = "a".repeat(48);
const encode = (value) => Buffer.from(value).toString("base64url");
const nativeFetch = globalThis.fetch.bind(globalThis);

async function immutableResponse(response) {
  const guard = (await nativeFetch("data:text/plain,")).headers;
  const immutableHeaders = new Proxy(response.headers, {
    get(target, property) {
      if (["set", "append", "delete"].includes(property)) return guard[property].bind(guard);
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  Object.defineProperty(response, "headers", { value: immutableHeaders });
  assert.throws(() => response.headers.set("x-mutation-probe", "blocked"), /immutable/i);
  return response;
}

async function forwardImmutableRoomResponses(t, h, beforeFetch = () => {}) {
  // Node requires duplex for stream bodies; workerd accepts this forwarding
  // Request directly. Adapt only that constructor difference in this harness.
  const NativeRequest = globalThis.Request;
  t.mock.method(globalThis, "Request", class extends NativeRequest {
    constructor(input, options) { super(input, options?.body?.getReader ? { ...options, duplex: "half" } : options); }
  });
  // In-process new Response() headers are writable, unlike a response crossing
  // a real Durable Object fetch boundary. Preserve the actual room body/status
  // and headers, but delegate mutations to a native fetch's immutable guard.
  // The data URL is local and never sends fixture text or credentials anywhere.
  const responses = [];
  h.env.COLLAB_ROOMS = {
    idFromName(name) { assert.equal(name, documentId); return name; },
    get(id) {
      assert.equal(id, documentId);
      return { async fetch(request) {
        await beforeFetch(request);
        const response = await h.room.fetch(request);
        responses.push({ status: response.status, body: await response.clone().text(), headers: new Headers(response.headers) });
        return immutableResponse(response);
      } };
    },
  };
  return responses;
}

function outerRoomRequest(h, action = "checkpoint", { origin = h.env.APP_ORIGIN, cookie = "fp_google_session=session-a", expectedContent = h.room.document.getText("source").toString() } = {}) {
  const method = action === "recovery" ? "GET" : "POST";
  return worker.fetch(new Request(`https://api.fountain-publisher.com/api/collaboration/${documentId}/${action}?fileId=${fileId}`, {
    method, headers: { origin, cookie }, ...(method === "POST" ? { body: JSON.stringify({ expectedContent }) } : {}),
  }), h.env);
}

async function assertForwardedRoomResponse(h, response, forwarded, status) {
  assert.equal(forwarded.status, status);
  assert.equal(response.status, status);
  assert.equal(await response.text(), forwarded.body, "CORS wrapping must preserve the exact room response body");
  for (const [name, value] of forwarded.headers) assert.equal(response.headers.get(name), value, `room header ${name} is preserved`);
  assert.equal(response.headers.get("access-control-allow-origin"), h.env.APP_ORIGIN);
  assert.equal(response.headers.get("access-control-allow-credentials"), "true");
  assert.equal(response.headers.get("vary"), "Origin");
}

function memoryStorage() {
  let records = new Map();
  let fail = false;
  const storage = {
    async get(key) { return structuredClone(records.get(key)); },
    async put(key, value) {
      if (fail) throw new Error("Storage unavailable");
      if (typeof key === "object") { for (const [name, item] of Object.entries(key)) await storage.put(name, item); return; }
      if (value instanceof Uint8Array) assert.ok(value.length < 128 * 1024, "snapshot values fit legacy storage limits");
      records.set(key, structuredClone(value));
    },
    async delete(key) { records.delete(key); },
    async setAlarm(value) { await storage.put("test-alarm", value); },
    async transaction(callback) {
      const before = structuredClone(records);
      try { return await callback(storage); } catch (error) { records = before; throw error; }
    },
    setFailure(value) { fail = value; },
  };
  return storage;
}

async function setup(t, content = "Original") {
  if (!globalThis.crypto) t.mock.property(globalThis, "crypto", webcrypto);
  t.mock.method(Math, "random", () => 0.5);
  const storage = memoryStorage();
  const sockets = [];
  const state = { storage, blockConcurrencyWhile: (callback) => callback(), getWebSockets: () => sockets, acceptWebSocket: (socket) => sockets.push(socket) };
  const keyBytes = new Uint8Array(32).fill(7);
  const key = await webcrypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
  const iv = new Uint8Array(12).fill(3);
  const encrypted = new Uint8Array(await webcrypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode("google-token")));
  const packed = new Uint8Array(iv.length + encrypted.length);
  packed.set(iv); packed.set(encrypted, iv.length);
  const sessions = new Map([ ["session-a", { id: "session-a", google_sub: "user-a", access_token: Buffer.from(packed).toString("base64"), refresh_token: null, access_expires_at: Date.now() / 1000 + 3600 }] ]);
  const env = {
    APP_ORIGIN: "https://fountain-publisher.com", TOKEN_ENCRYPTION_KEY: Buffer.from(keyBytes).toString("base64"),
    DB: { prepare: (query) => ({ bind(id) { return { first: async () => query.includes("rate_limits") ? { count: 1, reset_at: Date.now() / 1000 + 60 } : sessions.get(id) ? structuredClone(sessions.get(id)) : null, run: async () => {} }; } }) },
  };
  const drive = { content, etag: '"version-1"', canEdit: true, allowed: true, documentId, writes: [], metadataWrites: [], failWrite: false, afterRead: null, beforeWrite: null, onVersionRead: null };
  const fetch = t.mock.method(globalThis, "fetch", async (input, options = {}) => {
    const url = new URL(input);
    assert.equal(url.hostname, "www.googleapis.com");
    assert.equal(options.headers.authorization, "Bearer google-token");
    if (!drive.allowed) return new Response(JSON.stringify({ error: { message: "Permission revoked" } }), { status: 403 });
    if (url.pathname.startsWith("/upload/drive/v2/")) {
      if (drive.beforeWrite) await drive.beforeWrite();
      if (options.headers["if-match"] !== drive.etag) return new Response(JSON.stringify({ error: { message: "Precondition failed" } }), { status: 412 });
      if (drive.failWrite) throw new Error("Lost upload response");
      drive.writes.push(options.body);
      drive.content = options.body;
      drive.etag = `"version-${drive.writes.length + 1}"`;
      return new Response(JSON.stringify({ id: fileId, etag: drive.etag }));
    }
    if (url.pathname.startsWith("/drive/v2/files/") && options.method === "PATCH") {
      if (options.headers["if-match"] !== drive.etag) return new Response(JSON.stringify({ error: { message: "Precondition failed" } }), { status: 412 });
      const metadata = JSON.parse(options.body);
      drive.metadataWrites.push(metadata);
      drive.documentId = metadata.properties.find((property) => property.key === "fountainPublisherDocumentId").value;
      drive.etag = '"adopted"';
      return new Response(JSON.stringify({ id: fileId }));
    }
    if (url.pathname.startsWith("/drive/v2/files/")) {
      const result = { id: fileId, etag: drive.etag, properties: drive.documentId ? [{ key: "fountainPublisherDocumentId", value: drive.documentId, visibility: "PRIVATE" }] : [] };
      await drive.onVersionRead?.();
      return new Response(JSON.stringify(result));
    }
    if (url.searchParams.get("alt") === "media") {
      const value = drive.content;
      drive.afterRead?.();
      return new Response(value);
    }
    return new Response(JSON.stringify({ id: fileId, name: "Screenplay.fountain", mimeType: "text/plain", appProperties: { fountainPublisherDocumentId: drive.documentId }, capabilities: { canEdit: drive.canEdit } }));
  });
  const room = new CollaborationRoom(state, env);
  t.after(() => room.document.destroy());
  await room.ready;
  const initialized = await room.fetch(new Request("https://room.internal/initialize", { method: "POST", body: JSON.stringify({ fileId, documentId, content }) }));
  assert.equal(initialized.status, 200);
  function socket(overrides = {}) {
    const identity = { id: "user-a", name: "Writer", sessionId: "session-a", canEdit: true, authorizedUntil: 0, connectionId: `connection-${sockets.length}`, ...overrides };
    const result = { identity, sent: [], closed: [], serializeAttachment(value) { this.identity = structuredClone(value); }, deserializeAttachment() { return structuredClone(this.identity); }, send(value) { this.sent.push(JSON.parse(value)); }, close(...value) { this.closed.push(value); } };
    sockets.push(result);
    return result;
  }
  function checkpoint(expectedContent = room.document.getText("source").toString()) {
    return room.fetch(new Request(`https://room.internal/checkpoint?fileId=${fileId}&documentId=${documentId}`, { method: "POST", headers: { cookie: "fp_google_session=session-a" }, body: JSON.stringify({ expectedContent }) }));
  }
  function edit(value, id = 1) {
    const doc = new Y.Doc();
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(room.document));
    const vector = Y.encodeStateVector(doc);
    doc.getText("source").insert(doc.getText("source").length, value);
    const payload = JSON.stringify({ type: "update", protocol: 2, id, update: encode(Y.encodeStateAsUpdate(doc, vector)) });
    doc.destroy();
    return payload;
  }
  return { room, storage, state, env, sessions, sockets, socket, drive, fetch, checkpoint, edit };
}

test("room binds to one exact Drive file even when a copy carries the same application property", async (t) => {
  const h = await setup(t);
  const result = await h.room.fetch(new Request("https://room.internal/initialize", { method: "POST", body: JSON.stringify({ fileId: "copied_file_123456", documentId, content: "Original" }) }));
  assert.equal(result.status, 403);
  assert.equal(h.room.meta.fileId, fileId);
});

test("durable acknowledgment happens after persistence, and failed storage never mutates the live room", async (t) => {
  const h = await setup(t);
  const socket = h.socket();
  const payload = h.edit(" edit");
  h.storage.setFailure(true);
  await h.room.webSocketMessage(socket, payload);
  assert.equal(h.room.document.getText("source").toString(), "Original");
  assert.equal(socket.sent.length, 0);
  assert.equal(socket.closed[0][0], 4000);
  h.storage.setFailure(false);
  await h.room.webSocketMessage(socket, payload);
  assert.equal(h.room.document.getText("source").toString(), "Original edit");
  assert.equal(socket.sent[0].type, "ack");
  await h.room.webSocketMessage(socket, payload);
  assert.equal(h.room.document.getText("source").toString(), "Original edit");
  assert.equal(socket.sent[1].type, "ack");
});

test("large room states persist in bounded chunks and survive Durable Object reconstruction", async (t) => {
  const h = await setup(t);
  const socket = h.socket();
  await h.room.webSocketMessage(socket, h.edit("🌍".repeat(120_000)));
  assert.equal(socket.closed.length, 0);
  assert.ok((await h.storage.get("snapshot-layout")).chunks > 1);
  const reconstructed = new CollaborationRoom(h.state, h.env);
  await reconstructed.ready;
  assert.equal(reconstructed.document.getText("source").toString(), h.room.document.getText("source").toString());
  assert.deepEqual(reconstructed.meta, h.room.meta);
  reconstructed.document.destroy();
});

test("each editing mutation revalidates Google permissions even inside the read lease", async (t) => {
  const h = await setup(t);
  const socket = h.socket({ authorizedUntil: Date.now() / 1000 + 30 });
  h.drive.canEdit = false;
  await h.room.webSocketMessage(socket, h.edit(" forbidden"));
  assert.equal(h.room.document.getText("source").toString(), "Original");
  assert.equal(socket.sent.length, 0);
  assert.equal(socket.closed[0][0], 4003);
});

test("revoked readers receive no broadcast after their read-permission lease expires", async (t) => {
  const h = await setup(t);
  const socket = h.socket();
  h.drive.allowed = false;
  await h.room.broadcast({ type: "update", update: "private data" });
  assert.equal(socket.sent.length, 0);
  assert.equal(socket.closed[0][0], 4003);
});

test("logout and changed file identity prevent edits before room mutation", async (t) => {
  for (const failure of ["session", "identity"]) {
    const h = await setup(t);
    const socket = h.socket();
    if (failure === "session") h.sessions.clear();
    else h.drive.documentId = "b".repeat(48);
    await h.room.webSocketMessage(socket, h.edit(" forbidden"));
    assert.equal(h.room.document.getText("source").toString(), "Original");
    assert.equal(socket.closed[0][0], 4003);
  }
});

test("presence never discloses the session cookie and clamps invalid source offsets", async (t) => {
  const h = await setup(t);
  const writer = h.socket();
  const viewer = h.socket();
  await h.room.webSocketMessage(writer, JSON.stringify({ type: "presence", presence: { cursor: 2, selectionStart: -1, selectionEnd: 99999, mode: "preview" } }));
  assert.equal(viewer.sent[0].user.sessionId, undefined);
  assert.equal(JSON.stringify(viewer.sent).includes("session-a"), false);
  assert.deepEqual(viewer.sent[0].presence, { cursor: 2, selectionStart: null, selectionEnd: null, mode: "preview" });
});

test("checkpoint writes only authoritative room content and returns that exact saved snapshot", async (t) => {
  const h = await setup(t);
  await h.room.webSocketMessage(h.socket(), h.edit(" live edit"));
  const stale = await h.checkpoint("Original");
  assert.equal(stale.status, 409);
  assert.equal(h.drive.writes.length, 0);
  const response = await h.checkpoint();
  assert.equal(response.status, 200);
  const saved = await response.json();
  assert.equal(saved.content, "Original live edit");
  assert.equal(saved.saved, true);
  assert.equal(h.drive.content, saved.content);
  assert.equal(h.room.meta.savedRevision, h.room.meta.revision);
  assert.equal(h.room.meta.pendingCheckpoint, null);
});

test("outer Worker preserves a successful checkpoint across immutable Durable Object response headers", async (t) => {
  const h = await setup(t);
  t.mock.method(console, "error", () => {});
  const responses = await forwardImmutableRoomResponses(t, h);
  await h.room.webSocketMessage(h.socket(), h.edit(" live edit"));
  const response = await outerRoomRequest(h);
  assert.equal(h.drive.writes.length, 1, "the actual room write succeeds before the Worker adds CORS");
  assert.equal(h.drive.content, "Original live edit");
  assert.equal(responses.length, 1);
  await assertForwardedRoomResponse(h, response, responses[0], 200);
  assert.equal(h.room.meta.savedRevision, h.room.meta.revision);
  assert.equal(h.room.meta.pendingCheckpoint, null);
});

test("outer Worker preserves snapshot-conflict status and body instead of reporting a generic save failure", async (t) => {
  const h = await setup(t);
  t.mock.method(console, "error", () => {});
  const responses = await forwardImmutableRoomResponses(t, h);
  await h.room.webSocketMessage(h.socket(), h.edit(" live edit"));
  const response = await outerRoomRequest(h, "checkpoint", { expectedContent: "Original" });
  assert.equal(h.drive.writes.length, 0);
  assert.equal(responses.length, 1);
  assert.match(JSON.parse(responses[0].body).error, /live document changed/);
  await assertForwardedRoomResponse(h, response, responses[0], 409);
});

test("outer Worker preserves an external Drive conflict without writing over either version", async (t) => {
  const h = await setup(t);
  t.mock.method(console, "error", () => {});
  const responses = await forwardImmutableRoomResponses(t, h);
  await h.room.webSocketMessage(h.socket(), h.edit(" room version"));
  h.drive.content = "External Drive version"; h.drive.etag = '"external"';
  const response = await outerRoomRequest(h);
  assert.equal(h.drive.writes.length, 0);
  assert.equal(h.drive.content, "External Drive version");
  assert.equal(h.room.document.getText("source").toString(), "Original room version");
  assert.match(JSON.parse(responses[0].body).error, /edited outside the live room/);
  await assertForwardedRoomResponse(h, response, responses[0], 412);
});

test("outer Worker preserves a missing-ETag retry error instead of inventing a successful save", async (t) => {
  const h = await setup(t);
  t.mock.method(console, "error", () => {});
  const responses = await forwardImmutableRoomResponses(t, h);
  await h.room.webSocketMessage(h.socket(), h.edit(" room version"));
  h.drive.etag = undefined;
  const response = await outerRoomRequest(h);
  assert.equal(h.drive.writes.length, 0);
  assert.equal(h.drive.content, "Original");
  assert.match(JSON.parse(responses[0].body).error, /usable version validator/);
  await assertForwardedRoomResponse(h, response, responses[0], 503);
});

test("outer Worker preserves the room's read-only denial and never attempts a Drive write", async (t) => {
  const h = await setup(t);
  t.mock.method(console, "error", () => {});
  const responses = await forwardImmutableRoomResponses(t, h);
  await h.room.webSocketMessage(h.socket(), h.edit(" room version"));
  h.drive.canEdit = false;
  const response = await outerRoomRequest(h);
  assert.equal(h.drive.writes.length, 0);
  assert.match(JSON.parse(responses[0].body).error, /Editing permission was removed/);
  await assertForwardedRoomResponse(h, response, responses[0], 403);
});

test("session expiry between outer authorization and room fetch preserves the room's 401 response", async (t) => {
  const h = await setup(t);
  t.mock.method(console, "error", () => {});
  const responses = await forwardImmutableRoomResponses(t, h, () => h.sessions.clear());
  const response = await outerRoomRequest(h);
  assert.equal(h.drive.writes.length, 0);
  assert.equal(responses.length, 1);
  assert.match(JSON.parse(responses[0].body).error, /Sign in again/);
  await assertForwardedRoomResponse(h, response, responses[0], 401);
});

test("outer Worker rejects missing authentication before forwarding any room request", async (t) => {
  const h = await setup(t);
  const responses = await forwardImmutableRoomResponses(t, h);
  const response = await outerRoomRequest(h, "checkpoint", { cookie: "" });
  assert.equal(response.status, 401);
  assert.match((await response.json()).error, /Not signed in/);
  assert.equal(response.headers.get("access-control-allow-origin"), h.env.APP_ORIGIN);
  assert.equal(h.fetch.mock.callCount(), 0);
  assert.equal(responses.length, 0);
  assert.equal(h.drive.writes.length, 0);
});

test("outer Worker rejects checkpoint and recovery requests from a different origin without exposing room data", async (t) => {
  const h = await setup(t);
  const responses = await forwardImmutableRoomResponses(t, h);
  for (const action of ["checkpoint", "recovery"]) {
    const response = await outerRoomRequest(h, action, { origin: "https://untrusted.example" });
    assert.equal(response.status, 403);
    assert.match((await response.json()).error, /Invalid request origin/);
    assert.equal(response.headers.get("access-control-allow-origin"), null);
    assert.equal(response.headers.get("access-control-allow-credentials"), null);
  }
  assert.equal(h.fetch.mock.callCount(), 0);
  assert.equal(responses.length, 0);
  assert.equal(h.drive.writes.length, 0);
});

test("outer recovery preserves both versions, view-only access and no-store across immutable room headers", async (t) => {
  const h = await setup(t);
  t.mock.method(console, "error", () => {});
  const responses = await forwardImmutableRoomResponses(t, h);
  await h.room.webSocketMessage(h.socket(), h.edit(" room version"));
  h.drive.content = "External Drive version"; h.drive.etag = '"external"'; h.drive.canEdit = false;
  const response = await outerRoomRequest(h, "recovery");
  const recovered = JSON.parse(responses[0].body);
  assert.equal(recovered.roomContent, "Original room version");
  assert.equal(recovered.driveContent, "External Drive version");
  assert.equal(recovered.file.capabilities.canEdit, false);
  assert.equal(h.drive.writes.length, 0);
  assert.equal(h.drive.content, "External Drive version");
  assert.equal(response.headers.get("cache-control"), "no-store");
  await assertForwardedRoomResponse(h, response, responses[0], 200);
});

test("legacy Drive Save forwarding also preserves the room's successful immutable response", async (t) => {
  const h = await setup(t);
  t.mock.method(console, "error", () => {});
  const responses = await forwardImmutableRoomResponses(t, h);
  await h.room.webSocketMessage(h.socket(), h.edit(" legacy save"));
  const response = await worker.fetch(new Request(`https://api.fountain-publisher.com/api/google/drive/files/${fileId}`, {
    method: "PUT", headers: { origin: h.env.APP_ORIGIN, cookie: "fp_google_session=session-a" },
    body: JSON.stringify({ content: "Original legacy save" }),
  }), h.env);
  assert.equal(h.drive.writes.length, 1);
  assert.equal(h.drive.content, "Original legacy save");
  assert.equal(responses.length, 1);
  await assertForwardedRoomResponse(h, response, responses[0], 200);
});

test("unexpected provider errors identify Google Drive and collaboration rather than incorrectly blaming GitHub", async (t) => {
  const h = await setup(t);
  t.mock.method(console, "error", () => {});
  h.env.DB.prepare = () => { throw new Error("Synthetic database failure"); };
  for (const [path, method, expected] of [
    ["/api/google/session", "GET", "Google Drive integration failed. Please try again."],
    [`/api/collaboration/${documentId}/checkpoint?fileId=${fileId}`, "POST", "Collaboration request failed. Please try again."],
    ["/api/session", "GET", "GitHub integration failed"],
  ]) {
    const response = await worker.fetch(new Request(`https://api.fountain-publisher.com${path}`, {
      method, headers: { origin: h.env.APP_ORIGIN, cookie: "fp_google_session=session-a; fp_github_session=fixture-session" },
    }), h.env);
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: expected });
    assert.equal(response.headers.get("access-control-allow-origin"), h.env.APP_ORIGIN);
  }
  assert.equal(h.fetch.mock.callCount(), 0);
  assert.equal(h.drive.writes.length, 0);
});

test("outer Worker also safely wraps caught immutable error Responses without losing retry headers", async (t) => {
  const h = await setup(t);
  t.mock.method(console, "error", () => {});
  const body = JSON.stringify({ error: "Retry this request later" });
  const responseError = await immutableResponse(new Response(body, { status: 429, headers: { "content-type": "application/json", "retry-after": "7", "cache-control": "no-store" } }));
  h.env.DB.prepare = () => { throw responseError; };
  const response = await outerRoomRequest(h);
  await assertForwardedRoomResponse(h, response, { status: 429, body, headers: new Headers(responseError.headers) }, 429);
  assert.equal(response.headers.get("retry-after"), "7");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(h.drive.writes.length, 0);
});

test("an external Drive edit is never silently overwritten by the live room", async (t) => {
  const h = await setup(t);
  await h.room.webSocketMessage(h.socket(), h.edit(" live edit"));
  h.drive.content = "External editor version";
  h.drive.etag = '"external-2"';
  const response = await h.checkpoint();
  assert.equal(response.status, 412);
  assert.equal(h.drive.writes.length, 0);
  assert.equal(h.drive.content, "External editor version");
  assert.equal(h.room.document.getText("source").toString(), "Original live edit");
});

test("an external edit between read and upload fails the conditional write", async (t) => {
  const h = await setup(t);
  await h.room.webSocketMessage(h.socket(), h.edit(" live edit"));
  h.drive.beforeWrite = () => { h.drive.content = "External race winner"; h.drive.etag = '"external-2"'; };
  const response = await h.checkpoint();
  assert.equal(response.status, 412);
  assert.equal(h.drive.writes.length, 0);
  assert.equal(h.drive.content, "External race winner");
});

test("missing Drive ETag fails closed without an unconditional write", async (t) => {
  const h = await setup(t);
  await h.room.webSocketMessage(h.socket(), h.edit(" live edit"));
  h.drive.etag = undefined;
  const response = await h.checkpoint();
  assert.equal(response.status, 503);
  assert.equal(h.drive.writes.length, 0);
});

test("checkpoint and concurrent room updates are serialized rather than writing snapshots out of order", async (t) => {
  const h = await setup(t);
  const socket = h.socket();
  await h.room.webSocketMessage(socket, h.edit(" first"));
  let start;
  let release;
  const began = new Promise((resolve) => { start = resolve; });
  h.drive.beforeWrite = () => new Promise((resolve) => { release = resolve; start(); });
  const firstSave = h.checkpoint();
  await began;
  const secondEdit = h.room.webSocketMessage(socket, h.edit(" second", 2));
  assert.equal(h.room.document.getText("source").toString(), "Original first");
  release();
  assert.equal((await firstSave).status, 200);
  await secondEdit;
  assert.equal(h.drive.content, "Original first");
  assert.equal(h.room.document.getText("source").toString(), "Original first second");
  h.drive.beforeWrite = null;
  assert.equal((await h.checkpoint()).status, 200);
  assert.deepEqual(h.drive.writes, ["Original first", "Original first second"]);
});

test("pending checkpoint intent recovers a successful upload whose final acknowledgment was lost", async (t) => {
  const h = await setup(t);
  await h.room.webSocketMessage(h.socket(), h.edit(" live edit"));
  h.drive.beforeWrite = () => { h.storage.setFailure(true); };
  await assert.rejects(h.checkpoint(), /Storage unavailable/);
  assert.equal(h.drive.content, "Original live edit");
  assert.ok(h.room.meta.pendingCheckpoint);
  h.storage.setFailure(false);
  h.drive.beforeWrite = null;
  assert.equal((await h.checkpoint()).status, 200);
  assert.equal(h.drive.writes.length, 1);
  assert.equal(h.room.meta.pendingCheckpoint, null);
});

test("success with lost acknowledgment followed by a failed newer upload keeps the proven Drive baseline", async (t) => {
  const h = await setup(t);
  const socket = h.socket();
  await h.room.webSocketMessage(socket, h.edit(" A"));
  h.drive.beforeWrite = () => { h.storage.setFailure(true); };
  await assert.rejects(h.checkpoint(), /Storage unavailable/);
  assert.equal(h.drive.content, "Original A");
  h.storage.setFailure(false);
  h.drive.beforeWrite = null;
  await h.room.webSocketMessage(socket, h.edit(" B", 2));
  h.drive.failWrite = true;
  await assert.rejects(h.checkpoint(), /Lost upload response/);
  assert.equal(h.drive.content, "Original A");
  h.drive.failWrite = false;
  assert.equal((await h.checkpoint()).status, 200);
  assert.equal(h.drive.content, "Original A B");
});

test("wrong-file checkpoint request is rejected before reading room state or Drive credentials", async (t) => {
  const h = await setup(t);
  const response = await h.room.fetch(new Request(`https://room.internal/checkpoint?fileId=wrong_file_123&documentId=${documentId}`, { method: "POST", body: JSON.stringify({ expectedContent: "Original" }) }));
  assert.equal(response.status, 409);
  assert.equal(h.fetch.mock.callCount(), 0);
});

test("durable alarm checkpoints after the final editor has closed", async (t) => {
  const h = await setup(t);
  await h.room.webSocketMessage(h.socket(), h.edit(" last edit"));
  assert.ok(await h.storage.get("test-alarm"));
  h.sockets.length = 0;
  const restarted = new CollaborationRoom(h.state, h.env);
  await restarted.ready;
  await restarted.alarm();
  assert.equal(h.drive.content, "Original last edit");
  assert.equal(restarted.meta.savedRevision, restarted.meta.revision);
  restarted.document.destroy();
});

test("automatic save broadcasts do not give viewers the writer's file capabilities", async (t) => {
  const h = await setup(t);
  const socket = h.socket();
  await h.room.webSocketMessage(socket, h.edit(" last edit"));
  await h.room.alarm();
  const saved = socket.sent.find((payload) => payload.type === "checkpoint");
  assert.deepEqual(saved.result.file, { id: fileId });
  assert.equal(saved.result.content, "Original last edit");
});

test("automatic checkpoint conflict preserves acknowledged text without retrying a blind overwrite", async (t) => {
  const h = await setup(t);
  const socket = h.socket();
  await h.room.webSocketMessage(socket, h.edit(" live edit"));
  h.drive.content = "External content";
  h.drive.etag = '"external-2"';
  await h.room.alarm();
  assert.equal(h.drive.writes.length, 0);
  assert.equal(h.room.document.getText("source").toString(), "Original live edit");
  assert.equal(socket.sent.at(-1).type, "checkpoint-status");
});

test("Worker rejects a requested room that is not the authorized Drive file's application property", async (t) => {
  const h = await setup(t);
  const wrongRoom = "b".repeat(48);
  const response = await worker.fetch(new Request(`https://api.fountain-publisher.com/api/collaboration/${wrongRoom}?fileId=${fileId}&protocol=2`, {
    headers: { origin: h.env.APP_ORIGIN, upgrade: "websocket", cookie: "fp_google_session=session-a" },
  }), h.env);
  assert.equal(response.status, 403);
  assert.match((await response.json()).error, /identity mismatch/);
});

test("two concurrent legacy adopters retain one room identity and the loser reads the winner", async (t) => {
  const h = await setup(t);
  h.drive.documentId = null;
  let reads = 0;
  let release;
  const barrier = new Promise((resolve) => { release = resolve; });
  h.drive.onVersionRead = () => { reads += 1; if (reads === 2) release(); return barrier; };
  const adopt = () => worker.fetch(new Request(`https://api.fountain-publisher.com/api/google/drive/files/${fileId}/adopt`, {
    method: "POST", headers: { origin: h.env.APP_ORIGIN, cookie: "fp_google_session=session-a" },
  }), h.env);
  const [first, second] = await Promise.all([adopt(), adopt()]);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  const firstId = (await first.json()).file.appProperties.fountainPublisherDocumentId;
  const secondId = (await second.json()).file.appProperties.fountainPublisherDocumentId;
  assert.equal(firstId, secondId);
  assert.equal(firstId, h.drive.documentId);
  assert.equal(h.drive.metadataWrites.length, 1);
});

test("authenticated bound-room recovery returns both versions without writing either", async (t) => {
  const h = await setup(t);
  await h.room.webSocketMessage(h.socket(), h.edit(" room version"));
  h.drive.content = "External Drive version";
  h.drive.etag = '"external"';
  h.drive.canEdit = false;
  const response = await h.room.fetch(new Request(`https://room.internal/recovery?fileId=${fileId}&documentId=${documentId}`, { headers: { cookie: "fp_google_session=session-a" } }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const recovery = await response.json();
  assert.equal(recovery.roomContent, "Original room version");
  assert.equal(recovery.driveContent, "External Drive version");
  assert.equal(h.drive.writes.length, 0);
});

test("recovery refuses copied-file IDs and revoked access", async (t) => {
  const h = await setup(t);
  const copied = await h.room.fetch(new Request(`https://room.internal/recovery?fileId=copied_file_123&documentId=${documentId}`, { headers: { cookie: "fp_google_session=session-a" } }));
  assert.equal(copied.status, 409);
  h.drive.allowed = false;
  const revoked = await h.room.fetch(new Request(`https://room.internal/recovery?fileId=${fileId}&documentId=${documentId}`, { headers: { cookie: "fp_google_session=session-a" } }));
  assert.equal(revoked.status, 403);
  assert.equal(h.drive.writes.length, 0);
});

test("expired initial read lease revalidates before accepting or sending the initial room state", async (t) => {
  const h = await setup(t);
  const previous = Object.getOwnPropertyDescriptor(globalThis, "WebSocketPair");
  const sent = [];
  Object.defineProperty(globalThis, "WebSocketPair", { configurable: true, value: class { constructor() { return { 0: {}, 1: { send: (value) => sent.push(value) } }; } } });
  t.after(() => { if (previous) Object.defineProperty(globalThis, "WebSocketPair", previous); else delete globalThis.WebSocketPair; });
  h.drive.allowed = false;
  const response = await h.room.fetch(new Request(`https://room.internal/connect?protocol=2`, { headers: {
    "x-fp-file-id": fileId, "x-fp-document-id": documentId, "x-fp-user-id": "user-a", "x-fp-session-id": "session-a", "x-fp-authorized-until": "1", "x-fp-can-edit": "true",
  } }));
  assert.equal(response.status, 403);
  assert.deepEqual(sent, []);
  assert.equal(h.sockets.length, 0);
});
