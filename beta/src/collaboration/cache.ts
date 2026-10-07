import * as Y from "yjs";
export interface CachedLiveDocument {
  fileId: string;
  state: Uint8Array;
  name: string;
  canEdit: boolean;
  accountId: string;
  roomVersion?: string;
  baseContent?: string;
  needsMerge?: boolean;
}
let database: Promise<IDBDatabase> | undefined;
const savedBases = new Map<string, string | undefined>();
function db() {
  return (database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open("fountain-publisher-live-cache-v1", 2);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains("rooms"))
        req.result.createObjectStore("rooms", { keyPath: "id" });
      if (!req.result.objectStoreNames.contains("updates")) {
        const updates = req.result.createObjectStore("updates", {
          autoIncrement: true,
        });
        updates.createIndex("roomId", "roomId");
      }
      if (!req.result.objectStoreNames.contains("bases"))
        req.result.createObjectStore("bases", { keyPath: "id" });
    };
    req.onsuccess = () => {
      req.result.onversionchange = () => {
        req.result.close();
        database = undefined;
      };
      resolve(req.result);
    };
    req.onerror = () => {
      database = undefined;
      reject(req.error);
    };
    req.onblocked = () => {
      database = undefined;
      reject(
        new Error(
          "Close older Fountain Publisher tabs to finish opening local live storage.",
        ),
      );
    };
  }));
}
/** Compact once when opening a room; input only appends small incremental updates. */
export async function loadLiveCache(
  fileId: string,
  accountId: string,
): Promise<CachedLiveDocument | undefined> {
  const database = await db();
  const id = `${fileId}:${accountId}`;
  return new Promise((resolve, reject) => {
    const tx = database.transaction(["rooms", "updates", "bases"], "readwrite");
    const rooms = tx.objectStore("rooms"),
      updates = tx.objectStore("updates");
    let result: CachedLiveDocument | undefined;
    let baseContent: string | undefined;
    const base = tx.objectStore("bases").get(id);
    base.onsuccess = () => {
      baseContent = base.result?.content;
    };
    const metadata = rooms.get(id);
    metadata.onsuccess = () => {
      if (!metadata.result) return;
      const request = updates.index("roomId").getAll(id);
      request.onsuccess = () => {
        const entries = request.result as { update: Uint8Array }[];
        if (!entries.length) return;
        let state: Uint8Array;
        try {
          state = Y.mergeUpdates(entries.map((entry) => entry.update));
        } catch {
          reject(
            new Error(
              "The cached live draft could not be read. Its stored updates have been kept.",
            ),
          );
          tx.abort();
          return;
        }
        result = { ...metadata.result, state };
        const keys = updates.index("roomId").openKeyCursor(id);
        keys.onsuccess = () => {
          const cursor = keys.result;
          if (cursor) {
            updates.delete(cursor.primaryKey);
            cursor.continue();
          } else updates.add({ roomId: id, update: state });
        };
      };
    };
    tx.oncomplete = () => {
      if (result && baseContent !== undefined) result.baseContent = baseContent;
      savedBases.set(id, result?.baseContent);
      resolve(result);
    };
    tx.onabort = tx.onerror = () => reject(tx.error);
  });
}
export async function saveLiveCache(
  input: CachedLiveDocument,
  resolvedMerge = false,
): Promise<void> {
  const database = await db();
  const id = `${input.fileId}:${input.accountId}`;
  return new Promise((resolve, reject) => {
    const tx = database.transaction(["rooms", "updates", "bases"], "readwrite");
    const { state, baseContent, ...metadata } = input;
    const rooms = tx.objectStore("rooms"),
      previous = rooms.get(id);
    let persistedBase = savedBases.get(id);
    previous.onsuccess = () => {
      const sticky =
        previous.result?.needsMerge && !input.needsMerge && !resolvedMerge;
      rooms.put({
        ...metadata,
        id,
        ...(sticky
          ? { needsMerge: true, roomVersion: previous.result.roomVersion }
          : {}),
      });
      if (
        !sticky &&
        baseContent !== undefined &&
        (resolvedMerge || baseContent !== savedBases.get(id))
      ) {
        tx.objectStore("bases").put({ id, content: baseContent });
        persistedBase = baseContent;
      }
    };
    tx.objectStore("updates").add({ roomId: id, update: state });
    tx.oncomplete = () => {
      savedBases.set(id, persistedBase);
      resolve();
    };
    tx.onabort = tx.onerror = () =>
      reject(
        tx.error ?? new Error("Live draft could not be saved on this device."),
      );
  });
}
