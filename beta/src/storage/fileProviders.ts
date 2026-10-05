import type { FilesProvider } from "../components/WriteShapeFiles";
import type { DocumentSession } from "../core/session";
import { serializeDocument } from "../core/documentFormat";
import { importScreenplay } from "../core/fdx";
import { cloudRequest } from "./writeshapeLibrary";
import { downloadFile } from "./files";
import {
  directorySupported,
  pickDirectory,
  listDirectory,
  readDirectoryFile,
  createDirectoryFile,
  ensureLocalWritePermission,
  copyDirectoryEntry,
} from "./localDirectory";
import type { DirectoryHandle, FileHandle } from "./localDirectory";
import type { WriteShapeDestination } from "./destinations";

export function createFileProviders(options: {
  session: DocumentSession;
  localRoot?: { current?: DirectoryHandle };
  accountId?: string;
  premium: boolean;
  mode: "open" | "save";
  valid(): boolean;
  opened(): void;
}) {
  const { session } = options;
  let root = options.localRoot?.current;
  const folders = new Map<string, DirectoryHandle>();
  const files = new Map<string, FileHandle>();
  const paths = new Map<string, { id: string; name: string }[]>();
  if (root) folders.set("root", root);
  const assertCurrent = () => {
    if (!options.valid())
      throw new Error(
        "Your account or document changed. Reopen the file browser.",
      );
  };
  const bind = async (
    content: string,
    name: string,
    destination: WriteShapeDestination,
  ) => {
    assertCurrent();
    const imported = importScreenplay(content, name);
    await session.open(
      imported.screenplay,
      imported.name,
      undefined,
      undefined,
      {
        ...destination,
        name: imported.name,
        baseContent: serializeDocument(imported.screenplay),
        canWrite: destination.canWrite && !imported.converted,
      },
      assertCurrent,
    );
    // open() may activate a new workspace buffer after its guarded commit.
    options.opened();
  };
  const create = async (
    name: string,
    action: (content: string) => Promise<WriteShapeDestination>,
  ) => {
    assertCurrent();
    const snapshot = session.capture();
    const content = serializeDocument(snapshot.screenplay);
    await session.flush();
    assertCurrent();
    const destination = await action(content);
    assertCurrent();
    if (session.current.id !== snapshot.id)
      throw new Error(
        "The saved copy is in the selected folder; your new draft is unchanged.",
      );
    session.rename(name);
    session.setDestination({ ...destination, name, baseContent: content });
    await session.flush();
    options.opened();
  };
  const drive: FilesProvider = {
    async status() {
      if (!options.accountId)
        return {
          available: true,
          connected: false,
          message: "Sign in to WriteShape to connect Google Drive.",
        };
      const state = await cloudRequest("/api/drive/status");
      return {
        available: state.configured,
        reconnect: state.reconnect,
        connected: state.connected && options.premium,
        label: state.email || "Google Drive",
        message: !options.premium
          ? "Drive sync paused. Premium required. Your files remain available in Google Drive."
          : state.reason,
        writable: options.premium && state.canWrite,
      };
    },
    async connect() {
      assertCurrent();
      await session.flush();
      assertCurrent();
      const result = await cloudRequest("/api/drive/connect", {});
      assertCurrent();
      location.assign(result.url);
    },
    async list(parent = "root") {
      let pageToken: string | undefined;
      const items: any[] = [];
      do {
        const data = await cloudRequest(
          "/api/drive/browser?parent=" +
            encodeURIComponent(parent) +
            (pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : ""),
        );
        items.push(
          ...data.items.map((item: any) => ({
            ...item,
            size: item.bytes,
            modified: item.modifiedTime,
          })),
        );
        pageToken = data.nextPageToken;
      } while (pageToken);
      for (const item of items)
        if (item.kind === "folder")
          paths.set(item.id, [
            ...(paths.get(parent) || []),
            { id: item.id, name: item.name },
          ]);
      return {
        items,
        breadcrumbs: paths.get(parent) || [],
        writable: options.premium,
      };
    },
    async open(item) {
      assertCurrent();
      const token = session.token();
      const data = await cloudRequest(
        "/api/drive/open?id=" + encodeURIComponent(item.id),
      );
      assertCurrent();
      session.assertCurrent(token);
      await bind(data.content, data.name, {
        provider: "drive",
        id: data.id,
        accountId: options.accountId,
        name: data.name,
        revision: data.etag,
        baseContent: "",
        canWrite: data.canEdit,
      });
    },
    async create({ name, content, parent }) {
      assertCurrent();
      await session.flush();
      assertCurrent();
      const data = await cloudRequest("/api/drive/create", {
        name,
        content,
        parent: parent || "root",
      });
      await bind(data.content ?? content, data.name, {
        provider: "drive",
        id: data.id,
        accountId: options.accountId,
        name: data.name,
        revision: data.etag,
        baseContent: content,
        canWrite: true,
      });
    },
    async save({ name, parent }) {
      await create(name, async (content) => {
        const data = await cloudRequest("/api/drive/create", {
          name,
          parent: parent || "root",
          content,
        });
        return {
          provider: "drive",
          id: data.id,
          accountId: options.accountId,
          name: data.name,
          revision: data.etag,
          baseContent: content,
          canWrite: true,
        };
      });
    },
  };
  const local: FilesProvider = {
    async mkdir({ name, parent }) {
      assertCurrent();
      const target = folders.get(parent || "root");
      if (!target) throw new Error("Choose a local folder.");
      if (!name.trim() || name === "." || name === ".." || /[/\\\0]/.test(name))
        throw new Error("Choose a valid folder name.");
      if (!(await ensureLocalWritePermission(target)))
        throw new Error("Folder write permission is required.");
      for await (const [existing] of target.entries())
        if (existing.toLocaleLowerCase() === name.toLocaleLowerCase())
          throw new Error("An item with this name already exists.");
      assertCurrent();
      await target.getDirectoryHandle(name, { create: true });
    },
    async remove({ item, parent }) {
      assertCurrent();
      const target = folders.get(parent || "root");
      const source =
        item.kind === "folder" ? folders.get(item.id) : files.get(item.id);
      if (!target?.removeEntry || !source)
        throw new Error("Choose this item and folder again.");
      if (!(await ensureLocalWritePermission(target)))
        throw new Error("Folder write permission is required to delete here.");
      const binding = session.current.destination;
      const currentHandle =
        binding?.provider === "local" ? binding.handle : undefined;
      const containsOpenFile =
        !!currentHandle &&
        (source.kind === "directory"
          ? !!(await source.resolve?.(currentHandle))
          : source === currentHandle ||
            !!(await source.isSameEntry?.(currentHandle)));
      await session.flush();
      assertCurrent();
      await target.removeEntry(item.name, {
        recursive: item.kind === "folder",
      });
      // Keep the open writing as a device draft, without autosaving to a deleted file.
      if (containsOpenFile && session.current.destination === binding) {
        session.setDestination(undefined);
        await session.flush();
      }
    },
    async copy({ item, name, parent }) {
      assertCurrent();
      const source =
        item.kind === "folder" ? folders.get(item.id) : files.get(item.id);
      const destination = folders.get(parent || "root");
      if (!source || !destination)
        throw new Error("Choose this file and folder again.");
      const permission = ensureLocalWritePermission(destination);
      if (!(await permission))
        throw new Error("Folder write permission is required to copy here.");
      assertCurrent();
      await copyDirectoryEntry(source, destination, name, assertCurrent);
    },
    async download(item) {
      const source = files.get(item.id);
      if (!source) throw new Error("Choose this file again.");
      const data = await source.getFile();
      assertCurrent();
      downloadFile(data, source.name);
    },
    async status() {
      return {
        available: directorySupported(),
        connected: !!root,
        label: root?.name || "Local folder",
        message: directorySupported()
          ? "Choose a folder on this device. Local files do not sync across devices."
          : "Your writing autosaves on this device. Open it again below; download a copy when you want a separate file in Files or another app.",
        writable: true,
      };
    },
    async connect() {
      // Native picker must be invoked synchronously from the click.
      const picked = await pickDirectory(options.mode);
      assertCurrent();
      if (!picked) return;
      root = picked;
      if (options.localRoot) options.localRoot.current = picked;
      folders.clear();
      files.clear();
      paths.clear();
      folders.set("root", root);
    },
    async list(parent = "root") {
      const folder = folders.get(parent || "root");
      if (!folder) return { items: [], breadcrumbs: [] };
      const children = await listDirectory(folder);
      const items = children.map((item) => {
        const id = (parent || "root") + "/" + encodeURIComponent(item.name);
        if (item.kind === "folder") {
          folders.set(id, item.handle as DirectoryHandle);
          paths.set(id, [
            ...(paths.get(parent) || []),
            { id, name: item.name },
          ]);
        } else files.set(id, item.handle as FileHandle);
        return { id, name: item.name, kind: item.kind, canEdit: item.canEdit };
      });
      return { items, breadcrumbs: paths.get(parent) || [], writable: true };
    },
    async open(item) {
      const handle = files.get(item.id);
      if (!handle) throw new Error("Choose this file again.");
      const permission = ensureLocalWritePermission(handle);
      assertCurrent();
      const token = session.token();
      const writable = await permission;
      const data = await readDirectoryFile(handle);
      assertCurrent();
      session.assertCurrent(token);
      await bind(data.content, data.name, {
        provider: "local",
        id: crypto.randomUUID(),
        name: data.name,
        revision: data.revision,
        baseContent: "",
        canWrite: writable && data.canEdit,
        handle,
      });
    },
    async create({ name, content, parent }) {
      const folder = folders.get(parent || "root");
      if (!folder) throw new Error("Choose a local folder.");
      const permission = ensureLocalWritePermission(folder);
      assertCurrent();
      if (!(await permission))
        throw new Error(
          "Folder write permission is required to create a file.",
        );
      await session.flush();
      assertCurrent();
      const data = await createDirectoryFile(folder, name, content);
      await bind(content, name, {
        provider: "local",
        id: crypto.randomUUID(),
        name,
        revision: data.revision,
        baseContent: content,
        canWrite: true,
        handle: data.handle,
      });
    },
    async save({ name, parent }) {
      const folder = folders.get(parent || "root");
      if (!folder) throw new Error("Choose a local folder.");
      const permission = ensureLocalWritePermission(folder);
      if (!(await permission))
        throw new Error("Folder write permission is required to save here.");
      await create(name, async (content) => {
        const data = await createDirectoryFile(folder, name, content);
        return {
          provider: "local",
          id: crypto.randomUUID(),
          name: data.name,
          revision: data.revision,
          baseContent: content,
          canWrite: true,
          handle: data.handle,
        };
      });
    },
  };
  return { drive, local };
}
