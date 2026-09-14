// @vitest-environment node
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkspaceRepository } from "../src/storage/workspace";
import { emptyScreenplay } from "../src/core/model";
import { readLocalFile, saveLocalFile } from "../src/storage/files";
const repositories: WorkspaceRepository[] = [];
const repository = (name = crypto.randomUUID()) => {
  const repo = new WorkspaceRepository(name);
  repositories.push(repo);
  return repo;
};
const draft = (id = crypto.randomUUID(), text = "A train arrives.") => {
  const screenplay = emptyScreenplay();
  screenplay.blocks[0].text = text;
  return { id, name: "test.fountain", screenplay };
};
afterEach(async () => {
  for (const repo of repositories.splice(0)) await repo.close();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("durable device storage", () => {
  it("keeps screenplay and snapshots after reopening the database", async () => {
    const name = crypto.randomUUID();
    const first = repository(name);
    const doc = draft();
    const created = await first.save(doc, null);
    await first.save({ ...doc, name: "second.fountain" }, created.revision);
    await first.close();
    const reopened = repository(name);
    expect((await reopened.load(doc.id))?.name).toBe("second.fountain");
    expect(
      (await reopened.snapshots(doc.id))[0].screenplay.blocks[0].text,
    ).toBe("A train arrives.");
  });
  it("serializes competing tabs so only one stale revision can commit", async () => {
    const name = crypto.randomUUID();
    const a = repository(name),
      b = repository(name);
    const doc = draft();
    const saved = await a.save(doc, null);
    const results = await Promise.allSettled([
      a.save({ ...doc, name: "alpha.fountain" }, saved.revision),
      b.save({ ...doc, name: "beta.fountain" }, saved.revision),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const failure = results.find(
      (r) => r.status === "rejected",
    ) as PromiseRejectedResult;
    expect(failure.reason.code).toBe("CONFLICT");
    expect((await a.load(doc.id))?.revision).toBe(2);
  });
  it("preserves independent recovery drafts when another tab saves", async () => {
    const name = crypto.randomUUID();
    const a = repository(name),
      b = repository(name);
    const doc = draft();
    await a.save(doc, null);
    await a.writeRecovery(doc.id, draft(doc.id, "Alpha unsaved").screenplay, 1);
    await b.writeRecovery(doc.id, draft(doc.id, "Beta unsaved").screenplay, 1);
    expect(await a.recoveries()).toHaveLength(2);
    await a.save(doc, 1);
    const recoveries = await b.recoveries();
    expect(recoveries).toHaveLength(1);
    expect(recoveries[0].screenplay.blocks[0].text).toBe("Beta unsaved");
    await b.clearRecovery(recoveries[0].recoveryId);
    expect(await b.recoveries()).toHaveLength(0);
  });
  it("does not erase a draft when deletion uses a stale revision", async () => {
    const repo = repository();
    const doc = draft();
    await repo.save(doc, null);
    await repo.save(doc, 1);
    await expect(repo.remove(doc.id, 1)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(await repo.load(doc.id)).toBeDefined();
  });
  it("reports quota failure and retains the last committed version", async () => {
    const repo = repository();
    const doc = draft();
    await repo.save(doc, null);
    const original = IDBObjectStore.prototype.put;
    const spy = vi
      .spyOn(IDBObjectStore.prototype, "put")
      .mockImplementation(function (
        this: IDBObjectStore,
        ...args: Parameters<typeof original>
      ) {
        if (this.name === "documents")
          throw new DOMException("full", "QuotaExceededError");
        return original.apply(this, args);
      });
    await expect(
      repo.save({ ...doc, name: "unsaved.fountain" }, 1),
    ).rejects.toMatchObject({ code: "QUOTA" });
    spy.mockRestore();
    expect((await repo.load(doc.id))?.name).toBe(doc.name);
  });
  it("limits retained history and snapshots at one minute intervals", async () => {
    const repo = repository();
    const doc = draft();
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    await repo.save(doc, null);
    for (let revision = 1; revision <= 55; revision++) {
      vi.mocked(Date.now).mockReturnValue(now + revision * 61_000);
      await repo.save(doc, revision);
    }
    expect(await repo.snapshots(doc.id)).toHaveLength(50);
  });
});
describe("file durability", () => {
  it("aborts a failed file write and never reports success", async () => {
    vi.stubGlobal("window", {});
    const abort = vi.fn().mockResolvedValue(undefined);
    const handle = {
      name: "test.fountain",
      getFile: vi.fn(),
      createWritable: vi
        .fn()
        .mockResolvedValue({
          write: vi.fn().mockRejectedValue(new Error("disk full")),
          close: vi.fn(),
          abort,
        }),
    };
    await expect(
      saveLocalFile("hello", "test.fountain", handle),
    ).rejects.toThrow("disk full");
    expect(abort).toHaveBeenCalledOnce();
  });
  it("rejects binary files and oversized files before reading", async () => {
    await expect(
      readLocalFile({ size: 12 * 1024 * 1024 } as File),
    ).rejects.toThrow("10 MB");
    await expect(
      readLocalFile({
        name: "bad.fountain",
        size: 3,
        text: async () => "a\0b",
      } as File),
    ).rejects.toThrow("plain text");
  });
});
