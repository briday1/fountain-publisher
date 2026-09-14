// @vitest-environment node
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseFountain, serializeFountain } from "../src/core/fountain";
import {
  legacyWorkspaceKey,
  migrateLegacyWorkspace,
} from "../src/storage/legacyWorkspace";
import { StorageError, WorkspaceRepository } from "../src/storage/workspace";

const repositories: WorkspaceRepository[] = [];
const repository = (name = crypto.randomUUID()) => {
  const repo = new WorkspaceRepository(name);
  repositories.push(repo);
  return repo;
};
function cache(
  source = "Title: The Crossing\n\nINT. STATION - NIGHT\n\nA train arrives.",
) {
  const original = JSON.stringify({
    version: 1,
    source,
    filename: "The Crossing.fountain",
    savedSource: "An earlier draft.",
    updatedAt: 123,
  });
  const values = new Map([[legacyWorkspaceKey, original]]);
  return {
    original,
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}
afterEach(async () => {
  for (const repo of repositories.splice(0)) await repo.close();
  vi.restoreAllMocks();
});

describe("legacy local draft migration", () => {
  it("commits current writing, title and beat metadata without modifying its original cache", async () => {
    const source = parseFountain(
      "Title: The Crossing\n\nINT. STATION - NIGHT\n\nA train arrives.",
    );
    source.metadata.beats.push({
      id: "arrival",
      title: "The arrival",
      description: "A stranger steps down.",
      act: "Act I",
      color: "#123456",
    });
    const storage = cache(serializeFountain(source));
    const repo = repository();
    const migrated = await migrateLegacyWorkspace(repo, storage);
    expect(migrated?.name).toBe("The Crossing.fountain");
    expect(migrated?.screenplay.titlePage.title).toBe("The Crossing");
    expect(migrated?.screenplay.blocks.map((block) => block.text)).toContain(
      "A train arrives.",
    );
    expect(migrated?.screenplay.metadata.beats[0].title).toBe("The arrival");
    expect(await repo.load(migrated!.id)).toEqual(migrated);
    expect(
      (await repo.snapshots(migrated!.id))[0].screenplay.blocks[0].text,
    ).toBe("An earlier draft.");
    expect(storage.getItem(legacyWorkspaceKey)).toBe(storage.original);
    expect(await migrateLegacyWorkspace(repo, storage)).toBeUndefined();
    expect(await repo.list()).toHaveLength(1);
  });

  it("never replaces existing new drafts or edits to an imported draft when markers are unavailable", async () => {
    const repo = repository();
    const existing = await repo.save(
      {
        id: "new-draft",
        name: "New.fountain",
        screenplay: parseFountain("New writing."),
      },
      null,
    );
    const storage = cache();
    const noMarkers = {
      getItem: storage.getItem,
      setItem: () => {
        throw new Error("preferences unavailable");
      },
    };
    const imported = (await migrateLegacyWorkspace(repo, noMarkers))!;
    const edited = await repo.save(
      { ...imported, screenplay: parseFountain("Writing after migration.") },
      imported.revision,
    );
    expect(await migrateLegacyWorkspace(repo, noMarkers)).toEqual(edited);
    expect(await repo.load(existing.id)).toEqual(existing);
    expect(await repo.list()).toHaveLength(2);
    expect(storage.values.size).toBe(1);
  });

  it("deduplicates concurrent imports and preserves later writing from a still-open old tab as another draft", async () => {
    const name = crypto.randomUUID();
    const first = repository(name),
      second = repository(name);
    const storage = cache();
    const results = await Promise.all([
      migrateLegacyWorkspace(first, storage),
      migrateLegacyWorkspace(second, storage),
    ]);
    expect(
      new Set(results.filter(Boolean).map((draft) => draft!.id)).size,
    ).toBe(1);
    expect(await first.list()).toHaveLength(1);
    const old = JSON.parse(storage.original);
    storage.setItem(
      legacyWorkspaceKey,
      JSON.stringify({ ...old, updatedAt: 999, previewScrollTop: 500 }),
    );
    expect(await migrateLegacyWorkspace(first, storage)).toBeUndefined();
    storage.setItem(
      legacyWorkspaceKey,
      JSON.stringify({
        ...old,
        source: old.source + "\n\nLater unsaved writing.",
      }),
    );
    const changed = await migrateLegacyWorkspace(first, storage);
    expect(changed?.id).not.toBe(results.find(Boolean)?.id);
    expect(await first.list()).toHaveLength(2);
  });

  it("does not mark a failed save complete and retries from unchanged original writing", async () => {
    const repo = repository();
    const storage = cache();
    const save = vi
      .spyOn(repo, "importDraft")
      .mockRejectedValueOnce(new StorageError("Storage full", "QUOTA"));
    await expect(migrateLegacyWorkspace(repo, storage)).rejects.toMatchObject({
      code: "QUOTA",
    });
    expect(storage.values.size).toBe(1);
    expect(storage.getItem(legacyWorkspaceKey)).toBe(storage.original);
    expect(await repo.list()).toHaveLength(0);
    expect(await migrateLegacyWorkspace(repo, storage)).toBeDefined();
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("does not resurrect a deliberately deleted import", async () => {
    const repo = repository();
    const storage = cache();
    const imported = (await migrateLegacyWorkspace(repo, storage))!;
    await repo.remove(imported.id, imported.revision);
    expect(await migrateLegacyWorkspace(repo, storage)).toBeUndefined();
    expect(await repo.list()).toHaveLength(0);
    expect(storage.getItem(legacyWorkspaceKey)).toBe(storage.original);
  });

  it("keeps the conditional GitHub revision only for a validated GitHub save destination", async () => {
    const repo = repository();
    const storage = cache();
    const githubFile = {
      owner: "writer",
      repo: "scripts",
      branch: "main",
      path: "crossing.fountain",
      sha: "a".repeat(40),
    };
    storage.setItem(
      legacyWorkspaceKey,
      JSON.stringify({
        ...JSON.parse(storage.original),
        githubFile,
        saveDestination: "github",
      }),
    );
    expect((await migrateLegacyWorkspace(repo, storage))?.remote).toEqual({
      provider: "github",
      ...githubFile,
    });
    const drive = cache("A Drive draft without a saved file identity.");
    drive.setItem(
      legacyWorkspaceKey,
      JSON.stringify({
        ...JSON.parse(drive.original),
        githubFile,
        saveDestination: "drive",
      }),
    );
    expect((await migrateLegacyWorkspace(repo, drive))?.remote).toBeUndefined();
    const invalid = cache("An invalid GitHub reference.");
    invalid.setItem(
      legacyWorkspaceKey,
      JSON.stringify({
        ...JSON.parse(invalid.original),
        githubFile: { ...githubFile, path: "../other.fountain" },
        saveDestination: "github",
      }),
    );
    expect(
      (await migrateLegacyWorkspace(repo, invalid))?.remote,
    ).toBeUndefined();
  });

  it.each([
    "not json",
    "null",
    "[]",
    '{"version":2,"source":"text"}',
    '{"version":1,"source":42}',
  ])("leaves unsupported legacy data intact: %s", async (raw) => {
    const repo = repository();
    const storage = cache();
    storage.setItem(legacyWorkspaceKey, raw);
    expect(await migrateLegacyWorkspace(repo, storage)).toBeUndefined();
    expect(await repo.list()).toHaveLength(0);
    expect(storage.getItem(legacyWorkspaceKey)).toBe(raw);
  });
});
