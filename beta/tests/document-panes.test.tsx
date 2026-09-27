import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { DocumentPanes } from "../src/components/DocumentPanes";
import { DocumentWorkspace } from "../src/core/documentWorkspace";
import { DocumentSession } from "../src/core/session";
import { parseMarkdown } from "../src/core/markdown";
import { defaults } from "../src/components/Settings";

beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  Range.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 10, 20);
  Range.prototype.getClientRects = () =>
    [new DOMRect(0, 0, 10, 20)] as unknown as DOMRectList;
  HTMLElement.prototype.scrollIntoView = () => {};
  window.scrollBy = () => {};
});
let root: Root;
let host: HTMLDivElement;
let model: DocumentWorkspace;
afterEach(async () => {
  await act(async () => root?.unmount());
  model?.dispose();
  host?.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function setup() {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  let draw = () => {};
  model = new DocumentWorkspace(
    new DocumentSession({
      id: crypto.randomUUID(),
      name: "Draft.md",
      screenplay: parseMarkdown("# Draft\n\nWords remain here."),
      epoch: 0,
    }),
    {
      changed: () => draw(),
      activated: () => {},
      selection: () => {},
      activity: () => {},
      annotationState: () => {},
      annotation: () => {},
      error: () => {},
    },
  );
  draw = () =>
    root.render(
      <DocumentPanes
        model={model}
        preferences={defaults}
        onOpen={() => {}}
        onTitle={() => {}}
        changed={draw}
      />,
    );
  await act(async () => draw());
  return model.activeView!;
}
function button(label: string) {
  const found = [
    ...document.querySelectorAll<HTMLButtonElement>("button"),
  ].find(
    (b) => b.getAttribute("aria-label") === label || b.textContent === label,
  );
  expect(found, label).toBeDefined();
  return found!;
}
function sendDrag(element: Element, name: string, x: number) {
  const event = new MouseEvent(name, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: 50,
  });
  Object.defineProperty(event, "dataTransfer", {
    value: { setData: () => {}, effectAllowed: "", dropEffect: "" },
  });
  element.dispatchEvent(event);
}
it("right-click opens at the tab pointer and bulk close retains the requested tab and draft", async () => {
  const first = await setup();
  await act(async () => {
    model.duplicate(first.id);
    model.duplicate(first.id);
  });
  const original = host.querySelector<HTMLElement>(".document-tab")!;
  await act(async () =>
    original.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: 300,
        clientY: 150,
      }),
    ),
  );
  const popup = document.querySelector<HTMLElement>(".anchored-menu-popup")!;
  expect(popup.style.left).toBe("300px");
  expect(popup.style.top).toBe("150px");
  expect(document.activeElement?.textContent).toBe("Split right");
  await act(async () => button("Close other tabs").click());
  expect(model.panes[0].tabs).toEqual([first.id]);
  expect(host.querySelectorAll('[role="tab"]')).toHaveLength(1);
  expect(first.controller.getBlocks()[1].text).toBe("Words remain here.");
});
it("drag feedback matches the before/after slot, then moves an editor across groups", async () => {
  const first = await setup();
  let second = first,
    third = first;
  await act(async () => {
    second = model.duplicate(first.id)!;
    third = model.duplicate(first.id)!;
  });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
    new DOMRect(100, 0, 200, 36),
  );
  let tabs = host.querySelectorAll(".document-tab");
  await act(async () => sendDrag(tabs[0], "dragstart", 110));
  await act(async () => sendDrag(tabs[2], "dragover", 290));
  expect(tabs[2].classList.contains("drop-after")).toBe(true);
  await act(async () => sendDrag(tabs[2], "drop", 290));
  expect(model.panes[0].tabs).toEqual([second.id, third.id, first.id]);
  expect(host.querySelector(".dragging-tab")).toBeNull();
  await act(async () => model.splitWith(first.id));
  const other = model.activeView!;
  tabs = host.querySelectorAll(".pane-0 .document-tab");
  const right = host.querySelector(".pane-1")!;
  await act(async () => sendDrag(tabs[0], "dragstart", 110));
  await act(async () => sendDrag(right, "dragover", 200));
  expect(host.querySelector(".document-drop-overlay")?.textContent).toBe(
    "Move to this pane",
  );
  await act(async () => sendDrag(right, "drop", 200));
  expect(model.panes[1].tabs).toEqual([other.id, second.id]);
  expect(model.activeView).toBe(second);
});
it("split controls preserve section views and divider supports keyboard and equalizing", async () => {
  const first = await setup();
  await act(async () => button("Split editor right").click());
  expect(host.querySelectorAll(".document-pane")).toHaveLength(2);
  expect(model.panes[0].tabs).toEqual([first.id]);
  const divider = host.querySelector('[role="separator"]')!;
  await act(async () =>
    divider.dispatchEvent(
      new KeyboardEvent("keydown", { key: "End", bubbles: true }),
    ),
  );
  expect(divider.getAttribute("aria-valuenow")).toBe("75");
  await act(async () =>
    divider.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })),
  );
  expect(divider.getAttribute("aria-valuenow")).toBe("50");
  await act(async () => button("Close left pane").click());
  expect(host.querySelectorAll(".document-pane")).toHaveLength(1);
  expect(model.split).toBe(false);
  expect(model.activeView?.controller.getBlocks()[1].text).toBe(
    "Words remain here.",
  );
});
it("mobile renders one editor without discarding desktop tabs, widths or selection", async () => {
  const first = await setup();
  await act(async () => {
    model.splitWith(first.id);
    model.resizePanes(62);
  });
  const second = model.activeView!;
  second.scrollTop = 240;
  const draw = (mobile: boolean) =>
    root.render(
      <DocumentPanes
        model={model}
        preferences={defaults}
        onOpen={() => {}}
        onTitle={() => {}}
        changed={() => {}}
        mobile={mobile}
      />,
    );
  await act(async () => draw(true));
  expect(host.querySelectorAll(".document-pane")).toHaveLength(1);
  expect(host.querySelector('[role="tablist"]')).toBeNull();
  expect(model.split).toBe(true);
  expect(model.views.size).toBe(2);
  expect(model.activeView).toBe(second);
  await act(async () => draw(false));
  expect(host.querySelectorAll(".document-pane")).toHaveLength(2);
  expect(
    host.querySelector('[role="separator"]')?.getAttribute("aria-valuenow"),
  ).toBe("62");
  expect(model.panes[0].tabs).toEqual([first.id]);
  expect(model.panes[1].tabs).toEqual([second.id]);
  expect(second.scrollTop).toBe(240);
});
