import { it, expect, vi } from "vitest";
import { createFileProviders } from "../src/storage/fileProviders";
import { DocumentSession } from "../src/core/session";
import { emptyScreenplay } from "../src/core/model";
import type { DirectoryHandle } from "../src/storage/localDirectory";
it("retains the chosen local folder across picker and document changes, and permits changing folders", async () => {
  const folder = (name: string) =>
    ({
      kind: "directory",
      name,
      queryPermission: async () => "granted",
      requestPermission: async () => "granted",
      async *entries() {},
      getDirectoryHandle: vi.fn(),
      getFileHandle: vi.fn(),
    }) as DirectoryHandle;
  const one = folder("Writing"),
    two = folder("Books");
  const picker = vi.fn().mockResolvedValueOnce(one).mockResolvedValueOnce(two);
  Object.assign(window, { showDirectoryPicker: picker });
  const localRoot: { current?: DirectoryHandle } = {};
  const sessions: DocumentSession[] = [];
  const provider = () => {
    const session = new DocumentSession({
      id: crypto.randomUUID(),
      name: "Draft.fountain",
      screenplay: emptyScreenplay(),
      epoch: 0,
    });
    sessions.push(session);
    return createFileProviders({
      session,
      localRoot,
      premium: true,
      mode: "open",
      valid: () => true,
      opened: () => {},
    }).local;
  };
  try {
    const first = provider();
    expect((await first.status()).connected).toBe(false);
    await first.connect!();
    const next = provider();
    expect((await next.status()).label).toBe("Writing");
    expect((await next.status()).connected).toBe(true);
    expect(await next.list()).toMatchObject({ items: [], writable: true });
    expect(picker).toHaveBeenCalledTimes(1);
    await next.connect!();
    expect((await provider().status()).label).toBe("Books");
    expect(picker).toHaveBeenCalledTimes(2);
  } finally {
    sessions.forEach((s) => s.dispose());
    delete (window as any).showDirectoryPicker;
  }
});
