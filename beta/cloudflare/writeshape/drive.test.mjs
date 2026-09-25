import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generateKeyPair, exportJWK, createLocalJWKSet, SignJWT } from "jose";
import { testDB, request } from "./test-db.mjs";
import { verifyGoogleToken } from "./accounts.mjs";
import { createDriveRoutes, driveConfigured } from "./drive.mjs";
import { HttpError, json, now } from "./http.mjs";

const scope = "https://www.googleapis.com/auth/drive";
const pair = await generateKeyPair("RS256");
const keys = createLocalJWKSet({
  keys: [
    { ...(await exportJWK(pair.publicKey)), kid: "test-key", alg: "RS256" },
  ],
});
const user = (id = "owner", free = false) =>
  id ? { id, private_tester: free ? 0 : 1 } : null;
const response = (data, status = 200) =>
  new Response(typeof data === "string" ? data : JSON.stringify(data), {
    status,
    headers: {
      "Content-Type":
        typeof data === "string" ? "text/plain" : "application/json",
    },
  });
async function signed(nonce, extra = {}) {
  return new SignJWT({
    sub: "drive-person",
    email: "drive@example.test",
    email_verified: true,
    nonce,
    ...extra,
  })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer("https://accounts.google.com")
    .setAudience(extra.aud || "dedicated-write-client")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(pair.privateKey);
}
function fixture() {
  const env = {
    ...testDB(),
    APP_ORIGIN: "https://writeshape.com",
    GOOGLE_CLIENT_ID: "dedicated-write-client",
    GOOGLE_CLIENT_SECRET: "fixture-client-secret",
    DRIVE_TOKEN_KEY: btoa("k".repeat(32)),
  };
  env.sql.exec(readFileSync(new URL("./drive.sql", import.meta.url), "utf8"));
  for (const id of ["owner", "other"])
    env.sql
      .prepare("INSERT INTO accounts(id,email,created) VALUES (?,?,0)")
      .run(id, `${id}@example.test`);
  const calls = [];
  const provider = {
    nonce: "",
    etag: '"one"',
    text: "INT. ROOM - DAY\n\nSynthetic writing.",
    canEdit: true,
    canAddChildren: true,
    scope,
    expires: 3600,
    claims: {},
    tokenHook: null,
    hook: null,
    tokenCount: 0,
  };
  const route = createDriveRoutes({
    verifyIdToken: (token, e, nonce) =>
      verifyGoogleToken(token, e, nonce, keys),
    fetch: async (url, init) => {
      const parsed = new URL(url);
      calls.push({ url: parsed, init });
      assert.equal(init.redirect, "error");
      if (parsed.origin === "https://oauth2.googleapis.com") {
        provider.tokenCount++;
        if (provider.tokenHook) {
          const result = await provider.tokenHook(parsed, init);
          if (result) return result;
        }
        const body = new URLSearchParams(init.body);
        assert.equal(body.get("client_id"), "dedicated-write-client");
        assert.equal(body.get("client_secret"), "fixture-client-secret");
        return response({
          access_token: `fixture-access-${provider.tokenCount}`,
          refresh_token: `fixture-refresh-${provider.tokenCount}`,
          expires_in: provider.expires,
          token_type: "Bearer",
          scope: provider.scope,
          ...(body.get("grant_type") === "authorization_code"
            ? { id_token: await signed(provider.nonce, provider.claims) }
            : {}),
        });
      }
      assert.equal(parsed.origin, "https://www.googleapis.com");
      assert.match(
        new Headers(init.headers).get("Authorization"),
        /^Bearer fixture-access-/,
      );
      if (provider.hook) {
        const result = await provider.hook(parsed, init);
        if (result) return result;
      }
      if (parsed.pathname === "/drive/v3/files")
        return response({
          files: [
            {
              id: "folder",
              name: "Scripts",
              mimeType: "application/vnd.google-apps.folder",
              capabilities: { canAddChildren: true },
            },
            {
              id: "file",
              name: "Scene.fountain",
              mimeType: "text/plain",
              size: String(new TextEncoder().encode(provider.text).length),
              modifiedTime: "2026-09-24T12:00:00Z",
              capabilities: { canEdit: provider.canEdit },
            },
            {
              id: "bad",
              name: "ignore.fountain.exe",
              mimeType: "application/octet-stream",
            },
            {
              id: "doc",
              name: "document.txt",
              mimeType: "application/vnd.google-apps.document",
            },
          ],
          nextPageToken: "page-two",
        });
      if (parsed.pathname.startsWith("/drive/v2/files/"))
        return response({ id: "file", etag: provider.etag });
      if (parsed.pathname.startsWith("/drive/v3/files/")) {
        const id = parsed.pathname.split("/").at(-1);
        if (parsed.searchParams.get("alt") === "media")
          return response(provider.text);
        if (["root", "folder"].includes(id))
          return response({
            id,
            name: "Scripts",
            mimeType: "application/vnd.google-apps.folder",
            capabilities: { canAddChildren: provider.canAddChildren },
          });
        return response({
          id,
          name: "Scene.fountain",
          mimeType: "text/plain",
          size: String(new TextEncoder().encode(provider.text).length),
          modifiedTime: "2026-09-24T12:00:00Z",
          capabilities: { canEdit: provider.canEdit },
        });
      }
      if (parsed.pathname.startsWith("/upload/drive/v2/files/")) {
        if (new Headers(init.headers).get("If-Match") !== provider.etag)
          return response({}, 412);
        provider.text = init.body;
        provider.etag = '"two"';
        return response({
          id: "file",
          title: "Scene.fountain",
          etag: provider.etag,
          modifiedDate: "2026-09-24T13:00:00Z",
        });
      }
      if (parsed.pathname === "/upload/drive/v3/files")
        return response({ id: "created" });
      throw new Error(`Unexpected fixture path ${parsed.pathname}`);
    },
  });
  const call = async (path, body, options = {}) => {
    try {
      return await route(
        options.request ||
          request(path, body, options.cookie || "", options.origin),
        env,
        user(options.user === undefined ? "owner" : options.user, options.free),
      );
    } catch (error) {
      if (!(error instanceof HttpError)) throw error;
      return json({ error: error.message, code: error.code }, error.status);
    }
  };
  const start = async (options = {}) => {
    const result = await call("/api/drive/connect", {}, options);
    assert.equal(result.status, 200);
    const auth = new URL((await result.json()).url);
    provider.nonce = auth.searchParams.get("nonce");
    return {
      auth,
      cookie: result.headers.get("Set-Cookie").split(";")[0],
      path: `/api/drive/callback?state=${auth.searchParams.get("state")}&code=fixture-code`,
    };
  };
  const connect = async (options = {}) => {
    const flow = await start(options);
    const result = await call(flow.path, undefined, {
      ...options,
      cookie: flow.cookie,
    });
    assert.equal(result.status, 303);
    return flow;
  };
  return { env, provider, calls, route, call, start, connect };
}

test("unconfigured status is honest, account required, unrelated routes are untouched", async () => {
  const f = fixture();
  delete f.env.DRIVE_TOKEN_KEY;
  assert.equal(driveConfigured(f.env), false);
  assert.deepEqual(await (await f.call("/api/drive/status")).json(), {
    configured: false,
    connected: false,
    email: null,
    canWrite: false,
    reason: "Google Drive is not configured for WriteShape yet.",
  });
  assert.equal((await f.call("/api/drive/connect", {})).status, 503);
  assert.equal(
    (await f.call("/api/drive/status", undefined, { user: null })).status,
    401,
  );
  assert.equal(await f.route(request("/api/library"), f.env, null), null);
  assert.equal(f.calls.length, 0);
});

test("connect uses dedicated client, consent-only full Drive scope, PKCE, nonce and secure state cookie", async () => {
  const f = fixture();
  const flow = await f.start();
  assert.equal(flow.auth.origin, "https://accounts.google.com");
  assert.equal(flow.auth.searchParams.get("client_id"), f.env.GOOGLE_CLIENT_ID);
  assert.equal(
    flow.auth.searchParams.get("redirect_uri"),
    "https://writeshape.com/api/drive/callback",
  );
  assert.equal(flow.auth.searchParams.get("scope"), `openid email ${scope}`);
  assert.equal(flow.auth.searchParams.get("code_challenge_method"), "S256");
  assert.equal(flow.auth.searchParams.get("access_type"), "offline");
  const attempt = f.env.sql.prepare("SELECT * FROM drive_oauth_attempts").get();
  assert.notEqual(attempt.state_hash, flow.auth.searchParams.get("state"));
  assert.match(attempt.verifier_cipher, /^v1\./);
  const result = await f.call(flow.path, undefined, { cookie: flow.cookie });
  assert.equal(result.status, 303);
  const tokenBody = new URLSearchParams(f.calls[0].init.body);
  const challenge = Buffer.from(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(tokenBody.get("code_verifier")),
    ),
  ).toString("base64url");
  assert.equal(challenge, flow.auth.searchParams.get("code_challenge"));
  assert.equal(
    result.headers.get("Location"),
    "https://writeshape.com/?driveConnected=1",
  );
  assert.match(
    result.headers.get("Set-Cookie"),
    /HttpOnly; Secure; SameSite=Lax/,
  );
  assert.equal(
    f.env.sql.prepare("SELECT COUNT(*) AS n FROM account_identities").get().n,
    0,
  );
  assert.equal(
    f.env.sql.prepare("SELECT COUNT(*) AS n FROM account_sessions").get().n,
    0,
  );
  assert.equal(
    f.env.sql.prepare("SELECT COUNT(*) AS n FROM accounts").get().n,
    2,
  );
});

test("OAuth state is account-bound, cookie-bound, one-use and expires", async () => {
  const f = fixture();
  const flow = await f.start();
  assert.equal(
    (await f.call(flow.path, undefined, { user: "other", cookie: flow.cookie }))
      .status,
    400,
  );
  assert.equal((await f.call(flow.path)).status, 400);
  assert.equal(f.provider.tokenCount, 0);
  assert.equal(
    (await f.call(flow.path, undefined, { cookie: flow.cookie })).status,
    303,
  );
  assert.equal(
    (await f.call(flow.path, undefined, { cookie: flow.cookie })).status,
    400,
  );
  const expired = await f.start();
  f.env.sql.exec("UPDATE drive_oauth_attempts SET expires=0");
  assert.equal(
    (await f.call(expired.path, undefined, { cookie: expired.cookie })).status,
    400,
  );
  assert.equal(f.provider.tokenCount, 1);
});

test("unverified email, wrong nonce and missing Drive scope cannot connect", async () => {
  for (const claims of [
    { email_verified: false },
    { nonce: "wrong" },
    { aud: "another-client" },
  ]) {
    const f = fixture();
    f.provider.claims = claims;
    const flow = await f.start();
    assert.equal(
      (await f.call(flow.path, undefined, { cookie: flow.cookie })).status,
      401,
    );
    assert.equal(
      f.env.sql.prepare("SELECT COUNT(*) AS n FROM drive_connections").get().n,
      0,
    );
  }
  const f = fixture();
  f.provider.scope = "openid email";
  const flow = await f.start();
  assert.equal(
    (await f.call(flow.path, undefined, { cookie: flow.cookie })).status,
    403,
  );
});

test("tokens are encrypted, omitted from browser responses and bound to account AAD", async () => {
  const f = fixture();
  await f.connect();
  const stored = f.env.sql.prepare("SELECT * FROM drive_connections").get();
  assert.match(stored.token_cipher, /^v1\./);
  assert.equal(stored.token_cipher.includes("fixture-access"), false);
  assert.equal(stored.token_cipher.includes("fixture-refresh"), false);
  const status = await (await f.call("/api/drive/status")).json();
  assert.deepEqual(status, {
    configured: true,
    connected: true,
    email: "drive@example.test",
    canWrite: true,
    reason: null,
  });
  assert.equal(
    (
      await (
        await f.call("/api/drive/status", undefined, { user: "other" })
      ).json()
    ).connected,
    false,
  );
  f.env.sql
    .prepare(
      "INSERT INTO drive_connections SELECT ?,google_subject,email,token_cipher,expires,generation,refresh_lock,refresh_until,updated FROM drive_connections WHERE account_id=?",
    )
    .run("other", "owner");
  assert.equal(
    (await f.call("/api/drive/open?id=file", undefined, { user: "other" }))
      .status,
    503,
  );
  assert.equal(f.calls.length, 1);
});

test("disconnect deletes tokens, invalidates pending callbacks, and works after downgrade or missing config", async () => {
  const f = fixture();
  await f.connect();
  const flow = await f.start();
  const result = await f.call("/api/drive/disconnect", {}, { free: true });
  assert.equal(result.status, 200);
  assert.equal(
    f.env.sql.prepare("SELECT COUNT(*) AS n FROM drive_connections").get().n,
    0,
  );
  assert.equal(
    (await f.call(flow.path, undefined, { cookie: flow.cookie })).status,
    400,
  );
  delete f.env.DRIVE_TOKEN_KEY;
  assert.equal(
    (await f.call("/api/drive/disconnect", {}, { free: true })).status,
    200,
  );
});

test("disconnect during OAuth exchange cannot resurrect a connection", async () => {
  const f = fixture();
  const flow = await f.start();
  f.provider.tokenHook = async () => {
    assert.equal((await f.call("/api/drive/disconnect", {})).status, 200);
  };
  assert.equal(
    (await f.call(flow.path, undefined, { cookie: flow.cookie })).status,
    409,
  );
  assert.equal(
    f.env.sql.prepare("SELECT COUNT(*) AS n FROM drive_connections").get().n,
    0,
  );
});

test("read access survives downgrade while connect/create/save remain premium", async () => {
  const f = fixture();
  await f.connect();
  assert.equal(
    (await f.call("/api/drive/open?id=file", undefined, { free: true })).status,
    200,
  );
  assert.equal(
    (await f.call("/api/drive/browser", undefined, { free: true })).status,
    200,
  );
  assert.equal(
    (
      await (
        await f.call("/api/drive/status", undefined, { free: true })
      ).json()
    ).canWrite,
    false,
  );
  for (const path of ["connect", "save", "create"])
    assert.equal(
      (await f.call(`/api/drive/${path}`, {}, { free: true })).status,
      403,
    );
});

test("refresh tokens stay server-side; refreshed credentials are atomically encrypted", async () => {
  const f = fixture();
  await f.connect();
  const previous = f.env.sql
    .prepare("SELECT token_cipher FROM drive_connections")
    .get().token_cipher;
  f.env.sql.exec("UPDATE drive_connections SET expires=0");
  assert.equal((await f.call("/api/drive/open?id=file")).status, 200);
  const refresh = f.calls.filter(
    (c) => c.url.origin === "https://oauth2.googleapis.com",
  )[1];
  const body = new URLSearchParams(refresh.init.body);
  assert.equal(body.get("grant_type"), "refresh_token");
  assert.equal(body.get("refresh_token"), "fixture-refresh-1");
  const stored = f.env.sql.prepare("SELECT * FROM drive_connections").get();
  assert.notEqual(stored.token_cipher, previous);
  assert.equal(stored.refresh_lock, null);
  assert.ok(stored.expires > now());
});

test("concurrent refresh is serialized and refresh completion cannot undo disconnect", async () => {
  const f = fixture();
  await f.connect();
  f.env.sql.exec("UPDATE drive_connections SET expires=0");
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  let announce;
  const started = new Promise((resolve) => {
    announce = resolve;
  });
  f.provider.tokenHook = async () => {
    announce();
    await gate;
  };
  const first = f.call("/api/drive/open?id=file");
  await started;
  assert.equal((await f.call("/api/drive/open?id=file")).status, 409);
  assert.equal((await f.call("/api/drive/disconnect", {})).status, 200);
  release();
  assert.equal((await first).status, 409);
  assert.equal(
    f.env.sql.prepare("SELECT COUNT(*) AS n FROM drive_connections").get().n,
    0,
  );
});

test("failed refresh does not expose provider errors or destroy saved documents", async () => {
  const f = fixture();
  await f.connect();
  f.env.sql.exec("UPDATE drive_connections SET expires=0");
  f.provider.tokenHook = async () =>
    response({ error: "secret provider diagnostics", token: "sensitive" }, 400);
  const result = await f.call("/api/drive/browser");
  assert.equal(result.status, 401);
  assert.doesNotMatch(await result.text(), /secret|sensitive/);
  assert.equal(
    f.env.sql.prepare("SELECT refresh_lock FROM drive_connections").get()
      .refresh_lock,
    null,
  );
});

test("browser filters supported files, exposes capabilities and safely quotes search", async () => {
  const f = fixture();
  await f.connect();
  const search = "script' or trashed=true or name contains '\\";
  const result = await f.call(
    `/api/drive/browser?parent=folder&search=${encodeURIComponent(search)}&pageToken=page-one`,
  );
  const data = await result.json();
  assert.deepEqual(
    data.items.map((i) => i.kind),
    ["folder", "file"],
  );
  assert.equal(data.nextPageToken, "page-two");
  assert.equal(data.items[0].canAddChildren, true);
  const providerQuery = f.calls.at(-1).url.searchParams;
  assert.equal(providerQuery.get("pageToken"), "page-one");
  assert.ok(
    providerQuery
      .get("q")
      .includes(
        "name contains 'script\\' or trashed=true or name contains \\'\\\\'",
      ),
  );
  assert.equal(
    (await f.call("/api/drive/browser?parent=bad%27id")).status,
    400,
  );
});

test("open returns UTF-8 current content and checks ETag before and after reading", async () => {
  const f = fixture();
  await f.connect();
  f.provider.text = "é🌊";
  const file = await (await f.call("/api/drive/open?id=file")).json();
  assert.equal(file.content, "é🌊");
  assert.equal(file.etag, '"one"');
  assert.equal(file.canEdit, true);
  f.provider.hook = async (url) => {
    if (url.searchParams.get("alt") === "media") {
      f.provider.etag = '"raced"';
      return response("new");
    }
  };
  const result = await f.call("/api/drive/open?id=file");
  assert.equal(result.status, 409);
  assert.equal((await result.json()).code, "DRIVE_CONFLICT");
});

test("unsupported types, binary data and over-limit UTF-8 content are rejected", async () => {
  for (const scenario of [
    "google-doc",
    "extension",
    "oversize",
    "invalid-utf8",
  ]) {
    const f = fixture();
    await f.connect();
    f.provider.hook = async (url) => {
      if (url.searchParams.get("alt") === "media") {
        if (scenario === "invalid-utf8")
          return new Response(Uint8Array.of(255));
        if (scenario === "oversize") return new Response("é".repeat(1_000_001));
      }
      if (
        url.pathname.startsWith("/drive/v3/") &&
        !url.searchParams.has("alt") &&
        ["google-doc", "extension"].includes(scenario)
      )
        return response({
          id: "file",
          name: scenario === "extension" ? "Image.png" : "Scene.txt",
          mimeType:
            scenario === "google-doc"
              ? "application/vnd.google-apps.document"
              : "image/png",
        });
    };
    assert.equal(
      (await f.call("/api/drive/open?id=file")).status,
      scenario === "oversize" ? 413 : 400,
    );
  }
});

test("stale ETags and read-only capability prevent any upload; conditional race maps to conflict", async () => {
  const f = fixture();
  await f.connect();
  assert.equal(
    (
      await f.call("/api/drive/save", {
        id: "file",
        etag: '"old"',
        content: "next",
      })
    ).status,
    409,
  );
  f.provider.canEdit = false;
  assert.equal(
    (
      await f.call("/api/drive/save", {
        id: "file",
        etag: '"one"',
        content: "next",
      })
    ).status,
    403,
  );
  assert.equal(
    f.calls.filter((c) => c.url.pathname.startsWith("/upload/")).length,
    0,
  );
  f.provider.canEdit = true;
  f.provider.hook = async (url, init) => {
    if (url.pathname.startsWith("/upload/")) {
      assert.equal(new Headers(init.headers).get("If-Match"), '"one"');
      return response({}, 412);
    }
  };
  assert.equal(
    (
      await f.call("/api/drive/save", {
        id: "file",
        etag: '"one"',
        content: "next",
      })
    ).status,
    409,
  );
  assert.notEqual(f.provider.text, "next");
});

test("concurrent saves with one ETag cannot overwrite both and success returns acknowledged version", async () => {
  const f = fixture();
  await f.connect();
  const replies = await Promise.all(
    ["first", "second"].map((content) =>
      f.call("/api/drive/save", { id: "file", etag: '"one"', content }),
    ),
  );
  assert.deepEqual(replies.map((r) => r.status).sort(), [200, 409]);
  const success = await replies.find((r) => r.status === 200).json();
  assert.equal(success.etag, '"two"');
  assert.equal(success.content, f.provider.text);
  assert.equal(success.modifiedTime, "2026-09-24T13:00:00Z");
});

test("missing or weak ETags fail closed and ambiguous accepted uploads require reopen", async () => {
  const f = fixture();
  await f.connect();
  for (const etag of ["*", 'W/"one"', "one", '"one"\r\nX:bad', ""])
    assert.equal(
      (await f.call("/api/drive/save", { id: "file", etag, content: "new" }))
        .status,
      400,
    );
  f.provider.etag = 'W/"one"';
  assert.equal((await f.call("/api/drive/open?id=file")).status, 503);
  f.provider.etag = '"one"';
  f.provider.hook = async (url) => {
    if (url.pathname.startsWith("/upload/")) return response({ id: "file" });
  };
  const result = await f.call("/api/drive/save", {
    id: "file",
    etag: '"one"',
    content: "new",
  });
  assert.equal(result.status, 503);
  assert.equal((await result.json()).code, "DRIVE_REOPEN_REQUIRED");
});

test("create checks folder capability, sends multipart text and reads back exact new content", async () => {
  const f = fixture();
  await f.connect();
  f.provider.canAddChildren = false;
  assert.equal(
    (
      await f.call("/api/drive/create", {
        name: "Scene.fountain",
        parent: "folder",
        content: f.provider.text,
      })
    ).status,
    403,
  );
  f.provider.canAddChildren = true;
  const result = await f.call("/api/drive/create", {
    name: "Scene.fountain",
    parent: "folder",
    content: f.provider.text,
  });
  assert.equal(result.status, 201);
  const upload = f.calls.find(
    (c) => c.url.pathname === "/upload/drive/v3/files",
  );
  assert.match(
    new Headers(upload.init.headers).get("Content-Type"),
    /^multipart\/related; boundary=writeshape_/,
  );
  assert.ok(upload.init.body.includes('"parents":["folder"]'));
  assert.ok(upload.init.body.includes(f.provider.text));
  assert.equal((await result.json()).id, "created");
  const race = await f.call("/api/drive/create", {
    name: "Scene.fountain",
    parent: "folder",
    content: "different local",
  });
  assert.equal(race.status, 409);
});

test("origin, input size and provider failures never bypass protections or leak raw errors", async () => {
  const f = fixture();
  await f.connect();
  for (const path of ["connect", "disconnect", "save", "create"])
    assert.equal(
      (
        await f.call(
          `/api/drive/${path}`,
          {},
          { origin: "https://attacker.example" },
        )
      ).status,
      403,
    );
  assert.equal(
    (
      await f.call("/api/drive/save", {
        id: "file",
        etag: '"one"',
        content: "é".repeat(1_000_001),
      })
    ).status,
    413,
  );
  for (const status of [403, 404, 429, 500]) {
    f.provider.hook = async () =>
      response({ error: "private-provider-diagnostic" }, status);
    const result = await f.call("/api/drive/open?id=file");
    assert.equal(
      result.status,
      status === 403 || status === 404 ? status : 503,
    );
    assert.doesNotMatch(await result.text(), /private-provider/);
  }
});

test("ambiguous create response stops automatic retries and malformed UTF-8 input is rejected", async () => {
  const f = fixture();
  await f.connect();
  assert.equal(
    (
      await f.call("/api/drive/save", {
        id: "file",
        etag: '"one"',
        content: "\ud800",
      })
    ).status,
    400,
  );
  f.provider.hook = async (url) => {
    if (url.pathname.startsWith("/upload/"))
      throw new Error("private network details");
  };
  const result = await f.call("/api/drive/create", {
    name: "Scene.fountain",
    content: "new",
  });
  assert.equal(result.status, 503);
  const data = await result.json();
  assert.equal(data.code, "DRIVE_REOPEN_REQUIRED");
  assert.match(data.error, /Browse Drive/);
  assert.doesNotMatch(data.error, /private network/);
});
