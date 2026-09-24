import type { Screenplay } from "../core/model";
import type { WriteShapeDestination } from "./destinations";
import type { RemoteLocation } from "./cloud";
export interface WorkspaceDocument {
  id: string;
  name: string;
  screenplay: Screenplay;
  revision: number;
  createdAt: number;
  updatedAt: number;
  remote?: RemoteLocation;
  destination?: WriteShapeDestination;
}
export interface Snapshot {
  id: string;
  documentId: string;
  name: string;
  screenplay: Screenplay;
  createdAt: number;
  revision: number;
}
export interface Recovery {
  recoveryId: string;
  documentId: string;
  screenplay: Screenplay;
  updatedAt: number;
  baseRevision?: number;
}
export type DocumentInput = Pick<
  WorkspaceDocument,
  "id" | "name" | "screenplay" | "remote" | "destination"
>;
export class StorageError extends Error {
  constructor(
    message: string,
    public code: "CONFLICT" | "UNAVAILABLE" | "QUOTA",
  ) {
    super(message);
    this.name = "StorageError";
  }
}
function storageError(error: unknown): StorageError {
  if (error instanceof StorageError) return error;
  return new StorageError(
    error instanceof DOMException && error.name === "QuotaExceededError"
      ? "Device storage is full. Export a Fountain file to keep your latest changes."
      : "Device storage is unavailable. Export a Fountain file to keep your latest changes.",
    error instanceof DOMException && error.name === "QuotaExceededError"
      ? "QUOTA"
      : "UNAVAILABLE",
  );
}
function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
export class WorkspaceRepository {
  private database?: Promise<IDBDatabase>;
  private listeners = new Set<(id: string) => void>();
  private channel?: BroadcastChannel;
  private readonly writerId = crypto.randomUUID();
  constructor(
    private readonly databaseName = "fountain-publisher-workspace-v1",
  ) {
    if (
      typeof window !== "undefined" &&
      typeof BroadcastChannel !== "undefined"
    ) {
      this.channel = new BroadcastChannel(databaseName);
      this.channel.onmessage = (event: MessageEvent<unknown>) => {
        if (typeof event.data === "string")
          for (const listener of this.listeners) listener(event.data);
      };
    }
  }
  private db(): Promise<IDBDatabase> {
    if (!this.database)
      this.database = new Promise<IDBDatabase>((resolve, reject) => {
        if (typeof indexedDB === "undefined") {
          reject(
            new StorageError(
              "Your browser cannot save drafts on this device. Export your work before closing.",
              "UNAVAILABLE",
            ),
          );
          return;
        }
        const req = indexedDB.open(this.databaseName, 2);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains("documents"))
            db.createObjectStore("documents", { keyPath: "id" });
          if (!db.objectStoreNames.contains("snapshots")) {
            const history = db.createObjectStore("snapshots", {
              keyPath: "id",
            });
            history.createIndex("documentId", "documentId");
          }
          if (!db.objectStoreNames.contains("recovery"))
            db.createObjectStore("recovery", { keyPath: "documentId" });
          if (!db.objectStoreNames.contains("tabRecovery")) {
            const recovery = db.createObjectStore("tabRecovery", {
              keyPath: "recoveryId",
            });
            recovery.createIndex("documentId", "documentId");
          }
        };
        req.onsuccess = () => {
          req.result.onversionchange = () => {
            req.result.close();
            this.database = undefined;
          };
          resolve(req.result);
        };
        req.onerror = () => {
          this.database = undefined;
          reject(storageError(req.error));
        };
        req.onblocked = () => {
          this.database = undefined;
          reject(
            new StorageError(
              "Close other Fountain Publisher tabs to upgrade device storage.",
              "UNAVAILABLE",
            ),
          );
        };
      });
    return this.database;
  }
  subscribe(listener: (id: string) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  async list(): Promise<WorkspaceDocument[]> {
    try {
      const db = await this.db();
      const result = (await request(
        db.transaction("documents").objectStore("documents").getAll(),
      )) as WorkspaceDocument[];
      return result.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch (e) {
      throw storageError(e);
    }
  }
  async load(id: string): Promise<WorkspaceDocument | undefined> {
    try {
      const db = await this.db();
      return await request(
        db.transaction("documents").objectStore("documents").get(id),
      );
    } catch (e) {
      throw storageError(e);
    }
  }
  /** Insert a recovered draft and optional earlier save atomically, without replacing existing writing. */
  async importDraft(
    input: DocumentInput,
    previous?: Screenplay,
  ): Promise<WorkspaceDocument> {
    try {
      const db = await this.db();
      const tx = db.transaction(["documents", "snapshots"], "readwrite");
      const completion = done(tx);
      void completion.catch(() => {});
      const documents = tx.objectStore("documents");
      const current = (await request(documents.get(input.id))) as
        WorkspaceDocument | undefined;
      if (current) {
        await completion;
        return current;
      }
      const now = Date.now();
      const next: WorkspaceDocument = {
        ...input,
        revision: 1,
        createdAt: now,
        updatedAt: now,
      };
      documents.add(next);
      if (previous)
        tx.objectStore("snapshots").add({
          id: crypto.randomUUID(),
          documentId: next.id,
          name: next.name,
          screenplay: previous,
          createdAt: now,
          revision: 0,
        } satisfies Snapshot);
      await completion;
      this.channel?.postMessage(input.id);
      return next;
    } catch (error) {
      throw storageError(error);
    }
  }
  async save(
    input: DocumentInput,
    expectedRevision: number | null,
  ): Promise<WorkspaceDocument> {
    try {
      const db = await this.db();
      const tx = db.transaction(
        ["documents", "snapshots", "tabRecovery"],
        "readwrite",
      );
      const completion = done(tx);
      void completion.catch(() => {});
      const documents = tx.objectStore("documents");
      const current = (await request(documents.get(input.id))) as
        WorkspaceDocument | undefined;
      // Live updates are merged in the separate, atomic CRDT cache. These
      // records are render snapshots; sibling tabs for that same account/room
      // can refresh them without treating their stale snapshot as a conflict.
      const sameLiveDocument =
        current?.remote?.provider === "google" &&
        input.remote?.provider === "google" &&
        current.remote.live === true &&
        input.remote.live === true &&
        current.remote.id === input.remote.id &&
        typeof current.remote.accountId === "string" &&
        current.remote.accountId.trim().length > 0 &&
        current.remote.accountId === input.remote.accountId;
      if (
        (current?.revision ?? null) !== expectedRevision &&
        !sameLiveDocument
      ) {
        tx.abort();
        throw new StorageError(
          "This screenplay changed in another tab. Your recovery draft is preserved; reload the saved version or save your draft as a copy.",
          "CONFLICT",
        );
      }
      const now = Date.now();
      const next: WorkspaceDocument = {
        ...input,
        revision: (current?.revision ?? 0) + 1,
        createdAt: current?.createdAt ?? now,
        updatedAt: now,
      };
      if (current) {
        const history = tx.objectStore("snapshots");
        const previous = (await request(
          history.index("documentId").getAll(input.id),
        )) as Snapshot[];
        previous.sort((a, b) => b.createdAt - a.createdAt);
        if (!previous[0] || now - previous[0].createdAt >= 60_000) {
          history.put({
            id: crypto.randomUUID(),
            documentId: current.id,
            name: current.name,
            screenplay: current.screenplay,
            revision: current.revision,
            createdAt: now,
          } satisfies Snapshot);
          for (const old of previous.slice(49)) history.delete(old.id);
        }
      }
      documents.put(next);
      tx.objectStore("tabRecovery").delete(`${input.id}:${this.writerId}`);
      await completion;
      this.channel?.postMessage(input.id);
      return next;
    } catch (e) {
      throw storageError(e);
    }
  }
  async remove(id: string, expectedRevision: number): Promise<void> {
    try {
      const db = await this.db();
      const tx = db.transaction(["documents", "snapshots"], "readwrite");
      const completion = done(tx);
      void completion.catch(() => {});
      const current = (await request(tx.objectStore("documents").get(id))) as
        WorkspaceDocument | undefined;
      if (current && current.revision !== expectedRevision) {
        tx.abort();
        throw new StorageError(
          "This screenplay changed in another tab. Reload before deleting.",
          "CONFLICT",
        );
      }
      tx.objectStore("documents").delete(id);
      const keys = await request(
        tx.objectStore("snapshots").index("documentId").getAllKeys(id),
      );
      for (const key of keys) tx.objectStore("snapshots").delete(key);
      await completion;
      this.channel?.postMessage(id);
    } catch (e) {
      throw storageError(e);
    }
  }
  async snapshots(id: string): Promise<Snapshot[]> {
    try {
      const db = await this.db();
      const snapshots = (await request(
        db
          .transaction("snapshots")
          .objectStore("snapshots")
          .index("documentId")
          .getAll(id),
      )) as Snapshot[];
      return snapshots.sort((a, b) => b.createdAt - a.createdAt);
    } catch (e) {
      throw storageError(e);
    }
  }
  async writeRecovery(
    documentId: string,
    screenplay: Screenplay,
    baseRevision?: number,
  ): Promise<void> {
    try {
      const db = await this.db();
      const tx = db.transaction("tabRecovery", "readwrite");
      const completion = done(tx);
      tx.objectStore("tabRecovery").put({
        recoveryId: `${documentId}:${this.writerId}`,
        documentId,
        screenplay,
        baseRevision,
        updatedAt: Date.now(),
      } satisfies Recovery);
      await completion;
    } catch (e) {
      throw storageError(e);
    }
  }
  async recoveries(): Promise<Recovery[]> {
    try {
      const db = await this.db();
      const tx = db.transaction(["recovery", "tabRecovery"]);
      const modern = (await request(
        tx.objectStore("tabRecovery").getAll(),
      )) as Recovery[];
      const legacy = (await request(
        tx.objectStore("recovery").getAll(),
      )) as Omit<Recovery, "recoveryId">[];
      return [
        ...modern,
        ...legacy.map((r) => ({ ...r, recoveryId: r.documentId })),
      ].sort((a, b) => b.updatedAt - a.updatedAt);
    } catch (e) {
      throw storageError(e);
    }
  }
  async clearRecovery(id: string): Promise<void> {
    try {
      const db = await this.db();
      const tx = db.transaction(["recovery", "tabRecovery"], "readwrite");
      const completion = done(tx);
      tx.objectStore("recovery").delete(id);
      tx.objectStore("tabRecovery").delete(id);
      await completion;
    } catch (e) {
      throw storageError(e);
    }
  }
  getActiveId(): string | null {
    try {
      return localStorage.getItem("fp-active-document");
    } catch {
      return null;
    }
  }
  setActiveId(id: string): void {
    try {
      localStorage.setItem("fp-active-document", id);
    } catch {
      /* Only a preference; never screenplay text. */
    }
  }
  async close() {
    (await this.database)?.close();
    this.channel?.close();
    this.database = undefined;
  }
}
export const workspace = new WorkspaceRepository();
