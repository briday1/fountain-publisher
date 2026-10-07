import "fake-indexeddb/auto";
import { afterEach, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import * as Y from "yjs";
import { BufferSync } from "../src/components/DocumentPanes";
import { DocumentWorkspace } from "../src/core/documentWorkspace";
import { DocumentSession } from "../src/core/session";
import { emptyScreenplay } from "../src/core/model";
import { serializeDocument } from "../src/core/documentFormat";
import { createSharedDocument } from "../src/collaboration/sharedDocument";
import { LiveClient } from "../src/collaboration/LiveClient";
import { encodeBytes } from "../src/collaboration/encoding";
import { cloud } from "../src/storage/cloud";
import { useDestinationSync } from "../src/hooks/useDestinationSync";
vi.mock("../src/hooks/useDestinationSync", () => ({
  useDestinationSync: vi.fn(() => ({
    engine: { current: undefined },
    status: undefined,
  })),
}));
const mounted: {
  root: Root;
  model: DocumentWorkspace;
  host: HTMLElement;
  source: Y.Doc;
  disable: () => void;
}[] = [];
afterEach(() => {
  for (const { root, model, host, source, disable } of mounted.splice(0)) {
    disable();
    root.unmount();
    model.dispose();
    host.remove();
    source.destroy();
  }
  vi.restoreAllMocks();
});
function mount(
  bound = true,
  paused = false,
  access = { premium: true, canEdit: true },
) {
  Range.prototype.getBoundingClientRect = () => new DOMRect();
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  const screenplay = emptyScreenplay();
  screenplay.blocks[0].text = "Cloud paragraph.";
  const content = serializeDocument(screenplay);
  const destination = {
    provider: "writeshape" as const,
    id: "cloud-file-12345678",
    accountId: "owner",
    name: "Cloud.fountain",
    revision: "1",
    baseContent: content,
    canWrite: access.canEdit,
    livePaused: paused,
  };
  const session = new DocumentSession({
    id: crypto.randomUUID(),
    name: destination.name,
    screenplay,
    epoch: 0,
    destination: bound ? destination : undefined,
  });
  const source = createSharedDocument(screenplay);
  vi.spyOn(cloud, "liveBootstrap").mockResolvedValue({
    content,
    name: destination.name,
    state: encodeBytes(Y.encodeStateAsUpdate(source)),
    vector: encodeBytes(Y.encodeStateVector(source)),
    self: {
      id: "owner",
      name: "Owner",
      color: "#3875c7",
      canEdit: access.canEdit,
    },
    remote: {
      provider: "google",
      id: "library_" + destination.id,
      etag: "1",
      live: true,
    },
  });
  vi.spyOn(LiveClient.prototype, "start").mockImplementation(() => {});
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  let ready = false;
  const render = () => {
    if (ready)
      root.render(
        <BufferSync
          model={model}
          buffer={model.activeBuffer!}
          accountId="owner"
          premium={access.premium}
          collaborationAvailable
          changed={render}
        />,
      );
  };
  const model = new DocumentWorkspace(session, {
    changed: render,
    activated: () => {},
    selection: () => {},
    activity: () => {},
    annotation: () => {},
    annotationState: () => {},
    error: () => {},
  });
  ready = true;
  render();
  mounted.push({
    root,
    model,
    host,
    source,
    disable: () => {
      ready = false;
    },
  });
  return { session, model, destination };
}
it("opens a WriteShape cloud file in live mode automatically without ordinary autosave racing the room", async () => {
  const { model } = mount();
  await vi.waitFor(() => expect(LiveClient.prototype.start).toHaveBeenCalled());
  expect(cloud.liveBootstrap).toHaveBeenCalledWith(
    "library_cloud-file-12345678",
  );
  expect(LiveClient.prototype.start).toHaveBeenCalled();
  expect(model.activeBuffer?.snapshot.destination?.live).toBe(true);
  expect(
    vi.mocked(useDestinationSync).mock.calls.every((args) => args[5] === false),
  ).toBe(true);
});
it("connects automatically after saving a device draft to WriteShape without remounting", async () => {
  const { session, model, destination } = mount(false);
  await vi.waitFor(() => expect(useDestinationSync).toHaveBeenCalled());
  expect(model.activeBuffer?.live).toBeUndefined();
  session.setDestination(destination);
  await vi.waitFor(() => expect(model.activeBuffer?.live).toBeDefined());
  expect(session.current.destination?.live).toBe(true);
});
it("opens automatically even when an older version saved an end-session preference", async () => {
  const { model } = mount(true, true);
  await vi.waitFor(() => expect(model.activeBuffer?.live).toBeDefined());
  expect(model.activeBuffer?.snapshot.destination?.live).toBe(true);
  expect(model.activeBuffer?.snapshot.destination?.livePaused).not.toBe(true);
});
it.each([true, false])(
  "keeps a Free shared account connected with the server's editing permission (%s)",
  async (canEdit) => {
    const { model } = mount(true, false, { premium: false, canEdit });
    await vi.waitFor(() => expect(model.activeBuffer?.live).toBeDefined());
    await vi.waitFor(() =>
      expect(model.activeView?.controller.writable).toBe(canEdit),
    );
    expect(model.activeBuffer?.snapshot.destination?.pausedForPlan).not.toBe(
      true,
    );
    expect(
      vi
        .mocked(useDestinationSync)
        .mock.calls.every((args) => args[5] === false),
    ).toBe(true);
  },
);
