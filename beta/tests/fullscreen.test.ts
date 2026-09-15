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

for (const mode of ["ios", "standalone", "fullscreen"]) {
  it(`does nothing in an installed ${mode} app without fullscreen APIs`, async () => {
    const doc = {
      documentElement: {},
      defaultView: {
        navigator: { standalone: mode === "ios" },
        matchMedia: (query: string) => ({
          matches: query === `(display-mode: ${mode})`,
        }),
      },
    } as unknown as Document;
    await expect(setBrowserFullscreen(true, doc)).resolves.toBeUndefined();
    await expect(setBrowserFullscreen(false, doc)).resolves.toBeUndefined();
  });
}

it("does not enter or exit native fullscreen even if an installed app exposes the APIs", async () => {
  const requestFullscreen = vi.fn();
  const exitFullscreen = vi.fn();
  const doc = {
    documentElement: { requestFullscreen },
    exitFullscreen,
    fullscreenElement: document.documentElement,
    defaultView: { navigator: { standalone: true } },
  } as unknown as Document;
  await setBrowserFullscreen(true, doc);
  await setBrowserFullscreen(false, doc);
  expect(requestFullscreen).not.toHaveBeenCalled();
  expect(exitFullscreen).not.toHaveBeenCalled();
});
