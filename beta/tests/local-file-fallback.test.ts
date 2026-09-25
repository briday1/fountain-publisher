// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { openLocalFile } from "../src/storage/files";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

it("opens the explicit fallback inside its modal without invoking the native picker", async () => {
  const native = vi.fn();
  vi.stubGlobal("showOpenFilePicker", native);
  document.body.innerHTML = '<dialog open><div class="modal-content"></div></dialog>';
  const click = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(function (this: HTMLInputElement) {
    expect(this.closest("dialog[open]")).not.toBeNull();
    Object.defineProperty(this, "files", { configurable: true, value: [{
      name: "Local.fountain", size: 12,
      arrayBuffer: async () => new TextEncoder().encode("INT. QA - DAY").buffer,
    }] });
    this.dispatchEvent(new Event("change"));
  });
  await expect(openLocalFile({ useFileInput: true })).resolves.toEqual({
    name: "Local.fountain", content: "INT. QA - DAY",
  });
  expect(native).not.toHaveBeenCalled();
  expect(click).toHaveBeenCalledOnce();
});

it("reuses and reattaches the file input after its previous modal closes", async () => {
  let prior: HTMLInputElement | undefined;
  vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(function (this: HTMLInputElement) {
    if (prior) expect(this).toBe(prior);
    prior = this;
    expect(this.isConnected).toBe(true);
    this.dispatchEvent(new Event("cancel"));
  });
  await expect(openLocalFile({ useFileInput: true })).resolves.toBeNull();
  document.body.replaceChildren();
  await expect(openLocalFile({ useFileInput: true })).resolves.toBeNull();
});

it("preserves default native file opening for existing callers", async () => {
  const handle = {
    name: "Native.fountain",
    getFile: async () => ({ name: "Native.fountain", size: 4,
      arrayBuffer: async () => new TextEncoder().encode("TEST").buffer }),
  };
  const native = vi.fn(async () => [handle]);
  vi.stubGlobal("showOpenFilePicker", native);
  await expect(openLocalFile()).resolves.toMatchObject({ name: "Native.fountain", content: "TEST", handle });
  expect(native).toHaveBeenCalledOnce();
});
