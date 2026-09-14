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
const liveRemote = {
  provider: "google" as const,
  id: "shared-screenplay",
  etag: "version-one",
  live: true,
  accountId: "writer-one",
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
  it("lets tabs for the same live account and file refresh render snapshots", async () => {
    const database = crypto.randomUUID();
    const a = repository(database),
      b = repository(database);
    const input = { ...draft(), remote: liveRemote };
    const first = await a.save(input, null);
    const results = await Promise.all([
      a.save({ ...input, name: "alpha.fountain" }, first.revision),
      b.save({ ...input, name: "beta.fountain" }, first.revision),
    ]);
    expect(results.map((result) => result.revision).sort()).toEqual([2, 3]);
    expect(
      results.every((result) => result.createdAt === first.createdAt),
    ).toBe(true);
    expect((await a.load(input.id))?.revision).toBe(3);
    expect((await a.load(input.id))?.remote).toEqual(liveRemote);
    await expect(a.remove(input.id, first.revision)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });
  it.each([
    {
      name: "different Drive files",
      stored: liveRemote,
      incoming: { ...liveRemote, id: "another-file" },
    },
    {
      name: "different Google accounts",
      stored: liveRemote,
      incoming: { ...liveRemote, accountId: "another-writer" },
    },
    {
      name: "a missing incoming account",
      stored: liveRemote,
      incoming: { ...liveRemote, accountId: undefined },
    },
    {
      name: "a missing stored account",
      stored: { ...liveRemote, accountId: undefined },
      incoming: liveRemote,
    },
    {
      name: "empty accounts",
      stored: { ...liveRemote, accountId: "" },
      incoming: { ...liveRemote, accountId: "" },
    },
    {
      name: "blank accounts",
      stored: { ...liveRemote, accountId: " " },
      incoming: { ...liveRemote, accountId: " " },
    },
    {
      name: "an ordinary stored Drive document",
      stored: { ...liveRemote, live: false },
      incoming: liveRemote,
    },
    {
      name: "an ordinary incoming Drive document",
      stored: liveRemote,
      incoming: { ...liveRemote, live: false },
    },
    {
      name: "an unset stored live flag",
      stored: { ...liveRemote, live: undefined },
      incoming: liveRemote,
    },
    {
      name: "an unset incoming live flag",
      stored: liveRemote,
      incoming: { ...liveRemote, live: undefined },
    },
  ])(
    "keeps stale snapshot protection for $name",
    async ({ stored, incoming }) => {
      const repo = repository();
      const input = { ...draft(), remote: stored };
      await repo.save(input, null);
      await repo.save({ ...input, name: "newer.fountain" }, 1);
      await expect(
        repo.save({ ...input, remote: incoming }, 1),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect((await repo.load(input.id))?.name).toBe("newer.fountain");
    },
  );
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
      createWritable: vi.fn().mockResolvedValue({
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
  it("reads UTF-16 Final Draft files with a byte-order mark", async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-16"?><FinalDraft><Content><Paragraph><Text>Renée</Text></Paragraph></Content></FinalDraft>';
    const bytes = new Uint8Array(2 + xml.length * 2);
    bytes.set([255, 254]);
    for (let i = 0; i < xml.length; i++) {
      bytes[2 + i * 2] = xml.charCodeAt(i) & 255;
      bytes[3 + i * 2] = xml.charCodeAt(i) >> 8;
    }
    expect(
      await readLocalFile({
        name: "Draft.fdx",
        size: bytes.length,
        arrayBuffer: async () => bytes.buffer,
      } as File),
    ).toEqual({ name: "Draft.fdx", content: xml });
  });
  it("rejects binary files and oversized files before reading", async () => {
    await expect(
      readLocalFile({ size: 12 * 1024 * 1024 } as File),
    ).rejects.toThrow("10 MB");
    await expect(
      readLocalFile({
        name: "bad.fountain",
        size: 3,
        arrayBuffer: async () => new TextEncoder().encode("a\0b").buffer,
      } as File),
    ).rejects.toThrow("Fountain");
  });
});
