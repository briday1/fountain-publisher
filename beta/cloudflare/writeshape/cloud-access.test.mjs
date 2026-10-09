import { test } from "node:test";
import assert from "node:assert/strict";
import { testDB, request } from "./test-db.mjs";
import { createHandler } from "./worker.mjs";
import { cloudStorageAllowed } from "./cloud-access.mjs";
import { createDriveRoutes } from "./drive.mjs";
import { WriteShapeLiveStorage } from "./live-storage.mjs";
import {
  maintainCloudBackups,
  purgeExpiredCloud,
  reconcileBackupGrace,
} from "./cloud-backup.mjs";
import {
  LEGACY_TEST_PLANS,
  TEST_PLANS,
  subscriptionState,
} from "./billing.mjs";

function fixture() {
  const env = {
    ...testDB(),
    CLOUD_STORAGE_INVITE_ONLY: "true",
    OWNER_EMAIL: "owner@example.test",
    LIVE_COLLABORATION: "true",
  };
  for (const [id, tester] of [
    ["owner", 1],
    ["premium", 1],
    ["other", 1],
    ["basic", 0],
  ])
    env.sql
      .prepare(
        "INSERT INTO accounts(id,email,private_tester,created) VALUES(?,?,?,0)",
      )
      .run(id, id + "@example.test", tester);
  const account = (id) =>
    env.sql.prepare("SELECT * FROM accounts WHERE id=?").get(id);
  const handler = createHandler(async (r) => account(r.headers.get("Cookie")));
  const call = (id, path, body) => handler(request(path, body, id), env);
  return { env, account, call };
}
test("Premium and private testing never grant hosted storage; only owner controls invitations", async () => {
  const f = fixture();
  const status = await (await f.call("premium", "/api/account")).json();
  assert.equal(status.premium, true);
  assert.equal(status.cloudStorage, false);
  assert.equal(status.manageCloudAccess, false);
  assert.equal(
    (
      await f.call("premium", "/api/library", {
        name: "Test.fountain",
        kind: "file",
        content: "draft",
        parent: "",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await f.call("premium", "/api/cloud-access", {
        email: "premium@example.test",
      })
    ).status,
    403,
  );
  await f.call("premium", "/api/account/profile", {
    displayName: "Writer",
    cloudStorage: true,
  });
  assert.equal(
    (await (await f.call("premium", "/api/account")).json()).cloudStorage,
    false,
  );
  assert.equal(
    (await (await f.call("owner", "/api/account")).json()).cloudStorage,
    true,
  );
  assert.equal(
    await cloudStorageAllowed(
      { ...f.account("premium"), cloud_storage: true },
      { ...f.env, CLOUD_STORAGE_INVITE_ONLY: undefined },
    ),
    false,
  );
});
test("storage invitations are independent of subscription and revocation preserves files and versions", async () => {
  const f = fixture();
  assert.equal(
    (
      await f.call("owner", "/api/cloud-access", {
        email: "premium@example.test",
      })
    ).status,
    200,
  );
  const created = await f.call("premium", "/api/library", {
    name: "Test.fountain",
    kind: "file",
    content: "first",
    parent: "",
  });
  assert.equal(created.status, 201);
  const file = await created.json();
  assert.equal(
    (await f.call("premium", "/api/library", { ...file, content: "second" }))
      .status,
    200,
  );
  f.env.sql.exec("UPDATE accounts SET private_tester=0 WHERE id='premium'");
  assert.equal(
    (await (await f.call("premium", "/api/account")).json()).cloudStorage,
    true,
  );
  assert.equal(
    (
      await f.call("premium", "/api/library", {
        ...file,
        revision: 2,
        content: "third",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await f.call("owner", "/api/cloud-access/revoke", {
        accountId: "premium",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await f.call("premium", "/api/library", {
        ...file,
        revision: 3,
        content: "rejected",
      })
    ).status,
    403,
  );
  const read = await (
    await f.call("premium", "/api/library/" + file.id)
  ).json();
  assert.equal(read.content, "third");
  const history = await (
    await f.call("premium", "/api/library/" + file.id + "/versions")
  ).json();
  assert.ok(history.versions.length >= 2);
  const state = await (await f.call("premium", "/api/account")).json();
  assert.equal(state.existingCloudFiles, true);
  assert.equal(state.cloudStorage, false);
  assert.equal((await f.call("other", "/api/library/" + file.id)).status, 404);
});
test("invites require one verified existing account, enforce origin, and stay bound to account ID", async () => {
  const f = fixture();
  assert.equal(
    (
      await f.call("owner", "/api/cloud-access", {
        email: "missing@example.test",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await f.call("owner", "/api/cloud-access", {
        email: "basic@example.test",
      })
    ).status,
    400,
  );
  const handler = createHandler(async () => f.account("owner"));
  assert.equal(
    (
      await handler(
        request(
          "/api/cloud-access",
          { email: "premium@example.test" },
          "owner",
          "https://evil.test",
        ),
        f.env,
      )
    ).status,
    403,
  );
  await f.call("owner", "/api/cloud-access", { email: "premium@example.test" });
  f.env.sql.exec(
    "UPDATE accounts SET email='changed@example.test' WHERE id='premium'; UPDATE accounts SET email='premium@example.test' WHERE id='other'",
  );
  assert.equal(await cloudStorageAllowed(f.account("premium"), f.env), true);
  assert.equal(await cloudStorageAllowed(f.account("other"), f.env), false);
});
test("Premium Drive collaboration requires provider permission, uses the same ID, and needs no cloud invitation", async () => {
  const f = fixture();
  let revoked = false;
  const adapter = new WriteShapeLiveStorage(f.env, {
    authenticate: async (r) => f.account(r.headers.get("Cookie")),
    drive: async (r, _env, a) => {
      assert.equal(
        new URL(r.url).searchParams.get("id"),
        "same_drive_file_123",
      );
      return new Response(
        JSON.stringify(
          revoked
            ? { error: "Drive permission removed" }
            : {
                name: "Shared.md",
                content: "# Shared",
                etag: "1",
                canEdit: a.id !== "other",
              },
        ),
        {
          status: revoked ? 403 : 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    },
  });
  const cred = (id) => JSON.stringify({ cookie: id });
  const writer = await adapter.authorize(
    "drive_same_drive_file_123",
    cred("premium"),
  );
  const viewer = await adapter.authorize(
    "drive_same_drive_file_123",
    cred("other"),
  );
  assert.equal(writer.file.id, viewer.file.id);
  assert.equal(writer.self.canEdit, true);
  assert.equal(viewer.self.canEdit, false);
  assert.equal(await cloudStorageAllowed(f.account("premium"), f.env), false);
  await assert.rejects(
    adapter.authorize(writer.file.id, cred("basic")),
    /Premium/,
  );
  revoked = true;
  await assert.rejects(adapter.snapshot(writer), /permission removed/);
  const drive = createDriveRoutes();
  await assert.rejects(
    drive(
      request("/api/drive/open?id=same_drive_file_123"),
      f.env,
      f.account("basic"),
    ),
    /Premium/,
  );
});
test("invite-only storage ignores old Premium deletion deadlines and scheduled purge settings", async () => {
  const f = fixture();
  let messages = 0;
  f.env.CLOUD_BACKUP_POLICY = "true";
  f.env.CLOUD_BACKUP_PURGE = "true";
  f.env.CUSTOMER_EMAIL = {
    send: async () => {
      messages++;
      return { messageId: "test" };
    },
  };
  f.env.sql.exec(
    "INSERT INTO items(id,owner,name,kind,content,updated) VALUES('old-file','basic','Old.fountain','file','saved','2026-10-01'); INSERT INTO cloud_backup_grace(account_id,generation,last_premium_seen,ended_at,deadline,initial_sent,ten_sent,one_sent) VALUES('basic','old',1,1,2,1,1,1)",
  );
  const grace = f.env.sql
    .prepare("SELECT * FROM cloud_backup_grace WHERE account_id='basic'")
    .get();
  assert.equal(await reconcileBackupGrace(f.env, f.account("basic")), null);
  await maintainCloudBackups(f.env);
  await purgeExpiredCloud(f.env, grace);
  assert.equal(messages, 0);
  assert.equal(
    f.env.sql.prepare("SELECT content FROM items WHERE id='old-file'").get()
      .content,
    "saved",
  );
});
test("new checkout catalog uses 599/5900 cents and still recognizes prior paid sandbox periods", () => {
  assert.equal(TEST_PLANS.monthly.amount, 599);
  assert.equal(TEST_PLANS.yearly.amount, 5900);
  const end = Math.floor(Date.now() / 1000) + 3600;
  const plan = LEGACY_TEST_PLANS.monthly;
  const sub = {
    id: "sub_old",
    customer: "cus_old",
    livemode: false,
    status: "active",
    items: {
      data: [
        {
          quantity: 1,
          current_period_end: end,
          price: {
            ...plan,
            unit_amount: plan.amount,
            livemode: false,
            active: true,
            currency: "usd",
            type: "recurring",
            billing_scheme: "per_unit",
            product: "prod_VJvvBIU1Uuy6RQ",
            recurring: {
              interval: plan.interval,
              interval_count: 1,
              usage_type: "licensed",
            },
          },
        },
      ],
    },
  };
  assert.equal(subscriptionState(sub, end).until, end);
  assert.equal(subscriptionState(sub, end).plan, "monthly");
});
