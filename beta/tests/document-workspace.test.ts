import "fake-indexeddb/auto";
import { beforeAll, afterEach, it, expect, vi } from "vitest";
import { DocumentWorkspace } from "../src/core/documentWorkspace";
import { DocumentSession } from "../src/core/session";
import { parseMarkdown } from "../src/core/markdown";
import { TextSelection, AllSelection } from "prosemirror-state";
import { workspace } from "../src/storage/workspace";
const models: DocumentWorkspace[] = [];
beforeAll(() => {
  Range.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 10, 20);
  Range.prototype.getClientRects = () =>
    [new DOMRect(0, 0, 10, 20)] as unknown as DOMRectList;
  HTMLElement.prototype.scrollIntoView = () => {};
  window.scrollBy = () => {};
});
afterEach(() => {
  models.splice(0).forEach((m) => m.dispose());
});
function setup() {
  const activity = vi.fn();
  const session = new DocumentSession({
    id: crypto.randomUUID(),
    name: "Book.md",
    screenplay: parseMarkdown(
      "# Book\n\n## One\n\nFirst words.\n\n### Nested\n\nInside.\n\n## Two\n\nKeep these words.",
    ),
    epoch: 0,
  });
  const model = new DocumentWorkspace(session, {
    changed: () => {},
    activated: () => {},
    selection: () => {},
    activity,
    annotationState: () => {},
    annotation: () => {},
    error: () => {},
  });
  models.push(model);
  return { model, session, activity };
}
it("linked views share edits and undo with one writing activity credit, while carets remain independent", () => {
  const { model, session, activity } = setup();
  const first = model.activeView!;
  const second = model.duplicate(first.id, true)!;
  first.controller.focusBlock(session.current.screenplay.blocks[2].id);
  const firstPos = first.controller.view.state.selection.from;
  second.controller.focusBlock(session.current.screenplay.blocks[6].id);
  const pos = second.controller.view.state.selection.from;
  second.controller.view.dispatch(
    second.controller.view.state.tr.insertText("Fresh ", pos),
  );
  expect(first.controller.getBlocks()).toEqual(second.controller.getBlocks());
  expect(first.controller.view.state.selection.from).toBe(firstPos);
  expect(activity).toHaveBeenCalledTimes(1);
  first.controller.undo();
  expect(
    second.controller
      .getBlocks()
      .map((b) => b.text)
      .join(" "),
  ).not.toContain("Fresh");
  expect(activity).toHaveBeenCalledTimes(1);
  first.controller.redo();
  expect(
    second.controller
      .getBlocks()
      .map((b) => b.text)
      .join(" "),
  ).toContain("Fresh");
});
it("focus protects hidden content against select-all deletion and replace-all; descendants remain editable", () => {
  const { model, session } = setup();
  const base = model.activeView!;
  const section = session.current.screenplay.blocks[1].id;
  const focus = model.duplicate(base.id, true, section, true)!;
  const before = focus.controller.getBlocks();
  const state = focus.controller.view.state;
  focus.controller.view.dispatch(
    state.tr.setSelection(new AllSelection(state.doc)).deleteSelection(),
  );
  expect(focus.controller.getBlocks()).toEqual(before);
  expect(focus.controller.replaceAll("words", "changed")).toBe(1);
  expect(
    base.controller.getBlocks().find((b) => b.text === "Keep these words."),
  ).toBeTruthy();
  expect(
    base.controller.getBlocks().find((b) => b.text === "First changed."),
  ).toBeTruthy();
  expect(focus.host.querySelectorAll("[aria-hidden=true]").length).toBe(3);
});
it("a peer can delete a focused section without trapping or losing the remaining document", () => {
  const { model, session } = setup();
  const base = model.activeView!;
  const focus = model.duplicate(
    base.id,
    true,
    session.current.screenplay.blocks[1].id,
    true,
  )!;
  const state = base.controller.view.state;
  let end = 0;
  state.doc.forEach((node, pos) => {
    if (node.attrs.id === session.current.screenplay.blocks[5].id) end = pos;
  });
  const first = state.doc.firstChild!.nodeSize;
  base.controller.view.dispatch(state.tr.delete(first, end));
  expect(focus.controller.focusedSection).toBeUndefined();
  expect(focus.controller.getBlocks()).toEqual(base.controller.getBlocks());
  expect(focus.controller.getBlocks().map((b) => b.text)).toContain(
    "Keep these words.",
  );
});
it("new documents keep distinct sessions, pending saves, metadata and destinations; closing a view preserves its draft", async () => {
  const { model, session } = setup();
  const original = model.activeView!;
  await session.flush();
  original.controller.view.dispatch(
    original.controller.view.state.tr.insertText("Saved ", 1),
  );
  const oldId = session.current.id;
  await session.open(parseMarkdown("# Different\n\nSecond doc."), "Other.md");
  const second = model.activeBuffer!;
  expect(second.session).not.toBe(session);
  expect(model.panes[0].tabs).toHaveLength(2);
  second.session.rename("Renamed.md");
  await second.session.flush();
  expect(session.current.name).toBe("Book.md");
  expect((await workspace.load(oldId))!.screenplay.blocks[0].text).toContain(
    "Saved",
  );
  model.close(original.id);
  await session.flush();
  expect(await workspace.load(oldId)).toBeTruthy();
  expect(second.session.current.name).toBe("Renamed.md");
});
it("moving and reordering tabs retain controller, selection, scroll and draft identity", () => {
  const { model } = setup();
  const first = model.activeView!;
  first.scrollTop = 320;
  first.controller.view.dispatch(
    first.controller.view.state.tr.setSelection(
      TextSelection.create(first.controller.view.state.doc, 3),
    ),
  );
  const second = model.duplicate(first.id, true)!;
  model.move(first.id, 1, 0);
  expect(model.views.get(first.id)).toBe(first);
  expect(first.scrollTop).toBe(320);
  expect(first.controller.view.state.selection.from).toBe(3);
  expect(model.panes[0].tabs).toEqual([first.id, second.id]);
  expect(model.panes[1].tabs).toEqual([]);
  expect(model.split).toBe(false);
});
it("restores distinct buffers, split tabs and view positions without cloning save ownership", async () => {
  const { model, session } = setup();
  await model.restoreLayout();
  const first = model.activeView!;
  model.duplicate(
    first.id,
    true,
    session.current.screenplay.blocks[1].id,
    true,
  );
  await session.open(parseMarkdown("# Other\n\nAnother book."), "Other.md");
  const other = model.activeView!;
  other.scrollTop = 240;
  for (const b of model.buffers.values()) await b.session.flush();
  model.saveLayout();
  const selectedId = other.bufferId;
  model.dispose();
  const saved = await workspace.load(selectedId);
  const reopened = new DocumentWorkspace(new DocumentSession(saved!), {
    changed: () => {},
    activated: () => {},
    selection: () => {},
    activity: () => {},
    annotationState: () => {},
    annotation: () => {},
    error: () => {},
  });
  models.push(reopened);
  await reopened.restoreLayout();
  expect(reopened.buffers.size).toBe(2);
  expect(reopened.views.size).toBe(3);
  expect(reopened.split).toBe(true);
  expect(reopened.activeBuffer!.session.current.id).toBe(selectedId);
  expect(reopened.activeView!.scrollTop).toBe(240);
  expect(
    [...reopened.views.values()].filter((v) => v.controller.focusedSection),
  ).toHaveLength(1);
  sessionStorage.removeItem("writeshape.documentViews");
});
it("reopening a provider identity adds a linked view instead of a second writer", async () => {
  const { model, session } = setup();
  const doc = session.current.screenplay;
  await session.open(doc, "Drive.md", undefined, undefined, {
    provider: "drive",
    id: "drive-file",
    accountId: "account",
    name: "Drive.md",
    revision: "1",
    baseContent: "",
    canWrite: true,
  });
  const first = model.activeBuffer!;
  await first.session.open(doc, "Drive.md", undefined, undefined, {
    provider: "drive",
    id: "drive-file",
    accountId: "account",
    name: "Drive.md",
    revision: "2",
    baseContent: "",
    canWrite: true,
  });
  expect(model.activeBuffer).toBe(first);
  expect(first.views.size).toBe(2);
  expect(model.buffers.size).toBe(2);
});
it("metadata and external refresh reach every linked view while focused views still capture the complete document", async () => {
  const { model, session } = setup();
  const first = model.activeView!,
    second = model.duplicate(
      first.id,
      true,
      session.current.screenplay.blocks[1].id,
      true,
    )!;
  const full = session.capture().screenplay;
  session.updateMetadata({
    ...full,
    metadata: { ...full.metadata, notes: "Whole document notes" },
  });
  expect(session.capture().screenplay.blocks).toHaveLength(7);
  expect(session.capture().screenplay.metadata.notes).toBe(
    "Whole document notes",
  );
  await session.flush();
  const next = parseMarkdown(
    "# Replaced book\n\n## Fresh chapter\n\nRemote words.",
  );
  await session.applyExternal(next, "Book.md", session.token());
  expect(first.controller.getBlocks()).toEqual(next.blocks);
  expect(second.controller.getBlocks()).toEqual(next.blocks);
  expect(second.controller.focusedSection).toBeUndefined();
});
it("closing the last view retains document undo when reopened from the buffer list", async () => {
  const { model, session } = setup();
  const view = model.activeView!;
  view.controller.view.dispatch(
    view.controller.view.state.tr.insertText("Retained ", 1),
  );
  model.close(view.id);
  await session.flush();
  const reopened = model.addView(session.current.id, 0);
  expect(reopened.controller.getBlocks()[0].text).toContain("Retained");
  reopened.controller.undo();
  expect(reopened.controller.getBlocks()[0].text).toBe("Book");
});

import * as Y from "yjs";
import { LiveClient } from "../src/collaboration/LiveClient";
import {
  createSharedDocument,
  readSharedDocument,
} from "../src/collaboration/sharedDocument";
import { encodeBytes } from "../cloudflare/liveRoom";
import { cloud } from "../src/storage/cloud";
import { serializeDocument } from "../src/core/documentFormat";
import { parseFountain } from "../src/core/fountain";
afterEach(() => vi.restoreAllMocks());
async function liveSetup(book = true) {
  const first = setup(),
    second = setup();
  if (!book) {
    for (const s of [first.session, second.session]) {
      s.current = {
        ...s.current,
        name: "Script.fountain",
        screenplay: parseFountain(
          "INT. ROOM - DAY\n\nFirst words.\n\nEXT. STREET - NIGHT\n\nKeep these words.\n",
        ),
      };
      s.editor!.setDocument(s.current.screenplay);
    }
  }
  const source = createSharedDocument(first.session.capture().screenplay),
    id = crypto.randomUUID();
  const content = serializeDocument(readSharedDocument(source));
  vi.spyOn(LiveClient.prototype, "start").mockImplementation(() => {});
  vi.spyOn(cloud, "liveBootstrap").mockImplementation(async (roomId) => ({
    name: first.session.current.name,
    content,
    state: encodeBytes(Y.encodeStateAsUpdate(source)),
    vector: encodeBytes(Y.encodeStateVector(source)),
    self: {
      id: roomId.endsWith("never") ? "unused" : "owner",
      name: "Owner",
      color: "#3875c7",
      canEdit: true,
    },
    remote: { provider: "google", id: roomId, etag: "1", live: true },
  }));
  for (const s of [first, second]) {
    s.session.setDestination({
      provider: "writeshape",
      id,
      accountId: "owner",
      name: s.session.current.name,
      revision: "1",
      baseContent: serializeDocument(s.session.capture().screenplay),
      canWrite: true,
    });
    await s.model.startLive(s.session.current.id);
  }
  source.destroy();
  const a = first.model.activeBuffer!.live!,
    b = second.model.activeBuffer!.live!;
  const sync = () => {
    const one = Y.encodeStateAsUpdate(a.doc, Y.encodeStateVector(b.doc)),
      two = Y.encodeStateAsUpdate(b.doc, Y.encodeStateVector(a.doc));
    Y.applyUpdate(a.doc, two, "network");
    Y.applyUpdate(b.doc, one, "network");
  };
  return { first, second, a, b, sync };
}
it.each([true, false])(
  "live linked panes preserve peer edits through local undo and do not duplicate goal credit (Book=%s)",
  async (book) => {
    const { first, second, sync } = await liveSetup(book);
    const left = first.model.activeView!,
      right = first.model.duplicate(left.id, true)!;
    const peer = second.model.activeView!;
    const firstBlock = left.controller
      .getBlocks()
      .find((b) => b.text === "First words.")!.id;
    const lastBlock = left.controller
      .getBlocks()
      .find((b) => b.text === "Keep these words.")!.id;
    left.controller.focusBlock(firstBlock);
    right.controller.focusBlock(lastBlock);
    const leftPos = left.controller.view.state.selection.from;
    right.controller.view.dispatch(
      right.controller.view.state.tr.insertText(
        "Mine ",
        right.controller.view.state.selection.from,
      ),
    );
    expect(left.controller.view.state.selection.from).toBe(leftPos);
    expect(left.controller.getBlocks()).toEqual(right.controller.getBlocks());
    expect(first.activity).toHaveBeenCalledTimes(1);
    sync();
    peer.controller.focusBlock(firstBlock);
    peer.controller.view.dispatch(
      peer.controller.view.state.tr.insertText(
        "Peer ",
        peer.controller.view.state.selection.from,
      ),
    );
    sync();
    right.controller.undo();
    sync();
    expect(
      left.controller
        .getBlocks()
        .map((b) => b.text)
        .join(" "),
    ).toContain("Peer");
    expect(
      left.controller
        .getBlocks()
        .map((b) => b.text)
        .join(" "),
    ).not.toContain("Mine");
    expect(first.activity).toHaveBeenCalledTimes(1);
    expect(second.activity).toHaveBeenCalledTimes(1);
  },
);
it("live focused section receives outside peer edits and closing all views retains the pending document", async () => {
  const { first, second, sync, a } = await liveSetup();
  const whole = first.model.activeView!,
    section = whole.controller.getBlocks().find((b) => b.text === "One")!.id;
  const focused = first.model.duplicate(whole.id, true, section, true)!;
  const peer = second.model.activeView!;
  peer.controller.focusBlock(
    peer.controller.getBlocks().find((b) => b.text === "Keep these words.")!.id,
  );
  peer.controller.view.dispatch(
    peer.controller.view.state.tr.insertText(
      "Outside ",
      peer.controller.view.state.selection.from,
    ),
  );
  sync();
  expect(
    focused.controller.getBlocks().some((b) => b.text.includes("Outside")),
  ).toBe(true);
  expect(
    focused.host.querySelectorAll("[aria-hidden=true]").length,
  ).toBeGreaterThan(0);
  first.model.close(whole.id);
  first.model.close(focused.id);
  expect(first.model.buffers.get(first.session.current.id)!.live).toBe(a);
  const reopened = first.model.addView(first.session.current.id, 0);
  expect(
    reopened.controller.getBlocks().some((b) => b.text.includes("Outside")),
  ).toBe(true);
});
it("Save As detaches the old live room before edits can cross into a different destination", async () => {
  const { first, a } = await liveSetup();
  const before = serializeDocument(readSharedDocument(a.doc));
  first.session.setDestination({
    provider: "writeshape",
    id: crypto.randomUUID(),
    accountId: "owner",
    name: "Separate.md",
    revision: "1",
    baseContent: before,
    canWrite: true,
  });
  expect(first.model.activeBuffer!.live).toBeUndefined();
  const view = first.model.activeView!;
  view.controller.focusBlock(
    view.controller.getBlocks().find((b) => b.text === "First words.")!.id,
  );
  view.controller.view.dispatch(
    view.controller.view.state.tr.insertText(
      "Separate copy ",
      view.controller.view.state.selection.from,
    ),
  );
  expect(serializeDocument(readSharedDocument(a.doc))).toBe(before);
  expect(serializeDocument(first.session.capture().screenplay)).toContain(
    "Separate copy",
  );
});
it("opening another tab keeps a live buffer when a peer update arrives during the device flush", async () => {
  const { first, a } = await liveSetup();
  const originalId = first.session.current.id;
  const flush = first.session.flush.bind(first.session);
  vi.spyOn(first.session, "flush").mockImplementationOnce(async () => {
    await flush();
    first.session.markChanged();
  });
  await first.session.open(
    parseMarkdown("# Independent\n\nNew document."),
    "Independent.md",
  );
  expect(first.model.activeBuffer!.snapshot.name).toBe("Independent.md");
  expect(first.model.buffers.get(originalId)!.live).toBe(a);
  expect(first.model.buffers.size).toBe(2);
});

it.each([0, 1] as const)(
  "closing pane %s preserves surviving views, pending edits and undo",
  async (pane) => {
    const { model, session } = setup();
    const first = model.activeView!;
    const second = model.duplicate(first.id, true)!;
    model.duplicate(second.id);
    const survivor = pane === 0 ? second : first;
    first.controller.view.dispatch(
      first.controller.view.state.tr.insertText("Pending ", 1),
    );
    survivor.scrollTop = 120;
    const closed = [...model.panes[pane].tabs];
    model.closePane(pane);
    expect(model.split).toBe(false);
    expect(model.activePane).toBe(0);
    expect(closed.every((id) => !model.views.has(id))).toBe(true);
    expect(model.views.get(survivor.id)).toBe(survivor);
    expect(survivor.scrollTop).toBe(120);
    await session.flush();
    expect(
      (await workspace.load(session.current.id))!.screenplay.blocks[0].text,
    ).toContain("Pending");
    survivor.controller.undo();
    expect(survivor.controller.getBlocks()[0].text).toBe("Book");
  },
);
it("closing the last split tab promotes the other group and selects the neighboring tab", () => {
  const { model } = setup();
  const first = model.activeView!;
  const second = model.duplicate(first.id)!;
  const third = model.duplicate(first.id)!;
  model.activate(second.id);
  model.close(second.id);
  expect(model.activeView).toBe(third);
  model.toggleSplit();
  const right = model.activeView!;
  model.close(right.id);
  expect(model.split).toBe(false);
  expect(model.activeView).toBe(third);
  expect(model.panes[1].tabs).toEqual([]);
});
it("closing an empty pane collapses it without changing the retained document", () => {
  const { model } = setup();
  const view = model.activeView!;
  model.split = true;
  model.closePane(1);
  expect(model.split).toBe(false);
  expect(model.activeView).toBe(view);
});
it("closing a live pane retains its room and propagates peer edits to the surviving view", async () => {
  const { first, second, sync, a } = await liveSetup();
  const left = first.model.activeView!;
  first.model.duplicate(left.id, true);
  first.model.closePane(1);
  expect(first.model.activeBuffer!.live).toBe(a);
  const peer = second.model.activeView!;
  peer.controller.view.dispatch(
    peer.controller.view.state.tr.insertText("Peer after close ", 1),
  );
  sync();
  expect(left.controller.getBlocks()[0].text).toContain("Peer after close");
  expect(first.model.split).toBe(false);
});

it("drop slots reorder in both directions without losing the selected view or caret", () => {
  const { model } = setup();
  const first = model.activeView!;
  const second = model.duplicate(first.id)!;
  const third = model.duplicate(first.id)!;
  first.scrollTop = 137;
  first.controller.view.dispatch(
    first.controller.view.state.tr.insertText("Draft ", 1),
  );
  const selection = first.controller.view.state.selection;
  model.moveToSlot(first.id, 0, 3);
  expect(model.panes[0].tabs).toEqual([second.id, third.id, first.id]);
  model.moveToSlot(first.id, 0, 2); // Slot immediately before itself is a no-op.
  expect(model.panes[0].tabs).toEqual([second.id, third.id, first.id]);
  model.moveToSlot(first.id, 0, 0);
  expect(model.panes[0].tabs).toEqual([first.id, second.id, third.id]);
  expect(model.activeView).toBe(first);
  expect(first.controller.view.state.selection.eq(selection)).toBe(true);
  expect(first.scrollTop).toBe(137);
  first.controller.undo();
  expect(first.controller.getBlocks()[0].text).toBe("Book");
});

it("edge splitting preserves section focus and only moves a tab when its source has a survivor", () => {
  const { model, session } = setup();
  const first = model.activeView!;
  model.focusSection(first.id, session.current.screenplay.blocks[1].id);
  model.splitWith(first.id, "left", true);
  expect(model.split).toBe(true);
  const copy = model.activeView!;
  expect(model.activePane).toBe(0);
  expect(copy.id).not.toBe(first.id);
  expect(copy.controller.focusedSection).toBe(first.controller.focusedSection);
  expect(model.panes[1].tabs).toEqual([first.id]);
  model.toggleSplit();
  model.splitWith(copy.id, "right", true);
  expect(model.views.size).toBe(2);
  expect(model.activeView).toBe(copy);
  expect(model.panes[0].tabs).toEqual([first.id]);
  expect(model.panes[1].tabs).toEqual([copy.id]);
});

it("bulk close snapshots its group before collapse and retains edited documents and undo", async () => {
  const { model, session } = setup();
  const first = model.activeView!;
  const second = model.duplicate(first.id)!;
  const third = model.duplicate(first.id)!;
  model.splitWith(first.id);
  const other = model.activeView!;
  first.controller.view.dispatch(
    first.controller.view.state.tr.insertText("Bulk retained ", 1),
  );
  model.closeTabs(0, second.id, second.id);
  expect(model.panes[0].tabs).toEqual([first.id, second.id]);
  expect(model.views.has(third.id)).toBe(false);
  model.closeTabs(0, second.id);
  expect(model.panes[0].tabs).toEqual([second.id]);
  model.closeTabs(0);
  expect(model.split).toBe(false);
  expect(model.panes[0].tabs).toEqual([other.id]);
  expect(model.activeView).toBe(other);
  model.closeTabs(0);
  await session.flush();
  const reopened = model.addView(session.current.id, 0);
  expect(reopened.controller.getBlocks()[0].text).toContain("Bulk retained");
  reopened.controller.undo();
  expect(reopened.controller.getBlocks()[0].text).toBe("Book");
});

it("bulk closing a live group retains peer updates in a reopened document", async () => {
  const { first, second, sync } = await liveSetup();
  const original = first.model.activeView!;
  first.model.duplicate(original.id);
  first.model.splitWith(original.id);
  const live = first.model.activeBuffer!.live;
  first.model.closeTabs(0);
  first.model.closeTabs(0);
  expect(first.model.buffers.get(first.session.current.id)!.live).toBe(live);
  const peer = second.model.activeView!;
  peer.controller.view.dispatch(
    peer.controller.view.state.tr.insertText("Peer after bulk close ", 1),
  );
  sync();
  const reopened = first.model.addView(first.session.current.id, 0);
  expect(reopened.controller.getBlocks()[0].text).toContain(
    "Peer after bulk close",
  );
});
