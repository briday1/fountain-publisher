import { LibraryError } from "../src/storage/writeshapeLibrary";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeAll, expect, it, vi } from "vitest";
import { WriteShapeFiles } from "../src/components/WriteShapeFiles";
import type {
  FilesProvider,
  WriteShapeFilesProps,
} from "../src/components/WriteShapeFiles";
beforeAll(() => {
  Object.assign(globalThis, {
    IS_REACT_ACT_ENVIRONMENT: true,
    ResizeObserver: class {
      observe() {}
      disconnect() {}
    },
  });
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
const file = {
  id: "file",
  name: "Scene.fountain",
  kind: "file" as const,
  size: 300,
  modified: 1700000000000,
};
function provider(connected = true): FilesProvider {
  return {
    status: vi.fn(async () => ({
      available: true,
      connected,
      writable: true,
      label: "Scripts",
    })),
    connect: vi.fn(async () => {}),
    list: vi.fn(async () => ({ items: [file], breadcrumbs: [] })),
    open: vi.fn(async () => {}),
    save: vi.fn(async () => {}),
  };
}
async function mount(overrides: Partial<WriteShapeFilesProps> = {}) {
  const props: WriteShapeFilesProps = {
    mode: "open",
    name: "Draft",
    account: { authenticated: true, premium: true },
    providers: { drive: provider(), local: provider() },
    initialDestination: "local",
    captureSave: () => ({ content: "", onSaved: () => {} }),
    onOpen: async () => {},
    onClose: vi.fn(),
    onSignIn: vi.fn(),
    onUpgrade: vi.fn(),
    onOpenLocalFile: vi.fn(),
    onDownloadLocal: vi.fn(),
    ...overrides,
  };
  const node = document.createElement("div");
  document.body.append(node);
  const root = createRoot(node);
  await act(async () => root.render(<WriteShapeFiles {...props} />));
  return {
    node,
    props,
    close: async () => {
      await act(async () => root.unmount());
      node.remove();
    },
  };
}
function button(node: HTMLElement, label: string) {
  const b = [...node.querySelectorAll("button")].find(
    (b) => b.textContent === label,
  );
  if (!b) throw Error(label);
  return b;
}
it("uses one modal, keyboard-switchable tabs and native local connect directly in user gesture", async () => {
  const local = provider(false);
  let gesture = false;
  local.connect = vi.fn(async () => {
    expect(gesture).toBe(true);
  });
  const h = await mount({ providers: { local, drive: provider(false) } });
  expect(h.node.querySelectorAll("dialog")).toHaveLength(1);
  expect(h.node.querySelectorAll('[role="tab"]')).toHaveLength(3);
  await act(async () => {
    gesture = true;
    button(h.node, "Open local folder").click();
    gesture = false;
  });
  expect(local.connect).toHaveBeenCalledOnce();
  await act(async () =>
    h.node
      .querySelector('[role="tab"][aria-selected="true"]')!
      .dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
      ),
  );
  expect(button(h.node, "Google Drive").getAttribute("aria-selected")).toBe(
    "true",
  );
  await h.close();
});
it("does not close until safe open resolves and disables switching while busy", async () => {
  const local = provider();
  let finish!: () => void;
  local.open = vi.fn(() => new Promise<void>((r) => (finish = r)));
  const h = await mount({ providers: { local, drive: provider() } });
  await act(async () =>
    (h.node.querySelector('[role="option"]') as HTMLElement).click(),
  );
  await act(async () => button(h.node, "Open file").click());
  expect(h.props.onClose).not.toHaveBeenCalled();
  expect(button(h.node, "Google Drive").disabled).toBe(true);
  await act(async () => finish());
  expect(h.props.onClose).toHaveBeenCalledOnce();
  await h.close();
});
it("saving never passes selected-file IDs or overwrites; read-only folder disables saves", async () => {
  const local = provider();
  const h = await mount({
    mode: "save",
    providers: { local, drive: provider() },
  });
  await act(async () =>
    (h.node.querySelector('[role="option"]') as HTMLElement).click(),
  );
  await act(async () => button(h.node, "Save new file").click());
  expect(local.save).toHaveBeenCalledWith({
    name: "Draft.fountain",
    parent: "",
  });
  await h.close();
  const readonly = provider();
  readonly.list = async () => ({
    items: [file],
    breadcrumbs: [],
    writable: false,
  });
  const r = await mount({
    mode: "save",
    providers: { local: readonly, drive: provider() },
  });
  expect(button(r.node, "Save new file").disabled).toBe(true);
  expect(r.node.textContent).toContain("folder is read only");
  await r.close();
});
it("unsupported native directory access offers honest local fallback while Drive connect stays Premium", async () => {
  const local = provider(false);
  local.status = async () => ({ available: false, connected: false });
  const h = await mount({
    account: { authenticated: false, premium: false },
    providers: { local, drive: provider(false) },
  });
  expect(h.node.textContent).toContain("Autosaved on this device");
  await act(async () => button(h.node, "Open a local file").click());
  expect(h.props.onOpenLocalFile).toHaveBeenCalledOnce();
  await act(async () => button(h.node, "Google Drive").click());
  expect(h.node.textContent).toContain("Sign in to connect Drive");
  expect(h.props.providers.drive.connect).not.toHaveBeenCalled();
  await h.close();
});
it("failed folder loads leave saving disabled", async () => {
  const local = provider();
  local.list = async () => {
    throw Error("Permission denied");
  };
  const h = await mount({
    mode: "save",
    providers: { local, drive: provider() },
  });
  expect(h.node.textContent).toContain("Permission denied");
  expect(button(h.node, "Save new file").disabled).toBe(true);
  await h.close();
});
it("embeds the existing WriteShape library in the common modal without a second dialog", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            items: [],
            breadcrumbs: [],
            canWrite: true,
            usage: {
              usedBytes: 0,
              currentBytes: 0,
              historyBytes: 0,
              quotaBytes: null,
              historyLimit: null,
              fileCount: 0,
              folderCount: 0,
              versionCount: 0,
            },
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    ),
  );
  const h = await mount({ initialDestination: "writeshape" });
  try {
    expect(h.node.querySelectorAll("dialog")).toHaveLength(1);
    expect(h.node.textContent).toContain("My Storage");
    expect(h.node.textContent).toContain("Unlimited");
    expect(button(h.node, "WriteShape").getAttribute("aria-selected")).toBe(
      "true",
    );
  } finally {
    await h.close();
    vi.unstubAllGlobals();
  }
});
it("an unsafe or failed document switch leaves the picker open with its error", async () => {
  const local = provider();
  local.open = vi.fn(async () => {
    throw Error("Your draft changed. Open the picker again.");
  });
  const h = await mount({ providers: { local, drive: provider() } });
  try {
    await act(async () =>
      (h.node.querySelector('[role="option"]') as HTMLElement).click(),
    );
    await act(async () => button(h.node, "Open file").click());
    expect(h.props.onClose).not.toHaveBeenCalled();
    expect(h.node.textContent).toContain("Your draft changed");
    expect(button(h.node, "Google Drive").disabled).toBe(false);
  } finally {
    await h.close();
  }
});

it("a revoked Drive grant removes Connected and offers reconnection without closing the draft", async () => {
  const drive = provider();
  drive.list = vi.fn(async () => {
    throw new LibraryError(
      "Reconnect Google Drive to continue.",
      401,
      "DRIVE_RECONNECT_REQUIRED",
    );
  });
  const h = await mount({
    initialDestination: "drive",
    providers: { drive, local: provider() },
  });
  try {
    expect(h.node.querySelector(".files-connected")).toBeNull();
    expect(button(h.node, "Reconnect Google Drive").disabled).toBe(false);
    expect(h.props.onClose).not.toHaveBeenCalled();
    expect(drive.list).toHaveBeenCalledOnce();
    await act(async () => button(h.node, "Reconnect Google Drive").click());
    expect(drive.connect).toHaveBeenCalledOnce();
  } finally {
    await h.close();
  }
});
it("a folder failure does not keep a misleading Connected badge and retains retry", async () => {
  const drive = provider();
  drive.list = vi.fn(async () => {
    throw Error("Drive is temporarily unavailable.");
  });
  const h = await mount({
    initialDestination: "drive",
    providers: { drive, local: provider() },
  });
  try {
    expect(h.node.querySelector(".files-connected")?.textContent).toBe(
      "Connection needs attention",
    );
    drive.list = vi.fn(async () => ({ items: [file], breadcrumbs: [] }));
    await act(async () => button(h.node, "Try again").click());
    expect(h.node.querySelector(".files-connected")?.textContent).toBe(
      "Connected",
    );
    expect(h.node.textContent).toContain("Scene.fountain");
  } finally {
    await h.close();
  }
});

it("local Copy creates a separate file and keeps the browser and active draft open", async () => {
  const local = provider();
  local.copy = vi.fn(async () => {});
  const h = await mount({ providers: { local, drive: provider() } });
  try {
    await act(async () =>
      h.node.querySelector<HTMLElement>('[role="option"]')!.click(),
    );
    await act(async () =>
      h.node
        .querySelector<HTMLButtonElement>(
          '[aria-label="Actions for Scene.fountain"]',
        )!
        .click(),
    );
    await act(async () => button(h.node, "Copy").click());
    expect(
      h.node.querySelector<HTMLInputElement>('[aria-label="Copy name"]')?.value,
    ).toBe("Scene copy.fountain");
    await act(async () => button(h.node, "Create copy").click());
    expect(local.copy).toHaveBeenCalledWith({
      item: file,
      name: "Scene copy.fountain",
      parent: "",
    });
    expect(local.open).not.toHaveBeenCalled();
    expect(h.props.onClose).not.toHaveBeenCalled();
    expect(h.node.querySelector('[role="status"]')?.textContent).toContain(
      "Created “Scene copy.fountain”",
    );
  } finally {
    await h.close();
  }
});

it("local folders expose Copy and Delete in the item menu, and delete requires confirmation", async () => {
  const local = provider();
  const folder = { id: "folder", name: "Book", kind: "folder" as const };
  local.list = vi.fn(async () => ({ items: [folder], breadcrumbs: [] }));
  local.copy = vi.fn(async () => {});
  local.remove = vi.fn(async () => {});
  const h = await mount({ providers: { local, drive: provider() } });
  const menu = () =>
    h.node.querySelector<HTMLButtonElement>('[aria-label="Actions for Book"]')!;
  try {
    expect(h.node.querySelector(".library-actionbar")).toBeNull();
    await act(async () => menu().click());
    expect(
      h.node.querySelector(".anchored-menu-popup")?.closest("dialog"),
    ).not.toBeNull();
    await act(async () => button(h.node, "Copy").click());
    expect(
      h.node.querySelector<HTMLInputElement>('[aria-label="Copy name"]')?.value,
    ).toBe("Book copy");
    await act(async () => button(h.node, "Create copy").click());
    expect(local.copy).toHaveBeenCalledWith({
      item: folder,
      name: "Book copy",
      parent: "",
    });
    await act(async () => menu().click());
    await act(async () => button(h.node, "Delete").click());
    expect(local.remove).not.toHaveBeenCalled();
    expect(h.node.textContent).toContain("and everything inside it");
    await act(async () => button(h.node, "Delete folder").click());
    expect(local.remove).toHaveBeenCalledWith({ item: folder, parent: "" });
    expect(local.open).not.toHaveBeenCalled();
    expect(h.props.onClose).not.toHaveBeenCalled();
  } finally {
    await h.close();
  }
});
