import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import * as Y from "yjs";
import { loadLiveCache, saveLiveCache } from "../src/collaboration/cache";
it("restores and compacts incremental insertions and deletions with account isolation", async () => {
  const doc = new Y.Doc();
  const updates: Uint8Array[] = [];
  doc.on("update", (update) => updates.push(update));
  doc.getText("script").insert(0, "One two three");
  doc.getText("script").delete(4, 4);
  doc.getText("script").insert(4, "four ");
  for (const state of updates)
    await saveLiveCache({
      fileId: "same-file",
      accountId: "writer-a",
      name: "Draft.fountain",
      canEdit: true,
      state,
    });
  expect(await loadLiveCache("same-file", "writer-b")).toBeUndefined();
  const cached = await loadLiveCache("same-file", "writer-a");
  const restored = new Y.Doc();
  Y.applyUpdate(restored, cached!.state);
  expect(restored.getText("script").toString()).toBe("One four three");
  const compacted = await loadLiveCache("same-file", "writer-a");
  expect(Array.from(compacted!.state)).toEqual(Array.from(cached!.state));
  doc.destroy();
  restored.destroy();
});
