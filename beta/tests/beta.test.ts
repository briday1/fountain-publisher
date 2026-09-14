// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { createBetaWorker } from "../cloudflare/beta";
import type { BetaEnvironment } from "../cloudflare/beta";
const beta = "https://beta.fountain-publisher.com";
const api = "https://api.fountain-publisher.com";
const main = "https://fountain-publisher.com";
function fixture(
  shared = vi.fn<
    (input: Request | string, init?: RequestInit) => Promise<Response>
  >(),
  network = vi.fn<typeof fetch>(),
) {
  const env: BetaEnvironment = {
    BETA_ORIGIN: beta,
    SHARED_ORIGIN: main,
    API_ORIGIN: api,
    ASSETS: {
      fetch: async () =>
        new Response("<html>Beta</html>", {
          headers: { "content-type": "text/html" },
        }),
    },
    SHARED_API: { fetch: shared },
  };
  const worker = createBetaWorker(network);
  const request = (
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ) =>
    worker.fetch(
      new Request(`${api}/beta/api${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          Origin: beta,
          Cookie: "fp_beta_csrf=nonce; fp_google_session=session",
          "X-CSRF-Token": "nonce",
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      env,
    );
  return { env, worker, request, shared, network };
}
describe("shared Cloudflare infrastructure boundary", () => {
  it("reports actual shared account state without returning any provider tokens", async () => {
    const f = fixture(
      vi
        .fn()
        .mockImplementation(async (input: Request) =>
          new URL(input.url).pathname === "/api/session"
            ? new Response(JSON.stringify({ connected: true, login: "writer" }))
            : new Response("{}", { status: 401 }),
        ),
    );
    const result = await f.request("/status");
    expect(result.headers.get("access-control-allow-origin")).toBe(beta);
    expect(await result.json()).toMatchObject({
      github: { connected: true, account: "writer" },
      google: { connected: false },
      csrfToken: "nonce",
    });
    expect(
      f.shared.mock.calls.every(
        ([r]) => new Headers((r as Request).headers).get("origin") === main,
      ),
    ).toBe(true);
  });
  it("rejects hostile origins and missing CSRF before any cloud side effect", async () => {
    const f = fixture();
    const invalidHeaders: Record<string, string>[] = [
      { Origin: "https://other.example" },
      { "X-CSRF-Token": "" },
    ];
    for (const headers of invalidHeaders) {
      expect(
        (
          await f.request(
            "/google/share",
            { id: "file", email: "x@example.com", role: "reader" },
            headers,
          )
        ).status,
      ).toBe(403);
    }
    expect(f.shared).not.toHaveBeenCalled();
    expect(f.network).not.toHaveBeenCalled();
  });
  it("passes primary OAuth callbacks through unchanged", async () => {
    const html = `<script>window.opener.postMessage({type:'github-connected'},"${main}")</script>`;
    const f = fixture(
      vi.fn().mockResolvedValue(
        new Response(html, {
          headers: {
            "content-type": "text/html",
            "set-cookie": "fp_github_session=opaque; HttpOnly; Secure",
          },
        }),
      ),
    );
    const response = await f.worker.fetch(
      new Request(`${api}/auth/github/callback?code=test&state=nonce`),
      f.env,
    );
    expect(await response.text()).toBe(html);
    expect(response.headers.get("set-cookie")).toContain("opaque");
  });
  it("returns beta OAuth callbacks to beta while retaining shared session cookies", async () => {
    const html = `<script>window.opener.postMessage({type:'google-connected'},"${main}")</script>`;
    const f = fixture(
      vi.fn().mockResolvedValue(
        new Response(html, {
          headers: {
            "content-type": "text/html",
            "set-cookie": "fp_google_session=opaque; HttpOnly; Secure",
          },
        }),
      ),
    );
    const response = await f.worker.fetch(
      new Request(`${api}/auth/google/callback?code=test&state=nonce`, {
        headers: { Cookie: "fp_beta_return=google" },
      }),
      f.env,
    );
    expect(await response.text()).toContain(beta);
    expect(response.headers.get("set-cookie")).toContain(
      "fp_google_session=opaque",
    );
    expect(response.headers.get("set-cookie")).toContain("fp_beta_return=;");
  });
  it("keeps the original registered callback when starting beta authorization", async () => {
    const f = fixture(
      vi.fn().mockResolvedValue(
        new Response(null, {
          status: 302,
          headers: {
            location:
              "https://github.com/login/oauth/authorize?redirect_uri=original",
            "set-cookie": "fp_github_oauth=nonce; HttpOnly; Secure",
          },
        }),
      ),
    );
    const response = await f.request("/auth/github/start");
    expect(response.status).toBe(302);
    expect((f.shared.mock.calls[0][0] as Request).url).toBe(
      `${api}/auth/github/start`,
    );
    expect((f.shared.mock.calls[0][0] as Request).redirect).toBe("manual");
    expect(response.headers.get("location")).toBe(
      "https://github.com/login/oauth/authorize?redirect_uri=original",
    );
    expect(response.headers.get("set-cookie")).toContain(
      "fp_github_oauth=nonce",
    );
    expect(response.headers.get("set-cookie")).toContain(
      "fp_beta_return=github",
    );
  });
  it("passes the opened GitHub SHA and returns cloud conflicts without overwriting", async () => {
    const f = fixture(
      vi.fn().mockResolvedValue(new Response("{}", { status: 409 })),
    );
    const response = await f.request("/github/save", {
      owner: "writer",
      repo: "scripts",
      branch: "main",
      path: "a.fountain",
      sha: "a".repeat(40),
      content: "Changed.",
      message: "Update",
    });
    expect(response.status).toBe(409);
    const sent = f.shared.mock.calls[0][0] as Request;
    expect(await sent.json()).toMatchObject({
      sha: "a".repeat(40),
      content: "Changed.",
    });
  });
  it("uses server-only Google tokens and actual v2 If-Match for atomic uploads", async () => {
    const shared = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ accessToken: "only-inside-worker" })),
      );
    const network = vi
      .fn<typeof fetch>()
      .mockImplementation(async (input, init) => {
        const url = String(input);
        if (url.includes("/upload/")) {
          expect(new Headers(init?.headers).get("if-match")).toBe('"old"');
          return new Response("{}", { status: 412 });
        }
        if (url.includes("/drive/v2/"))
          return new Response(JSON.stringify({ id: "file", etag: '"old"' }));
        return new Response(
          JSON.stringify({
            id: "file",
            name: "a.fountain",
            mimeType: "text/plain",
            capabilities: { canEdit: true },
          }),
        );
      });
    const f = fixture(shared, network);
    const response = await f.request("/google/save", {
      id: "file",
      etag: '"old"',
      content: "Text.",
    });
    expect(response.status).toBe(409);
    expect(await response.text()).not.toContain("only-inside-worker");
    expect(
      network.mock.calls.every(
        ([, init]) =>
          new Headers(init?.headers).get("authorization") ===
          "Bearer only-inside-worker",
      ),
    ).toBe(true);
  });
  it("rejects missing Drive version validators before attempting to upload", async () => {
    const f = fixture(
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ accessToken: "token" })),
        ),
      vi.fn().mockImplementation(
        async () =>
          new Response(
            JSON.stringify({
              id: "file",
              name: "a.fountain",
              mimeType: "text/plain",
            }),
          ),
      ),
    );
    expect(
      (
        await f.request("/google/save", {
          id: "file",
          etag: "old",
          content: "Text",
        })
      ).status,
    ).toBe(503);
    expect(
      f.network.mock.calls.every(([url]) => !String(url).includes("/upload/")),
    ).toBe(true);
  });
  it.each(["/", "/index.html", "/sw.js", "/manifest.webmanifest"])(
    "never serves a CDN-cached mutable shell at %s",
    async (path) => {
      const network = vi.fn<typeof fetch>().mockResolvedValue(
        new Response("current release", {
          headers: {
            "content-type": "application/javascript",
            "cache-control": "max-age=14400",
            age: "320",
            expires: "tomorrow",
          },
        }),
      );
      const f = fixture(undefined, network);
      f.env.BETA_ASSET_ORIGIN = `${main}/previews/beta`;
      const response = await f.worker.fetch(
        new Request(`${beta}${path}`),
        f.env,
      );
      const upstreamUrl = new URL(String(network.mock.calls[0][0]));
      expect(upstreamUrl.searchParams.get("_fp_refresh")).toMatch(
        /^[a-f0-9-]+$/,
      );
      expect(network.mock.calls[0][1]).toMatchObject({
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("cloudflare-cdn-cache-control")).toBe(
        "no-store",
      );
      expect(response.headers.has("age")).toBe(false);
      expect(response.headers.has("expires")).toBe(false);
    },
  );
  it("keeps beta assets isolated under the preserved Pages preview path", async () => {
    const network = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("beta-script", {
        headers: { "content-type": "text/javascript" },
      }),
    );
    const f = fixture(undefined, network);
    f.env.BETA_ASSET_ORIGIN = `${main}/previews/beta`;
    const response = await f.worker.fetch(
      new Request(`${beta}/assets/app-abc.js`),
      f.env,
    );
    expect(network.mock.calls[0][0]).toBe(
      `${main}/previews/beta/assets/app-abc.js`,
    );
    expect(response.headers.get("content-security-policy")).toContain(
      "frame-ancestors",
    );
    expect(await response.text()).toBe("beta-script");
  });
});
