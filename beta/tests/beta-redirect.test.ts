// @vitest-environment node
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";

const source = (name: string) =>
  readFileSync(
    new URL(`../public/previews/beta/${name}`, import.meta.url),
    "utf8",
  );

it.each([
  ["https://beta.fountain-publisher.com/", "https://fountain-publisher.com/"],
  [
    "https://beta.fountain-publisher.com/?drive=abc#scene-2",
    "https://fountain-publisher.com/?drive=abc#scene-2",
  ],
  [
    "https://fountain-publisher.com/previews/beta/index.html?drive=abc#scene-2",
    "https://fountain-publisher.com/?drive=abc#scene-2",
  ],
  [
    "https://beta.fountain-publisher.com/script?next=https://example.com",
    "https://fountain-publisher.com/script?next=https://example.com",
  ],
])("forwards %s without losing shared links", (href, expected) => {
  const replace = vi.fn();
  runInNewContext(source("redirect.js"), { URL, location: { href, replace } });
  expect(replace).toHaveBeenCalledWith(expected);
});

it("retires offline navigation while leaving open sessions and API requests alone", () => {
  const listeners: Record<string, (event: any) => void> = {};
  const skipWaiting = vi.fn(() => Promise.resolve());
  runInNewContext(source("sw.js"), {
    URL,
    Response,
    self: {
      skipWaiting,
      addEventListener: (type: string, handler: (event: any) => void) => {
        listeners[type] = handler;
      },
    },
  });
  listeners.install({ waitUntil: vi.fn() });
  expect(skipWaiting).toHaveBeenCalledOnce();
  const respondWith = vi.fn();
  listeners.fetch({
    request: {
      mode: "navigate",
      method: "GET",
      url: "https://beta.fountain-publisher.com/?drive=abc",
    },
    respondWith,
  });
  expect(respondWith.mock.calls[0][0].headers.get("location")).toBe(
    "https://fountain-publisher.com/?drive=abc",
  );
  respondWith.mockClear();
  listeners.fetch({
    request: {
      mode: "cors",
      method: "POST",
      url: "https://api.fountain-publisher.com/beta/api/drive",
    },
    respondWith,
  });
  expect(respondWith).not.toHaveBeenCalled();
  // No activation handler claims clients, reloads tabs, or removes local data.
  expect(listeners.activate).toBeUndefined();
});
