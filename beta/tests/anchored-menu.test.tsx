import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { Menu, MenuItem } from "../src/components/Menu";
beforeAll(() => Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("anchors an overflow-safe menu to its trigger, follows scrolling, and keeps keyboard and click actions", async () => {
  let anchor = new DOMRect(410, 180, 24, 28);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      return this.classList.contains("menu-trigger")
        ? anchor
        : new DOMRect(0, 0, 255, 240);
    },
  );
  const disconnect = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect = disconnect;
    },
  );
  vi.stubGlobal("innerWidth", 1024);
  vi.stubGlobal("innerHeight", 768);
  const node = document.createElement("div");
  document.body.append(node);
  const root = createRoot(node);
  const action = vi.fn();
  try {
    await act(async () =>
      root.render(
        <Menu anchored label="Tab actions">
          <MenuItem disabled onClick={() => {}}>
            Unavailable
          </MenuItem>
          <MenuItem onClick={action}>Move to other pane</MenuItem>
        </Menu>,
      ),
    );
    const trigger = node.querySelector("button")!;
    await act(async () => trigger.click());
    const popup = document.querySelector<HTMLElement>(".anchored-menu-popup")!;
    expect(node.contains(popup)).toBe(false); // Escapes tab-strip overflow.
    expect(popup.style.left).toBe("410px");
    expect(popup.style.top).toBe("212px");
    anchor = new DOMRect(970, 700, 24, 28);
    await act(async () => document.dispatchEvent(new Event("scroll")));
    expect(popup.style.left).toBe("761px");
    expect(popup.style.top).toBe("456px");
    trigger.focus();
    await act(async () =>
      trigger.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
      ),
    );
    expect(document.activeElement?.textContent).toBe("Move to other pane");
    await act(async () =>
      document.activeElement!.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      ),
    );
    expect(document.querySelector(".anchored-menu-popup")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    await act(async () => trigger.click());
    const item = document.querySelectorAll<HTMLButtonElement>(
      ".anchored-menu-popup button",
    )[1];
    await act(async () => {
      item.dispatchEvent(new Event("pointerdown", { bubbles: true }));
      item.click();
    });
    expect(action).toHaveBeenCalledOnce();
    expect(document.querySelector(".anchored-menu-popup")).toBeNull();
    await act(async () => trigger.click());
    await act(async () =>
      document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })),
    );
    expect(document.querySelector(".anchored-menu-popup")).toBeNull();
  } finally {
    await act(async () => root.unmount());
    node.remove();
  }
  expect(disconnect).toHaveBeenCalled();
});
