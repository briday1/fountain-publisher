import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import {
  defaults,
  readPreferences,
  Settings,
} from "../src/components/Settings";
import { WorkspaceBackground } from "../src/components/WorkspaceBackground";
import { defaultBackgroundOptions } from "../src/components/backgroundPreferences";

beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("migrates old preferences and validates each new setting independently", () => {
  localStorage.setItem(
    "fp2.preferences",
    JSON.stringify({ background: "grid" }),
  );
  expect(readPreferences().background).toBe("plain");
  expect(readPreferences().backgroundOptions.dots).toEqual(
    defaultBackgroundOptions,
  );
  localStorage.setItem(
    "fp2.preferences",
    JSON.stringify({
      background: "hyperspace",
      backgroundOptions: {
        dots: { animated: false, speed: "fast", density: "dense" },
        hyperspace: { animated: "yes", speed: "constructor", density: 1000000 },
        topographic: null,
      },
    }),
  );
  expect(readPreferences().backgroundOptions).toEqual({
    dots: { animated: false, speed: "fast", density: "dense" },
    hyperspace: defaultBackgroundOptions,
    topographic: defaultBackgroundOptions,
  });
  localStorage.setItem("fp2.preferences", "{broken");
  expect(readPreferences()).toEqual(defaults);
});

it("keeps independent choices across backgrounds and reloads, hiding irrelevant controls", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  function Harness() {
    const [value, setValue] = useState(readPreferences);
    return (
      <Settings
        value={value}
        onClose={() => {}}
        onChange={(next) => {
          localStorage.setItem("fp2.preferences", JSON.stringify(next));
          setValue(next);
        }}
      />
    );
  }
  const control = (label: string) =>
    Array.from(container.querySelectorAll("label"))
      .find((el) => el.firstChild?.textContent?.trim() === label)
      ?.querySelector("select, input") as
      HTMLSelectElement | HTMLInputElement | undefined;
  const select = async (label: string, value: string) => {
    await act(async () => {
      const el = control(label)!;
      el.value = value;
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
  };
  try {
    await act(async () => root.render(<Harness />));
    await select("Animation speed", "fast");
    await select("Dot density", "dense");
    await act(async () => control("Animate background")!.click());
    expect(control("Animation speed")).toBeUndefined();
    expect(control("Dot density")?.value).toBe("dense");
    await select("Workspace background", "hyperspace");
    expect(control("Animation speed")?.value).toBe("normal");
    await select("Star density", "sparse");
    await select("Workspace background", "topographic");
    expect(control("Contour density")?.value).toBe("normal");
    await select("Workspace background", "plain");
    expect(container.querySelector("fieldset")).toBeNull();
    await select("Workspace background", "dots");
    expect((control("Animate background") as HTMLInputElement).checked).toBe(
      false,
    );
    await act(async () => root.render(<Harness key="reload" />));
    expect((control("Animate background") as HTMLInputElement).checked).toBe(
      false,
    );
    expect(control("Dot density")?.value).toBe("dense");
    await act(async () => control("Animate background")!.click());
    expect(control("Animation speed")?.value).toBe("fast");
    expect(readPreferences().backgroundOptions.hyperspace.density).toBe(
      "sparse",
    );
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

it("stops canvas work for static, reduced-motion, hidden and paused states and cleans up", async () => {
  let reduced = false;
  let hidden = false;
  const motion = new EventTarget();
  Object.defineProperty(motion, "matches", { get: () => reduced });
  vi.stubGlobal("matchMedia", () => motion);
  vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
  vi.spyOn(HTMLCanvasElement.prototype, "clientWidth", "get").mockReturnValue(
    1200,
  );
  vi.spyOn(HTMLCanvasElement.prototype, "clientHeight", "get").mockReturnValue(
    800,
  );
  const context = {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    setTransform: vi.fn(),
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
  const disconnect = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect = disconnect;
    },
  );
  let nextFrame = 0;
  const frames = new Map<number, FrameRequestCallback>();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.stubGlobal("cancelAnimationFrame", (frame: number) =>
    frames.delete(frame),
  );
  const container = document.createElement("div");
  const root = createRoot(container);
  const render = async (
    animated = true,
    paused = false,
    density: "normal" | "dense" = "normal",
    speed: "normal" | "fast" = "normal",
  ) => {
    await act(async () =>
      root.render(
        <WorkspaceBackground
          pattern="hyperspace"
          paused={paused}
          options={{ animated, density, speed }}
        />,
      ),
    );
  };
  try {
    await render(false);
    expect(context.stroke).toHaveBeenCalled(); // Still star field, no frame loop.
    expect(frames.size).toBe(0);
    context.lineTo.mockClear();
    await render(false, false, "dense");
    expect(context.lineTo.mock.calls.length).toBeGreaterThan(150);
    expect(context.lineTo.mock.calls.length).toBeLessThanOrEqual(225);
    await render();
    expect(frames.size).toBe(1);
    const canvas = container.querySelector("canvas");
    const observers = disconnect.mock.calls.length;
    await render(true, false, "normal", "fast");
    expect(container.querySelector("canvas")).toBe(canvas);
    expect(disconnect.mock.calls.length).toBe(observers);
    reduced = true;
    await act(async () => motion.dispatchEvent(new Event("change")));
    expect(frames.size).toBe(0);
    expect(container.firstElementChild?.getAttribute("data-running")).toBe(
      "false",
    );
    reduced = false;
    await act(async () => motion.dispatchEvent(new Event("change")));
    expect(frames.size).toBe(1);
    hidden = true;
    await act(async () =>
      document.dispatchEvent(new Event("visibilitychange")),
    );
    expect(frames.size).toBe(0);
    hidden = false;
    await act(async () =>
      document.dispatchEvent(new Event("visibilitychange")),
    );
    expect(frames.size).toBe(1);
    await render(true, true);
    expect(frames.size).toBe(0);
    await render();
    expect(frames.size).toBe(1);
  } finally {
    await act(async () => root.unmount());
  }
  expect(frames.size).toBe(0);
  expect(disconnect).toHaveBeenCalledTimes(1);
});

it("applies density to contours and dot spacing while retaining default visuals", async () => {
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  }));
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(<WorkspaceBackground pattern="topographic" />),
    );
    const normalPath = container.querySelector("path")!.getAttribute("d")!;
    await act(async () =>
      root.render(
        <WorkspaceBackground
          pattern="topographic"
          options={{ animated: false, speed: "fast", density: "sparse" }}
        />,
      ),
    );
    expect(
      container.querySelector("path")!.getAttribute("d")!.length,
    ).toBeLessThan(normalPath.length);
    expect(container.firstElementChild?.getAttribute("data-running")).toBe(
      "false",
    );
    await act(async () => root.render(<WorkspaceBackground pattern="dots" />));
    const background = container.firstElementChild as HTMLElement;
    expect(background.style.getPropertyValue("--workspace-dot-spacing")).toBe(
      "24px",
    );
    expect(background.style.getPropertyValue("--workspace-dots-duration")).toBe(
      "28s",
    );
    await act(async () =>
      root.render(
        <WorkspaceBackground
          pattern="dots"
          options={{ animated: true, speed: "fast", density: "dense" }}
        />,
      ),
    );
    expect(
      parseFloat(background.style.getPropertyValue("--workspace-dot-spacing")),
    ).toBeLessThan(24);
    expect(background.style.getPropertyValue("--workspace-dots-duration")).toBe(
      "14s",
    );
  } finally {
    await act(async () => root.unmount());
  }
});
