import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
} from "y-protocols/awareness";
import { createHash, webcrypto } from "node:crypto";
import { LiveClient } from "../src/collaboration/LiveClient";
import type { LiveStatus } from "../src/collaboration/LiveClient";
import { loadLiveCache, saveLiveCache } from "../src/collaboration/cache";
import { serializeDocument } from "../src/core/documentFormat";
import { decodeBytes, encodeBytes } from "../src/collaboration/encoding";
import { EditorController } from "../src/editor/EditorController";
import { DocumentSession } from "../src/core/session";
import { emptyScreenplay } from "../src/core/model";
import {
  createSharedDocument,
  readSharedDocument,
  replaceSharedDocument,
} from "../src/collaboration/sharedDocument";
vi.mock("../src/collaboration/cache", () => ({
  loadLiveCache: vi.fn(async () => undefined),
  saveLiveCache: vi.fn(async () => {}),
}));
vi.mock("../src/storage/cloud", () => ({
  apiBase: "/api",
  cloud: { liveCheckpoint: vi.fn(async () => ({ etag: "saved" })) },
}));
class Socket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 3;
  static instances: Socket[] = [];
  readyState = 0;
  sent: Record<string, unknown>[] = [];
  onmessage?: (event: { data: string }) => void;
  onclose?: (event: { code: number; reason: string }) => void;
  onerror?: () => void;
  constructor(readonly url: string) {
    Socket.instances.push(this);
  }
  send(data: string) {
    if (this.readyState !== 1) throw new Error("closed");
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.readyState = 3;
    this.onclose?.({ code: 1000, reason: "" });
  }
  message(data: Record<string, unknown>) {
    this.readyState = 1;
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}
const clients: LiveClient[] = [],
  docs: Y.Doc[] = [];
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", Socket);
  vi.stubGlobal("crypto", webcrypto);
  Socket.instances = [];
  vi.mocked(saveLiveCache).mockReset().mockResolvedValue();
  vi.mocked(loadLiveCache).mockReset().mockResolvedValue(undefined);
});
afterEach(async () => {
  for (const client of clients.splice(0)) {
    const stopped = client.stop();
    await vi.advanceTimersByTimeAsync(2100);
    await stopped;
    client.destroy();
  }
  for (const doc of docs.splice(0)) doc.destroy();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const settle = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
function fixture(initial?: Y.Doc) {
  const server = initial ?? new Y.Doc();
  if (!initial) server.getText("body").insert(0, "Opening.");
  docs.push(server);
  const client = new LiveClient({
    fileId: "drive-file",
    name: "Draft.fountain",
    self: { id: "account-a", name: "A", color: "#3377bb", canEdit: true },
    state: Y.encodeStateAsUpdate(server),
  });
  clients.push(client);
  const statuses: LiveStatus[] = [];
  client.onStatus = (status) => statuses.push(status);
  client.start();
  const socket = Socket.instances.at(-1)!;
  const sync = (target = socket, id = "account-a", canEdit = true) =>
    target.message({
      type: "sync",
      self: { id, name: "Writer", color: "#3377bb", canEdit },
      state: encodeBytes(Y.encodeStateAsUpdate(server)),
      vector: encodeBytes(Y.encodeStateVector(server)),
    });
  return { server, client, socket, statuses, sync };
}
describe("live client durable synchronization", () => {
  it("keeps a connected writer's last inline position through focus loss and clears it on close", async () => {
    const { client, socket, sync } = fixture();
    sync();
    const cursor = {
      anchor: Y.relativePositionToJSON(
        Y.createRelativePositionFromTypeIndex(client.doc.getText("body"), 1),
      ),
      head: Y.relativePositionToJSON(
        Y.createRelativePositionFromTypeIndex(client.doc.getText("body"), 3),
      ),
    };
    client.awareness.setLocalStateField("cursor", cursor);
    client.awareness.setLocalStateField("cursor", null);
    await vi.advanceTimersByTimeAsync(60);
    const peerDoc = new Y.Doc();
    docs.push(peerDoc);
    const awareness = new Awareness(peerDoc);
    awareness.setLocalState(null);
    try {
      const last = () =>
        socket.sent.filter((message) => message.type === "presence").at(-1)!;
      applyAwarenessUpdate(
        awareness,
        decodeBytes(last().awareness as string),
        "server",
      );
      expect(awareness.getStates().get(client.doc.clientID)?.cursor).toEqual(
        cursor,
      );
      const stopped = client.stop();
      await vi.advanceTimersByTimeAsync(2100);
      await stopped;
      applyAwarenessUpdate(
        awareness,
        decodeBytes(last().awareness as string),
        "server",
      );
      expect(awareness.getStates().has(client.doc.clientID)).toBe(false);
    } finally {
      awareness.destroy();
    }
  });
  it("shows another session on the same account with its cursor position and authenticated viewing role", () => {
    const { socket, statuses, sync } = fixture();
    sync();
    const peer = new Y.Doc();
    docs.push(peer);
    const awareness = new Awareness(peer);
    try {
      const sendPresence = () =>
        socket.message({
          type: "presence",
          awareness: encodeBytes(
            encodeAwarenessUpdate(awareness, [peer.clientID]),
          ),
        });
      awareness.setLocalState({
        user: {
          id: "account-a",
          name: "Alex Writer",
          color: "#39765e",
          canEdit: true,
        },
        cursor: { anchor: {}, head: {} },
      });
      sendPresence();
      expect(statuses.at(-1)?.members).toEqual([
        {
          id: "account-a",
          clientId: peer.clientID,
          name: "Alex Writer",
          color: "#39765e",
          editing: true,
          canEdit: true,
        },
      ]);
      awareness.setLocalState({
        user: {
          id: "account-a",
          name: "Alex Writer",
          color: "#39765e",
          canEdit: false,
        },
        cursor: { anchor: {}, head: {} },
      });
      sendPresence();
      expect(statuses.at(-1)?.members[0]).toMatchObject({
        editing: false,
        canEdit: false,
      });
      awareness.setLocalState(null);
      sendPresence();
      expect(statuses.at(-1)?.members).toEqual([]);
    } finally {
      awareness.destroy();
    }
  });
  it.each([false, true])(
    "verifies the old cached draft before adopting refreshed cloud content (unsaved=%s)",
    async (unsaved) => {
      const screenplay = emptyScreenplay();
      screenplay.blocks[0].text = "Previously saved cloud text.";
      const old = createSharedDocument(screenplay);
      docs.push(old);
      const previousHash = createHash("sha256")
        .update(serializeDocument(readSharedDocument(old)))
        .digest("hex");
      const cached = new Y.Doc();
      docs.push(cached);
      Y.applyUpdate(cached, Y.encodeStateAsUpdate(old));
      if (unsaved) {
        const edited = readSharedDocument(cached);
        edited.blocks[0].text = "Unsaved device writing.";
        replaceSharedDocument(cached, edited);
      }
      vi.mocked(loadLiveCache).mockResolvedValue({
        fileId: "library_refreshed-file",
        accountId: "account-a",
        name: "Draft.fountain",
        canEdit: true,
        state: Y.encodeStateAsUpdate(cached),
      });
      const refreshed = readSharedDocument(old);
      refreshed.blocks[0].text = "New cloud text.";
      replaceSharedDocument(old, refreshed);
      const prepared = LiveClient.prepare({
        name: "Draft.fountain",
        content: serializeDocument(refreshed),
        state: encodeBytes(Y.encodeStateAsUpdate(old)),
        vector: encodeBytes(Y.encodeStateVector(old)),
        remote: {
          provider: "google",
          id: "library_refreshed-file",
          etag: "2",
          live: true,
        },
        self: { id: "account-a", name: "A", color: "#3377bb", canEdit: true },
        refresh: { version: "cloud-refresh-1", previousHash },
      });
      if (unsaved) {
        await expect(prepared).rejects.toThrow(
          "save a copy to preserve both versions",
        );
        expect(saveLiveCache).not.toHaveBeenCalled();
        expect(readSharedDocument(cached).blocks[0].text).toBe(
          "Unsaved device writing.",
        );
      } else {
        const restored = await prepared;
        clients.push(restored);
        expect(readSharedDocument(restored.doc).blocks[0].text).toBe(
          "New cloud text.",
        );
        expect(vi.mocked(saveLiveCache).mock.calls.at(-1)![0].roomVersion).toBe(
          "cloud-refresh-1",
        );
      }
    },
  );
  it("resumes the same CRDT and undo history when writing aborts an awaited document switch", async () => {
    Range.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 10, 20);
    Range.prototype.getClientRects = () =>
      [new DOMRect(0, 0, 10, 20)] as unknown as DOMRectList;
    HTMLElement.prototype.scrollIntoView = () => {};
    window.scrollBy = () => {};
    const screenplay = emptyScreenplay();
    screenplay.blocks[0].text = "Opening.";
    const { client, server, sync } = fixture(createSharedDocument(screenplay));
    sync();
    await settle();
    const host = document.createElement("div");
    document.body.append(host);
    let finishSave!: () => void;
    const saveGate = new Promise<void>((resolve) => {
      finishSave = resolve;
    });
    const repository = {
      save: vi.fn(async (data) => {
        await saveGate;
        return { ...data, revision: 1, createdAt: 0, updatedAt: 0 };
      }),
      writeRecovery: vi.fn(),
      setActiveId: vi.fn(),
    };
    const session = new DocumentSession(
      { id: "active", name: "Shared.fountain", screenplay, epoch: 0 },
      repository,
    );
    const editor = new EditorController(host, screenplay, {
      onChange: () => session.markChanged(),
    });
    session.editor = editor;
    editor.attachCollaboration({
      doc: client.doc,
      awareness: client.awareness,
      canEdit: true,
    });
    session.onBeforeOpen = () => client.stop();
    session.onOpenAborted = () => client.resume();
    const completed = vi.fn();
    session.onOpenComplete = completed;
    const documentIdentity = client.doc,
      element = editor.view.dom;
    try {
      const opening = session.open(emptyScreenplay(), "Other.fountain");
      const rejected = expect(opening).rejects.toThrow("changed");
      await settle();
      await vi.advanceTimersByTimeAsync(1);
      expect(repository.save).toHaveBeenCalled();
      // The transport is stopped and device snapshot is awaiting storage, while
      // the original native editor remains available and owns its Yjs history.
      editor.view.dispatch(editor.view.state.tr.insertText("Keep writing. "));
      finishSave();
      await rejected;
      expect(completed).not.toHaveBeenCalled();
      expect(editor.isCollaborating).toBe(true);
      expect(client.doc).toBe(documentIdentity);
      expect(editor.view.dom).toBe(element);
      expect(session.current.name).toBe("Shared.fountain");
      const resumed = Socket.instances.at(-1)!;
      sync(resumed);
      await settle();
      await vi.advanceTimersByTimeAsync(40);
      const update = resumed.sent.find((message) => message.type === "update")!;
      Y.applyUpdate(server, decodeBytes(update.update as string));
      resumed.message({ type: "ack", id: update.id });
      expect(readSharedDocument(server).blocks[0].text).toBe(
        "Keep writing. Opening.",
      );
      expect(editor.undo()).toBe(true);
      await vi.advanceTimersByTimeAsync(40);
      for (const message of resumed.sent.filter(
        (message) => message.type === "update",
      ))
        Y.applyUpdate(server, decodeBytes(message.update as string));
      expect(readSharedDocument(server).blocks[0].text).toBe("Opening.");
    } finally {
      finishSave();
      session.dispose();
      editor.destroy();
      host.remove();
    }
  });

  it("flushes immediately on stop and waits for the server ACK before closing", async () => {
    const { client, server, socket, sync } = fixture();
    sync();
    await settle();
    client.doc.getText("body").insert(0, "Last words ");
    const stopped = client.stop();
    await settle();
    await vi.advanceTimersByTimeAsync(1);
    const update = socket.sent.find((message) => message.type === "update")!;
    expect(update).toBeTruthy();
    expect(socket.readyState).toBe(Socket.OPEN);
    Y.applyUpdate(server, decodeBytes(update.update as string));
    socket.message({ type: "ack", id: update.id });
    await vi.advanceTimersByTimeAsync(25);
    await stopped;
    expect(socket.readyState).toBe(Socket.CLOSED);
    expect(server.getText("body").toString()).toBe("Last words Opening.");
  });

  it("remains subscribed after a failed stop and retries durability on the next stop", async () => {
    const { client, socket, sync } = fixture();
    sync();
    await settle();
    vi.mocked(saveLiveCache).mockRejectedValueOnce(new Error("Storage busy"));
    await expect(client.stop()).rejects.toThrow("Storage busy");
    expect(socket.readyState).toBe(Socket.OPEN);
    client.doc.getText("body").insert(0, "Still writing ");
    await settle();
    await vi.advanceTimersByTimeAsync(40);
    expect(socket.sent.some((message) => message.type === "update")).toBe(true);
    const stopped = client.stop();
    await vi.advanceTimersByTimeAsync(2100);
    await stopped;
    const persisted = vi.mocked(saveLiveCache).mock.calls.at(-1)![0];
    const restored = new Y.Doc();
    docs.push(restored);
    Y.applyUpdate(restored, persisted.state);
    expect(restored.getText("body").toString()).toBe("Still writing Opening.");
  });

  it("captures writing during stop and bounds an unacknowledged online close", async () => {
    const { client, socket, sync, server } = fixture();
    sync();
    await settle();
    client.doc.getText("body").insert(0, "First ");
    const stopped = client.stop();
    await vi.advanceTimersByTimeAsync(1);
    client.doc.getText("body").insert(6, "Last ");
    await vi.advanceTimersByTimeAsync(2050);
    await stopped;
    expect(socket.readyState).toBe(Socket.CLOSED);
    const recovered = new Y.Doc();
    docs.push(recovered);
    Y.applyUpdate(recovered, Y.encodeStateAsUpdate(server));
    for (const [saved] of vi.mocked(saveLiveCache).mock.calls)
      Y.applyUpdate(recovered, saved.state);
    expect(recovered.getText("body").toString()).toBe("First Last Opening.");
  });

  it("persists local updates before sending and survives reconnect before acknowledgement", async () => {
    const { client, server, socket, sync } = fixture();
    sync();
    await settle();
    client.doc.getText("body").insert(0, "Local ");
    await vi.advanceTimersByTimeAsync(40);
    const update = socket.sent.find((message) => message.type === "update")!;
    expect(update).toBeTruthy();
    expect(saveLiveCache).toHaveBeenCalled();
    socket.close();
    await vi.advanceTimersByTimeAsync(800);
    const replacement = Socket.instances.at(-1)!;
    expect(replacement).not.toBe(socket);
    sync(replacement);
    await settle();
    await vi.advanceTimersByTimeAsync(40);
    const replay = replacement.sent.find(
      (message) => message.type === "update",
    )!;
    Y.applyUpdate(server, decodeBytes(replay.update as string));
    expect(server.getText("body").toString()).toBe("Local Opening.");
    replacement.message({ type: "ack", id: replay.id });
    await settle();
  });

  it("keeps failed storage updates in the next successful durable append", async () => {
    const { client, socket, sync, server } = fixture();
    sync();
    await settle();
    vi.mocked(saveLiveCache).mockRejectedValueOnce(new Error("Storage busy"));
    client.doc.getText("body").insert(0, "First ");
    await settle();
    await vi.advanceTimersByTimeAsync(40);
    expect(
      socket.sent.filter((message) => message.type === "update"),
    ).toHaveLength(0);
    client.doc.getText("body").insert(6, "Second ");
    await settle();
    await vi.advanceTimersByTimeAsync(80);
    const saved = vi.mocked(saveLiveCache).mock.calls.at(-1)![0];
    const recovered = new Y.Doc();
    docs.push(recovered);
    Y.applyUpdate(recovered, Y.encodeStateAsUpdate(server));
    Y.applyUpdate(recovered, saved.state);
    expect(recovered.getText("body").toString()).toBe("First Second Opening.");
    const sent = socket.sent.filter((message) => message.type === "update");
    expect(sent.length).toBeGreaterThan(0);
    for (const message of sent)
      Y.applyUpdate(server, decodeBytes(message.update as string));
    expect(server.getText("body").toString()).toBe("First Second Opening.");
  });

  it("never applies or sends cached writing to a different signed-in Google account", async () => {
    const { client, socket, statuses, sync } = fixture();
    client.doc.getText("body").insert(0, "Private ");
    const permission = vi.fn();
    client.onPermission = permission;
    sync(socket, "account-b");
    await settle();
    await vi.advanceTimersByTimeAsync(5000);
    expect(permission).toHaveBeenCalledWith(false);
    expect(
      socket.sent.filter((message) => message.type === "update"),
    ).toHaveLength(0);
    expect(statuses.at(-1)).toMatchObject({
      phase: "paused",
      canEdit: false,
      message: expect.stringContaining("different Google account"),
    });
    expect(client.accountId).toBe("account-a");
    expect(client.doc.getText("body").toString()).toBe("Private Opening.");
    expect(Socket.instances).toHaveLength(1);
  });

  it("defers incoming changes until composition ends without delaying local composition updates", async () => {
    const { client, server, socket, sync } = fixture();
    sync();
    await settle();
    let composing = true;
    client.isComposing = () => composing;
    server.getText("body").insert(8, " Remote.");
    socket.message({
      type: "update",
      update: encodeBytes(Y.encodeStateAsUpdate(server)),
    });
    client.doc.getText("body").insert(0, "東京 ");
    await vi.advanceTimersByTimeAsync(60);
    expect(client.doc.getText("body").toString()).toBe("東京 Opening.");
    expect(socket.sent.some((message) => message.type === "update")).toBe(true);
    composing = false;
    await vi.advanceTimersByTimeAsync(35);
    expect(client.doc.getText("body").toString()).toBe("東京 Opening. Remote.");
  });

  it("rechecks permissions after pending persistence and remains paused after revocation", async () => {
    const { client, socket, statuses, sync } = fixture();
    sync();
    await settle();
    let finish!: () => void;
    vi.mocked(saveLiveCache).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    client.doc.getText("body").insert(0, "Unsent ");
    await settle();
    await vi.advanceTimersByTimeAsync(40);
    socket.onclose?.({ code: 4003, reason: "Access was revoked." });
    finish();
    await settle();
    await vi.advanceTimersByTimeAsync(100);
    expect(
      socket.sent.filter((message) => message.type === "update"),
    ).toHaveLength(0);
    expect(statuses.at(-1)).toMatchObject({ phase: "paused", canEdit: false });
  });

  it("drains composition-delayed peer changes after an aborted switch resumes", async () => {
    const { client, server, socket, sync } = fixture();
    sync();
    await settle();
    let composing = true;
    client.isComposing = () => composing;
    server.getText("body").insert(8, " Remote.");
    socket.message({
      type: "update",
      update: encodeBytes(Y.encodeStateAsUpdate(server)),
    });
    await client.stop();
    composing = false;
    await client.resume();
    expect(client.doc.getText("body").toString()).toBe("Opening. Remote.");
  });
});
