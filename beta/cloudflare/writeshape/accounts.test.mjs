import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, exportJWK, SignJWT, createLocalJWKSet } from "jose";
import { testDB, request } from "./test-db.mjs";
import {
  accessAccount,
  googleAccount,
  issueSession,
  sessionAccount,
  verifyGoogleToken,
  hash,
  premium,
  accountRoutes,
  resolveAccount,
} from "./accounts.mjs";
import { createHandler } from "./worker.mjs";
const publicEnv = () => ({ ...testDB(), PUBLIC_LAUNCH: "true" });
const googleEnv = () => ({
  ...publicEnv(),
  APP_ORIGIN: "https://writeshape.com",
  GOOGLE_CLIENT_ID: "test-client",
  GOOGLE_CLIENT_SECRET: "test-secret",
});
const claims = {
  sub: "google-owner",
  email: "owner@example.test",
  name: "Owner",
};
test("existing Access owner retains document ownership when explicitly linking Google", async () => {
  const env = publicEnv();
  const owner = await accessAccount(
    { id: "legacy-owner", email: claims.email },
    env,
  );
  env.sql
    .prepare("INSERT INTO items VALUES (?,?,?,?,?,?,?,?)")
    .run(
      "saved-script",
      "legacy-owner",
      "",
      "Existing.fountain",
      "file",
      "Existing writing",
      2,
      "now",
    );
  assert.equal(await googleAccount(claims, owner.id, env), "legacy-owner");
  assert.equal(await googleAccount(claims, null, env), "legacy-owner");
  assert.equal(
    env.sql.prepare("SELECT owner,content FROM items").get().content,
    "Existing writing",
  );
  assert.equal(
    env.sql.prepare("SELECT owner FROM items").get().owner,
    owner.id,
  );
  assert.equal(premium(owner), true);
});
test("same email does not silently merge identity; linking another account is rejected", async () => {
  const env = publicEnv();
  const owner = await accessAccount(
    { id: "legacy-owner", email: claims.email },
    env,
  );
  const google = await googleAccount(claims, null, env);
  assert.notEqual(google, owner.id);
  await assert.rejects(
    () => googleAccount(claims, owner.id, env),
    /already belongs/,
  );
  await assert.rejects(
    () =>
      googleAccount(
        { ...claims, sub: "other", email: "other@example.test" },
        owner.id,
        env,
      ),
    /matching|current verified email/,
  );
});
test("opaque server sessions are hashed, expire, rotate, and revoke on logout", async () => {
  const env = publicEnv();
  await accessAccount({ id: "owner", email: claims.email }, env);
  const first = await issueSession("owner", request("/"), env);
  assert.match(first, /HttpOnly; Secure; SameSite=Lax/);
  const cookie = first.split(";")[0];
  const raw = cookie.split("=")[1];
  assert.notEqual(
    env.sql.prepare("SELECT token_hash FROM account_sessions").get().token_hash,
    raw,
  );
  assert.equal(
    (await sessionAccount(request("/", undefined, cookie), env)).id,
    "owner",
  );
  const second = await issueSession(
    "owner",
    request("/", undefined, cookie),
    env,
  );
  assert.equal(
    await sessionAccount(request("/", undefined, cookie), env),
    null,
  );
  const next = second.split(";")[0];
  await accountRoutes(request("/api/auth/logout", {}, next), env, null, false);
  assert.equal(await sessionAccount(request("/", undefined, next), env), null);
  const third = await issueSession("owner", request("/"), env);
  env.sql.exec("UPDATE account_sessions SET expires=1");
  assert.equal(
    await sessionAccount(request("/", undefined, third.split(";")[0]), env),
    null,
  );
});
test("private mode never accepts a session in place of the signed Access gate", async () => {
  const env = publicEnv();
  await accessAccount({ id: "owner", email: claims.email }, env);
  const session = await issueSession("owner", request("/"), env);
  env.PUBLIC_LAUNCH = "false";
  await assert.rejects(
    () => resolveAccount(request("/", undefined, session.split(";")[0]), env),
    /sign in again/,
  );
});
test("Google token verification requires signed audience, nonce, expiry, and verified email", async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  jwk.kid = "google-test";
  const keys = createLocalJWKSet({ keys: [jwk] });
  const valid = {
    ...claims,
    iss: "https://accounts.google.com",
    aud: "test-client",
    email_verified: true,
    nonce: "nonce",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 300,
  };
  const token = (payload) =>
    new SignJWT(payload)
      .setProtectedHeader({ alg: "RS256", kid: "google-test" })
      .sign(privateKey);
  assert.equal(
    (
      await verifyGoogleToken(
        await token(valid),
        { GOOGLE_CLIENT_ID: "test-client" },
        "nonce",
        keys,
      )
    ).sub,
    claims.sub,
  );
  for (const patch of [
    { aud: "wrong" },
    { nonce: "wrong" },
    { exp: 1 },
    { email_verified: false },
    { azp: "other" },
    { iss: "https://evil.test" },
  ])
    await assert.rejects(() =>
      token({ ...valid, ...patch }).then((t) =>
        verifyGoogleToken(
          t,
          { GOOGLE_CLIENT_ID: "test-client" },
          "nonce",
          keys,
        ),
      ),
    );
});
test("Google starts with one-use state, nonce and PKCE; CSRF and wrong callbacks fail closed", async () => {
  const env = googleEnv();
  const response = await accountRoutes(
    request("/api/auth/google/start", {}),
    env,
    null,
    false,
  );
  const data = await response.json(),
    target = new URL(data.url);
  assert.equal(target.origin, "https://accounts.google.com");
  assert.equal(target.searchParams.get("scope"), "openid email profile");
  assert.equal(target.searchParams.get("code_challenge_method"), "S256");
  assert.equal(
    target.searchParams.get("redirect_uri"),
    "https://writeshape.com/api/auth/google/callback",
  );
  const state = target.searchParams.get("state");
  assert.equal(
    env.sql.prepare("SELECT state_hash FROM oauth_attempts").get().state_hash,
    await hash(state),
  );
  await assert.rejects(
    () =>
      accountRoutes(
        request("/api/auth/google/start", {}, "", "https://evil.test"),
        env,
        null,
        false,
      ),
    /origin/,
  );
  await assert.rejects(
    () =>
      accountRoutes(
        request("/api/auth/google/callback?state=" + state + "&code=bad"),
        env,
        null,
        false,
      ),
    /expired/,
  );
  const cookie = response.headers.get("Set-Cookie").split(";")[0];
  await assert.rejects(
    () =>
      accountRoutes(
        request("/api/auth/google/callback?state=" + state, undefined, cookie),
        env,
        null,
        false,
      ),
    /Missing authorization/,
  );
  await assert.rejects(
    () =>
      accountRoutes(
        request("/api/auth/google/callback?state=" + state, undefined, cookie),
        env,
        null,
        false,
      ),
    /expired/,
  );
});
test("anonymous writing account response is free and unconfigured signup is honest", async () => {
  const env = publicEnv();
  const handler = createHandler();
  const response = await handler(request("/api/account"), env);
  const data = await response.json();
  assert.equal(data.account, null);
  assert.equal(data.premium, false);
  assert.equal(data.googleAvailable, false);
  assert.equal(data.billingAvailable, false);
  assert.equal(
    (await handler(request("/api/auth/google/start", {}), env)).status,
    503,
  );
  assert.equal(
    (await handler(request("/api/billing/checkout", {}), env)).status,
    401,
  );
});
test("profile updates cannot change another account or entitlement; cloud is readable after cancellation", async () => {
  const env = publicEnv();
  await accessAccount({ id: "alice", email: "alice@example.test" }, env);
  await accessAccount({ id: "bob", email: "bob@example.test" }, env);
  env.sql.exec("UPDATE accounts SET private_tester=0");
  const session = (await issueSession("alice", request("/"), env)).split(
    ";",
  )[0];
  const handler = createHandler();
  const profile = await handler(
    request(
      "/api/account/profile",
      {
        displayName: "Alice Writer",
        id: "bob",
        private_tester: 1,
        premium: true,
      },
      session,
    ),
    env,
  );
  assert.equal(profile.status, 200);
  assert.equal(
    env.sql.prepare("SELECT display_name FROM accounts WHERE id='alice'").get()
      .display_name,
    "Alice Writer",
  );
  assert.equal(
    env.sql.prepare("SELECT display_name FROM accounts WHERE id='bob'").get()
      .display_name,
    "",
  );
  assert.equal(
    (
      await (
        await handler(request("/api/account", undefined, session), env)
      ).json()
    ).premium,
    false,
  );
  const id = crypto.randomUUID();
  env.sql
    .prepare("INSERT INTO items VALUES (?,?,?,?,?,?,?,?)")
    .run(id, "alice", "", "Kept.fountain", "file", "Writing remains", 1, "now");
  assert.equal(
    (await handler(request("/api/library", undefined, session), env)).status,
    200,
  );
  assert.equal(
    (
      await (
        await handler(request("/api/library/" + id, undefined, session), env)
      ).json()
    ).content,
    "Writing remains",
  );
  assert.equal(
    (
      await handler(
        request(
          "/api/library",
          {
            name: "New",
            kind: "file",
            parent: "",
            content: "x",
            premium: true,
          },
          session,
        ),
        env,
      )
    ).status,
    403,
  );
});
