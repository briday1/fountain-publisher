import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Use the exact runtime/bundler installed with the locked Wrangler version.
const require = createRequire(new URL("../package.json", import.meta.url));
const { Miniflare, convertV4MiniflareOptions } = require("miniflare");
const { build } = require("esbuild");
const origin = "https://fountain-publisher.com";
const roomUrl = `https://api.fountain-publisher.com/api/collaboration/${"a".repeat(48)}`;
const query = "?fileId=drive_file_123456";

test("API responses survive the real Workers Durable Object boundary", { timeout: 30_000 }, async (t) => {
  const bundle = await build({
    entryPoints: [fileURLToPath(new URL("./fixtures/response-boundary.mjs", import.meta.url))],
    bundle: true, write: false, format: "esm", platform: "browser",
  });
  const options = {
    modules: true, compatibilityDate: "2026-08-27",
    durableObjects: { COLLAB_ROOMS: "BoundaryRoom" }, script: bundle.outputFiles[0].text,
  };
  const mf = new Miniflare(convertV4MiniflareOptions(options));
  t.after(() => mf.dispose());
  const headers = { origin, cookie: "fp_google_session=synthetic-session" };
  function checkpoint(status) {
    return mf.dispatchFetch(`${roomUrl}/checkpoint${query}`, {
      method: "POST", headers, body: JSON.stringify({ expectedContent: String(status) }),
    });
  }
  function assertCors(response) {
    assert.equal(response.headers.get("access-control-allow-origin"), origin);
    assert.equal(response.headers.get("access-control-allow-credentials"), "true");
    assert.equal(response.headers.get("vary"), "Origin");
  }

  await t.test("a successful save remains successful instead of becoming a generic 500", async () => {
    const response = await checkpoint(200);
    assert.equal(response.status, 200);
    assertCors(response);
    assert.deepEqual(await response.json(), {
      saved: true, content: "Synthetic screenplay", file: { id: "drive_file_123456" },
    });
  });
  for (const status of [401, 403, 409, 412, 503]) {
    await t.test(`checkpoint ${status} retains its actual status and error`, async () => {
      const response = await checkpoint(status);
      assert.equal(response.status, status);
      assertCors(response);
      assert.deepEqual(await response.json(), { error: "Synthetic Drive conflict" });
    });
  }
  await t.test("recovery preserves its body and no-store header", async () => {
    const response = await mf.dispatchFetch(`${roomUrl}/recovery${query}`, { headers });
    assert.equal(response.status, 200);
    assertCors(response);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), { roomContent: "Synthetic screenplay", driveContent: "Drive version" });
  });
  await t.test("unexpected collaboration exceptions do not claim GitHub failed or expose details", async () => {
    const response = await checkpoint("throw");
    assert.equal(response.status, 500);
    assertCors(response);
    assert.deepEqual(await response.json(), { error: "Collaboration request failed. Please try again." });
  });
  await t.test("WebSocket upgrades retain their socket and status", async () => {
    const response = await mf.dispatchFetch(`${roomUrl}${query}&protocol=2`, { headers: { ...headers, upgrade: "websocket" } });
    assert.equal(response.status, 101);
    assert.ok(response.webSocket);
    response.webSocket.accept();
    response.webSocket.close(1000);
  });
});
