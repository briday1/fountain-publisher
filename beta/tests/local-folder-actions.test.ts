import { File as NodeFile } from "node:buffer";
import { expect, it, vi } from "vitest";
import { createFileProviders } from "../src/storage/fileProviders";
import {
  copyDirectoryEntry,
  type DirectoryHandle,
  type FileHandle,
} from "../src/storage/localDirectory";
import { DocumentSession } from "../src/core/session";
import { emptyScreenplay } from "../src/core/model";
function directory(name: string, permission: PermissionState = "granted") {
  const children = new Map<string, DirectoryHandle | FileHandle>();
  const missing = () => new DOMException("Missing", "NotFoundError");
  const handle: DirectoryHandle = {
    kind: "directory",
    name,
    queryPermission: async () => permission,
    requestPermission: async () => permission,
    entries: async function* () {
      yield* children;
    },
    getDirectoryHandle: async (name, options) => {
      if (!children.has(name) && options?.create)
        children.set(name, directory(name).handle);
      const child = children.get(name);
      if (!child) throw missing();
      if (child.kind !== "directory")
        throw new DOMException("File", "TypeMismatchError");
      return child;
    },
    getFileHandle: async (name, options) => {
      if (!children.has(name) && options?.create)
        children.set(name, file(name, []).handle);
      const child = children.get(name);
      if (!child) throw missing();
      if (child.kind !== "file")
        throw new DOMException("Folder", "TypeMismatchError");
      return child;
    },
    removeEntry: vi.fn(async (name) => {
      if (!children.delete(name)) throw missing();
    }),
    resolve: async (target) => {
      for (const [name, child] of children) {
        if (child === target) return [name];
        if (child.kind === "directory") {
          const path = await child.resolve?.(target);
          if (path) return [name, ...path];
        }
      }
      return null;
    },
  };
  return { handle, children };
}
function file(name: string, initial: number[]) {
  let bytes = new Uint8Array(initial);
  const handle: FileHandle = {
    kind: "file",
    name,
    queryPermission: async () => "granted",
    requestPermission: async () => "granted",
    getFile: async () => new NodeFile([bytes], name) as unknown as File,
    createWritable: vi.fn(async () => ({
      write: async (data: string | Blob) => {
        bytes = new Uint8Array(
          typeof data === "string"
            ? new TextEncoder().encode(data)
            : await data.arrayBuffer(),
        );
      },
      close: async () => {},
    })),
  };
  return { handle };
}
it("copies complete local folder trees including binary files and empty folders, without touching originals", async () => {
  const root = directory("Writing"),
    source = directory("Book"),
    nested = directory("Images"),
    empty = directory("Empty");
  const binary = file("cover.png", [0, 255, 128, 10]),
    writing = file("Draft.md", [65, 66]);
  nested.children.set("cover.png", binary.handle);
  source.children.set("Images", nested.handle);
  source.children.set("Empty", empty.handle);
  source.children.set("Draft.md", writing.handle);
  root.children.set("Book", source.handle);
  const session = new DocumentSession({
    id: crypto.randomUUID(),
    name: "Active.md",
    screenplay: emptyScreenplay(),
    epoch: 0,
  });
  vi.spyOn(session, "flush").mockResolvedValue(undefined);
  const opened = vi.fn();
  const local = createFileProviders({
    session,
    localRoot: { current: root.handle },
    premium: true,
    mode: "open",
    valid: () => true,
    opened,
  }).local;
  try {
    const item = (await local.list()).items[0];
    await local.copy!({ item, name: "Book copy", parent: "" });
    const copy = await root.handle.getDirectoryHandle("Book copy");
    const copiedFile = await (
      await (await copy.getDirectoryHandle("Images")).getFileHandle("cover.png")
    ).getFile();
    expect([...new Uint8Array(await copiedFile.arrayBuffer())]).toEqual([
      0, 255, 128, 10,
    ]);
    expect((await copy.getDirectoryHandle("Empty")).name).toBe("Empty");
    expect(binary.handle.createWritable).not.toHaveBeenCalled();
    expect(writing.handle.createWritable).not.toHaveBeenCalled();
    expect(opened).not.toHaveBeenCalled();
    expect(session.current.name).toBe("Active.md");
    await expect(
      local.copy!({ item, name: "Book copy", parent: "" }),
    ).rejects.toMatchObject({ code: "NAME_CONFLICT" });
    await local.remove!({ item, parent: "" });
    expect(root.handle.removeEntry).toHaveBeenCalledWith("Book", {
      recursive: true,
    });
    expect(root.children.has("Book")).toBe(false);
    expect(root.children.has("Book copy")).toBe(true);
  } finally {
    session.dispose();
  }
});
it("denied copy permissions leave the destination untouched", async () => {
  const target = directory("Read only", "denied");
  await expect(
    copyDirectoryEntry(
      file("binary.dat", [255]).handle,
      target.handle,
      "binary copy.dat",
      () => {},
    ),
  ).rejects.toMatchObject({ code: "LOCAL_PERMISSION" });
  expect(target.children.size).toBe(0);
});
it("deleting a folder containing the open local file keeps its writing as a device draft", async () => {
  const root = directory("Writing"),
    book = directory("Book"),
    draft = file("Draft.md", [65]);
  root.children.set("Book", book.handle);
  book.children.set("Draft.md", draft.handle);
  const session = new DocumentSession({
    id: crypto.randomUUID(),
    name: "Draft.md",
    screenplay: emptyScreenplay(),
    epoch: 0,
  });
  session.setDestination({
    provider: "local",
    id: "draft",
    name: "Draft.md",
    revision: "r1",
    baseContent: "A",
    canWrite: true,
    handle: draft.handle,
  });
  const flush = vi.spyOn(session, "flush").mockResolvedValue(undefined);
  const local = createFileProviders({
    session,
    localRoot: { current: root.handle },
    premium: true,
    mode: "open",
    valid: () => true,
    opened: () => {},
  }).local;
  try {
    await local.remove!({ item: (await local.list()).items[0], parent: "" });
    expect(session.current.name).toBe("Draft.md");
    expect(session.current.destination).toBeUndefined();
    expect(flush).toHaveBeenCalledTimes(2);
  } finally {
    session.dispose();
  }
});
