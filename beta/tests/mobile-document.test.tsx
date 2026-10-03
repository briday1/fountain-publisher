import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeAll, expect, it } from "vitest";
import { DocumentPanes } from "../src/components/DocumentPanes";
import { DocumentWorkspace } from "../src/core/documentWorkspace";
import { DocumentSession } from "../src/core/session";
import { parseMarkdown } from "../src/core/markdown";
import { defaults as defaultPreferences } from "../src/components/Settings";
beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  Range.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 10, 20);
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  HTMLElement.prototype.scrollIntoView = () => {};
});
it("mobile shows only the active document and preserves desktop panes, drafts, caret and undo across breakpoints", async () => {
  const session = new DocumentSession({
    id: crypto.randomUUID(),
    name: "First.md",
    screenplay: parseMarkdown("# First\n\nOriginal words."),
    epoch: 0,
  });
  const model = new DocumentWorkspace(session, {
    changed() {},
    activated() {},
    selection() {},
    activity() {},
    annotationState() {},
    annotation() {},
    error() {},
  });
  const original = model.activeView!;
  model.duplicate(original.id, true);
  const layout = JSON.stringify(model.panes);
  const node = document.createElement("div");
  document.body.append(node);
  const root = createRoot(node);
  const render = async (mobile: boolean) =>
    act(async () =>
      root.render(
        <DocumentPanes
          model={model}
          preferences={defaultPreferences}
          mobile={mobile}
          onOpen={() => {}}
          onTitle={() => {}}
          changed={() => {}}
        />,
      ),
    );
  try {
    await render(false);
    expect(node.querySelectorAll('[role="tablist"]')).toHaveLength(2);
    await render(true);
    expect(node.querySelector('[role="tablist"]')).toBeNull();
    expect(node.querySelector('[role="separator"]')).toBeNull();
    expect(node.textContent).not.toMatch(
      /Split view|Single pane|Left pane|Right pane|Open documents/,
    );
    expect(node.querySelectorAll(".ProseMirror")).toHaveLength(1);
    expect(JSON.stringify(model.panes)).toBe(layout);
    expect(model.split).toBe(true);
    const view = model.activeView!;
    view.controller.view.dispatch(
      view.controller.view.state.tr.insertText("Saved ", 1),
    );
    await session.flush();
    await render(false);
    expect(JSON.stringify(model.panes)).toBe(layout);
    expect(node.querySelectorAll('[role="tablist"]')).toHaveLength(2);
    original.controller.undo();
    expect(view.controller.getBlocks()[0].text).toBe("First");
    await render(true);
    await session.open(
      parseMarkdown("# Second\n\nOther document."),
      "Second.md",
    );
    await render(true);
    expect(node.querySelector(".ProseMirror")?.textContent).toContain(
      "Other document.",
    );
    expect(model.activeBuffer?.snapshot.name).toBe("Second.md");
    expect(model.buffers.size).toBe(2);
    expect(model.views.has(original.id)).toBe(true);
  } finally {
    await act(async () => root.unmount());
    model.dispose();
    node.remove();
  }
});
