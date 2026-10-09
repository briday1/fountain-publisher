import { inviteOnlyStorage } from "./cloud-access.mjs";
import { premium } from "./accounts.mjs";
import { accountBilling } from "./billing-mode.mjs";
import { withComplimentaryAccess } from "./access-codes.mjs";
import { now } from "./http.mjs";
import {
  backupDeadline,
  backupReminderAt,
  backupDeadlineLabel,
} from "./backup-deadline.mjs";

export async function freshBackupAccount(env, id) {
  return withComplimentaryAccess(
    accountBilling(
      await env.DB.prepare("SELECT * FROM accounts WHERE id=?")
        .bind(id)
        .first(),
      env,
    ),
    env,
  );
}
export async function reconcileBackupGrace(env, account) {
  if (inviteOnlyStorage(env)) return null;
  if (!account || env.CLOUD_BACKUP_POLICY !== "true") return null;
  const time = now();
  if (premium(account)) {
    const until = Math.max(
      account.premium_until || 0,
      account.complimentary_until || 0,
    );
    // Reactivation invalidates the whole old generation, including leased notices.
    await env.DB.batch([
      env.DB.prepare(
        "DELETE FROM cloud_backup_notices WHERE account_id=?",
      ).bind(account.id),
      env.DB.prepare(
        `INSERT INTO cloud_backup_grace(account_id,generation,last_premium_until,last_premium_seen)
       VALUES(?,?,?,?) ON CONFLICT(account_id) DO UPDATE SET
       generation=CASE WHEN ended_at IS NOT NULL THEN excluded.generation ELSE generation END,
       last_premium_until=excluded.last_premium_until,last_premium_seen=excluded.last_premium_seen,
       ended_at=NULL,deadline=NULL,purged_at=NULL,initial_sent=NULL,ten_sent=NULL,one_sent=NULL`,
      ).bind(account.id, crypto.randomUUID(), until, time),
    ]);
    return null;
  }
  let state = await env.DB.prepare(
    "SELECT * FROM cloud_backup_grace WHERE account_id=?",
  )
    .bind(account.id)
    .first();
  if (!state) {
    const data = await env.DB.prepare(
      "SELECT id FROM items WHERE owner=? LIMIT 1",
    )
      .bind(account.id)
      .first();
    if (!data) return null;
    // Existing Basic cloud data gets a full new grace period, never a backdated purge.
    await env.DB.prepare(
      `INSERT OR IGNORE INTO cloud_backup_grace
      (account_id,generation,last_premium_seen) VALUES(?,?,?)`,
    )
      .bind(account.id, crypto.randomUUID(), time)
      .run();
    state = await env.DB.prepare(
      "SELECT * FROM cloud_backup_grace WHERE account_id=?",
    )
      .bind(account.id)
      .first();
  }
  if (!state.ended_at && !state.purged_at) {
    const ended =
      state.last_premium_until > 0 && state.last_premium_until <= time
        ? Math.max(state.last_premium_until, state.last_premium_seen)
        : time;
    const deadline = backupDeadline(ended);
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE cloud_backup_grace SET ended_at=?,deadline=? WHERE account_id=? AND ended_at IS NULL",
      ).bind(ended, deadline, account.id),
      ...[
        ["initial", ended],
        ["ten", backupReminderAt(deadline, 10)],
        ["one", backupReminderAt(deadline, 1)],
      ].map(([kind, due]) =>
        env.DB.prepare(
          `INSERT OR IGNORE INTO cloud_backup_notices
         (account_id,generation,kind,due) SELECT account_id,generation,?,? FROM cloud_backup_grace WHERE account_id=?`,
        ).bind(kind, due, account.id),
      ),
    ]);
    state = await env.DB.prepare(
      "SELECT * FROM cloud_backup_grace WHERE account_id=?",
    )
      .bind(account.id)
      .first();
  }
  return state.purged_at
    ? null
    : {
        endedAt: state.ended_at,
        deadline: state.deadline,
        deadlineLabel: backupDeadlineLabel(state.deadline),
        backupUrl: "/backup.html",
      };
}
export async function backupAllowed(env, account) {
  if (inviteOnlyStorage(env)) return false;
  if (premium(account)) return true;
  if (env.CLOUD_BACKUP_POLICY !== "true") return false;
  const state = await env.DB.prepare(
    "SELECT deadline,purged_at FROM cloud_backup_grace WHERE account_id=?",
  )
    .bind(account.id)
    .first();
  return !!state?.deadline && !state.purged_at;
}

export async function sendBackupNotices(env, accountId = null) {
  if (inviteOnlyStorage(env)) return;
  if (!env.CUSTOMER_EMAIL || env.CLOUD_BACKUP_POLICY !== "true") return;
  const time = now();
  const pending = await env.DB.prepare(
    `SELECT n.* FROM cloud_backup_notices n
    JOIN cloud_backup_grace g ON g.account_id=n.account_id AND g.generation=n.generation
    WHERE n.sent_at IS NULL AND n.due<=? AND n.next_attempt<=? AND g.purged_at IS NULL
    AND (? IS NULL OR n.account_id=?) ORDER BY n.due LIMIT 20`,
  )
    .bind(time, time, accountId, accountId)
    .all();
  for (const notice of pending.results) {
    const account = await freshBackupAccount(env, notice.account_id);
    await reconcileBackupGrace(env, account);
    if (!account || premium(account)) continue;
    const claimed = await env.DB.prepare(
      `UPDATE cloud_backup_notices SET next_attempt=?,attempts=attempts+1
     WHERE account_id=? AND generation=? AND kind=? AND sent_at IS NULL AND next_attempt<=?
     AND EXISTS(SELECT 1 FROM cloud_backup_grace g WHERE g.account_id=cloud_backup_notices.account_id
      AND g.generation=cloud_backup_notices.generation AND g.ended_at IS NOT NULL AND g.purged_at IS NULL)
     RETURNING kind`,
    )
      .bind(time + 300, notice.account_id, notice.generation, notice.kind, time)
      .first();
    if (!claimed) continue;
    try {
      // Re-read after claiming: a renewal while waiting for the lease cancels sending.
      const latest = await freshBackupAccount(env, account.id);
      if (!latest || premium(latest)) {
        await reconcileBackupGrace(env, latest);
        continue;
      }
      const state = await env.DB.prepare(
        "SELECT * FROM cloud_backup_grace WHERE account_id=? AND generation=? AND ended_at IS NOT NULL",
      )
        .bind(account.id, notice.generation)
        .first();
      if (!state || state.purged_at) continue;
      const remaining =
        notice.kind === "initial"
          ? "30 days"
          : notice.kind === "ten"
            ? "10 days"
            : "1 day";
      const deadline = backupDeadlineLabel(state.deadline);
      const result = await env.CUSTOMER_EMAIL.send({
        from: "support@writeshape.com",
        to: latest.email,
        subject:
          notice.kind === "initial"
            ? "Your WriteShape cloud backup window"
            : `WriteShape backup reminder: ${remaining} left`,
        text: `${notice.kind === "initial" ? "We're sorry to see you go. Premium access has ended." : `You have ${remaining} left to back up your WriteShape cloud data.`}\n\nYour backup deadline is ${deadline}. During the backup window, cloud files are read-only. Download your files locally or copy them to Google Drive through WriteShape. Cloud documents and their saved version history will be automatically deleted after the deadline. Your account, local files, and Google Drive files are preserved.\n\nBackup instructions: https://writeshape.com/backup.html\nOpen WriteShape: https://writeshape.com/\n\nReactivating Premium before deletion cancels the deadline and remaining reminders. Questions? Reply to support@writeshape.com.`,
      });
      if (!result?.messageId) throw new Error("Email was not acknowledged");
      await env.DB.batch([
        env.DB.prepare(
          "UPDATE cloud_backup_notices SET sent_at=? WHERE account_id=? AND generation=? AND kind=?",
        ).bind(now(), account.id, notice.generation, notice.kind),
        env.DB.prepare(
          `UPDATE cloud_backup_grace SET ${notice.kind}_sent=? WHERE account_id=? AND generation=?`,
        ).bind(now(), account.id, notice.generation),
      ]);
    } catch {
      await env.DB.prepare(
        "UPDATE cloud_backup_notices SET next_attempt=? WHERE account_id=? AND generation=? AND kind=?",
      )
        .bind(
          time + Math.min(86400, 900 * 2 ** Math.min(notice.attempts, 7)),
          account.id,
          notice.generation,
          notice.kind,
        )
        .run();
      console.error(JSON.stringify({ event: "cloud_backup_email_pending" }));
    }
  }
}

export async function maintainCloudBackups(env) {
  if (inviteOnlyStorage(env)) return;
  if (env.CLOUD_BACKUP_POLICY !== "true") return;
  const owners = await env.DB.prepare(
    `SELECT id FROM accounts WHERE id IN (SELECT owner FROM items)
    OR id IN (SELECT account_id FROM cloud_backup_grace WHERE purged_at IS NULL)`,
  ).all();
  for (const owner of owners.results)
    await reconcileBackupGrace(env, await freshBackupAccount(env, owner.id));
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date()),
  );
  // Email work runs in the Eastern morning. The fifteen-minute trigger is also
  // used for independent midnight expiration, retrying within the morning window.
  if (hour >= 9 && hour < 12) {
    if (env.LIVE_ROOMS) {
      const accounts = await env.DB.prepare(
        `SELECT DISTINCT account_id FROM cloud_backup_notices
        WHERE sent_at IS NULL AND due<=? AND next_attempt<=? LIMIT 20`,
      )
        .bind(now(), now())
        .all();
      for (const account of accounts.results)
        await env.LIVE_ROOMS.get(
          env.LIVE_ROOMS.idFromName(
            "writeshape-account-v1:" + account.account_id,
          ),
        ).fetch(
          new Request("https://room.internal/backup-notices", {
            method: "POST",
            body: JSON.stringify({ accountId: account.account_id }),
            headers: { "Content-Type": "application/json" },
          }),
        );
    } else await sendBackupNotices(env);
  }
  // Purging is enabled only after customer email sending is verified. Failed notice
  // delivery holds deletion rather than silently removing a writer's only copy.
  if (env.CLOUD_BACKUP_PURGE !== "true" || !env.CUSTOMER_EMAIL) return;
  const expired = await env.DB.prepare(
    `SELECT account_id,generation FROM cloud_backup_grace
    WHERE deadline<=? AND purged_at IS NULL AND initial_sent IS NOT NULL
    AND ten_sent IS NOT NULL AND one_sent IS NOT NULL`,
  )
    .bind(now())
    .all();
  for (const state of expired.results) {
    if (env.LIVE_ROOMS) {
      await env.LIVE_ROOMS.get(
        env.LIVE_ROOMS.idFromName("writeshape-account-v1:" + state.account_id),
      ).fetch(
        new Request("https://room.internal/expire-cloud", {
          method: "POST",
          body: JSON.stringify(state),
          headers: { "Content-Type": "application/json" },
        }),
      );
    } else await purgeExpiredCloud(env, state);
  }
}

export async function purgeExpiredCloud(env, state) {
  if (inviteOnlyStorage(env)) return;
  const account = await freshBackupAccount(env, state.account_id);
  if (!account || premium(account)) {
    await reconcileBackupGrace(env, account);
    return false;
  }
  const grace = await env.DB.prepare(
    `SELECT * FROM cloud_backup_grace WHERE account_id=? AND generation=?
    AND deadline<=? AND purged_at IS NULL AND initial_sent IS NOT NULL AND ten_sent IS NOT NULL AND one_sent IS NOT NULL`,
  )
    .bind(account.id, state.generation, now())
    .first();
  if (!grace) return false;
  await env.DB.prepare(
    "INSERT OR REPLACE INTO expiring_cloud_accounts(account_id,generation) VALUES(?,?)",
  )
    .bind(account.id, state.generation)
    .run();
  try {
    if (env.LIVE_ROOMS) {
      const rooms = await env.DB.prepare(
        `SELECT 'library_'||id AS file_id FROM items WHERE owner=? AND kind='file'`,
      )
        .bind(account.id)
        .all();
      for (const room of rooms.results) {
        const response = await env.LIVE_ROOMS.get(
          env.LIVE_ROOMS.idFromName("writeshape-v1:" + room.file_id),
        ).fetch(
          new Request("https://room.internal/expire-cloud-room", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ accountId: account.id }),
          }),
        );
        if (!response.ok) return false;
      }
    }
    await env.DB.batch([
      ...[
        "file_shares",
        "file_edit_shares",
        "file_versions",
        "file_retention",
      ].map((table) =>
        env.DB.prepare(`DELETE FROM ${table} WHERE owner=?`).bind(account.id),
      ),
      env.DB.prepare(
        "DELETE FROM live_room_members WHERE file_id IN (SELECT 'library_'||id FROM items WHERE owner=?)",
      ).bind(account.id),
      env.DB.prepare(
        "DELETE FROM live_room_registry WHERE file_id IN (SELECT 'library_'||id FROM items WHERE owner=?)",
      ).bind(account.id),
      env.DB.prepare("DELETE FROM items WHERE owner=?").bind(account.id),
      env.DB.prepare(
        "DELETE FROM cloud_backup_notices WHERE account_id=? AND generation=?",
      ).bind(account.id, state.generation),
      env.DB.prepare(
        "UPDATE cloud_backup_grace SET purged_at=? WHERE account_id=? AND generation=?",
      ).bind(now(), account.id, state.generation),
    ]);
    return true;
  } finally {
    await env.DB.prepare(
      "DELETE FROM expiring_cloud_accounts WHERE account_id=?",
    )
      .bind(account.id)
      .run();
  }
}
