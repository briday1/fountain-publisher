import type { FilesProvider } from "../components/WriteShapeFiles";
import type { DocumentSession } from "../core/session";
import { serializeFountain } from "../core/fountain";
import { importScreenplay } from "../core/fdx";
import { cloudRequest } from "./writeshapeLibrary";
import {
  directorySupported,
  pickDirectory,
  listDirectory,
  readDirectoryFile,
  createDirectoryFile,
  ensureLocalWritePermission,
} from "./localDirectory";
import type { DirectoryHandle, FileHandle } from "./localDirectory";
import type { WriteShapeDestination } from "./destinations";

export function createFileProviders(options: {
  session: DocumentSession;
  accountId?: string;
  premium: boolean;
  mode: "open" | "save";
  valid(): boolean;
  opened(): void;
}) {
  const { session } = options;
  let root: DirectoryHandle | undefined;
  const folders = new Map<string, DirectoryHandle>();
  const files = new Map<string, FileHandle>();
  const paths = new Map<string, { id: string; name: string }[]>();
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
        baseContent: serializeFountain(imported.screenplay),
        canWrite: destination.canWrite && !imported.converted,
      },
      assertCurrent,
    );
    assertCurrent();
    options.opened();
  };
  const create = async (
    name: string,
    action: (content: string) => Promise<WriteShapeDestination>,
  ) => {
    assertCurrent();
    const snapshot = session.capture();
    const content = serializeFountain(snapshot.screenplay);
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
        connected: state.connected,
        label: state.email || "Google Drive",
        message: state.reason,
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
    async status() {
      return {
        available: directorySupported(),
        connected: !!root,
        label: root?.name || "Local folder",
        message: directorySupported()
          ? "Choose a folder on this device. Local files do not sync across devices."
          : "This browser supports opening files and downloading copies. Folder autosave is unavailable.",
        writable: true,
      };
    },
    async connect() {
      // Native picker must be invoked synchronously from the click.
      const picked = await pickDirectory(options.mode);
      assertCurrent();
      if (!picked) return;
      root = picked;
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
