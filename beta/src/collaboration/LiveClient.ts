import * as Y from "yjs";
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from "y-protocols/awareness";
import { apiBase, cloud } from "../storage/cloud";
import { encodeBytes, decodeBytes } from "./encoding";
import { loadLiveCache, saveLiveCache } from "./cache";
import type { CachedLiveDocument } from "./cache";
export interface LiveIdentity {
  id: string;
  name: string;
  color: string;
  canEdit: boolean;
  clientId?: number;
  connectionId?: string;
}
export interface LiveBootstrap {
  state: string;
  vector: string;
  content: string;
  name: string;
  remote: { provider: "google"; id: string; etag: string; live: true };
  self: LiveIdentity;
}
export interface LiveStatus {
  phase: "connecting" | "live" | "syncing" | "offline" | "readonly" | "paused";
  message?: string;
  members: { id: string; name: string; color: string }[];
  canEdit: boolean;
}
const remoteOrigin = Symbol("network update");
export class LiveClient {
  readonly doc = new Y.Doc();
  readonly awareness = new Awareness(this.doc);
  self: LiveIdentity;
  readonly fileId: string;
  readonly accountId: string;
  readonly name: string;
  private socket?: WebSocket;
  private disposed = false;
  private connected = false;
  private terminal = false;
  private retry = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private sendTimer?: ReturnType<typeof setTimeout>;
  private incomingTimer?: ReturnType<typeof setTimeout>;
  private presenceTimer?: ReturnType<typeof setTimeout>;
  private buffered: Uint8Array[] = [];
  private incoming: Uint8Array[] = [];
  private pending = new Set<number>();
  private serial = 0;
  private persistTail: Promise<void> = Promise.resolve();
  private saving?: Promise<void>;
  private stopping?: Promise<void>;
  private flushing?: Promise<void>;
  private failedPersistence: Uint8Array[] = [];
  private cacheError = "";
  private announced = "";
  private phase: LiveStatus["phase"] = "connecting";
  onStatus?: (status: LiveStatus) => void;
  onSaved?: (etag: string) => void;
  onPermission?: (canEdit: boolean) => void;
  isComposing?: () => boolean;
  constructor(input: {
    fileId: string;
    name: string;
    self: LiveIdentity;
    state: Uint8Array;
  }) {
    this.fileId = input.fileId;
    this.accountId = input.self.id;
    this.name = input.name;
    this.self = input.self;
    Y.applyUpdate(this.doc, input.state, remoteOrigin);
    this.awareness.setLocalStateField("user", {
      id: this.self.id,
      name: this.self.name,
      color: this.self.color,
    });
    this.doc.on("update", this.updated);
    this.awareness.on("update", this.presenceChanged);
    this.awareness.on("change", this.announce);
    window.addEventListener("online", this.reconnect);
    window.addEventListener("offline", this.offline);
  }
  static async prepare(bootstrap: LiveBootstrap): Promise<LiveClient> {
    const cached = await loadLiveCache(bootstrap.remote.id, bootstrap.self.id);
    const state = decodeBytes(bootstrap.state);
    const client = new LiveClient({
      fileId: bootstrap.remote.id,
      name: bootstrap.name,
      self: bootstrap.self,
      state:
        cached?.accountId === bootstrap.self.id && bootstrap.self.canEdit
          ? Y.mergeUpdates([state, cached.state])
          : state,
    });
    await client.persist(state);
    return client;
  }
  static async cached(
    fileId: string,
    accountId: string,
  ): Promise<LiveClient | undefined> {
    const cached = await loadLiveCache(fileId, accountId);
    return (
      cached &&
      new LiveClient({
        fileId,
        name: cached.name,
        state: cached.state,
        self: {
          id: cached.accountId,
          name: "You",
          color: "#3478b9",
          canEdit: cached.canEdit,
        },
      })
    );
  }
  private updated = (update: Uint8Array, origin: unknown) => {
    // Persist incremental updates, never encode the whole document in a keystroke.
    void this.persist(update).catch(() => {});
    if (origin === remoteOrigin) return;
    this.buffered.push(update);
    this.phase = this.connected ? "syncing" : "offline";
    this.announce();
    if (!this.sendTimer)
      this.sendTimer = setTimeout(() => {
        this.sendTimer = undefined;
        void this.flushUpdates();
      }, 35);
  };
  private persist(update: Uint8Array) {
    this.persistTail = this.persistTail
      .catch(() => {})
      .then(async () => {
        const chunks = [...this.failedPersistence, update];
        const state = chunks.length > 1 ? Y.mergeUpdates(chunks) : update;
        const input: CachedLiveDocument = {
          fileId: this.fileId,
          state,
          name: this.name,
          canEdit: this.self.canEdit,
          accountId: this.accountId,
        };
        try {
          await saveLiveCache(input);
          this.failedPersistence = [];
          if (this.cacheError && !this.terminal) {
            this.cacheError = "";
            this.announce();
          }
        } catch (error) {
          // The next successful append includes every failed update, even if the writer
          // kept typing while storage was temporarily unavailable.
          this.failedPersistence = [state];
          this.cacheError =
            error instanceof Error
              ? error.message
              : "Device storage needs attention.";
          this.announce();
          throw error;
        }
      });
    return this.persistTail;
  }
  start() {
    this.connect();
    this.announce();
  }
  private reconnect = () => {
    if (!this.disposed && !this.terminal) {
      clearTimeout(this.timer);
      this.connect();
    }
  };
  private offline = () => {
    this.socket?.close();
    this.connected = false;
    this.phase = "offline";
    this.announce();
  };
  private connect() {
    if (
      this.disposed ||
      this.terminal ||
      this.socket?.readyState === WebSocket.OPEN ||
      this.socket?.readyState === WebSocket.CONNECTING
    )
      return;
    if (!navigator.onLine) {
      this.phase = "offline";
      this.announce();
      return;
    }
    const url = new URL(
      `${apiBase}/collaboration/${encodeURIComponent(this.fileId)}/connect`,
      location.origin,
    );
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.searchParams.set("clientId", String(this.doc.clientID));
    this.phase = this.retry ? "offline" : "connecting";
    const socket = (this.socket = new WebSocket(url));
    socket.onmessage = (event) => {
      if (this.socket !== socket || this.disposed) return;
      try {
        this.receive(JSON.parse(String(event.data)));
      } catch {
        this.pause(
          "Live synchronization received an invalid message. Your local draft is kept.",
        );
      }
    };
    socket.onclose = (event) => {
      if (this.socket !== socket || this.disposed) return;
      this.connected = false;
      this.socket = undefined;
      if (this.terminal) {
        this.announce();
        return;
      }
      removeAwarenessStates(
        this.awareness,
        [...this.awareness.getStates().keys()].filter(
          (id) => id !== this.doc.clientID,
        ),
        remoteOrigin,
      );
      if (event.code === 4003) {
        this.self.canEdit = false;
        this.onPermission?.(false);
        void this.persist(Y.encodeStateAsUpdate(this.doc)).catch(() => {});
        this.pause(
          event.reason || "Drive access changed. Your local draft is kept.",
        );
        return;
      }
      if (event.code === 4009 || event.code === 4010) {
        this.pause(event.reason || "Live synchronization needs attention.");
        return;
      }
      this.phase = "offline";
      this.announce();
      if (!this.terminal)
        this.timer = setTimeout(
          this.reconnect,
          Math.min(15000, 500 * 2 ** this.retry++) + Math.random() * 200,
        );
    };
    socket.onerror = () => {}; // close handles retry without discarding local edits.
  }
  private receive(data: Record<string, unknown>) {
    switch (data.type) {
      case "sync": {
        const identity = data.self as LiveIdentity | undefined;
        if (
          !identity ||
          typeof identity.id !== "string" ||
          typeof identity.canEdit !== "boolean" ||
          typeof identity.name !== "string" ||
          typeof identity.color !== "string"
        )
          throw new Error("Invalid live identity.");
        if (identity.id !== this.accountId) {
          this.self.canEdit = false;
          this.onPermission?.(false);
          this.pause(
            "This draft belongs to a different Google account. Reconnect its original account to synchronize your saved writing.",
          );
          return;
        }
        this.self = identity;
        this.onPermission?.(this.self.canEdit);
        void this.persist(new Uint8Array([0, 0])).catch(() => {});
        this.awareness.setLocalStateField("user", {
          id: this.self.id,
          name: this.self.name,
          color: this.self.color,
        });
        this.pending.clear();
        this.buffered = [];
        this.retry = 0;
        this.connected = true;
        this.applyRemote(decodeBytes(data.state as string));
        // Reconnect diff includes unacknowledged insertions and deletions. Yjs is idempotent.
        if (this.self.canEdit) {
          const diff = Y.encodeStateAsUpdate(
            this.doc,
            decodeBytes(data.vector as string),
          );
          if (diff.length > 2) this.buffered.push(diff);
          void this.flushUpdates();
        }
        this.phase = this.self.canEdit
          ? this.buffered.length || this.pending.size || this.flushing
            ? "syncing"
            : "live"
          : "readonly";
        this.sendPresence();
        this.announce();
        break;
      }
      case "update":
        this.applyRemote(decodeBytes(data.update as string));
        break;
      case "ack":
        this.pending.delete(Number(data.id));
        if (
          !this.pending.size &&
          !this.buffered.length &&
          !this.flushing &&
          this.self.canEdit
        )
          this.phase = "live";
        this.announce();
        break;
      case "presence":
        applyAwarenessUpdate(
          this.awareness,
          decodeBytes(data.awareness as string),
          remoteOrigin,
        );
        break;
      case "saved":
        this.onSaved?.(String(data.etag));
        this.announce();
        break;
      case "error":
        this.pause(
          String(data.message || "Live synchronization needs attention."),
        );
        break;
    }
  }
  private applyRemote(update: Uint8Array) {
    if (this.isComposing?.()) {
      this.incoming.push(update);
      if (!this.incomingTimer)
        this.incomingTimer = setTimeout(() => this.drainIncoming(), 30);
      return;
    }
    Y.applyUpdate(this.doc, update, remoteOrigin);
  }
  private drainIncoming() {
    this.incomingTimer = undefined;
    if (this.disposed) return;
    if (this.isComposing?.()) {
      this.incomingTimer = setTimeout(() => this.drainIncoming(), 30);
      return;
    }
    if (this.incoming.length) {
      try {
        Y.applyUpdate(
          this.doc,
          Y.mergeUpdates(this.incoming.splice(0)),
          remoteOrigin,
        );
      } catch {
        this.pause(
          "Live synchronization received an invalid update. Your local draft is kept.",
        );
      }
    }
  }
  private async flushUpdates(): Promise<void> {
    if (this.flushing) return this.flushing;
    if (
      !this.connected ||
      !this.self.canEdit ||
      this.socket?.readyState !== WebSocket.OPEN ||
      !this.buffered.length ||
      this.terminal
    )
      return;
    const socket = this.socket;
    const update = Y.mergeUpdates(this.buffered.splice(0));
    this.flushing = (async () => {
      try {
        await this.persistTail;
      } catch {
        this.buffered.unshift(update);
        return;
      }
      if (
        !this.connected ||
        socket !== this.socket ||
        socket.readyState !== WebSocket.OPEN ||
        this.disposed ||
        this.terminal ||
        !this.self.canEdit
      ) {
        this.buffered.unshift(update);
        return;
      }
      const id = ++this.serial;
      try {
        socket.send(
          JSON.stringify({ type: "update", id, update: encodeBytes(update) }),
        );
        this.pending.add(id);
        this.phase = "syncing";
        this.announce();
      } catch {
        this.buffered.unshift(update);
        this.connected = false;
        socket.close();
      }
    })().finally(() => {
      this.flushing = undefined;
      if (
        this.buffered.length &&
        this.connected &&
        !this.terminal &&
        this.self.canEdit &&
        !this.cacheError &&
        !this.sendTimer
      )
        this.sendTimer = setTimeout(() => {
          this.sendTimer = undefined;
          void this.flushUpdates();
        }, 35);
    });
    return this.flushing;
  }
  private presenceChanged = (
    {
      added,
      updated,
      removed,
    }: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ) => {
    if (
      origin === remoteOrigin ||
      ![...added, ...updated, ...removed].includes(this.doc.clientID)
    )
      return;
    if (!this.presenceTimer)
      this.presenceTimer = setTimeout(() => {
        this.presenceTimer = undefined;
        this.sendPresence();
      }, 50);
  };
  private sendPresence() {
    if (this.connected && this.socket?.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(
          JSON.stringify({
            type: "presence",
            awareness: encodeBytes(
              encodeAwarenessUpdate(this.awareness, [this.doc.clientID]),
            ),
          }),
        );
      } catch {
        this.socket?.close();
      }
    }
  }
  private announce = () => {
    const members = [...this.awareness.getStates()]
      .filter(([id]) => id !== this.doc.clientID)
      .map(([, state]) => state.user)
      .filter(
        (user): user is { id: string; name: string; color: string } =>
          !!user && typeof user.name === "string",
      );
    const status = {
      phase: this.phase,
      members,
      canEdit: this.self.canEdit,
      message: this.cacheError || undefined,
    };
    const key = JSON.stringify(status);
    if (key !== this.announced) {
      this.announced = key;
      this.onStatus?.(status);
    }
  };
  private pause(message: string) {
    clearTimeout(this.timer);
    this.terminal = true;
    this.phase = "paused";
    this.cacheError = message;
    this.connected = false;
    this.socket?.close();
    this.announce();
  }
  async checkpoint(): Promise<void> {
    if (this.saving) return this.saving;
    return (this.saving = (async () => {
      if (!this.self.canEdit)
        throw new Error(
          "This Drive document is view only. Save a copy to make edits.",
        );
      if (!this.connected || this.terminal)
        throw new Error(
          "Live connection is unavailable. Your edits are saved on this device and will sync after reconnecting.",
        );
      // An explicit save retries a previously failed cache append before it sends.
      await this.persist(Y.encodeStateAsUpdate(this.doc));
      await this.flushUpdates();
      const deadline = Date.now() + 30000;
      while (
        this.pending.size ||
        this.buffered.length ||
        this.flushing ||
        this.incoming.length
      ) {
        if (!this.connected || this.terminal || Date.now() > deadline)
          throw new Error(
            "Waiting for live synchronization. Your local draft is kept.",
          );
        await new Promise((resolve) => setTimeout(resolve, 30));
        await this.flushUpdates();
      }
      const result = await cloud.liveCheckpoint(
        this.fileId,
        encodeBytes(Y.encodeStateVector(this.doc)),
      );
      this.onSaved?.(result.etag);
    })().finally(() => {
      this.saving = undefined;
    }));
  }
  async stop(): Promise<void> {
    if (this.disposed) return;
    if (this.stopping) return this.stopping;
    return (this.stopping = (async () => {
      // Stay subscribed until the last local update is durable. If storage rejects,
      // this client remains usable and a later stop retries instead of losing input.
      await this.persist(Y.encodeStateAsUpdate(this.doc));
      const deadline = Date.now() + 2000;
      while (true) {
        await this.persistTail;
        await this.flushUpdates();
        if (
          !this.connected ||
          this.terminal ||
          !this.self.canEdit ||
          Date.now() >= deadline
        )
          break;
        if (!this.pending.size && !this.buffered.length && !this.flushing)
          break;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      // Typing during an ACK wait can append to the persistence queue. Drain its
      // current tail before releasing the editor; unsent updates survive offline.
      let tail: Promise<void>;
      do {
        tail = this.persistTail;
        await tail;
      } while (tail !== this.persistTail);
      this.close();
    })().finally(() => {
      this.stopping = undefined;
    }));
  }
  /** Resume the same CRDT and client identity after a canceled document switch. */
  async resume(): Promise<void> {
    if (!this.disposed) return;
    this.disposed = false;
    this.doc.on("update", this.updated);
    this.awareness.on("update", this.presenceChanged);
    this.awareness.on("change", this.announce);
    this.awareness.setLocalStateField("user", {
      id: this.self.id,
      name: this.self.name,
      color: this.self.color,
    });
    window.addEventListener("online", this.reconnect);
    window.addEventListener("offline", this.offline);
    // The still-mounted editor may have accepted input after stop completed.
    // Capture that same document before reconnect's diff can send it to the room.
    const durable = this.persist(Y.encodeStateAsUpdate(this.doc));
    this.drainIncoming();
    this.connect();
    this.announce();
    await durable;
  }
  private close() {
    if (this.disposed) return;
    this.disposed = true;
    clearTimeout(this.timer);
    clearTimeout(this.sendTimer);
    clearTimeout(this.incomingTimer);
    clearTimeout(this.presenceTimer);
    this.timer =
      this.sendTimer =
      this.incomingTimer =
      this.presenceTimer =
        undefined;
    this.doc.off("update", this.updated);
    this.awareness.off("update", this.presenceChanged);
    this.awareness.off("change", this.announce);
    this.awareness.setLocalState(null);
    this.sendPresence();
    this.socket?.close();
    this.socket = undefined;
    this.connected = false;
    window.removeEventListener("online", this.reconnect);
    window.removeEventListener("offline", this.offline);
  }
  destroy() {
    this.close();
    this.awareness.destroy();
    this.doc.destroy();
  }
}
