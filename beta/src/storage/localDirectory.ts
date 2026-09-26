import { MAX_FILE_BYTES, readLocalFile, type FileHandle as BaseFileHandle } from "./files";

export interface LocalPermissions {
  queryPermission(options: { mode: "read" | "readwrite" }): Promise<PermissionState>;
  requestPermission(options: { mode: "read" | "readwrite" }): Promise<PermissionState>;
}

export interface FileHandle extends BaseFileHandle, LocalPermissions {
  kind: "file";
}

export interface DirectoryHandle extends LocalPermissions {
  kind: "directory";
  name: string;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirectoryHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandle>;
  entries(): AsyncIterableIterator<[string, DirectoryHandle | FileHandle]>;
}

export type DirectoryItem = {
  id: string;
  name: string;
  canEdit: boolean;
} & ({ kind: "folder"; handle: DirectoryHandle } | { kind: "file"; handle: FileHandle });

export interface LocalFileSnapshot {
  content: string;
  name: string;
  revision: string;
  canEdit: boolean;
}

export class LocalDirectoryError extends Error {
  constructor(message: string, public readonly code: string, public readonly status = 400) {
    super(message);
    this.name = "LocalDirectoryError";
  }
}

interface DirectoryWindow extends Window {
  showDirectoryPicker?: (options: { mode: "readwrite"; id: string }) => Promise<DirectoryHandle>;
}

export function directorySupported(): boolean {
  return typeof window !== "undefined" && typeof (window as DirectoryWindow).showDirectoryPicker === "function";
}

/** Call directly from a user gesture; do not await other work before this call. */
export function pickDirectory(_mode: "open" | "save"): Promise<DirectoryHandle> {
  const picker = typeof window === "undefined" ? undefined : (window as DirectoryWindow).showDirectoryPicker;
  if (!picker) return Promise.reject(new LocalDirectoryError(
    "This browser cannot browse a local folder. Use Open file or Download instead.", "DIRECTORY_UNSUPPORTED"));
  return picker.call(window, { mode: "readwrite", id: "writeshape-local-folder" });
}

/** User-action only. Background autosave must never call requestPermission. */
export async function ensureLocalWritePermission(handle: LocalPermissions): Promise<boolean> {
  return (await handle.requestPermission({ mode: "readwrite" })) === "granted";
}

async function writable(handle: LocalPermissions): Promise<boolean> {
  return (await handle.queryPermission({ mode: "readwrite" })) === "granted";
}

function textWritable(name: string): boolean {
  return /\.(?:fountain|txt|md|markdown)$/i.test(name);
}

function validName(name: string): void {
  if (!name || name === "." || name === ".." || /[/\\\0]/.test(name))
    throw new LocalDirectoryError("Choose a filename without folder separators.", "INVALID_NAME");
  if (!textWritable(name)) throw new LocalDirectoryError("Save as Markdown (.md), Fountain (.fountain), or text (.txt).", "UNSUPPORTED_FORMAT");
}

async function requireWritable(handle: LocalPermissions): Promise<void> {
  if (!(await writable(handle))) throw new LocalDirectoryError(
    "Write access is not granted. Choose the folder or explicitly allow saving again.", "LOCAL_PERMISSION", 403);
}

export async function listDirectory(directory: DirectoryHandle): Promise<DirectoryItem[]> {
  const result: DirectoryItem[] = [];
  for await (const [name, handle] of directory.entries()) {
    if (handle.kind === "directory") {
      result.push({ id: name, name, kind: "folder", handle, canEdit: await writable(handle) });
    } else {
      result.push({ id: name, name, kind: "file", handle, canEdit: textWritable(name) && await writable(handle) });
    }
  }
  return result.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "folder" ? -1 : 1)
    || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
}

async function revision(file: File): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new LocalDirectoryError(
    "This browser cannot safely verify file changes. Use Open file or Download instead.", "REVISION_UNSUPPORTED");
  const hash = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return `sha256:${Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export async function readDirectoryFile(handle: FileHandle): Promise<LocalFileSnapshot> {
  const file = await handle.getFile();
  const parsed = await readLocalFile(file);
  return { ...parsed, revision: await revision(file), canEdit: textWritable(handle.name) && await writable(handle) };
}

const queues = new Map<string, Promise<unknown>>();
async function locked<T>(name: string, action: () => Promise<T>): Promise<T> {
  // A filename-wide lock deliberately over-serializes files in different folders;
  // handles have no stable cross-tab path. It still protects same-file writers.
  const key = `writeshape:local-file:${name.normalize("NFC").toLocaleLowerCase()}`;
  if (typeof navigator !== "undefined" && navigator.locks?.request)
    return navigator.locks.request(key, { mode: "exclusive" }, action);
  // Older browsers get in-instance serialization, not a cross-tab guarantee.
  const previous = queues.get(key) ?? Promise.resolve();
  const task = previous.catch(() => {}).then(action);
  queues.set(key, task);
  try { return await task; }
  finally { if (queues.get(key) === task) queues.delete(key); }
}

async function writeChecked(handle: FileHandle, content: string, expected: string): Promise<LocalFileSnapshot> {
  await requireWritable(handle);
  if (new TextEncoder().encode(content).byteLength > MAX_FILE_BYTES)
    throw new LocalDirectoryError("This file exceeds the 10 MB screenplay limit.", "FILE_TOO_LARGE");
  if (await revision(await handle.getFile()) !== expected) throw new LocalDirectoryError(
    "This local file changed in another instance. Your draft is preserved.", "LOCAL_CONFLICT", 409);
  const stream = await handle.createWritable();
  try {
    // Check again after opening the temporary writable stream. Browser APIs offer
    // no atomic comparison with external applications, so this is best effort.
    if (await revision(await handle.getFile()) !== expected) throw new LocalDirectoryError(
      "This local file changed before saving. Your draft is preserved.", "LOCAL_CONFLICT", 409);
    await stream.write(content);
    await stream.close();
  } catch (error) {
    await stream.abort?.().catch(() => {});
    throw error;
  }
  return readDirectoryFile(handle);
}

export function writeDirectoryFile(handle: FileHandle, draft: {
  content: string;
  name: string;
  revision: string;
}): Promise<LocalFileSnapshot> {
  return locked(handle.name, async () => {
    validName(draft.name);
    if (draft.name !== handle.name) throw new LocalDirectoryError(
      "Use Save as to save this draft under a different filename.", "RENAME_UNSUPPORTED");
    return writeChecked(handle, draft.content, draft.revision);
  });
}

export function createDirectoryFile(directory: DirectoryHandle, name: string, content: string): Promise<LocalFileSnapshot & { handle: FileHandle }> {
  return locked(name, async () => {
    validName(name);
    if (new TextEncoder().encode(content).byteLength > MAX_FILE_BYTES)
      throw new LocalDirectoryError("This file exceeds the 10 MB screenplay limit.", "FILE_TOO_LARGE");
    await requireWritable(directory);
    try {
      await directory.getFileHandle(name);
      throw new LocalDirectoryError("A file with this name already exists. Choose another name.", "NAME_CONFLICT", 409);
    } catch (error) {
      if ((error as { name?: string })?.name !== "NotFoundError") throw error;
    }
    // File System Access has no exclusive-create flag. Same-origin creation is
    // locked; an external process racing creation cannot be made fully atomic.
    const handle = await directory.getFileHandle(name, { create: true });
    const file = await handle.getFile();
    if (file.size !== 0) throw new LocalDirectoryError(
      "A file appeared with this name. Choose another name.", "NAME_CONFLICT", 409);
    const saved = await writeChecked(handle, content, await revision(file));
    return { ...saved, handle };
  });
}
