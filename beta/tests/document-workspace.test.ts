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
  expect(model.panes[1].tabs).toEqual([first.id, second.id]);
  model.toggleSplit();
  expect(model.panes[0].tabs).toEqual([first.id, second.id]);
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
