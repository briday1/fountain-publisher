// @vitest-environment node
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { offlineShell } from "../build-tools/offline";

const origin = "https://beta.fountain-publisher.com";
function build(
  html = '<script src="/assets/app-test.js"></script>',
  notices = "Full dependency license text",
) {
  const emitted: { fileName: string; source: string }[] = [];
  const hook = offlineShell().generateBundle as { handler: Function };
  hook.handler.call(
    {
      emitFile: (file: { fileName: string; source: string }) =>
        emitted.push(file),
    },
    {},
    {
      "index.html": { type: "asset", source: html },
      "assets/app-test.js": { type: "chunk", code: "app" },
      "licenses.html": { type: "asset", source: `<pre>${notices}</pre>` },
      "THIRD_PARTY_NOTICES.txt": { type: "asset", source: notices },
    },
  );
  return {
    script: emitted.find(({ fileName }) => fileName === "sw.js")!.source,
    shell: emitted.find(({ fileName }) => fileName.endsWith(".html"))!,
    emitted,
  };
}

function harness() {
  const bundle = build();
  const stores = new Map<string, Map<string, Response>>();
  const calls: {
    waitUntil: (promise: Promise<unknown>) => void;
    respondWith?: (promise: Promise<Response>) => void;
    request?: unknown;
  }[] = [];
  const events = new Map<string, (event: (typeof calls)[number]) => void>();
  const network = vi.fn(
    async (request: Request) =>
      new Response(
        request.url.endsWith(bundle.shell.fileName)
          ? bundle.shell.source
          : "asset",
      ),
  );
  const key = (request: Request | string) =>
    new URL(typeof request === "string" ? request : request.url, origin).href;
  const caches = {
    has: async (name: string) => stores.has(name),
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    open: async (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name)!;
      return {
        match: async (request: Request | string) =>
          store.get(key(request))?.clone(),
        put: async (request: Request | string, response: Response) => {
          store.set(key(request), response.clone());
        },
        addAll: async (requests: Request[]) => {
          const responses = await Promise.all(
            requests.map((request) => network(request)),
          );
          if (responses.some((response) => !response.ok))
            throw new Error("Request failed");
          requests.forEach((request, index) =>
            store.set(key(request), responses[index]),
          );
        },
      };
    },
  };
  class WorkerRequest extends Request {
    constructor(input: string, options?: RequestInit) {
      super(new URL(input, origin), options);
    }
  }
  const claim = vi.fn(async () => {});
  runInNewContext(bundle.script, {
    caches,
    Request: WorkerRequest,
    Response,
    URL,
    fetch: network,
    self: {
      location: new URL(`${origin}/sw.js`),
      clients: { claim },
      addEventListener: (
        name: string,
        fn: typeof events extends Map<string, infer T> ? T : never,
      ) => events.set(name, fn),
    },
  });
  const lifecycle = async (name: string) => {
    const pending: Promise<unknown>[] = [];
    events.get(name)!({ waitUntil: (promise) => pending.push(promise) });
    await Promise.all(pending);
  };
  const request = async (url = "/", mode = "navigate") => {
    let response: Promise<Response> | undefined;
    const pending: Promise<unknown>[] = [];
    events.get("fetch")!({
      request: { url: new URL(url, origin).href, method: "GET", mode },
      waitUntil: (promise) => pending.push(promise),
      respondWith: (promise) => {
        response = promise;
      },
    });
    const result = await response;
    await Promise.all(pending);
    return result;
  };
  return { bundle, stores, caches, network, claim, lifecycle, request };
}

describe("offline release integrity", () => {
  it("emits an immutable HTML snapshot and versions HTML-only changes", () => {
    const first = build();
    expect(first.shell.fileName).toMatch(/^offline-shell-[a-f0-9]+\.html$/);
    expect(first.shell.source).toContain("/assets/app-test.js");
    expect(
      build('<title>Changed</title><script src="/assets/app-test.js"></script>')
        .shell.fileName,
    ).not.toBe(first.shell.fileName);
  });
  it("versions notice-only changes and includes both notice formats in the offline release", () => {
    const first = build();
    expect(first.script).toContain('"/licenses.html"');
    expect(first.script).toContain('"/THIRD_PARTY_NOTICES.txt"');
    expect(build(undefined, "Updated license notices").shell.fileName).not.toBe(
      first.shell.fileName,
    );
  });
  it("opens cached license documents themselves during an offline navigation", async () => {
    const h = harness();
    await h.lifecycle("install");
    const cache = await h.caches.open(
      [...h.stores.keys()].find((key) => key.startsWith("fp2-shell-"))!,
    );
    await cache.put("/licenses.html", new Response("License page"));
    await cache.put("/THIRD_PARTY_NOTICES.txt", new Response("License text"));
    h.network.mockRejectedValue(new TypeError("Offline"));
    expect(await (await h.request("/licenses.html?from=help"))!.text()).toBe(
      "License page",
    );
    expect(await (await h.request("/THIRD_PARTY_NOTICES.txt"))!.text()).toBe(
      "License text",
    );
  });
  it("installs every asset without the browser HTTP cache and removes incomplete installs", async () => {
    const h = harness();
    h.network.mockImplementation(
      async (request) =>
        new Response("gone", {
          status: request.url.endsWith(".js") ? 404 : 200,
        }),
    );
    await expect(h.lifecycle("install")).rejects.toThrow("Request failed");
    expect(h.stores.size).toBe(0);
    expect(
      h.network.mock.calls.every(([request]) => request.cache === "reload"),
    ).toBe(true);
  });
  it("reopens its own complete release after offline or HTTP failure without mixing older caches or newer HTML", async () => {
    const h = harness();
    await (
      await h.caches.open("fp2-shell-old")
    ).put("/", new Response("oldest HTML"));
    await h.lifecycle("install");
    await h.lifecycle("activate");
    expect(h.claim).toHaveBeenCalledOnce();
    h.network.mockResolvedValue(new Response("next release HTML"));
    expect(await (await h.request())!.text()).toBe("next release HTML");
    h.network.mockRejectedValue(new TypeError("Offline"));
    expect(await (await h.request())!.text()).toBe(h.bundle.shell.source);
    expect(await (await h.request("/assets/app-test.js", "cors"))!.text()).toBe(
      "asset",
    );
    h.network.mockResolvedValue(new Response("maintenance", { status: 503 }));
    expect(await (await h.request())!.text()).toBe(h.bundle.shell.source);
  });
  it.each([false, true])(
    "preserves Access login redirects with an installed shell: %s",
    async (installed) => {
      const h = harness();
      if (installed) await h.lifecycle("install");
      // Navigation requests use manual redirects. A cross-origin Access login
      // becomes an opaque redirect: status 0 and ok=false, not a network error.
      const redirect = Response.error();
      Object.defineProperty(redirect, "type", { value: "opaqueredirect" });
      h.network.mockResolvedValue(redirect);
      expect(await h.request()).toBe(redirect);
    },
  );
  it.each([401, 403])(
    "preserves HTTP %s authentication failures instead of serving a cached app",
    async (status) => {
      const h = harness();
      await h.lifecycle("install");
      const denied = new Response("Sign in to continue", { status });
      h.network.mockResolvedValue(denied);
      expect(await h.request()).toBe(denied);
    },
  );
  it("does not delete an already usable release when a same-release update fails", async () => {
    const h = harness();
    await h.lifecycle("install");
    h.network.mockResolvedValue(new Response("unavailable", { status: 503 }));
    await expect(h.lifecycle("install")).rejects.toThrow("Request failed");
    expect(await (await h.request())!.text()).toBe(h.bundle.shell.source);
  });
  it("leaves account API requests and other origins outside offline caching", async () => {
    const h = harness();
    expect(await h.request("/api/private", "cors")).toBeUndefined();
    expect(await h.request("/beta/api/status", "cors")).toBeUndefined();
    expect(
      await h.request(
        "https://api.fountain-publisher.com/beta/api/status",
        "cors",
      ),
    ).toBeUndefined();
    expect(h.network).not.toHaveBeenCalled();
  });
});
