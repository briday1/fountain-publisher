import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  createDirectoryFile, directorySupported, ensureLocalWritePermission,
  listDirectory, pickDirectory, readDirectoryFile, writeDirectoryFile,
  type DirectoryHandle, type FileHandle,
} from "../src/storage/localDirectory";

function fileHandle(name: string, initial = "Original", permission: PermissionState = "granted") {
  let content = initial;
  const abort = vi.fn(async () => {});
  const handle: FileHandle = {
    name, kind: "file",
    queryPermission: vi.fn(async () => permission),
    requestPermission: vi.fn(async () => permission),
    getFile: vi.fn(async () => {
      const bytes = new TextEncoder().encode(content);
      return { name, size: bytes.length, arrayBuffer: async () => bytes.buffer } as File;
    }),
    createWritable: vi.fn(async () => {
      let pending = "";
      return {
        write: async (next: string) => { pending = next; },
        close: async () => { content = pending; }, abort,
      };
    }),
  };
  return { handle, abort, get content() { return content; }, external(value: string) { content = value; } };
}

function directory(name = "Scripts", permission: PermissionState = "granted") {
  const children = new Map<string, DirectoryHandle | FileHandle>();
  const handle: DirectoryHandle = {
    name, kind: "directory",
    queryPermission: vi.fn(async () => permission),
    requestPermission: vi.fn(async () => permission),
    getDirectoryHandle: vi.fn(async (name) => {
      const child = children.get(name);
      if (!child) throw new DOMException("Missing", "NotFoundError");
      if (child.kind !== "directory") throw new DOMException("File", "TypeMismatchError");
      return child;
    }),
    getFileHandle: vi.fn(async (name, options) => {
      let child = children.get(name);
      if (!child && options?.create) { child = fileHandle(name, "").handle; children.set(name, child); }
      if (!child) throw new DOMException("Missing", "NotFoundError");
      if (child.kind !== "file") throw new DOMException("Directory", "TypeMismatchError");
      return child;
    }),
    entries: async function* () { yield* children.entries(); },
  };
  return { handle, children };
}

beforeEach(() => vi.stubGlobal("crypto", webcrypto));
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("reports unsupported directory browsing and invokes supported picker immediately with write access", async () => {
  expect(directorySupported()).toBe(false);
  await expect(pickDirectory("open")).rejects.toMatchObject({ code: "DIRECTORY_UNSUPPORTED" });
  const d = directory();
  const picker = vi.fn(async () => d.handle);
  Object.defineProperty(window, "showDirectoryPicker", { configurable: true, value: picker });
  try {
    expect(directorySupported()).toBe(true);
    const result = pickDirectory("open");
    expect(picker).toHaveBeenCalledWith({ mode: "readwrite", id: "writeshape-local-folder" });
    expect(await result).toBe(d.handle);
  } finally { delete (window as Window & { showDirectoryPicker?: unknown }).showDirectoryPicker; }
});

it("lists nested folders before naturally sorted files and makes imported FDX read-only", async () => {
  const d = directory();
  const folder = directory("Archive");
  const fdx = fileHandle("Draft.fdx", "<FinalDraft/>");
  d.children.set("Scene10.fountain", fileHandle("Scene10.fountain").handle);
  d.children.set("Scene2.fountain", fileHandle("Scene2.fountain").handle);
  d.children.set("Archive", folder.handle);
  d.children.set("Draft.fdx", fdx.handle);
  const items = await listDirectory(d.handle);
  expect(items.map((item) => item.name)).toEqual(["Archive", "Draft.fdx", "Scene2.fountain", "Scene10.fountain"]);
  expect(items[0].kind).toBe("folder");
  expect(items[1].canEdit).toBe(false);
  expect(items[2].canEdit).toBe(true);
  expect(fdx.handle.requestPermission).not.toHaveBeenCalled();
});

it("uses SHA256 content revisions and changes them even when byte length stays the same", async () => {
  const f = fileHandle("Draft.fountain", "alpha");
  const first = await readDirectoryFile(f.handle);
  expect(first.revision).toMatch(/^sha256:[a-f0-9]{64}$/);
  f.external("bravo");
  const second = await readDirectoryFile(f.handle);
  expect(second.revision).not.toBe(first.revision);
  expect(second.content).toBe("bravo");
  expect(f.handle.requestPermission).not.toHaveBeenCalled();
});

it("conditionally writes content and refuses a stale external edit without opening a writer", async () => {
  const f = fileHandle("Draft.fountain");
  const base = await readDirectoryFile(f.handle);
  const saved = await writeDirectoryFile(f.handle, { ...base, content: "Saved" });
  expect(saved.content).toBe("Saved");
  expect(saved.revision).not.toBe(base.revision);
  f.external("External");
  await expect(writeDirectoryFile(f.handle, { ...saved, content: "Stale" })).rejects.toMatchObject({ code: "LOCAL_CONFLICT", status: 409 });
  expect(f.content).toBe("External");
  expect(f.handle.createWritable).toHaveBeenCalledTimes(1);
  expect(f.handle.requestPermission).not.toHaveBeenCalled();
});

it("aborts the temporary writer if another edit arrives while it is being opened", async () => {
  const f = fileHandle("Draft.fountain");
  const base = await readDirectoryFile(f.handle);
  const write = vi.fn(async () => {});
  const close = vi.fn(async () => {});
  vi.mocked(f.handle.createWritable).mockImplementationOnce(async () => {
    f.external("During writer open");
    return { write, close, abort: f.abort };
  });
  await expect(writeDirectoryFile(f.handle, { ...base, content: "New" })).rejects.toMatchObject({ code: "LOCAL_CONFLICT" });
  expect(f.abort).toHaveBeenCalledOnce();
  expect(write).not.toHaveBeenCalled();
  expect(close).not.toHaveBeenCalled();
  expect(f.content).toBe("During writer open");
});

it("never requests permission during a denied background save", async () => {
  const f = fileHandle("Draft.fountain", "Original", "prompt");
  const base = await readDirectoryFile(f.handle);
  expect(base.canEdit).toBe(false);
  await expect(writeDirectoryFile(f.handle, { ...base, content: "No access" })).rejects.toMatchObject({ code: "LOCAL_PERMISSION", status: 403 });
  expect(f.handle.requestPermission).not.toHaveBeenCalled();
  expect(f.handle.createWritable).not.toHaveBeenCalled();
  expect(await ensureLocalWritePermission(f.handle)).toBe(false);
  expect(f.handle.requestPermission).toHaveBeenCalledWith({ mode: "readwrite" });
});

it("keeps FDX files import-only and rejects implicit renaming", async () => {
  const xml = fileHandle("Draft.fdx", "<FinalDraft/>");
  const base = await readDirectoryFile(xml.handle);
  expect(base.canEdit).toBe(false);
  await expect(writeDirectoryFile(xml.handle, { ...base, content: "Fountain" })).rejects.toMatchObject({ code: "UNSUPPORTED_FORMAT" });
  const f = fileHandle("Draft.fountain");
  await expect(writeDirectoryFile(f.handle, { ...await readDirectoryFile(f.handle), name: "Other.fountain" })).rejects.toMatchObject({ code: "RENAME_UNSUPPORTED" });
  expect(xml.content).toBe("<FinalDraft/>");
});

it("creates a new document and refuses an existing filename without overwriting", async () => {
  const d = directory();
  const saved = await createDirectoryFile(d.handle, "New.fountain", "New text");
  expect(saved.content).toBe("New text");
  expect(saved.handle.name).toBe("New.fountain");
  await expect(createDirectoryFile(d.handle, "New.fountain", "Overwrite")).rejects.toMatchObject({ code: "NAME_CONFLICT" });
  expect((await readDirectoryFile(saved.handle)).content).toBe("New text");
});

it("serializes concurrent same-filename creation and conditional saves without Web Locks", async () => {
  const d = directory();
  const created = await Promise.allSettled([
    createDirectoryFile(d.handle, "Same.fountain", "One"),
    createDirectoryFile(d.handle, "Same.fountain", "Two"),
  ]);
  expect(created.map((r) => r.status)).toEqual(["fulfilled", "rejected"]);
  const handle = await d.handle.getFileHandle("Same.fountain");
  const base = await readDirectoryFile(handle);
  const writes = await Promise.allSettled([
    writeDirectoryFile(handle, { ...base, content: "First write" }),
    writeDirectoryFile(handle, { ...base, content: "Stale write" }),
  ]);
  expect(writes.map((r) => r.status)).toEqual(["fulfilled", "rejected"]);
  expect((await readDirectoryFile(handle)).content).toBe("First write");
});

it("uses browser Web Locks for same-origin file writes when available", async () => {
  const f = fileHandle("Draft.fountain");
  const request = vi.fn(async (_name: string, _options: unknown, callback: () => Promise<unknown>) => callback());
  Object.defineProperty(navigator, "locks", { configurable: true, value: { request } });
  try {
    await writeDirectoryFile(f.handle, { ...await readDirectoryFile(f.handle), content: "Locked" });
    expect(request).toHaveBeenCalledWith("writeshape:local-file:draft.fountain", { mode: "exclusive" }, expect.any(Function));
  } finally { Reflect.deleteProperty(navigator, "locks"); }
});

it("does not create a file when the directory lacks write permission or name is invalid", async () => {
  const d = directory("Read only", "denied");
  await expect(createDirectoryFile(d.handle, "Draft.fountain", "No")).rejects.toMatchObject({ status: 403 });
  expect(d.handle.getFileHandle).not.toHaveBeenCalled();
  expect(d.handle.requestPermission).not.toHaveBeenCalled();
  await expect(createDirectoryFile(directory().handle, "../Draft.fountain", "No")).rejects.toMatchObject({ code: "INVALID_NAME" });
});
