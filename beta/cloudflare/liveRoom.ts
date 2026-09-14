import * as Y from "yjs";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import { parseFountain, serializeFountain } from "../src/core/fountain";
import {
  createSharedDocument,
  readSharedDocument,
  validateSharedDocument,
} from "../src/collaboration/sharedDocument";
import {
  LiveDrive,
  LiveError,
  MAX_CONTENT_BYTES,
  boundedText,
  contentHash,
  validFileId,
} from "./liveDrive";
import type {
  LiveAuthorization,
  LiveEnvironment,
  LiveIdentity,
} from "./liveDrive";

const MAX_STATE = 8 * 1024 * 1024;
const MAX_FRAME = 12 * 1024 * 1024;
const CHUNK_SIZE = 60 * 1024;
const READ_LEASE = 30_000;
export interface LiveSocket {
  readyState: number;
  send(message: string): void;
  close(code?: number, reason?: string): void;
  serializeAttachment(value: unknown): void;
  deserializeAttachment(): unknown;
}
interface Storage {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<unknown>;
  transaction<T>(operation: (storage: Storage) => Promise<T>): Promise<T>;
  setAlarm(time: number): Promise<void>;
}
export interface LiveRoomContext {
  storage: Storage;
  getWebSockets(): LiveSocket[];
  acceptWebSocket(socket: LiveSocket): void;
}
declare const WebSocketPair: { new (): { 0: LiveSocket; 1: LiveSocket } };
interface RoomMeta {
  version: 1;
  fileId: string;
  name: string;
  webViewLink?: string;
  revision: number;
  savedRevision: number;
  driveHash: string;
  etag: string;
  checkpointCookie?: string;
  pending?: { hash: string; revision: number } | null;
}
interface AwarenessState {
  user: Pick<LiveIdentity, "id" | "name" | "color">;
  cursor?: { anchor: unknown; head: unknown } | null;
}
interface Attachment {
  self: LiveIdentity & { clientId: number; connectionId: string };
  fileId: string;
  cookie: string;
  readUntil: number;
  awareness?: { clock: number; state: AwarenessState | null };
}
function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
function errorValue(error: unknown) {
  return error instanceof LiveError
    ? { code: error.code, message: error.message, status: error.status }
    : {
        code: "LIVE_UNAVAILABLE",
        message:
          "Live editing could not verify or save this change. Your local writing is preserved.",
        status: 503,
      };
}
export function encodeBytes(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(binary);
}
export function decodeBytes(value: unknown, limit = MAX_STATE): Uint8Array {
  if (
    typeof value !== "string" ||
    !value.length ||
    value.length > Math.ceil(limit / 3) * 4 + 4 ||
    !/^[A-Za-z0-9+/_-]*={0,2}$/.test(value)
  )
    throw new LiveError(
      400,
      "LIVE_INVALID_UPDATE",
      "Invalid live document update.",
    );
  let binary: string;
  try {
    binary = atob(value.replaceAll("-", "+").replaceAll("_", "/"));
  } catch {
    throw new LiveError(
      400,
      "LIVE_INVALID_UPDATE",
      "Invalid live document update.",
    );
  }
  if (binary.length > limit)
    throw new LiveError(
      413,
      "LIVE_TOO_LARGE",
      "This update is too large for live editing.",
    );
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
function attachment(socket: LiveSocket): Attachment {
  const value = socket.deserializeAttachment() as Attachment | null;
  if (!value?.self?.id || !value.cookie || !validFileId(value.fileId))
    throw new LiveError(
      401,
      "LIVE_ACCESS",
      "This live connection has expired.",
    );
  return value;
}
function documentContent(document: Y.Doc): string {
  let content: string;
  try {
    validateSharedDocument(document);
    content = serializeFountain(readSharedDocument(document));
  } catch {
    throw new LiveError(
      400,
      "LIVE_INVALID_DOCUMENT",
      "This update contains unsupported screenplay data. Your local writing is preserved.",
    );
  }
  if (new TextEncoder().encode(content).length > MAX_CONTENT_BYTES)
    throw new LiveError(
      413,
      "LIVE_TOO_LARGE",
      "This screenplay is too large for live editing. Save a local copy.",
    );
  return content;
}
function awarenessFrame(
  clientId: number,
  clock: number,
  state: AwarenessState | null,
): string {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, 1);
  encoding.writeVarUint(encoder, clientId);
  encoding.writeVarUint(encoder, clock);
  encoding.writeVarString(encoder, JSON.stringify(state));
  return encodeBytes(encoding.toUint8Array(encoder));
}
function relativePosition(value: unknown): unknown {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    JSON.stringify(value).length > 2048
  )
    throw new LiveError(
      400,
      "LIVE_INVALID_PRESENCE",
      "Invalid collaborator cursor.",
    );
  const raw = value as {
    type?: { client?: number; clock?: number };
    tname?: unknown;
    item?: { client?: number; clock?: number };
    assoc?: unknown;
  };
  for (const position of [raw.type, raw.item]) {
    if (
      position &&
      (!Number.isSafeInteger(position.client) ||
        position.client! < 0 ||
        position.client! > 0xffffffff ||
        !Number.isSafeInteger(position.clock) ||
        position.clock! < 0)
    )
      throw new LiveError(
        400,
        "LIVE_INVALID_PRESENCE",
        "Invalid collaborator cursor.",
      );
  }
  if (
    raw.tname !== undefined &&
    (typeof raw.tname !== "string" || raw.tname.length > 80)
  )
    throw new LiveError(
      400,
      "LIVE_INVALID_PRESENCE",
      "Invalid collaborator cursor.",
    );
  if (
    raw.assoc !== undefined &&
    (!Number.isSafeInteger(raw.assoc) || Math.abs(raw.assoc as number) > 1)
  )
    throw new LiveError(
      400,
      "LIVE_INVALID_PRESENCE",
      "Invalid collaborator cursor.",
    );
  return Y.relativePositionToJSON(Y.createRelativePositionFromJSON(value));
}

/** A separate structured room namespace. No old Y.Text room state is read or rewritten here. */
export class LiveScreenplayRoom {
  private drive: LiveDrive;
  private document: Y.Doc | null = null;
  private meta: RoomMeta | null = null;
  private chunks = 0;
  private queue: Promise<unknown> = Promise.resolve();
  private ready: Promise<void>;

  constructor(
    private context: LiveRoomContext,
    env: LiveEnvironment,
    dependencies: { network?: typeof fetch } = {},
  ) {
    this.drive = new LiveDrive(env, dependencies.network);
    this.ready = this.restore();
  }

  private async restore() {
    const [meta, layout] = await Promise.all([
      this.context.storage.get<RoomMeta>("live-meta"),
      this.context.storage.get<{
        version: number;
        chunks: number;
        size: number;
      }>("live-layout"),
    ]);
    if (!meta && !layout) return;
    if (
      !meta ||
      meta.version !== 1 ||
      !validFileId(meta.fileId) ||
      !layout ||
      layout.version !== 1 ||
      !Number.isSafeInteger(layout.size) ||
      layout.size < 1 ||
      layout.size > MAX_STATE ||
      layout.chunks !== Math.ceil(layout.size / CHUNK_SIZE)
    )
      throw new LiveError(
        503,
        "LIVE_STORAGE",
        "The stored live document could not be verified. Your local writing is preserved.",
      );
    const parts = await Promise.all(
      Array.from({ length: layout.chunks }, (_, index) =>
        this.context.storage.get<Uint8Array>(`live-state-${index}`),
      ),
    );
    const state = new Uint8Array(layout.size);
    parts.forEach((part, index) => {
      if (
        !part ||
        part.byteLength !==
          Math.min(CHUNK_SIZE, layout.size - index * CHUNK_SIZE)
      )
        throw new LiveError(
          503,
          "LIVE_STORAGE",
          "The stored live document is incomplete.",
        );
      state.set(new Uint8Array(part), index * CHUNK_SIZE);
    });
    const document = new Y.Doc();
    try {
      Y.applyUpdate(document, state);
      documentContent(document);
    } catch (error) {
      document.destroy();
      throw error;
    }
    this.document = document;
    this.meta = meta;
    this.chunks = layout.chunks;
  }

  private run<T>(operation: () => Promise<T>): Promise<T> {
    const task = this.queue.then(async () => {
      await this.ready;
      return operation();
    });
    this.queue = task.catch(() => {});
    return task;
  }

  private async persist(document: Y.Doc, meta: RoomMeta) {
    const state = Y.encodeStateAsUpdate(document);
    if (state.byteLength > MAX_STATE)
      throw new LiveError(
        413,
        "LIVE_TOO_LARGE",
        "The live document history is full. Save a new copy to continue.",
      );
    const chunks = Math.ceil(state.length / CHUNK_SIZE);
    await this.context.storage.transaction(async (storage) => {
      for (let index = 0; index < chunks; index++)
        await storage.put(
          `live-state-${index}`,
          state.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE),
        );
      for (let index = chunks; index < this.chunks; index++)
        await storage.delete(`live-state-${index}`);
      await storage.put("live-layout", {
        version: 1,
        chunks,
        size: state.length,
      });
      await storage.put("live-meta", meta);
    });
    this.chunks = chunks;
  }

  private async ensure(auth: LiveAuthorization) {
    if (this.meta && this.meta.fileId !== auth.file.id)
      throw new LiveError(
        403,
        "LIVE_FILE_MISMATCH",
        "This room belongs to another Drive file.",
      );
    const snapshot = await this.drive.snapshot(auth);
    if (this.meta) {
      if (
        snapshot.hash !== this.meta.driveHash &&
        snapshot.hash !== this.meta.pending?.hash
      )
        throw new LiveError(
          409,
          "LIVE_CONFLICT",
          "Drive was changed outside this live room. Preserve both versions before continuing.",
        );
      this.meta = {
        ...this.meta,
        name: auth.file.name,
        webViewLink: auth.file.webViewLink,
        etag: snapshot.etag,
      };
      await this.context.storage.put("live-meta", this.meta);
      return;
    }
    await this.drive.verifyOriginalRoom(auth, snapshot.content);
    const document = createSharedDocument(parseFountain(snapshot.content));
    try {
      documentContent(document);
      const meta: RoomMeta = {
        version: 1,
        fileId: auth.file.id,
        name: auth.file.name,
        webViewLink: auth.file.webViewLink,
        revision: 0,
        savedRevision: 0,
        driveHash: snapshot.hash,
        etag: snapshot.etag,
      };
      await this.persist(document, meta);
      this.document = document;
      this.meta = meta;
    } catch (error) {
      document.destroy();
      throw error;
    }
  }

  fetch(request: Request): Promise<Response> {
    return this.run(() => this.handleRequest(request)).catch((error) => {
      const value = errorValue(error);
      return json({ error: value.message, code: value.code }, value.status);
    });
  }

  private async handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const fileId = url.searchParams.get("fileId");
    if (!validFileId(fileId))
      throw new LiveError(
        400,
        "LIVE_INVALID_FILE",
        "Choose a valid Drive screenplay.",
      );
    if (this.meta && this.meta.fileId !== fileId)
      throw new LiveError(
        403,
        "LIVE_FILE_MISMATCH",
        "This room belongs to another Drive file.",
      );
    let auth = await this.drive.authorize(
      fileId,
      request.headers.get("cookie") || "",
    );
    const authorizedAt = Date.now();
    if (url.pathname === "/plain-save" && request.method === "POST") {
      let input: { expectedContent?: unknown; etag?: unknown };
      try {
        input = JSON.parse(
          await boundedText(
            new Response(request.body),
            MAX_CONTENT_BYTES + 65536,
          ),
        );
      } catch (error) {
        if (error instanceof LiveError) throw error;
        throw new LiveError(
          400,
          "LIVE_INVALID_DOCUMENT",
          "Invalid screenplay save request.",
        );
      }
      if (
        !input ||
        typeof input !== "object" ||
        typeof input.expectedContent !== "string" ||
        input.expectedContent.includes("\0") ||
        new TextEncoder().encode(input.expectedContent).length >
          MAX_CONTENT_BYTES ||
        typeof input.etag !== "string"
      )
        throw new LiveError(
          400,
          "LIVE_INVALID_DOCUMENT",
          "Invalid screenplay save request.",
        );
      if (!auth.self.canEdit)
        throw new LiveError(
          403,
          "LIVE_READ_ONLY",
          "You have view access to this screenplay.",
        );
      if (this.document && this.meta) {
        if (input.expectedContent !== documentContent(this.document))
          throw new LiveError(
            409,
            "LIVE_NOT_SYNCED",
            "The live screenplay has newer changes. Open the live document before saving this copy.",
          );
        return json(await this.checkpoint(auth));
      }
      // Keep the upload in this queue: an outside 'is live?' probe could race a bootstrap.
      const snapshot = await this.drive.snapshot(auth);
      if (input.etag !== snapshot.etag)
        throw new LiveError(
          409,
          "LIVE_CONFLICT",
          "This file changed on Drive. Preserve your local draft before opening its latest version.",
        );
      await this.drive.verifyOriginalRoom(auth, snapshot.content);
      const etag = await this.drive.save(
        auth,
        input.expectedContent,
        snapshot.etag,
      );
      return json({
        name: auth.file.name,
        content: input.expectedContent,
        remote: {
          provider: "google",
          id: fileId,
          etag,
          ...(auth.file.webViewLink
            ? { webViewLink: auth.file.webViewLink }
            : {}),
        },
      });
    }
    if (url.pathname === "/recovery" && request.method === "GET") {
      if (!this.document || !this.meta)
        throw new LiveError(
          404,
          "LIVE_NOT_FOUND",
          "This file does not have a live session yet.",
        );
      const snapshot = await this.drive.snapshot(auth);
      return json({
        content: documentContent(this.document),
        driveContent: snapshot.content,
        name: auth.file.name,
      });
    }
    if (url.pathname === "/checkpoint" && request.method === "POST") {
      if (!this.document || !this.meta)
        throw new LiveError(
          409,
          "LIVE_NOT_READY",
          "Open the live document before saving.",
        );
      const raw = await boundedText(new Response(request.body), 128 * 1024);
      let body: { vector?: unknown } = {};
      try {
        if (raw) body = JSON.parse(raw);
      } catch {
        throw new LiveError(
          400,
          "LIVE_INVALID_UPDATE",
          "Invalid save request.",
        );
      }
      if (!body || typeof body !== "object" || Array.isArray(body))
        throw new LiveError(
          400,
          "LIVE_INVALID_UPDATE",
          "Invalid save request.",
        );
      if (body.vector !== undefined) {
        const vector = Y.decodeStateVector(decodeBytes(body.vector, 64 * 1024));
        const server = Y.decodeStateVector(Y.encodeStateVector(this.document));
        for (const [client, clock] of vector)
          if ((server.get(client) ?? 0) < clock)
            throw new LiveError(
              409,
              "LIVE_NOT_SYNCED",
              "Wait for your changes to synchronize before saving.",
            );
      }
      return json(await this.checkpoint(auth));
    }
    if (
      !(url.pathname === "/bootstrap" && request.method === "POST") &&
      !(
        url.pathname === "/connect" &&
        request.headers.get("upgrade")?.toLowerCase() === "websocket"
      )
    )
      throw new LiveError(
        404,
        "LIVE_NOT_FOUND",
        "This live endpoint does not exist.",
      );
    await this.ensure(auth);
    if (Date.now() - authorizedAt >= READ_LEASE)
      auth = await this.drive.authorize(fileId, auth.cookie);
    if (url.pathname === "/bootstrap")
      return json({
        state: encodeBytes(Y.encodeStateAsUpdate(this.document!)),
        vector: encodeBytes(Y.encodeStateVector(this.document!)),
        content: documentContent(this.document!),
        name: this.meta!.name,
        remote: this.remote(),
        self: auth.self,
        revision: this.meta!.revision,
        savedRevision: this.meta!.savedRevision,
      });
    const clientId = Number(url.searchParams.get("clientId"));
    if (
      !url.searchParams.has("clientId") ||
      !Number.isSafeInteger(clientId) ||
      clientId < 0 ||
      clientId > 0xffffffff
    )
      throw new LiveError(
        400,
        "LIVE_INVALID_PRESENCE",
        "A valid live client identity is required.",
      );
    const sockets = this.context
      .getWebSockets()
      .filter((socket) => socket.readyState === 1);
    if (sockets.length >= 100)
      throw new LiveError(
        503,
        "LIVE_FULL",
        "This screenplay has reached its live collaborator limit.",
      );
    for (const socket of sockets) {
      const other = attachment(socket);
      if (other.self.clientId !== clientId) continue;
      if (other.self.id !== auth.self.id || other.cookie !== auth.cookie)
        throw new LiveError(
          409,
          "LIVE_CLIENT_CONFLICT",
          "This live client identity is already connected.",
        );
      socket.close(4001, "Reconnected in a newer socket");
    }
    const pair = new WebSocketPair();
    const socket = pair[1];
    const identity: Attachment = {
      self: { ...auth.self, clientId, connectionId: crypto.randomUUID() },
      fileId,
      cookie: auth.cookie,
      readUntil: Date.now() + READ_LEASE,
    };
    socket.serializeAttachment(identity);
    this.context.acceptWebSocket(socket);
    socket.send(
      JSON.stringify({
        type: "sync",
        state: encodeBytes(Y.encodeStateAsUpdate(this.document!)),
        vector: encodeBytes(Y.encodeStateVector(this.document!)),
        self: identity.self,
        revision: this.meta!.revision,
        savedRevision: this.meta!.savedRevision,
      }),
    );
    for (const other of sockets) {
      if (other.readyState !== 1) continue;
      try {
        const peer = await this.authorizeSocket(other);
        if (peer.awareness)
          socket.send(
            JSON.stringify({
              type: "presence",
              awareness: awarenessFrame(
                peer.self.clientId,
                peer.awareness.clock,
                peer.awareness.state,
              ),
            }),
          );
      } catch {
        other.close(4003, "Drive access changed");
      }
    }
    return new Response(null, {
      status: 101,
      webSocket: pair[0],
    } as ResponseInit);
  }

  private remote() {
    return {
      provider: "google",
      id: this.meta!.fileId,
      etag: this.meta!.etag,
      live: true,
      ...(this.meta!.webViewLink
        ? { webViewLink: this.meta!.webViewLink }
        : {}),
    };
  }

  private async authorizeSocket(
    socket: LiveSocket,
    force = false,
  ): Promise<Attachment> {
    const identity = attachment(socket);
    if (identity.fileId !== this.meta?.fileId)
      throw new LiveError(
        403,
        "LIVE_FILE_MISMATCH",
        "The live room belongs to another Drive file.",
      );
    if (!force && identity.readUntil > Date.now()) return identity;
    const auth = await this.drive.authorize(identity.fileId, identity.cookie);
    if (auth.self.id !== identity.self.id)
      throw new LiveError(
        401,
        "LIVE_ACCESS",
        "The signed-in Google account changed.",
      );
    identity.self = { ...identity.self, ...auth.self };
    identity.readUntil = Date.now() + READ_LEASE;
    socket.serializeAttachment(identity);
    return identity;
  }

  webSocketMessage(
    socket: LiveSocket,
    message: string | ArrayBuffer,
  ): Promise<void> {
    return this.run(() => this.receive(socket, message)).catch((error) => {
      const value = errorValue(error);
      if (value.status < 500) {
        try {
          socket.send(
            JSON.stringify({
              type: "error",
              code: value.code,
              message: value.message,
            }),
          );
        } catch {
          /* disconnected */
        }
      }
      socket.close(
        [401, 403, 404].includes(value.status) ? 4003 : 4000,
        "Live change was not acknowledged",
      );
    });
  }

  private async receive(socket: LiveSocket, message: string | ArrayBuffer) {
    if (typeof message !== "string" || message.length > MAX_FRAME)
      throw new LiveError(
        413,
        "LIVE_TOO_LARGE",
        "The live update is too large. Save a local copy.",
      );
    let input: {
      type?: unknown;
      id?: unknown;
      update?: unknown;
      awareness?: unknown;
    };
    try {
      input = JSON.parse(message);
    } catch {
      throw new LiveError(400, "LIVE_INVALID_UPDATE", "Invalid live message.");
    }
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new LiveError(400, "LIVE_INVALID_UPDATE", "Invalid live message.");
    const identity = await this.authorizeSocket(
      socket,
      input.type === "update",
    );
    if (!this.document || !this.meta)
      throw new LiveError(
        409,
        "LIVE_NOT_READY",
        "The live room is not initialized.",
      );
    if (input.type === "presence") {
      const decoder = decoding.createDecoder(
        decodeBytes(input.awareness, 16 * 1024),
      );
      if (decoding.readVarUint(decoder) !== 1)
        throw new LiveError(
          400,
          "LIVE_INVALID_PRESENCE",
          "Only your own cursor can be updated.",
        );
      const clientId = decoding.readVarUint(decoder);
      const clock = decoding.readVarUint(decoder);
      const state = JSON.parse(decoding.readVarString(decoder)) as {
        cursor?: { anchor?: unknown; head?: unknown } | null;
      } | null;
      if (
        clientId !== identity.self.clientId ||
        !Number.isSafeInteger(clock) ||
        clock < 0 ||
        decoding.hasContent(decoder)
      )
        throw new LiveError(
          400,
          "LIVE_INVALID_PRESENCE",
          "Only your own cursor can be updated.",
        );
      if (identity.awareness && clock <= identity.awareness.clock) return;
      if (
        state !== null &&
        (!state || typeof state !== "object" || Array.isArray(state))
      )
        throw new LiveError(
          400,
          "LIVE_INVALID_PRESENCE",
          "Invalid collaborator presence.",
        );
      const safe: AwarenessState | null =
        state === null
          ? null
          : {
              user: {
                id: identity.self.id,
                name: identity.self.name,
                color: identity.self.color,
              },
            };
      if (safe && state?.cursor)
        safe.cursor = {
          anchor: relativePosition(state.cursor.anchor),
          head: relativePosition(state.cursor.head),
        };
      identity.awareness = { clock, state: safe };
      socket.serializeAttachment(identity);
      await this.broadcast({
        type: "presence",
        awareness: awarenessFrame(clientId, clock, safe),
      });
      return;
    }
    if (
      input.type !== "update" ||
      !Number.isSafeInteger(input.id) ||
      (input.id as number) < 1
    )
      throw new LiveError(
        400,
        "LIVE_INVALID_UPDATE",
        "Invalid live update identifier.",
      );
    if (!identity.self.canEdit)
      throw new LiveError(
        403,
        "LIVE_READ_ONLY",
        "You have view access to this live screenplay.",
      );
    const update = decodeBytes(input.update);
    const candidate = new Y.Doc();
    try {
      Y.applyUpdate(candidate, Y.encodeStateAsUpdate(this.document));
      try {
        Y.applyUpdate(candidate, update);
      } catch {
        throw new LiveError(
          400,
          "LIVE_INVALID_UPDATE",
          "This live update is invalid. Your local writing is preserved.",
        );
      }
      documentContent(candidate);
      const next: RoomMeta = {
        ...this.meta,
        revision: this.meta.revision + 1,
        checkpointCookie: identity.cookie,
      };
      await this.context.storage.setAlarm(Date.now() + 2000);
      await this.persist(candidate, next);
      this.document.destroy();
      this.document = candidate;
      this.meta = next;
    } catch (error) {
      candidate.destroy();
      throw error;
    }
    socket.send(
      JSON.stringify({
        type: "ack",
        id: input.id,
        vector: encodeBytes(Y.encodeStateVector(this.document)),
        revision: this.meta.revision,
      }),
    );
    await this.broadcast(
      { type: "update", update: input.update, revision: this.meta.revision },
      socket,
    );
  }

  private async checkpoint(auth: LiveAuthorization) {
    if (!auth.self.canEdit)
      throw new LiveError(
        403,
        "LIVE_READ_ONLY",
        "You have view access to this live screenplay.",
      );
    if (!this.document || !this.meta || auth.file.id !== this.meta.fileId)
      throw new LiveError(
        403,
        "LIVE_FILE_MISMATCH",
        "The live room belongs to another Drive file.",
      );
    const content = documentContent(this.document);
    const snapshot = await this.drive.snapshot(auth);
    const hash = await contentHash(content);
    if (
      snapshot.hash !== this.meta.driveHash &&
      snapshot.hash !== this.meta.pending?.hash
    )
      throw new LiveError(
        409,
        "LIVE_CONFLICT",
        "Google Drive changed outside this live session. Preserve both versions before continuing.",
      );
    let etag = snapshot.etag;
    if (snapshot.hash !== hash) {
      const intent: RoomMeta = {
        ...this.meta,
        driveHash: snapshot.hash,
        etag,
        savedRevision:
          snapshot.hash === this.meta.pending?.hash
            ? this.meta.pending.revision
            : this.meta.savedRevision,
        pending: { hash, revision: this.meta.revision },
        checkpointCookie: auth.cookie,
      };
      await this.context.storage.put("live-meta", intent);
      this.meta = intent;
      etag = await this.drive.save(auth, content, etag);
    }
    const saved: RoomMeta = {
      ...this.meta,
      driveHash: hash,
      savedRevision: this.meta.revision,
      etag,
      name: auth.file.name,
      webViewLink: auth.file.webViewLink,
      pending: null,
    };
    await this.context.storage.put("live-meta", saved);
    this.meta = saved;
    await this.broadcast({
      type: "saved",
      etag,
      revision: saved.savedRevision,
    });
    return {
      content,
      name: saved.name,
      remote: this.remote(),
      etag,
      revision: saved.savedRevision,
      saved: true,
    };
  }

  alarm(): Promise<void> {
    return this.run(async () => {
      if (
        !this.meta?.checkpointCookie ||
        this.meta.savedRevision >= this.meta.revision
      )
        return;
      try {
        const auth = await this.drive.authorize(
          this.meta.fileId,
          this.meta.checkpointCookie,
        );
        await this.checkpoint(auth);
      } catch (error) {
        const value = errorValue(error);
        await this.broadcast({
          type: "error",
          code: value.code,
          message: value.message,
        });
        // Durable alarms retry transient failures, including a lost upload response.
        if (![400, 401, 403, 404, 409, 413].includes(value.status)) throw error;
      }
    });
  }

  webSocketClose(socket: LiveSocket): Promise<void> {
    return this.run(async () => {
      const identity = attachment(socket);
      if (
        this.context
          .getWebSockets()
          .some(
            (other) =>
              other !== socket &&
              other.readyState === 1 &&
              attachment(other).self.clientId === identity.self.clientId,
          )
      )
        return;
      if (identity.awareness)
        await this.broadcast(
          {
            type: "presence",
            awareness: awarenessFrame(
              identity.self.clientId,
              identity.awareness.clock + 1,
              null,
            ),
          },
          socket,
        );
    }).catch(() => {});
  }

  webSocketError(socket: LiveSocket): Promise<void> {
    return this.webSocketClose(socket);
  }

  private async broadcast(payload: unknown, except?: LiveSocket) {
    const message = JSON.stringify(payload);
    for (const socket of this.context.getWebSockets()) {
      if (socket === except || socket.readyState !== 1) continue;
      try {
        await this.authorizeSocket(socket);
        socket.send(message);
      } catch {
        socket.close(4003, "Drive access changed");
      }
    }
  }
}
