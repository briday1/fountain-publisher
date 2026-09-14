// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createBetaWorker } from "../cloudflare/beta";
import type { BetaEnvironment } from "../cloudflare/beta";
const beta = "https://beta.fountain-publisher.com";
const api = "https://api.fountain-publisher.com";
const file = "drive_file_1234567890";
function fixture(response: Response = Response.json({ ok: true })) {
  const room = vi.fn(async (_request: Request | string) => response);
  const name = vi.fn((value: string) => value);
  const shared = vi.fn(async () => {
    throw new Error("Unexpected shared request");
  });
  const network = vi.fn<typeof fetch>();
  const env: BetaEnvironment = {
    BETA_ORIGIN: beta,
    API_ORIGIN: api,
    SHARED_ORIGIN: "https://fountain-publisher.com",
    SHARED_API: { fetch: shared },
    ASSETS: { fetch: async () => new Response("page") },
    LIVE_ROOMS: { idFromName: name, get: () => ({ fetch: room }) },
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
          Cookie: "fp_google_session=alice; fp_beta_csrf=nonce",
          "X-CSRF-Token": "nonce",
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      env,
    );
  return { room, name, shared, network, request, worker, env };
}
describe("beta live room routing", () => {
  it("rejects untrusted WebSocket origins before room access and preserves genuine101 responses", async () => {
    const upgrade = { status: 101, webSocket: {} } as unknown as Response;
    const f = fixture(upgrade);
    const route = `/collaboration/${file}/connect?clientId=123`;
    expect(
      (
        await f.request(route, undefined, {
          Origin: "https://hostile.example",
          Upgrade: "websocket",
        })
      ).status,
    ).toBe(403);
    expect(f.room).not.toHaveBeenCalled();
    expect(await f.request(route, undefined, { Upgrade: "websocket" })).toBe(
      upgrade,
    );
    expect(f.name).toHaveBeenCalledWith(`structured-v1:${file}`);
    const forwarded = f.room.mock.calls[0][0] as Request;
    expect(forwarded.url).toBe(
      `https://room.internal/connect?fileId=${file}&clientId=123`,
    );
    expect(forwarded.headers.get("cookie")).toContain(
      "fp_google_session=alice",
    );
    expect(forwarded.headers.get("upgrade")).toBe("websocket");
  });

  it("requires CSRF on bootstrap/checkpoint and the beta origin on recovery", async () => {
    const f = fixture();
    expect(
      (
        await f.request(
          `/collaboration/${file}/bootstrap`,
          {},
          { "X-CSRF-Token": "wrong" },
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await f.request(
          `/collaboration/${file}/checkpoint`,
          {},
          { Origin: "https://hostile.example" },
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await f.request(`/collaboration/${file}/recovery`, undefined, {
          Origin: "https://hostile.example",
        })
      ).status,
    ).toBe(403);
    expect(f.room).not.toHaveBeenCalled();
    const response = await f.request(`/collaboration/${file}/checkpoint`, {
      vector: "AA==",
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(beta);
    expect(await (f.room.mock.calls[0][0] as Request).json()).toEqual({
      vector: "AA==",
    });
  });

  it("routes legacy plain saves through the room ownership queue without direct uploads", async () => {
    const f = fixture(
      Response.json(
        { error: "Live state differs", code: "LIVE_NOT_SYNCED" },
        { status: 409 },
      ),
    );
    const result = await f.request("/google/save", {
      id: file,
      content: "stale local draft",
      etag: '"version-1"',
    });
    expect(result.status).toBe(409);
    expect(await result.json()).toMatchObject({ code: "LIVE_NOT_SYNCED" });
    const request = f.room.mock.calls[0][0] as Request;
    expect(request.url).toBe(`https://room.internal/plain-save?fileId=${file}`);
    expect(await request.json()).toEqual({
      expectedContent: "stale local draft",
      etag: '"version-1"',
    });
    expect(f.network).not.toHaveBeenCalled();
    expect(f.shared).not.toHaveBeenCalled();
  });
});
