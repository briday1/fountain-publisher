import { expect, it, vi } from "vitest";
import {
  fullscreenElement,
  setBrowserFullscreen,
} from "../src/components/fullscreen";

it("requests the old app's hidden browser-navigation mode", async () => {
  const requestFullscreen = vi.fn().mockResolvedValue(undefined);
  const doc = { documentElement: { requestFullscreen } } as unknown as Document;
  await setBrowserFullscreen(true, doc);
  expect(requestFullscreen).toHaveBeenCalledWith({ navigationUI: "hide" });
});

it("uses Safari's prefixed entry, state, and exit when needed", async () => {
  const webkitRequestFullscreen = vi.fn();
  const webkitExitFullscreen = vi.fn();
  const mock = {
    documentElement: { webkitRequestFullscreen },
    webkitExitFullscreen,
    webkitFullscreenElement: null as Element | null,
  };
  const doc = mock as unknown as Document;
  await setBrowserFullscreen(true, doc);
  expect(webkitRequestFullscreen).toHaveBeenCalledOnce();
  mock.webkitFullscreenElement = document.documentElement;
  expect(fullscreenElement(doc)).toBe(document.documentElement);
  await setBrowserFullscreen(false, doc);
  expect(webkitExitFullscreen).toHaveBeenCalledOnce();
});

it("reports unsupported fullscreen without claiming it is active", async () => {
  const doc = { documentElement: {} } as Document;
  await expect(setBrowserFullscreen(true, doc)).rejects.toThrow("unavailable");
  expect(fullscreenElement(doc)).toBeFalsy();
});
