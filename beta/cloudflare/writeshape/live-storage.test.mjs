import { test } from "node:test";
import assert from "node:assert/strict";
import { testDB, request } from "./test-db.mjs";
import { WriteShapeLiveStorage } from "./live-storage.mjs";
import { liveRoutes, liveCredential } from "./live-routes.mjs";
import { sharingRoutes } from "./sharing.mjs";
function fixture() {
  const env = { ...testDB(), LIVE_COLLABORATION: "true" };
  for (const id of ["owner", "writer", "reader", "stranger"])
    env.sql
      .prepare(
        "INSERT INTO accounts(id,email,private_tester,created) VALUES(?,?,?,0)",
      )
      .run(id, id + "@example.test", id === "owner" ? 1 : 0);
  const id = crypto.randomUUID();
  env.sql
    .prepare("INSERT INTO items VALUES(?,?,?,?,?,?,?,?)")
    .run(
      id,
      "owner",
      "",
      "Book.md",
      "file",
      "# Book\n\nOriginal.",
      1,
      new Date().toISOString(),
    );
  const edit = crypto.randomUUID();
  env.sql
    .prepare(
      "INSERT INTO file_edit_shares(id,file_id,owner,recipient_id,recipient_email,created_at) VALUES(?,?,?,?,?,?)",
    )
    .run(
      edit,
      id,
      "owner",
      "writer",
      "writer@example.test",
      new Date().toISOString(),
    );
  env.sql
    .prepare(
      "INSERT INTO file_shares(id,file_id,owner,recipient_id,recipient_email,created_at) VALUES(?,?,?,?,?,?)",
    )
    .run(
      crypto.randomUUID(),
      id,
      "owner",
      "reader",
      "reader@example.test",
      new Date().toISOString(),
    );
  const adapter = new WriteShapeLiveStorage(env, {
    authenticate: async (req) =>
      env.sql
        .prepare("SELECT * FROM accounts WHERE id=?")
        .get(req.headers.get("Cookie")) || null,
  });
  return {
    env,
    id,
    edit,
    adapter,
    room: "library_" + id,
    credential: (user) => JSON.stringify({ cookie: user }),
  };
}
test("live library uses owner entitlement and stable writer grants; downgrade and revocation take effect immediately", async () => {
  const { env, edit, adapter, room, credential } = fixture();
  for (const user of ["owner", "writer"])
    assert.equal(
      (await adapter.authorize(room, credential(user))).self.canEdit,
      true,
    );
  const reader = await adapter.authorize(room, credential("reader"));
  assert.equal(reader.self.canEdit, false);
  await assert.rejects(
    adapter.save(reader, "attack", "1"),
    (e) => e.status === 403,
  );
  await assert.rejects(
    adapter.authorize(room, credential("stranger")),
    (e) => e.status === 404,
  );
  env.sql
    .prepare("UPDATE accounts SET private_tester=0 WHERE id=?")
    .run("owner");
  assert.equal(
    (await adapter.authorize(room, credential("writer"))).self.canEdit,
    false,
  );
  env.sql
    .prepare("UPDATE file_edit_shares SET revoked_at=? WHERE id=?")
    .run(new Date().toISOString(), edit);
  await assert.rejects(
    adapter.authorize(room, credential("writer")),
    (e) => e.status === 404,
  );
});
test("revocation racing a live checkpoint cannot update file or immutable history", async () => {
  const { env, id, edit, adapter, room, credential } = fixture();
  const auth = await adapter.authorize(room, credential("writer"));
  const prepare = env.DB.prepare;
  env.DB.prepare = (q) => {
    if (q.startsWith("UPDATE items SET content="))
      env.sql
        .prepare("UPDATE file_edit_shares SET revoked_at=? WHERE id=?")
        .run(new Date().toISOString(), edit);
    return prepare(q);
  };
  await assert.rejects(
    adapter.save(auth, "forbidden racing update", "1"),
    (e) => e.status === 403,
  );
  assert.equal(
    env.sql.prepare("SELECT content FROM items WHERE id=?").get(id).content,
    "# Book\n\nOriginal.",
  );
  assert.equal(
    env.sql.prepare("SELECT count(*) AS n FROM file_versions").get().n,
    0,
  );
});
test("internal live transport forwards only WriteShape credentials and protects origins and disabled deployments", async () => {
  const path =
    "/api/collaboration/library_" + crypto.randomUUID() + "/bootstrap";
  let forwarded;
  const env = {
    LIVE_COLLABORATION: "true",
    LIVE_ROOMS: {
      idFromName: (id) => id,
      get: () => ({
        fetch: async (req) => {
          forwarded = req;
          return Response.json({ ok: true });
        },
      }),
    },
  };
  const req = request(
    path,
    {},
    "unrelated=secret; __Host-writeshape_session=fixture",
  );
  req.headers.set("X-User-Id", "attacker");
  req.headers.set("Cf-Access-Jwt-Assertion", "signed-access-fixture");
  assert.deepEqual(JSON.parse(liveCredential(req)), {
    cookie: "__Host-writeshape_session=fixture",
    assertion: "signed-access-fixture",
  });
  assert.equal((await liveRoutes(req, env, { id: "owner" })).status, 200);
  assert.equal(forwarded.headers.get("X-User-Id"), null);
  await assert.rejects(
    liveRoutes(request(path, {}, "", "https://attacker.test"), env, {
      id: "owner",
    }),
    (e) => e.status === 403,
  );
  await assert.rejects(
    liveRoutes(
      request(path, {}),
      { ...env, LIVE_COLLABORATION: "false" },
      { id: "owner" },
    ),
    (e) => e.status === 503,
  );
  await assert.rejects(
    liveRoutes(request(path, {}), env, null),
    (e) => e.status === 401,
  );
});
test("existing Fountain rooms require a separate copy before joining WriteShape", async () => {
  const { adapter } = fixture();
  await assert.rejects(
    adapter.verifyOriginalRoom({ file: { legacyLiveRoom: true } }),
    (e) => e.status === 409,
  );
  await adapter.verifyOriginalRoom({ file: { legacyLiveRoom: false } });
});
test("enabled private collaboration grants editing only to existing verified accounts and roles cannot silently escalate", async () => {
  const { env, id } = fixture();
  env.sql
    .prepare("INSERT INTO account_identities VALUES(?,?,?)")
    .run("google", "reader-subject", "reader");
  const owner = env.sql
    .prepare("SELECT * FROM accounts WHERE id=?")
    .get("owner");
  await assert.rejects(
    sharingRoutes(
      request("/api/library/" + id + "/shares", {
        email: "reader@example.test",
        role: "read-write",
      }),
      env,
      owner,
    ),
    (e) => e.status === 409,
  );
  assert.equal(
    env.sql
      .prepare(
        "SELECT count(*) AS n FROM file_edit_shares WHERE recipient_id='reader'",
      )
      .get().n,
    0,
  );
  await assert.rejects(
    sharingRoutes(
      request("/api/library/" + id + "/shares", {
        email: "new@example.test",
        role: "read-write",
      }),
      env,
      owner,
    ),
    (e) => e.status === 400,
  );
});
