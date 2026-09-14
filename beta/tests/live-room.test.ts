// @vitest-environment node
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import {
  LiveScreenplayRoom,
  decodeBytes,
  encodeBytes,
} from "../cloudflare/liveRoom";
import type { LiveRoomContext, LiveSocket } from "../cloudflare/liveRoom";
import type { LiveEnvironment } from "../cloudflare/liveDrive";
import { parseFountain } from "../src/core/fountain";
import { readSharedDocument } from "../src/collaboration/sharedDocument";

const FILE = "drive_file_1234567890";
const originalId = "a".repeat(48);
class MemoryStorage {
  data = new Map<string, unknown>();
  failNextTransaction = false;
  alarmAt = 0;
  async get<T>(key: string): Promise<T | undefined> {
    return structuredClone(this.data.get(key)) as T | undefined;
  }
  async put(key: string, value: unknown) {
    this.data.set(key, structuredClone(value));
  }
  async delete(key: string) {
    return this.data.delete(key);
  }
  async transaction<T>(
    operation: (storage: MemoryStorage) => Promise<T>,
  ): Promise<T> {
    const work = new MemoryStorage();
    work.data = structuredClone(this.data);
    const result = await operation(work);
    if (this.failNextTransaction) {
      this.failNextTransaction = false;
      throw new Error("durability unavailable");
    }
    this.data = work.data;
    return result;
  }
  async setAlarm(time: number) {
    this.alarmAt = time;
  }
}
class Socket implements LiveSocket {
  readyState = 1;
  messages: Record<string, unknown>[] = [];
  identity: unknown;
  closeCode?: number;
  send(message: string) {
    this.messages.push(JSON.parse(message));
  }
  close(code?: number) {
    this.readyState = 3;
    this.closeCode = code;
  }
  serializeAttachment(value: unknown) {
    this.identity = structuredClone(value);
  }
  deserializeAttachment() {
    return structuredClone(this.identity);
  }
}
interface Bootstrap {
  state: string;
  vector: string;
  content: string;
  remote: { etag: string; live: boolean };
  self: { id: string; canEdit: boolean };
  revision: number;
}
function fixture() {
  const storage = new MemoryStorage();
  const sockets: Socket[] = [];
  const context: LiveRoomContext = {
    storage,
    getWebSockets: () => sockets,
    acceptWebSocket: (socket) => sockets.push(socket as Socket),
  };
  const permissions = new Map<string, "writer" | "reader" | "none">([
    ["alice", "writer"],
    ["bob", "writer"],
    ["viewer", "reader"],
  ]);
  let content = "INT. ROOM - DAY\n\nA voice answers.\n";
  let etag = '"version-1"';
  let version = 1;
  let writes = 0;
  let loseUploadResponse = false;
  let legacy = false;
  let legacyBound = false;
  let legacyContent = content;
  let handshakeError = false;
  let handshakeCount = 0;
  const sharedCalls: Request[] = [];
  const env: LiveEnvironment = {
    BETA_ORIGIN: "https://beta.fountain-publisher.com",
    SHARED_ORIGIN: "https://fountain-publisher.com",
    API_ORIGIN: "https://api.fountain-publisher.com",
    SHARED_API: {
      fetch: async (input: Request | string, init?: RequestInit) => {
        const request =
          typeof input === "string" ? new Request(input, init) : input;
        sharedCalls.push(request);
        const user =
          request.headers
            .get("cookie")
            ?.match(/fp_google_session=([^;]+)/)?.[1] || "";
        if (!permissions.has(user) || permissions.get(user) === "none")
          return Response.json({}, { status: 401 });
        const url = new URL(request.url);
        if (url.pathname === "/api/google/session")
          return Response.json({
            account: { id: user, name: user.toUpperCase() },
          });
        if (url.pathname === "/api/google/picker/config")
          return Response.json({ accessToken: `token-${user}` });
        if (url.pathname.endsWith("/recovery"))
          return legacyBound
            ? Response.json({
                roomContent: legacyContent,
                driveContent: content,
                file: { id: FILE },
              })
            : Response.json({}, { status: 409 });
        if (url.pathname.startsWith("/api/collaboration/")) {
          handshakeCount++;
          if (handshakeError) return Response.json({}, { status: 409 });
          legacyBound = true;
          return {
            status: 101,
            webSocket: { accept() {}, close() {} },
          } as unknown as Response;
        }
        throw new Error(`Unexpected shared route ${url.pathname}`);
      },
    },
  };
  const network = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const user =
      new Headers(init?.headers)
        .get("authorization")
        ?.replace("Bearer token-", "") || "";
    if (!permissions.has(user) || permissions.get(user) === "none")
      return Response.json({}, { status: 403 });
    if (url.pathname.startsWith("/upload/")) {
      if (permissions.get(user) !== "writer")
        return Response.json({}, { status: 403 });
      if (new Headers(init?.headers).get("if-match") !== etag)
        return Response.json({}, { status: 412 });
      content = String(init?.body);
      etag = `"version-${++version}"`;
      writes++;
      if (loseUploadResponse) {
        loseUploadResponse = false;
        throw new TypeError("Upload response lost after Drive committed");
      }
      return Response.json({ id: FILE, etag });
    }
    if (url.pathname.startsWith("/drive/v2/"))
      return Response.json({ id: FILE, etag });
    if (url.searchParams.get("alt") === "media") return new Response(content);
    return Response.json({
      id: FILE,
      name: "Shared.fountain",
      mimeType: "text/plain",
      capabilities: { canEdit: permissions.get(user) === "writer" },
      ...(legacy
        ? { appProperties: { fountainPublisherDocumentId: originalId } }
        : {}),
    });
  }) as typeof fetch;
  let room = new LiveScreenplayRoom(context, env, { network });
  const request = (
    route: string,
    user = "alice",
    body?: unknown,
    fileId = FILE,
  ) =>
    room.fetch(
      new Request(`https://room.internal/${route}?fileId=${fileId}`, {
        method: ["bootstrap", "checkpoint", "plain-save"].includes(route)
          ? "POST"
          : "GET",
        headers: {
          cookie: `fp_google_session=${user}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      }),
    );
  const connect = (user: string, doc: Y.Doc) => {
    const socket = new Socket();
    socket.serializeAttachment({
      self: {
        id: user,
        name: user.toUpperCase(),
        color: "#3875c7",
        canEdit: permissions.get(user) === "writer",
        clientId: doc.clientID,
        connectionId: `${user}-${doc.clientID}`,
      },
      fileId: FILE,
      cookie: `fp_google_session=${user}`,
      readUntil: 0,
    });
    sockets.push(socket);
    return socket;
  };
  return {
    storage,
    sockets,
    permissions,
    sharedCalls,
    request,
    connect,
    get room() {
      return room;
    },
    restart() {
      room = new LiveScreenplayRoom(context, env, { network });
    },
    get content() {
      return content;
    },
    get etag() {
      return etag;
    },
    get writes() {
      return writes;
    },
    get handshakeCount() {
      return handshakeCount;
    },
    external(value: string) {
      content = value;
      etag = `"version-${++version}"`;
    },
    loseResponse() {
      loseUploadResponse = true;
    },
    legacy(value: string, bound: boolean, error = false) {
      legacy = true;
      legacyContent = value;
      legacyBound = bound;
      handshakeError = error;
    },
  };
}
function client(state: string) {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, decodeBytes(state));
  return doc;
}
function write(doc: Y.Doc, value: string, at = 0): Uint8Array {
  const paragraph = doc
    .getXmlFragment("script")
    .toArray()
    .find(
      (node) =>
        node instanceof Y.XmlElement && node.getAttribute("kind") === "action",
    ) as Y.XmlElement;
  const text = paragraph.toArray()[0] as Y.XmlText;
  const updates: Uint8Array[] = [];
  const updated = (update: Uint8Array) => updates.push(update);
  doc.on("update", updated);
  text.insert(at, value);
  doc.off("update", updated);
  return Y.mergeUpdates(updates);
}
const send = (
  room: LiveScreenplayRoom,
  socket: Socket,
  update: Uint8Array,
  id = 1,
) =>
  room.webSocketMessage(
    socket,
    JSON.stringify({ type: "update", id, update: encodeBytes(update) }),
  );
async function bootstrap(
  f: ReturnType<typeof fixture>,
  user = "alice",
): Promise<Bootstrap> {
  const response = await f.request("bootstrap", user);
  expect(response.status).toBe(200);
  return response.json() as Promise<Bootstrap>;
}
function presence(clientId: number, clock: number, state: unknown) {
  const data = encoding.createEncoder();
  encoding.writeVarUint(data, 1);
  encoding.writeVarUint(data, clientId);
  encoding.writeVarUint(data, clock);
  encoding.writeVarString(data, JSON.stringify(state));
  return JSON.stringify({
    type: "presence",
    awareness: encodeBytes(encoding.toUint8Array(data)),
  });
}

describe("structured live room durability and authorization", () => {
  it("converges concurrent edits, durably restores them, and saves after the last socket leaves", async () => {
    const f = fixture();
    const initial = await bootstrap(f);
    const alice = client(initial.state),
      bob = client(initial.state);
    const a = f.connect("alice", alice),
      b = f.connect("bob", bob);
    const first = write(alice, "Alice. "),
      second = write(bob, "Bob. ");
    await Promise.all([send(f.room, a, first), send(f.room, b, second)]);
    expect(a.messages.some((message) => message.type === "ack")).toBe(true);
    expect(b.messages.some((message) => message.type === "ack")).toBe(true);
    for (const message of a.messages)
      if (message.type === "update")
        Y.applyUpdate(alice, decodeBytes(message.update));
    for (const message of b.messages)
      if (message.type === "update")
        Y.applyUpdate(bob, decodeBytes(message.update));
    expect(readSharedDocument(alice)).toEqual(readSharedDocument(bob));
    f.restart();
    const reopened = await bootstrap(f);
    expect(readSharedDocument(client(reopened.state))).toEqual(
      readSharedDocument(alice),
    );
    a.close();
    b.close();
    await f.room.alarm();
    expect(f.writes).toBe(1);
    const saved = parseFountain(f.content);
    expect(
      saved.blocks.find((block) => block.kind === "action")?.text,
    ).toContain("Alice.");
    expect(
      saved.blocks.find((block) => block.kind === "action")?.text,
    ).toContain("Bob.");
    expect(f.storage.alarmAt).toBeGreaterThan(0);
  });

  it("never ACKs or broadcasts an update whose transactional snapshot failed", async () => {
    const f = fixture();
    const initial = await bootstrap(f);
    const doc = client(initial.state);
    const writer = f.connect("alice", doc);
    const viewer = f.connect("viewer", client(initial.state));
    f.storage.failNextTransaction = true;
    await send(f.room, writer, write(doc, "Unsaved. "));
    expect(writer.messages).toEqual([]);
    expect(writer.closeCode).toBe(4000);
    expect(viewer.messages).toEqual([]);
    f.restart();
    expect((await bootstrap(f)).content).not.toContain("Unsaved.");
    // A reconnect resends the same idempotent delta after storage recovers.
    const recovered = f.connect("alice", doc);
    const missing = Y.encodeStateAsUpdate(doc, decodeBytes(initial.vector));
    await send(f.room, recovered, missing);
    expect(recovered.messages[0].type).toBe("ack");
    expect((await bootstrap(f)).content).toContain("Unsaved.");
  });

  it("denies viewer writes and rechecks a writer's permissions on each update", async () => {
    const f = fixture();
    const initial = await bootstrap(f);
    const doc = client(initial.state),
      viewerDoc = client(initial.state);
    const writer = f.connect("alice", doc),
      viewer = f.connect("viewer", viewerDoc);
    await send(f.room, viewer, write(viewerDoc, "Forbidden viewer edit. "));
    expect(viewer.messages[0]).toMatchObject({
      type: "error",
      code: "LIVE_READ_ONLY",
    });
    expect(viewer.closeCode).toBe(4003);
    await send(f.room, writer, write(doc, "Allowed. "));
    expect(writer.messages[0].type).toBe("ack");
    f.permissions.set("alice", "reader");
    await send(f.room, writer, write(doc, "Forbidden later edit. "), 2);
    expect(writer.messages.at(-1)).toMatchObject({
      type: "error",
      code: "LIVE_READ_ONLY",
    });
    expect((await bootstrap(f, "bob")).content).not.toContain("Forbidden");
    expect((await f.request("checkpoint", "viewer")).status).toBe(403);
  });

  it("does not disclose updates to a reader whose permission lease expired", async () => {
    const f = fixture();
    const initial = await bootstrap(f);
    const doc = client(initial.state);
    const writer = f.connect("alice", doc),
      viewer = f.connect("viewer", client(initial.state));
    f.permissions.set("viewer", "none");
    await send(f.room, writer, write(doc, "Private. "));
    expect(writer.messages[0].type).toBe("ack");
    expect(viewer.messages).toEqual([]);
    expect(viewer.closeCode).toBe(4003);
  });

  it("retains both versions on an external Drive edit instead of overwriting it", async () => {
    const f = fixture();
    const initial = await bootstrap(f);
    const doc = client(initial.state);
    await send(f.room, f.connect("alice", doc), write(doc, "Live room. "));
    f.external("INT. ROOM - DAY\n\nExternal editor.\n");
    const saved = await f.request("checkpoint", "alice", {
      vector: encodeBytes(Y.encodeStateVector(doc)),
    });
    expect(saved.status).toBe(409);
    expect(f.writes).toBe(0);
    expect((await f.request("bootstrap")).status).toBe(409);
    const recovery = (await (await f.request("recovery")).json()) as {
      content: string;
      driveContent: string;
    };
    expect(recovery.content).toContain("Live room.");
    expect(recovery.driveContent).toContain("External editor.");
  });

  it("recovers a committed upload with a lost response and safely checkpoints later edits", async () => {
    const f = fixture();
    const initial = await bootstrap(f);
    const doc = client(initial.state);
    const socket = f.connect("alice", doc);
    await send(f.room, socket, write(doc, "First change. "));
    f.loseResponse();
    expect((await f.request("checkpoint")).status).toBe(503);
    expect(f.writes).toBe(1);
    f.restart();
    await send(f.room, socket, write(doc, "Second change. "), 2);
    const saved = await f.request("checkpoint");
    expect(saved.status).toBe(200);
    expect(f.writes).toBe(2);
    expect(f.content).toContain("First change.");
    expect(f.content).toContain("Second change.");
    expect(
      (await f.storage.get<{ pending: unknown }>("live-meta"))?.pending,
    ).toBeNull();
  });

  it("rejects a checkpoint ahead of durable room state and a mismatched Drive file", async () => {
    const f = fixture();
    const initial = await bootstrap(f);
    const doc = client(initial.state);
    write(doc, "Still offline. ");
    const response = await f.request("checkpoint", "alice", {
      vector: encodeBytes(Y.encodeStateVector(doc)),
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "LIVE_NOT_SYNCED" });
    expect(
      (
        await f.request(
          "recovery",
          "alice",
          undefined,
          "copied_file_1234567890",
        )
      ).status,
    ).toBe(403);
    expect(f.writes).toBe(0);
  });

  it("blocks old plain-text saves that omit acknowledged live edits", async () => {
    const f = fixture();
    const initial = await bootstrap(f);
    const doc = client(initial.state);
    await send(f.room, f.connect("alice", doc), write(doc, "Live edit. "));
    const stale = await f.request("plain-save", "alice", {
      expectedContent: initial.content,
      etag: initial.remote.etag,
    });
    expect(stale.status).toBe(409);
    expect(f.writes).toBe(0);
    const current = await bootstrap(f);
    const exact = await f.request("plain-save", "alice", {
      expectedContent: current.content,
      etag: initial.remote.etag,
    });
    expect(exact.status).toBe(200);
    expect(await exact.json()).toMatchObject({ remote: { live: true } });
    expect(f.content).toContain("Live edit.");
  });

  it("serializes a plain save before a racing room bootstrap without an ownership gap", async () => {
    const f = fixture();
    const text = "INT. ROOM - DAY\n\nSaved before joining.\n";
    const saving = f.request("plain-save", "alice", {
      expectedContent: text,
      etag: f.etag,
    });
    const joining = f.request("bootstrap");
    expect((await saving).status).toBe(200);
    const joined = await joining;
    expect(joined.status).toBe(200);
    expect(((await joined.json()) as Bootstrap).content).toContain(
      "Saved before joining.",
    );
    expect(f.writes).toBe(1);
  });

  it("rejects unsupported shared roots before committing or exposing them", async () => {
    const f = fixture();
    const initial = await bootstrap(f);
    const doc = client(initial.state);
    const socket = f.connect("alice", doc);
    const vector = Y.encodeStateVector(doc);
    doc.getText("foreign-root").insert(0, "Not part of a screenplay");
    await send(f.room, socket, Y.encodeStateAsUpdate(doc, vector));
    expect(socket.messages.map((message) => message.type)).toEqual(["error"]);
    expect((await bootstrap(f)).content).not.toContain(
      "Not part of a screenplay",
    );
  });

  it("binds awareness to its connection and replaces claimed identity with authenticated identity", async () => {
    const f = fixture();
    const initial = await bootstrap(f);
    const doc = client(initial.state);
    const socket = f.connect("alice", doc);
    await f.room.webSocketMessage(
      socket,
      presence(doc.clientID, 1, {
        user: { id: "bob", name: "Admin", token: "secret" },
      }),
    );
    const broadcast = socket.messages[0];
    expect(broadcast.type).toBe("presence");
    const decoded = decoding.createDecoder(decodeBytes(broadcast.awareness));
    expect(decoding.readVarUint(decoded)).toBe(1);
    expect(decoding.readVarUint(decoded)).toBe(doc.clientID);
    decoding.readVarUint(decoded);
    expect(JSON.parse(decoding.readVarString(decoded))).toEqual({
      user: { id: "alice", name: "ALICE", color: expect.stringMatching(/^#/) },
    });
    await f.room.webSocketMessage(socket, presence(doc.clientID + 1, 2, null));
    expect(socket.messages.at(-1)).toMatchObject({
      type: "error",
      code: "LIVE_INVALID_PRESENCE",
    });
    expect(JSON.stringify(socket.messages)).not.toContain("secret");
  });
});

describe("original room preflight", () => {
  it("verifies an uninitialized original room with a no-edit handshake before beta seeding", async () => {
    const f = fixture();
    f.legacy(f.content, false);
    await bootstrap(f);
    expect(f.handshakeCount).toBe(1);
    expect(f.writes).toBe(0);
    const original = f.sharedCalls.filter((request) =>
      request.url.includes("/api/collaboration/"),
    );
    expect(original.map((request) => request.method)).toEqual([
      "GET",
      "GET",
      "GET",
    ]);
    expect(
      original.every(
        (request) =>
          request.headers.get("origin") === "https://fountain-publisher.com",
      ),
    ).toBe(true);
  });

  it("does not seed from stale Drive when original acknowledged room changes differ", async () => {
    const f = fixture();
    f.legacy("INT. ROOM - DAY\n\nOriginal live changes.\n", true);
    const response = await f.request("bootstrap");
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: "LIVE_LEGACY_CONFLICT",
    });
    expect(f.storage.data.size).toBe(0);
    expect(f.writes).toBe(0);
  });

  it("preserves an ambiguous historical room when the verified handshake fails", async () => {
    const f = fixture();
    f.legacy(f.content, false, true);
    expect((await f.request("bootstrap")).status).toBe(409);
    expect(f.storage.data.size).toBe(0);
  });
});
