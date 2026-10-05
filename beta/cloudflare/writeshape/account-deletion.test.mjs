import { test } from "node:test";
import assert from "node:assert/strict";
import { testDB, request } from "./test-db.mjs";
import { accountDeletionRoutes } from "./account-deletion.mjs";
import { accessAccount, hash } from "./accounts.mjs";
import { accessCodeRoutes } from "./access-codes.mjs";
const user = { id: "alice", email: "alice@example.test" };
function setup() {
  const env = {
    ...testDB(),
    APP_ORIGIN: "https://writeshape.com",
    PUBLIC_LAUNCH: "true",
    STRIPE_SECRET_KEY: "sk_test_fixture",
    STRIPE_LIVE_SECRET_KEY: "sk_live_fixture",
  };
  for (const id of ["alice", "bob"])
    env.sql
      .prepare("INSERT INTO accounts(id,email,created) VALUES(?,?,0)")
      .run(id, id + "@example.test");
  for (const id of ["alice", "bob"]) {
    env.sql
      .prepare("INSERT INTO items VALUES(?,?,?,?,?,?,?,?)")
      .run(
        id + "-file-12345",
        id,
        "",
        "Script.fountain",
        "file",
        id + " private work",
        1,
        "2026-10-05",
      );
    env.sql
      .prepare("UPDATE items SET content=?,revision=2 WHERE owner=?")
      .run(id + " revision", id);
  }
  return env;
}
const deletion = (env, deps = {}) =>
  accountDeletionRoutes(
    request("/api/account/delete", { confirmation: "DELETE" }),
    env,
    user,
    deps,
  );
test("account erasure removes owned files, immutable history, shares, credentials, sessions and feedback, leaving other accounts intact", async () => {
  const env = setup();
  env.sql.exec(`INSERT INTO account_sessions VALUES('token','alice',9999999999);
    INSERT INTO account_identities VALUES('google','google-alice','alice');
    INSERT INTO drive_connections VALUES('alice','google-alice','alice@example.test','cipher',9999999999,'generation',NULL,0,0);
    INSERT INTO drive_link_state VALUES('alice','epoch');
    INSERT INTO file_shares VALUES('share','alice-file-12345','alice','bob','bob@example.test','read-only','today',NULL);
    INSERT INTO cancellation_feedback(id,account_id,subscription_id,billing_mode,reason,created) VALUES('feedback','alice','sub','test','private feedback',0);`);
  assert.throws(
    () =>
      env.sql.prepare("DELETE FROM file_versions WHERE owner='alice'").run(),
    /IMMUTABLE/,
  );
  assert.equal((await deletion(env)).status, 200);
  for (const table of [
    "accounts",
    "items",
    "file_versions",
    "file_shares",
    "account_identities",
    "account_sessions",
    "drive_connections",
    "drive_link_state",
    "cancellation_feedback",
    "deleting_accounts",
  ]) {
    const rows = env.sql.prepare(`SELECT * FROM ${table}`).all();
    assert.ok(!JSON.stringify(rows).includes("alice"), table);
  }
  assert.equal(
    env.sql.prepare("SELECT content FROM items WHERE owner='bob'").get()
      .content,
    "bob revision",
  );
  assert.equal(
    env.sql
      .prepare("SELECT count(*) AS n FROM file_versions WHERE owner='bob'")
      .get().n,
    1,
  );
  assert.throws(
    () =>
      env.sql
        .prepare(
          "INSERT INTO items VALUES('late','alice','','Late','file','no',1,'today')",
        )
        .run(),
    /ACCOUNT_UNAVAILABLE/,
  );
});
test("both live and test billing are canceled and old checkout links expired before erasure; retries recognize removed customers", async () => {
  const env = setup();
  env.sql.exec(
    "UPDATE accounts SET stripe_customer='cus_test',live_stripe_customer='cus_live' WHERE id='alice'",
  );
  const calls = [];
  const stripeClient = ({ BILLING_MODE: mode }) => {
    const customer = "cus_" + mode,
      livemode = mode === "live";
    return {
      customers: {
        retrieve: async () => ({ id: customer, livemode }),
        del: async () => {
          calls.push("delete-" + mode);
          return { id: customer, deleted: true };
        },
      },
      checkout: {
        sessions: {
          list: () =>
            (async function* () {
              yield { id: "checkout-" + mode, customer, livemode };
            })(),
          expire: async (id) => calls.push(id),
        },
      },
      subscriptions: {
        list: () =>
          (async function* () {
            yield { id: "sub-" + mode, customer, livemode, status: "active" };
          })(),
        cancel: async (id, options) => {
          assert.deepEqual(options, { invoice_now: false, prorate: false });
          assert.ok(
            env.sql.prepare("SELECT id FROM accounts WHERE id='alice'").get(),
          );
          calls.push(id);
          return { id, status: "canceled" };
        },
      },
    };
  };
  await deletion(env, { stripeClient });
  assert.deepEqual(calls, [
    "checkout-live",
    "sub-live",
    "delete-live",
    "checkout-test",
    "sub-test",
    "delete-test",
  ]);
});
test("provider failures keep the account and every document available for retry", async () => {
  const env = setup();
  env.sql.exec(
    "UPDATE accounts SET stripe_customer='cus_test' WHERE id='alice'",
  );
  await assert.rejects(
    deletion(env, {
      stripeClient: () => ({
        customers: {
          retrieve: async () => {
            throw Error("unavailable");
          },
        },
      }),
    }),
    /unavailable/,
  );
  assert.equal(
    env.sql.prepare("SELECT count(*) AS n FROM items WHERE owner='alice'").get()
      .n,
    1,
  );
  assert.equal(
    env.sql.prepare("SELECT count(*) AS n FROM deleting_accounts").get().n,
    0,
  );
});
test("a failed room purge cannot return deletion success, and old private sign-ins cannot recreate a deleted account", async () => {
  const env = setup();
  env.sql.exec(
    "INSERT INTO maintenance_state VALUES('live_inventory_complete','1'); INSERT INTO live_room_registry VALUES('library_alice-file-12345',0)",
  );
  let success = false;
  env.LIVE_ROOMS = {
    idFromName: (x) => x,
    get: () => ({
      fetch: async () => new Response("", { status: success ? 200 : 503 }),
    }),
  };
  await assert.rejects(deletion(env), /cleanup is still pending/);
  assert.ok(env.sql.prepare("SELECT id FROM accounts WHERE id='alice'").get());
  success = true;
  env.PUBLIC_LAUNCH = "false";
  await deletion(env);
  assert.equal(await accessAccount({ ...user, issuedAt: 1 }, env), null);
  const tombstone = env.sql.prepare("SELECT * FROM revoked_access").get();
  assert.equal(tombstone.subject_hash, await hash(user.id));
  assert.equal(
    (await accessAccount({ ...user, issuedAt: tombstone.before_iat + 1 }, env))
      .id,
    "alice",
  );
});
test("confirmation and same-origin are required before any account mutation", async () => {
  const env = setup();
  await assert.rejects(
    accountDeletionRoutes(
      request("/api/account/delete", { confirmation: "no" }),
      env,
      user,
    ),
    /DELETE/,
  );
  await assert.rejects(
    accountDeletionRoutes(
      request(
        "/api/account/delete",
        { confirmation: "DELETE" },
        "",
        "https://evil.test",
      ),
      env,
      user,
    ),
    /origin/i,
  );
  assert.equal(
    env.sql.prepare("SELECT count(*) AS n FROM accounts").get().n,
    2,
  );
});
