// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:http";
import { createApp } from "../server/app";
import type { Session } from "../server/vault";
import { SessionVault } from "../server/vault";
let directory: string;
let server: Server | undefined;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "fp-server-"));
});
afterEach(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = undefined;
  }
  await rm(directory, { recursive: true, force: true });
  vi.restoreAllMocks();
});
async function fixture(network = vi.fn<typeof fetch>()) {
  const created = await createApp(
    {
      origin: "http://127.0.0.1:5173",
      dataDirectory: directory,
      github: { clientId: "client", clientSecret: "secret" },
      google: { clientId: "google-client", clientSecret: "google-secret" },
    },
    network,
  );
  server = created.app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) =>
    server!.once("listening", () => resolve()),
  );
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("No server port");
  const base = `http://127.0.0.1:${address.port}`;
  const status = await fetch(`${base}/api/status`);
  const cookie = status.headers.get("set-cookie")!.split(";")[0];
  const data = (await status.json()) as { csrfToken: string };
  const current = [...created.vault.sessions.values()][0];
  const headers = {
    Cookie: cookie,
    Origin: "http://127.0.0.1:5173",
    "X-CSRF-Token": data.csrfToken,
    "Content-Type": "application/json",
  };
  return { ...created, base, headers, current, network };
}
describe("provider session and mutation boundary", () => {
  it("does not expose provider tokens and persists encrypted credentials", async () => {
    const f = await fixture();
    f.current.credentials.github = {
      accessToken: "private-token-value",
      account: "writer",
    };
    await f.vault.persist();
    const response = await fetch(`${f.base}/api/status`, {
      headers: f.headers,
    });
    const body = await response.text();
    expect(body).toContain("writer");
    expect(body).not.toContain("private-token-value");
    const encrypted = await readFile(join(directory, "sessions.enc"));
    expect(encrypted.toString()).not.toContain("private-token-value");
    const reopened = new SessionVault(directory);
    await reopened.open();
    expect(
      reopened.sessions.get(f.current.id)?.credentials.github?.accessToken,
    ).toBe("private-token-value");
  });
  it("rejects cross-origin and missing-CSRF mutations before contacting providers", async () => {
    const f = await fixture();
    const input = { id: "file", email: "writer@example.com", role: "reader" };
    for (const headers of [
      { ...f.headers, Origin: "https://attacker.example" },
      { ...f.headers, "X-CSRF-Token": "" },
    ]) {
      const response = await fetch(`${f.base}/api/google/share`, {
        method: "POST",
        headers,
        body: JSON.stringify(input),
      });
      expect(response.status).toBe(403);
    }
    expect(f.network).not.toHaveBeenCalled();
  });
  it("validates paths and prevents unconfigured or unauthenticated operations", async () => {
    const f = await fixture();
    const response = await fetch(`${f.base}/api/github/save`, {
      method: "POST",
      headers: f.headers,
      body: JSON.stringify({
        owner: "a",
        repo: "b",
        branch: "main",
        path: "../x.fountain",
        content: "x",
        message: "save",
      }),
    });
    expect(response.status).toBe(400);
    const noAuth = await fetch(`${f.base}/api/google/open?id=file`, {
      headers: f.headers,
    });
    expect(noAuth.status).toBe(401);
    expect(f.network).not.toHaveBeenCalled();
  });
  it("rejects OAuth callback state mismatch without exchanging any code", async () => {
    const f = await fixture();
    f.current.oauth = {
      provider: "github",
      state: "expected",
      verifier: "test",
      expiresAt: Date.now() + 1000,
    };
    const response = await fetch(
      `${f.base}/api/auth/github/callback?state=other&code=fake`,
      { headers: f.headers },
    );
    expect(response.status).toBe(400);
    expect(f.current.oauth).toBeUndefined();
    expect(f.network).not.toHaveBeenCalled();
  });
  it("uses PKCE and a session-bound single-use OAuth state", async () => {
    const f = await fixture();
    const response = await fetch(`${f.base}/api/auth/github/start`, {
      headers: f.headers,
      redirect: "manual",
    });
    const url = new URL(response.headers.get("location")!);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("state")).toBe(f.current.oauth?.state);
    expect(url.searchParams.get("code_challenge")).toHaveLength(43);
    expect(url.toString()).not.toContain("client_secret");
  });
});
describe("conditional provider writes", () => {
  it("passes the opened GitHub SHA and surfaces a remote conflict", async () => {
    const network = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("{}", { status: 409 }));
    const f = await fixture(network);
    f.current.credentials.github = { accessToken: "test-token" };
    const sha = "a".repeat(40);
    const response = await fetch(`${f.base}/api/github/save`, {
      method: "POST",
      headers: f.headers,
      body: JSON.stringify({
        owner: "writer",
        repo: "scripts",
        branch: "draft/two",
        path: "my scene.fountain",
        content: "INT. ROOM - DAY",
        sha,
        message: "Revise scene",
      }),
    });
    expect(response.status).toBe(409);
    const sent = JSON.parse(String(network.mock.calls[0][1]?.body));
    expect(sent.sha).toBe(sha);
    expect(sent.branch).toBe("draft/two");
    expect(network.mock.calls[0][0]).toContain("my%20scene.fountain");
    expect(await response.json()).toMatchObject({ code: "CONFLICT" });
  });
  it("refuses a Drive save if the metadata changed before the upload", async () => {
    const network = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "file",
          name: "a.fountain",
          mimeType: "text/plain",
          version: "2",
        }),
        { headers: { etag: '"new"' } },
      ),
    );
    const f = await fixture(network);
    f.current.credentials.google = { accessToken: "google-token" };
    const response = await fetch(`${f.base}/api/google/save`, {
      method: "POST",
      headers: f.headers,
      body: JSON.stringify({ id: "file", content: "new work", etag: '"old"' }),
    });
    expect(response.status).toBe(409);
    expect(network).toHaveBeenCalledOnce();
  });
  it("sends If-Match to make Drive upload atomic against concurrent changes", async () => {
    const network = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "file",
            name: "a.fountain",
            mimeType: "text/plain",
            version: "1",
          }),
          { headers: { etag: '"old"' } },
        ),
      )
      .mockResolvedValueOnce(new Response("{}", { status: 412 }));
    const f = await fixture(network);
    f.current.credentials.google = { accessToken: "google-token" };
    const response = await fetch(`${f.base}/api/google/save`, {
      method: "POST",
      headers: f.headers,
      body: JSON.stringify({ id: "file", content: "new work", etag: '"old"' }),
    });
    expect(response.status).toBe(409);
    expect(
      (network.mock.calls[1][1]?.headers as Record<string, string>)["If-Match"],
    ).toBe('"old"');
  });
  it("does not mix Drive content and version from different remote revisions", async () => {
    const metadata = (version: string) =>
      new Response(
        JSON.stringify({
          id: "file",
          name: "a.fountain",
          mimeType: "text/plain",
          version,
        }),
        { headers: { etag: `"${version}"` } },
      );
    const network = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(metadata("1"))
      .mockResolvedValueOnce(new Response("First revision"))
      .mockResolvedValueOnce(metadata("2"));
    const f = await fixture(network);
    f.current.credentials.google = { accessToken: "google-token" };
    const response = await fetch(`${f.base}/api/google/open?id=file`, {
      headers: f.headers,
    });
    expect(response.status).toBe(409);
  });
  it("refreshes expired credentials once for simultaneous requests", async () => {
    const network = vi
      .fn<typeof fetch>()
      .mockImplementation(async (url) =>
        String(url).includes("/token")
          ? new Response(
              JSON.stringify({ access_token: "new-token", expires_in: 3600 }),
            )
          : new Response(JSON.stringify({ files: [] })),
      );
    const f = await fixture(network);
    f.current.credentials.google = {
      accessToken: "expired",
      refreshToken: "refresh-token",
      expiresAt: Date.now() - 100,
    };
    await Promise.all([
      f.providers.request(f.current as Session, "google", "/drive/v3/files"),
      f.providers.request(f.current as Session, "google", "/drive/v3/files"),
    ]);
    expect(
      network.mock.calls.filter((c) => String(c[0]).includes("/token")),
    ).toHaveLength(1);
    expect(f.current.credentials.google.accessToken).toBe("new-token");
  });
});

it("reports full Drive browsing only for a granted full Drive scope", async () => {
  const f = await fixture();
  f.current.credentials.google = {
    accessToken: "private",
    scope: "https://www.googleapis.com/auth/drive.file",
  };
  let result = await (
    await fetch(`${f.base}/api/status`, { headers: f.headers })
  ).json();
  expect(result.google.driveAccess).toBe("limited");
  f.current.credentials.google.scope = "https://www.googleapis.com/auth/drive";
  result = await (
    await fetch(`${f.base}/api/status`, { headers: f.headers })
  ).json();
  expect(result.google.driveAccess).toBe("full");
  expect(JSON.stringify(result)).not.toContain("private");
});
