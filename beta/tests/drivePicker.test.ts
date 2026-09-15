import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cloud } from "../src/storage/cloud";

vi.mock("../src/storage/cloud", () => ({ cloud: { drivePicker: vi.fn() } }));

type LoadOptions = { callback: () => void; onerror: () => void };
let pickDriveItem: typeof import("../src/storage/drivePicker").pickDriveItem;
let root: HTMLDivElement;
let controller: AbortController;
const sdkScript = () =>
  document.querySelector<HTMLScriptElement>(
    'script[src="https://apis.google.com/js/api.js"]',
  );
const close = () =>
  document.querySelector<HTMLButtonElement>(".drive-picker-close")!.click();
const start = (onReady: () => void = vi.fn()) =>
  pickDriveItem({ signal: controller.signal, onReady });
const expectClean = () => {
  expect(
    document.querySelector(
      ".drive-picker-controls, .picker-dialog, .picker-dialog-bg",
    ),
  ).toBeNull();
  expect(document.body.classList.contains("drive-picker-active")).toBe(false);
  expect(
    document.documentElement.style.getPropertyValue("--drive-picker-scale"),
  ).toBe("");
  expect(root.inert).toBe(false);
};

beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal("google", undefined);
  vi.stubGlobal("gapi", undefined);
  ({ pickDriveItem } = await import("../src/storage/drivePicker"));
  root = document.createElement("div");
  root.id = "root";
  root.inert = false;
  document.body.append(root);
  controller = new AbortController();
  vi.mocked(cloud.drivePicker)
    .mockReset()
    .mockResolvedValue({
      accessToken: "token",
      apiKey: "key",
      appId: "project",
    });
});
afterEach(() => {
  controller.abort();
  root.remove();
  sdkScript()?.remove();
  vi.unstubAllGlobals();
});

it("does not wrap Google in an app dialog or frame and can cancel while loading", async () => {
  const input = document.createElement("input");
  root.append(input);
  input.focus();
  const pending = start();
  expect(document.activeElement).not.toBe(input);
  expect(root.inert).toBe(true);
  expect(document.querySelector("dialog, iframe")).toBeNull();
  close();
  await expect(pending).resolves.toBeUndefined();
  expect(document.activeElement).toBe(input);
  expectClean();
  // A late SDK failure must not reopen the UI or leave an unhandled rejection.
  sdkScript()!.dispatchEvent(new Event("error"));
  await Promise.resolve();
  expectClean();
});

it("shares an in-flight SDK load across cancel and retry", async () => {
  const first = start();
  const script = sdkScript();
  close();
  await first;
  const second = start();
  expect(sdkScript()).toBe(script);
  expect(
    document.querySelectorAll(
      'script[src="https://apis.google.com/js/api.js"]',
    ),
  ).toHaveLength(1);
  const result = expect(second).rejects.toThrow("could not load");
  script!.dispatchEvent(new Event("error"));
  await result;
  expectClean();
});

it("retries a failed SDK script instead of keeping a rejected cached promise", async () => {
  const first = start();
  const script = sdkScript();
  const failed = expect(first).rejects.toThrow("could not load");
  script!.dispatchEvent(new Event("error"));
  await failed;
  const second = start();
  expect(sdkScript()).not.toBe(script);
  const failedAgain = expect(second).rejects.toThrow("could not load");
  sdkScript()!.dispatchEvent(new Event("error"));
  await failedAgain;
  expectClean();
});

it("reuses an existing Google API loader instead of injecting it again", async () => {
  const load = vi.fn((_module: string, options: LoadOptions) =>
    options.onerror(),
  );
  vi.stubGlobal("gapi", { load });
  await expect(start()).rejects.toThrow("could not load");
  expect(load).toHaveBeenCalledOnce();
  expect(sdkScript()).toBeNull();
  expectClean();
});

it("does not build or show a picker after abort while its SDK loads", async () => {
  const build = vi.fn();
  let loaded!: LoadOptions;
  vi.stubGlobal("gapi", {
    load: (_module: string, options: LoadOptions) => {
      loaded = options;
    },
  });
  const pending = start();
  const aborted = expect(pending).rejects.toMatchObject({ name: "AbortError" });
  controller.abort();
  await aborted;
  vi.stubGlobal("google", { picker: { PickerBuilder: build } });
  loaded.callback();
  await Promise.resolve();
  await Promise.resolve();
  expect(build).not.toHaveBeenCalled();
  expectClean();
});

it("handles an abort during onReady without adding controls or starting a request", async () => {
  await expect(start(() => controller.abort())).rejects.toMatchObject({
    name: "AbortError",
  });
  expect(cloud.drivePicker).not.toHaveBeenCalled();
  expect(sdkScript()).toBeNull();
  expectClean();
});

it("restores a preexisting inert state on cancellation", async () => {
  vi.stubGlobal("google", { picker: {} });
  root.inert = true;
  const pending = start();
  close();
  await pending;
  expect(root.inert).toBe(true);
});

it("rejects incomplete configuration before building Google's account UI", async () => {
  const build = vi.fn();
  vi.stubGlobal("google", { picker: { PickerBuilder: build } });
  vi.mocked(cloud.drivePicker).mockResolvedValue({
    accessToken: "token",
    apiKey: "",
    appId: "project",
  });
  await expect(start()).rejects.toThrow("configuration is incomplete");
  expect(build).not.toHaveBeenCalled();
  expectClean();
});
