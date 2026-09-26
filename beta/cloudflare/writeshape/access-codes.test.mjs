import { test } from "node:test";
import assert from "node:assert/strict";
import { testDB, request } from "./test-db.mjs";
import { accessCodeRoutes, withComplimentaryAccess } from "./access-codes.mjs";
import { premium, googleAccount } from "./accounts.mjs";
const future = () => Math.floor(Date.now() / 1000) + 86400;
function setup() {
  const env = {
    ...testDB(),
    ACCESS_CODE_KEY: "synthetic-secret-with-at-least-32-characters",
    OWNER_EMAIL: "owner@example.test",
  };
  for (const id of ["owner", "alice", "bob"])
    env.sql
      .prepare("INSERT INTO accounts(id,email,created) VALUES(?,?,1)")
      .run(id, id + "@example.test");
  const account = (id) =>
    env.sql.prepare("SELECT * FROM accounts WHERE id=?").get(id);
  const route = (id, path, body, origin) =>
    accessCodeRoutes(
      request("/api/access-codes" + path, body, "", origin),
      env,
      account(id),
    );
  const create = (extra = {}) =>
    route("owner", "", {
      label: "Synthetic test",
      code: "READERS-TEST",
      durationDays: 30,
      expiresAt: future(),
      maxRedemptions: 1,
      ...extra,
    }).then((r) => r.json());
  return { env, account, route, create };
}
test("ordinary account stays Free; only verified owner can create, list or revoke codes", async () => {
  const h = setup();
  const fresh = await googleAccount(
    { sub: "new-subject", email: "new@example.test", name: "New writer" },
    null,
    h.env,
  );
  assert.equal(premium(h.account(fresh)), false);
  for (const [path, body] of [
    ["", undefined],
    ["", {}],
    ["/revoke", { id: "x" }],
  ])
    await assert.rejects(h.route("alice", path, body), (e) => e.status === 403);
  await assert.rejects(
    accessCodeRoutes(
      request("/api/access-codes/redeem", { code: "READERS-TEST" }),
      h.env,
      null,
    ),
    (e) => e.status === 401,
  );
  await assert.rejects(
    h.route("owner", "", { label: "x" }, "https://other.test"),
    (e) => e.status === 403,
  );
  assert.equal(
    h.env.sql.prepare("SELECT COUNT(*) n FROM access_codes").get().n,
    0,
  );
});
test("redeem is bounded, case-insensitive and idempotent; codes are hashed and audit has no plaintext", async () => {
  const h = setup(),
    code = await h.create();
  assert.equal(code.code, "READERS-TEST");
  const stored = h.env.sql.prepare("SELECT * FROM access_codes").get();
  assert.equal(stored.code_hash.length, 64);
  assert.ok(!JSON.stringify(stored).includes(code.code));
  const first = await (
    await h.route("alice", "/redeem", { code: "readers-test" })
  ).json();
  const retry = await (
    await h.route("alice", "/redeem", { code: code.code })
  ).json();
  assert.deepEqual(first, retry);
  assert.equal(
    premium(await withComplimentaryAccess(h.account("alice"), h.env)),
    true,
  );
  await assert.rejects(
    h.route("bob", "/redeem", { code: code.code }),
    (e) => e.status === 400,
  );
  assert.equal(
    premium(await withComplimentaryAccess(h.account("bob"), h.env)),
    false,
  );
  const audit = h.env.sql
    .prepare("SELECT action FROM access_code_audit ORDER BY id")
    .all();
  assert.deepEqual(
    audit.map((x) => x.action),
    ["created", "redeemed"],
  );
  const listing = await (await h.route("owner", "")).json();
  assert.equal(listing.codes[0].redemptions, 1);
  assert.ok(!JSON.stringify(listing).includes(stored.code_hash));
});
test("competing redemptions cannot exceed capacity and repeated parallel redemption cannot extend grant", async () => {
  const h = setup();
  await h.create();
  const results = await Promise.allSettled(
    ["alice", "bob", "alice"].map((id) =>
      h.route(id, "/redeem", { code: "READERS-TEST" }),
    ),
  );
  assert.ok(results.some((r) => r.status === "fulfilled"));
  assert.equal(
    h.env.sql.prepare("SELECT COUNT(*) n FROM access_redemptions").get().n,
    1,
  );
  assert.equal(
    h.env.sql
      .prepare(
        "SELECT COUNT(*) n FROM access_code_audit WHERE action='redeemed'",
      )
      .get().n,
    1,
  );
});
test("deadline prevents new grants; revocation ends grants but preserves separately paid access", async () => {
  const h = setup(),
    c = await h.create({ maxRedemptions: 3 });
  await h.route("alice", "/redeem", { code: c.code });
  h.env.sql
    .prepare("UPDATE access_codes SET expires_at=1 WHERE id=?")
    .run(c.id);
  await assert.rejects(
    h.route("bob", "/redeem", { code: c.code }),
    (e) => e.status === 400,
  );
  assert.equal(
    premium(await withComplimentaryAccess(h.account("alice"), h.env)),
    true,
  );
  await h.route("owner", "/revoke", { id: c.id });
  await h.route("owner", "/revoke", { id: c.id });
  assert.equal(
    premium(await withComplimentaryAccess(h.account("alice"), h.env)),
    false,
  );
  await assert.rejects(
    h.route("alice", "/redeem", { code: c.code }),
    (e) => e.status === 400,
  );
  h.env.sql
    .prepare(
      "UPDATE accounts SET billing_status='active',premium_until=? WHERE id='alice'",
    )
    .run(future());
  assert.equal(
    premium(await withComplimentaryAccess(h.account("alice"), h.env)),
    true,
  );
  assert.equal(
    h.env.sql
      .prepare(
        "SELECT COUNT(*) n FROM access_code_audit WHERE action='revoked'",
      )
      .get().n,
    1,
  );
});
test("expired grants do not grant Premium; multiple grants do not sum durations", async () => {
  const h = setup();
  await h.create();
  await h.route("alice", "/redeem", { code: "READERS-TEST" });
  const before = await withComplimentaryAccess(h.account("alice"), h.env);
  await h.create({ code: "SECOND-CODE", durationDays: 5 });
  await h.route("alice", "/redeem", { code: "SECOND-CODE" });
  assert.equal(
    (await withComplimentaryAccess(h.account("alice"), h.env))
      .complimentary_until,
    before.complimentary_until,
  );
  h.env.sql.prepare("UPDATE access_redemptions SET expires_at=1").run();
  assert.equal(
    premium(await withComplimentaryAccess(h.account("alice"), h.env)),
    false,
  );
});
test("invalid terms, duplicate codes, origin spoofing and guessing are rejected", async () => {
  const h = setup();
  for (const extra of [
    { durationDays: 0 },
    { durationDays: 3651 },
    { durationDays: 1.5 },
    { maxRedemptions: 0 },
    { expiresAt: 1 },
    { code: "short" },
    { label: "" },
  ])
    await assert.rejects(h.create(extra), (e) => e.status === 400);
  await h.create();
  await assert.rejects(h.create(), (e) => e.status === 409);
  await assert.rejects(
    h.route("alice", "/redeem", { code: "READERS-TEST" }, "https://other.test"),
    (e) => e.status === 403,
  );
  for (let i = 0; i < 20; i++)
    await assert.rejects(
      h.route("bob", "/redeem", { code: "UNKNOWN-CODE" }),
      (e) => e.status === 400,
    );
  await assert.rejects(
    h.route("bob", "/redeem", { code: "READERS-TEST" }),
    (e) => e.status === 429,
  );
  assert.equal(
    premium(await withComplimentaryAccess(h.account("bob"), h.env)),
    false,
  );
});

test("ordinary grant recipient can save then download after revocation; other account cannot read, restore or overwrite", async () => {
  const { createHandler } = await import("./worker.mjs");
  const h = setup();
  const c = await h.create();
  await h.route("alice", "/redeem", { code: c.code });
  const handler = createHandler(async (req) =>
    h.account(req.headers.get("test-user")),
  );
  const call = (user, path, body) =>
    handler(
      new Request("https://writeshape.com/api/library" + path, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          Origin: "https://writeshape.com",
          "Content-Type": "application/json",
          "test-user": user,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      h.env,
    );
  let response = await call("alice", "", {
    name: "Synthetic.md",
    kind: "file",
    parent: "",
    content: "# One\n\nOriginal text.",
  });
  assert.equal(response.status, 201);
  let file = await response.json();
  const first = file.versionId;
  response = await call("alice", "", {
    ...file,
    content: "# Two\n\nSaved newer text.",
  });
  assert.equal(response.status, 200);
  file = await response.json();
  assert.equal((await call("bob", "/" + file.id)).status, 404);
  assert.equal((await call("bob", "/" + file.id + "/versions")).status, 404);
  assert.ok(
    [403, 404].includes(
      (await call("bob", "", { ...file, content: "attempt" })).status,
    ),
  );
  assert.ok(
    [403, 404].includes(
      (
        await call("bob", "/" + file.id + "/restore", {
          versionId: first,
          revision: file.revision,
        })
      ).status,
    ),
  );
  response = await call("alice", "/" + file.id + "/restore", {
    versionId: first,
    revision: file.revision,
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).revision, 3);
  assert.equal(
    (await (await call("alice", "/" + file.id)).json()).content,
    "# One\n\nOriginal text.",
  );
  assert.equal(
    (
      await (
        await call("alice", "/" + file.id + "/versions/" + file.id + ":2")
      ).json()
    ).content,
    "# Two\n\nSaved newer text.",
  );
  await h.route("owner", "/revoke", { id: c.id });
  assert.equal((await call("alice", "/" + file.id)).status, 200);
  assert.equal(
    (await call("alice", "", { ...file, content: "not entitled" })).status,
    403,
  );
  assert.equal((await call("bob", "")).status, 200);
  assert.equal(
    JSON.stringify(await (await call("bob", "")).json()).includes(file.id),
    false,
  );
});
