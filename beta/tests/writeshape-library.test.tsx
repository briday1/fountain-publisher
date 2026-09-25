// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { WriteShapeLibrary } from "../src/components/WriteShapeLibrary";
import { LibraryHistory } from "../src/components/LibraryHistory";
import { LibrarySharing, SharedWithMe } from "../src/components/LibrarySharing";
import {
  sortedLibraryItems,
  LibraryError,
} from "../src/storage/writeshapeLibrary";
import type { LibraryFile } from "../src/storage/writeshapeLibrary";
const api = vi.hoisted(() => vi.fn());
vi.mock("../src/storage/writeshapeLibrary", async (original) => ({
  ...(await original<object>()),
  libraryRequest: api,
  cloudRequest: api,
}));
beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
afterEach(() => vi.clearAllMocks());
const folder: LibraryFile = {
  id: "folder",
  parent: "",
  name: "Scripts",
  kind: "folder",
  revision: 1,
};
const file: LibraryFile = {
  id: "file",
  parent: "folder",
  name: "Light.fountain",
  kind: "file",
  revision: 3,
  bytes: 100,
};
const usage = {
  usedBytes: 140,
  currentBytes: 100,
  historyBytes: 40,
  quotaBytes: null,
  historyLimit: null,
  fileCount: 1,
  folderCount: 1,
  versionCount: 2,
};
async function mount(component: React.ReactNode) {
  const node = document.createElement("div");
  document.body.append(node);
  const root = createRoot(node);
  await act(async () => root.render(component));
  return {
    node,
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
  if (!b) throw Error("Missing button " + label);
  return b;
}
const click = async (node: HTMLElement, label: string) => {
  await act(async () => button(node, label).click());
};
it("sorts folders before files, natural names, size and folder search without mutating input", () => {
  const items = [
    { ...file, id: "2", name: "Scene 10", bytes: 10 },
    { ...file, id: "1", name: "Scene 2", bytes: 30 },
    folder,
  ];
  expect(sortedLibraryItems(items, "", "name").map((i) => i.id)).toEqual([
    "folder",
    "1",
    "2",
  ]);
  expect(sortedLibraryItems(items, "scene", "size").map((i) => i.id)).toEqual([
    "1",
    "2",
  ]);
  expect(items[0].id).toBe("2");
});
it("navigates folders with keyboard, shows Unlimited usage, and fetches the selected file before opening", async () => {
  api.mockImplementation(async (path: string) =>
    path === "?parent="
      ? { items: [folder], breadcrumbs: [], usage, canWrite: true }
      : path === "?parent=folder"
        ? { items: [file], breadcrumbs: [folder], usage, canWrite: true }
        : { ...file, content: "INT. TEST - DAY" },
  );
  const onOpen = vi.fn(async () => {}),
    onClose = vi.fn();
  const { node, close } = await mount(
    <WriteShapeLibrary
      mode="open"
      name="Draft"
      captureSave={() => ({ content: "", onSaved: () => {} })}
      onOpen={onOpen}
      onClose={onClose}
    />,
  );
  try {
    expect(node.textContent).toContain("Unlimited");
    const row = node.querySelector("[role=option]")!;
    await act(async () =>
      row.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      ),
    );
    expect(node.textContent).toContain("Light.fountain");
    await act(async () =>
      node.querySelector<HTMLElement>("[role=option]")!.click(),
    );
    await click(node, "Open file");
    expect(onOpen).toHaveBeenCalledWith(
      expect.objectContaining({ content: "INT. TEST - DAY" }),
    );
    expect(onClose).toHaveBeenCalledOnce();
  } finally {
    await close();
  }
});
it("new cloud saves capture the draft once and acknowledge only a successful request", async () => {
  api.mockImplementation(async (path: string, body: unknown) =>
    body
      ? { ...file, name: "Draft.fountain" }
      : { items: [], breadcrumbs: [], usage, canWrite: true },
  );
  const saved = vi.fn(),
    capture = vi.fn(() => ({ content: "captured draft", onSaved: saved })),
    closed = vi.fn();
  const { node, close } = await mount(
    <WriteShapeLibrary
      mode="save"
      name="Draft"
      captureSave={capture}
      onOpen={async () => {}}
      onClose={closed}
    />,
  );
  try {
    await act(async () =>
      node
        .querySelector("form")!
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        ),
    );
    expect(capture).toHaveBeenCalledOnce();
    expect(api).toHaveBeenCalledWith("", {
      name: "Draft.fountain",
      parent: "",
      kind: "file",
      content: "captured draft",
    });
    expect(saved).toHaveBeenCalledOnce();
    expect(closed).toHaveBeenCalledOnce();
  } finally {
    await close();
  }
});
it("failed save keeps the dialog open and never acknowledges or loses the draft", async () => {
  api.mockImplementation(async (path: string, body: unknown) => {
    if (body)
      throw new LibraryError("Storage limit reached.", 409, "QUOTA_EXCEEDED");
    return { items: [], breadcrumbs: [], usage, canWrite: true };
  });
  const saved = vi.fn(),
    closed = vi.fn();
  const { node, close } = await mount(
    <WriteShapeLibrary
      mode="save"
      name="Draft"
      captureSave={() => ({ content: "draft", onSaved: saved })}
      onOpen={async () => {}}
      onClose={closed}
    />,
  );
  try {
    await act(async () =>
      node
        .querySelector("form")!
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        ),
    );
    expect(node.querySelector("[role=alert]")?.textContent).toContain(
      "Storage limit reached.",
    );
    expect(saved).not.toHaveBeenCalled();
    expect(closed).not.toHaveBeenCalled();
  } finally {
    await close();
  }
});
it("history restore uses the current revision, creates a new version, and does not open or overwrite the local draft", async () => {
  const old = {
    id: "file:1",
    revision: 1,
    name: file.name,
    savedAt: "2026-09-24T12:00:00Z",
    bytes: 10,
    current: false,
    content: "Earlier draft",
  };
  const latest = {
    ...old,
    id: "file:3",
    revision: 3,
    current: true,
    content: "Latest draft",
  };
  let restored = false;
  api.mockImplementation(async (path: string, body: any) => {
    if (path.endsWith("/restore")) {
      expect(body).toEqual({ versionId: "file:1", revision: 3 });
      restored = true;
      return { ...file, revision: 4, versionId: "file:4" };
    }
    if (path.endsWith("/versions"))
      return {
        file: { ...file, revision: restored ? 4 : 3 },
        versions: restored
          ? [{ ...latest, id: "file:4", revision: 4 }, old]
          : [latest, old],
      };
    return path.endsWith("file%3A1")
      ? old
      : {
          ...latest,
          id: restored ? "file:4" : "file:3",
          revision: restored ? 4 : 3,
        };
  });
  const opened = vi.fn(async () => {}),
    changed = vi.fn();
  const { node, close } = await mount(
    <LibraryHistory
      file={file}
      canWrite
      onBack={() => {}}
      onOpen={opened}
      onChanged={changed}
    />,
  );
  try {
    const oldButton = [
      ...node.querySelectorAll(".library-version-list button"),
    ].find((b) => b.textContent?.startsWith("Version 1"))!;
    await act(async () => (oldButton as HTMLElement).click());
    expect(node.querySelector("pre")?.textContent).toBe("Earlier draft");
    await click(node, "Restore as new version");
    expect(node.textContent).toContain(
      "Current version 3 and all history will be kept",
    );
    await click(node, "Confirm restore");
    expect(node.textContent).toContain("Version 1 restored as version 4");
    expect(changed).toHaveBeenCalledOnce();
    expect(opened).not.toHaveBeenCalled();
  } finally {
    await close();
  }
});
it("history conflicts preserve the preview and require refreshing before a successful restore", async () => {
  const old = {
    id: "file:1",
    revision: 1,
    name: file.name,
    savedAt: "",
    bytes: 10,
    current: false,
    content: "Original",
  };
  api.mockImplementation(async (path: string) => {
    if (path.endsWith("/restore"))
      throw new LibraryError(
        "A newer version exists.",
        409,
        "REVISION_CONFLICT",
      );
    return path.endsWith("/versions") ? { file, versions: [old] } : old;
  });
  const changed = vi.fn();
  const { node, close } = await mount(
    <LibraryHistory
      file={file}
      canWrite
      onBack={() => {}}
      onOpen={async () => {}}
      onChanged={changed}
    />,
  );
  try {
    await click(node, "Restore as new version");
    await click(node, "Confirm restore");
    expect(node.querySelector("[role=alert]")?.textContent).toContain(
      "A newer version exists.",
    );
    expect(node.querySelector("pre")?.textContent).toBe("Original");
    expect(changed).not.toHaveBeenCalled();
  } finally {
    await close();
  }
});
it("private pilot sharing explains its disabled state and never presents a public link", async () => {
  api.mockResolvedValue({
    shares: [],
    canShare: false,
    canReadShared: false,
    reason: "External sharing is unavailable during the private pilot.",
  });
  const owner = await mount(<LibrarySharing file={file} onBack={() => {}} />);
  try {
    expect(button(owner.node, "Share file").disabled).toBe(true);
    expect(owner.node.querySelector("input")?.disabled).toBe(true);
    expect(owner.node.textContent).toContain("Only you have access");
    expect(owner.node.querySelector("a")).toBeNull();
  } finally {
    await owner.close();
  }
  const reader = await mount(<SharedWithMe />);
  try {
    expect(reader.node.textContent).toContain("Sharing is not available yet");
    expect(reader.node.querySelector("pre")).toBeNull();
  } finally {
    await reader.close();
  }
});
it("owner can revoke a grant while creation is disabled", async () => {
  let revoked = false;
  api.mockImplementation(async (path: string) => {
    if (path.endsWith("/revoke")) {
      revoked = true;
      return {};
    }
    return {
      shares: revoked
        ? []
        : [
            {
              id: "share",
              recipientEmail: "reader@example.test",
              createdAt: "",
              revokedAt: null,
            },
          ],
      canShare: false,
      reason: "Private pilot",
    };
  });
  const { node, close } = await mount(
    <LibrarySharing file={file} onBack={() => {}} />,
  );
  try {
    await click(node, "Revoke access");
    expect(api).toHaveBeenCalledWith("/file/shares/share/revoke", {});
    expect(node.textContent).toContain("Only you have access");
  } finally {
    await close();
  }
});
