import { test } from "node:test";
import assert from "node:assert/strict";
import { testDB } from "./test-db.mjs";
import {
  freshBackupAccount,
  reconcileBackupGrace,
  sendBackupNotices,
  purgeExpiredCloud,
} from "./cloud-backup.mjs";
import { backupDeadline, backupReminderAt } from "./backup-deadline.mjs";
function setup(t) {
  let clock = Date.parse("2026-10-06T16:00:00-04:00") / 1000;
  t.mock.method(Date, "now", () => clock * 1000);
  const messages = [];
  const env = {
    ...testDB(),
    CLOUD_BACKUP_POLICY: "true",
    CLOUD_BACKUP_PURGE: "true",
    CUSTOMER_EMAIL: {
      send: async (message) => {
        messages.push(message);
        return { messageId: "test-message" };
      },
    },
  };
  env.sql
    .prepare(
      "INSERT INTO accounts(id,email,billing_status,premium_until,created) VALUES('alice','alice@example.test','active',?,0)",
    )
    .run(clock + 3600);
  env.sql.exec(
    "INSERT INTO accounts(id,email,created) VALUES('bob','bob@example.test',0)",
  );
  for (const owner of ["alice", "bob"])
    env.sql
      .prepare(
        "INSERT INTO items(id,owner,name,kind,content,updated) VALUES(?,?,?,'file','original','2026-10-06')",
      )
      .run(owner + "-file", owner, owner + ".fountain");
  return {
    env,
    messages,
    account: () => freshBackupAccount(env, "alice"),
    advance: (seconds) => {
      clock = seconds;
    },
    time: () => clock,
    state: () =>
      env.sql
        .prepare("SELECT * FROM cloud_backup_grace WHERE account_id='alice'")
        .get(),
  };
}
test("only actual end of paid access starts grace; one generation schedules three reminders", async (t) => {
  const f = setup(t);
  await reconcileBackupGrace(f.env, await f.account());
  f.env.sql.exec("UPDATE accounts SET cancel_at_period_end=1 WHERE id='alice'");
  assert.equal(await reconcileBackupGrace(f.env, await f.account()), null);
  f.advance(f.time() + 3601);
  const grace = await reconcileBackupGrace(f.env, await f.account());
  assert.equal(grace.deadline, backupDeadline(f.time() - 1));
  assert.equal(
    f.env.sql.prepare("SELECT COUNT(*) n FROM cloud_backup_notices").get().n,
    3,
  );
  await reconcileBackupGrace(f.env, await f.account());
  await sendBackupNotices(f.env);
  await sendBackupNotices(f.env);
  assert.equal(f.messages.length, 1);
  assert.equal(f.messages[0].to, "alice@example.test");
  assert.match(f.messages[0].text, /11:59:59 p.m. Eastern Time/);
  f.advance(backupReminderAt(grace.deadline, 10));
  await sendBackupNotices(f.env);
  assert.equal(f.messages.length, 2);
  f.advance(backupReminderAt(grace.deadline, 1));
  await sendBackupNotices(f.env);
  assert.equal(f.messages.length, 3);
});
test("payment recovery invalidates queued reminders and prevents deletion; another downgrade starts fresh", async (t) => {
  const f = setup(t);
  await reconcileBackupGrace(f.env, await f.account());
  f.advance(f.time() + 3601);
  f.env.sql.exec(
    "UPDATE accounts SET billing_status='past_due' WHERE id='alice'",
  );
  await reconcileBackupGrace(f.env, await f.account());
  const old = f.state();
  await sendBackupNotices(f.env);
  f.env.sql
    .prepare(
      "UPDATE accounts SET billing_status='active',premium_until=? WHERE id='alice'",
    )
    .run(old.deadline + 86400);
  // Sender's fresh check cancels notices even if no browser has refreshed yet.
  f.advance(backupReminderAt(old.deadline, 10));
  await sendBackupNotices(f.env);
  assert.equal(f.messages.length, 1);
  assert.equal(
    f.env.sql.prepare("SELECT COUNT(*) n FROM cloud_backup_notices").get().n,
    0,
  );
  f.advance(old.deadline);
  assert.equal(await purgeExpiredCloud(f.env, old), false);
  assert.equal(
    f.env.sql.prepare("SELECT COUNT(*) n FROM items WHERE owner='alice'").get()
      .n,
    1,
  );
  f.advance(old.deadline + 86401);
  await reconcileBackupGrace(f.env, await f.account());
  assert.notEqual(f.state().generation, old.generation);
});
test("expiration removes only owned cloud data, preserving account, Drive authorization, and other writers", async (t) => {
  const f = setup(t);
  await reconcileBackupGrace(f.env, await f.account());
  f.advance(f.time() + 3601);
  await reconcileBackupGrace(f.env, await f.account());
  const state = f.state();
  await sendBackupNotices(f.env);
  f.advance(backupReminderAt(state.deadline, 10));
  await sendBackupNotices(f.env);
  f.advance(backupReminderAt(state.deadline, 1));
  await sendBackupNotices(f.env);
  f.advance(state.deadline - 1);
  assert.equal(await purgeExpiredCloud(f.env, state), false);
  f.advance(state.deadline);
  assert.equal(await purgeExpiredCloud(f.env, state), true);
  assert.equal(
    f.env.sql.prepare("SELECT COUNT(*) n FROM items WHERE owner='alice'").get()
      .n,
    0,
  );
  assert.equal(
    f.env.sql.prepare("SELECT COUNT(*) n FROM accounts WHERE id='alice'").get()
      .n,
    1,
  );
  assert.equal(
    f.env.sql.prepare("SELECT COUNT(*) n FROM items WHERE owner='bob'").get().n,
    1,
  );
  assert.equal(await purgeExpiredCloud(f.env, state), false);
});
test("email failure persists for retry and cannot silently permit deletion", async (t) => {
  const f = setup(t);
  await reconcileBackupGrace(f.env, await f.account());
  f.advance(f.time() + 3601);
  await reconcileBackupGrace(f.env, await f.account());
  f.env.CUSTOMER_EMAIL.send = async () => {
    throw new Error("unavailable");
  };
  await sendBackupNotices(f.env);
  const notice = f.env.sql
    .prepare("SELECT * FROM cloud_backup_notices WHERE kind='initial'")
    .get();
  assert.equal(notice.sent_at, null);
  assert.equal(notice.attempts, 1);
  f.advance(f.state().deadline + 1);
  assert.equal(await purgeExpiredCloud(f.env, f.state()), false);
});
