import { act } from "react";
import { createRoot } from "react-dom/client";
import { it, expect, vi } from "vitest";
import { useWritingGoals } from "../src/components/useWritingGoals";
import { readGoalDays } from "../src/core/writingGoals";
it("requires deliberate start and stops counting at idle cutoff, blur and pause", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 8, 25, 12));
  localStorage.clear();
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  const host = document.createElement("div"),
    input = document.createElement("input");
  input.className = "ProseMirror";
  document.body.append(host, input);
  input.focus();
  let state!: ReturnType<typeof useWritingGoals>;
  function Harness() {
    state = useWritingGoals("owner", true);
    return null;
  }
  const root = createRoot(host);
  const advance = async (ms: number) => {
    await act(async () => vi.advanceTimersByTime(ms));
  };
  const total = () =>
    readGoalDays(localStorage, "owner").reduce((n, d) => n + d.milliseconds, 0);
  try {
    await act(async () => root.render(<Harness />));
    await act(async () => state.onActivity(5));
    await advance(5000);
    expect(total()).toBe(0);
    await act(async () => state.toggleTimer());
    await advance(5000);
    expect(total()).toBe(0);
    await act(async () => state.onActivity(1));
    await advance(35000);
    expect(total()).toBe(30000);
    await act(async () => state.onActivity(1));
    await advance(2000);
    expect(total()).toBe(32000);
    await act(async () => window.dispatchEvent(new Event("blur")));
    await advance(4000);
    expect(total()).toBe(32000);
    await act(async () => state.toggleTimer());
    await act(async () => state.onActivity(1));
    await advance(4000);
    expect(total()).toBe(32000);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    input.remove();
    vi.restoreAllMocks();
    vi.useRealTimers();
  }
});
