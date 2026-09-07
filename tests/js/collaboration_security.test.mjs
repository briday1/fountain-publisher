import test from "node:test";
import assert from "node:assert/strict";
import worker, { CollaborationRoom } from "../../github-worker/src/index.mjs";

const roomId = "a".repeat(48);
const fileId = "original-file-id";
const origin = "https://app.example";

async function harness(t, options = {}) {
  const keyBytes = crypto.getRandomValues(new Uint8Array(32));
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode("caller-access-token"));
  const accessToken = Buffer.concat([iv, Buffer.from(encrypted)]).toString("base64");
  const rooms = [], requests = [];
  const env = {
    APP_ORIGIN: origin,
    TOKEN_ENCRYPTION_KEY: Buffer.from(keyBytes).toString("base64"),
    DB: {
      batch: async () => [],
      prepare: () => ({ bind() { return this; }, first: async () => options.noSession ? null : ({
        google_sub: "actual-user-id", email: "test@example.com", display_name: "Actual User",
        access_token: accessToken, refresh_token: null,
        access_expires_at: Math.floor(Date.now() / 1000) + 3600,
      }), run: async () => {} }),
    },
    COLLAB_ROOMS: {
      idFromName: name => { rooms.push({ name, calls: [] }); return rooms.length - 1; },
      get: index => ({ fetch: async input => {
        const request = typeof input === "string" ? new Request(input) : input;
        rooms[index].calls.push(request);
        const path = new URL(request.url).pathname;
        if (path === "/initialized") return Response.json({ initialized: options.initialized ?? true });
        if (path === "/initialize") return Response.json({}, { status: options.initializeStatus ?? 200 });
        return Response.json({ admitted: true }); // Node's Response cannot represent a 101 upgrade.
      } }),
    },
  };
  t.mock.method(globalThis, "fetch", async (url, init) => {
    requests.push({ url, init });
    assert.equal(init.headers.authorization, "Bearer caller-access-token");
    const parsed = new URL(url);
    assert.equal(parsed.origin, "https://www.googleapis.com");
    if (options.driveStatus) return Response.json({ error: { message: "Denied by Drive" } }, { status: options.driveStatus });
    const requestedId = decodeURIComponent(parsed.pathname.split("/").at(-1));
    if (parsed.searchParams.get("alt") === "media") return new Response(`content of ${requestedId}`);
    return Response.json({ id: requestedId, trashed: false, appProperties: { fountainPublisherDocumentId: roomId }, capabilities: { canEdit: true }, ...options.file });
  });
  return { rooms, requests, async connect({ id = fileId, protocol = "2", headers = {}, documentId = roomId } = {}) {
    const url = new URL(`https://api.example/api/collaboration/${documentId}`);
    url.searchParams.set("fileId", id);
    if (protocol) url.searchParams.set("roomProtocol", protocol);
    const request = new Request(url, { headers: { origin, upgrade: "websocket", cookie: "fp_google_session=synthetic-session", ...headers } });
    return worker.fetch(request, env, { waitUntil: promise => promise.catch(() => {}) });
  } };
}

test("collaboration requires the session, origin, room format, and new protocol before touching a room", async t => {
  const h = await harness(t);
  for (const [options, status] of [
    [{ headers: { cookie: "" } }, 401],
    [{ headers: { origin: "https://attacker.example" } }, 403],
    [{ headers: { upgrade: "" } }, 426],
    [{ id: "../bad" }, 400],
    [{ documentId: "wrong" }, 400],
    [{ protocol: "" }, 409],
    [{ protocol: "1" }, 409],
  ]) assert.equal((await h.connect(options)).status, status);
  assert.equal(h.rooms.length, 0);
  assert.equal(h.requests.length, 0);
});

test("an unknown session cannot connect even with valid file and document IDs", async t => {
  const h = await harness(t, { noSession: true });
  assert.equal((await h.connect()).status, 401);
  assert.equal(h.requests.length, 0);
  assert.equal(h.rooms.length, 0);
});

for (const driveStatus of [403, 404, 503]) test(`Drive ${driveStatus} fails closed even for an existing room`, async t => {
  const h = await harness(t, { driveStatus });
  assert.equal((await h.connect()).status, driveStatus);
  assert.equal(h.rooms.length, 0);
});

for (const file of [
  { id: "another-file-id" }, { trashed: true },
  { appProperties: {} }, { appProperties: { fountainPublisherDocumentId: "b".repeat(48) } },
]) test(`Drive metadata cannot bypass identity validation: ${JSON.stringify(file)}`, async t => {
  const h = await harness(t, { file });
  assert.equal((await h.connect()).status, 403);
  assert.equal(h.rooms.length, 0);
});

test("copied appProperties never address or initialize the original file's room", async t => {
  const h = await harness(t, { initialized: false });
  for (const id of [fileId, "attacker-copy-id"]) assert.equal((await h.connect({ id })).status, 200);
  assert.notEqual(h.rooms[0].name, h.rooms[1].name);
  for (const [index, id] of [fileId, "attacker-copy-id"].entries()) {
    assert.deepEqual(JSON.parse(h.rooms[index].name), ["drive-file-v2", id, roomId]);
    assert.equal(await h.rooms[index].calls[1].text(), `content of ${id}`);
  }
  assert.ok(h.requests.every(request => new URL(request.url).searchParams.get("supportsAllDrives") === "true"));
});

test("identity and writer capability are derived server-side, not from caller headers", async t => {
  const h = await harness(t, { file: { capabilities: { canEdit: false } } });
  const result = await h.connect({ headers: {
    "x-fp-can-edit": "true", "x-fp-user-id": "spoofed", "x-fp-room-protocol": "spoofed",
    "x-fp-user-email": "spoofed@example.com", "x-fp-authorized-until": "999999999999",
  } });
  assert.equal(result.status, 200);
  const headers = h.rooms[0].calls.at(-1).headers;
  assert.equal(headers.get("x-fp-user-id"), "actual-user-id");
  assert.equal(headers.get("x-fp-user-email"), "test@example.com");
  assert.equal(headers.get("x-fp-can-edit"), "false");
  assert.equal(headers.get("x-fp-room-protocol"), "2");
  assert.ok(Number(headers.get("x-fp-authorized-until")) <= Math.floor(Date.now() / 1000) + 300);
});

test("a failed initialization never proceeds to a WebSocket upgrade", async t => {
  const h = await harness(t, { initialized: false, initializeStatus: 413 });
  assert.equal((await h.connect()).status, 413);
  assert.equal(h.rooms[0].calls.length, 2);
});

function socket(identity) {
  return {
    sent: [], closed: [],
    deserializeAttachment: () => identity,
    serializeAttachment: value => { identity = value; },
    send(value) { this.sent.push(JSON.parse(value)); },
    close(...args) { this.closed.push(args); },
  };
}

async function localRoom(sockets) {
  const writes = [];
  const room = new CollaborationRoom({
    blockConcurrencyWhile: fn => fn(),
    storage: { get: async () => undefined, put: async (...args) => writes.push(args) },
    getWebSockets: () => sockets,
  });
  await room.ready;
  return { room, writes };
}

const authorized = { roomProtocol: "2", canEdit: true, authorizedUntil: Math.floor(Date.now() / 1000) + 300 };

test("legacy and expired sockets cannot receive broadcasts or submit document updates", async () => {
  const legacy = socket({ ...authorized, roomProtocol: undefined });
  const expired = socket({ ...authorized, authorizedUntil: 1 });
  const valid = socket(authorized);
  const { room, writes } = await localRoom([legacy, expired, valid]);
  try {
    room.broadcast({ type: "update", update: "sensitive data" });
    for (const rejected of [legacy, expired]) {
      await room.webSocketMessage(rejected, JSON.stringify({ type: "update", update: "AAAA" }));
      assert.equal(rejected.sent.length, 0);
      assert.ok(rejected.closed.every(([code]) => code === 4003));
      assert.equal(rejected.closed.length, 2);
    }
    assert.equal(valid.sent.length, 1);
    assert.equal(writes.length, 0);
  } finally { room.document.destroy(); }
});

test("readers can receive updates but cannot mutate the document", async () => {
  const reader = socket({ ...authorized, canEdit: false });
  const writer = socket(authorized);
  const { room, writes } = await localRoom([reader, writer]);
  const doc = new room.document.constructor();
  let update;
  doc.on("update", value => { update = value; });
  doc.getText("source").insert(0, "writer content");
  const message = JSON.stringify({ type: "update", update: Buffer.from(update).toString("base64url") });
  try {
    await room.webSocketMessage(reader, message);
    assert.equal(room.document.getText("source").toString(), "");
    assert.equal(writes.length, 0);
    assert.equal(reader.sent[0].error, "Read-only access");
    await room.webSocketMessage(writer, message);
    assert.equal(room.document.getText("source").toString(), "writer content");
    assert.equal(writes.length, 1);
    assert.equal(reader.sent[1].type, "update");
  } finally { room.document.destroy(); doc.destroy(); }
});
