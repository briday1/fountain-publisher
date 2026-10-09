import { HttpError, sameOrigin, bodyJson, json, now } from "./http.mjs";
import { hash, privateMode } from "./accounts.mjs";
import { stripeClient } from "./billing.mjs";

const objectId = (v) => (typeof v === "string" ? v : v?.id);
async function stopBilling(env, account, client = stripeClient) {
  // Check every mode before changing anything. A site mode switch must not strand live billing.
  const modes = ["live", "test"].filter(
    (mode) =>
      account[mode === "live" ? "live_stripe_customer" : "stripe_customer"],
  );
  for (const mode of modes) {
    const key =
      mode === "live" ? env.STRIPE_LIVE_SECRET_KEY : env.STRIPE_SECRET_KEY;
    if (!key?.startsWith(`sk_${mode}_`))
      throw new HttpError(
        503,
        "Billing could not be verified. Your account has not been deleted. You can still cancel Premium from Account.",
      );
  }
  for (const mode of modes) {
    const stripe = client({ ...env, BILLING_MODE: mode });
    const customer =
      account[mode === "live" ? "live_stripe_customer" : "stripe_customer"];
    const existing = await stripe.customers.retrieve(customer);
    if (existing.id !== customer)
      throw new HttpError(502, "Billing ownership could not be confirmed.");
    if (existing.deleted) continue;
    if (existing.livemode !== (mode === "live"))
      throw new HttpError(502, "Unexpected billing mode.");
    // Expire outstanding checkout links so an old browser tab cannot restart billing.
    for await (const checkout of stripe.checkout.sessions.list({
      customer,
      status: "open",
      limit: 100,
    })) {
      if (
        objectId(checkout.customer) !== customer ||
        checkout.livemode !== (mode === "live")
      )
        throw new HttpError(502, "Checkout ownership could not be confirmed.");
      await stripe.checkout.sessions.expire(checkout.id);
    }
    for await (const subscription of stripe.subscriptions.list({
      customer,
      status: "all",
      limit: 100,
    })) {
      if (
        objectId(subscription.customer) !== customer ||
        subscription.livemode !== (mode === "live")
      )
        throw new HttpError(
          502,
          "Subscription ownership could not be confirmed.",
        );
      if (!["canceled", "incomplete_expired"].includes(subscription.status)) {
        const canceled = await stripe.subscriptions.cancel(subscription.id, {
          invoice_now: false,
          prorate: false,
        });
        if (canceled.id !== subscription.id || canceled.status !== "canceled")
          throw new HttpError(
            502,
            "Cancellation could not be confirmed. Your account has not been deleted.",
          );
      }
    }
    // Deleting the dedicated customer also disables automatic collection of remaining invoices.
    const removed = await stripe.customers.del(customer);
    if (!removed.deleted || removed.id !== customer)
      throw new HttpError(
        502,
        "Billing cleanup could not be confirmed. Try again.",
      );
  }
}
export async function accountDeletionRoutes(
  request,
  env,
  user,
  dependencies = {},
) {
  if (new URL(request.url).pathname !== "/api/account/delete") return null;
  if (request.method !== "POST") throw new HttpError(405, "Use POST.");
  sameOrigin(request);
  if (!user) throw new HttpError(401, "Sign in first.");
  const input = await bodyJson(request);
  if (input.confirmation !== "DELETE")
    throw new HttpError(
      400,
      "Type DELETE to confirm permanent account deletion.",
    );
  const account = await env.DB.prepare("SELECT * FROM accounts WHERE id=?")
    .bind(user.id)
    .first();
  if (!account)
    throw new HttpError(401, "This account is no longer available.");
  if (
    env.LIVE_ROOMS &&
    !(await env.DB.prepare(
      "SELECT value FROM maintenance_state WHERE key='live_inventory_complete'",
    ).first())
  )
    throw new HttpError(
      503,
      "Server cleanup is being prepared. Your account has not been deleted. You can cancel Premium separately now.",
    );
  await env.DB.prepare(
    "INSERT OR IGNORE INTO deleting_accounts(account_id,started) VALUES(?,?)",
  )
    .bind(user.id, now())
    .run();
  try {
    await stopBilling(env, account, dependencies.stripeClient);
  } catch (error) {
    // Billing remains reachable; no documents have been removed. The retry is idempotent.
    await env.DB.prepare("DELETE FROM deleting_accounts WHERE account_id=?")
      .bind(user.id)
      .run();
    throw error;
  }
  if (env.LIVE_ROOMS) {
    const rooms = await env.DB.prepare(
      `SELECT file_id FROM live_room_registry WHERE legacy=1 OR file_id IN
      (SELECT file_id FROM live_room_members WHERE account_id=?) OR file_id IN
      (SELECT 'library_'||id FROM items WHERE owner=? AND kind='file')`,
    )
      .bind(user.id, user.id)
      .all();
    for (const room of rooms.results) {
      const result = await env.LIVE_ROOMS.get(
        env.LIVE_ROOMS.idFromName("writeshape-v1:" + room.file_id),
      ).fetch(
        new Request("https://room.internal/delete-account", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId: user.id }),
        }),
      );
      if (!result.ok)
        throw new HttpError(
          503,
          "Premium has been canceled. Live document cleanup is still pending; your account has not been deleted. Reopen any shared live documents, then retry deletion or contact support@writeshape.com.",
        );
    }
  }
  const id = user.id;
  const statements = [];
  if (privateMode(env))
    statements.push(
      env.DB.prepare(
        "INSERT OR REPLACE INTO revoked_access(subject_hash,before_iat,expires) VALUES(?,?,?)",
      ).bind(await hash(id), now(), now() + 2592000),
    );
  // Codes issued by an administrator keep other writers' grants, with issuer details removed.
  const codes = await env.DB.prepare(
    "SELECT id FROM access_codes WHERE created_by=? LIMIT 1",
  )
    .bind(id)
    .first();
  if (codes) {
    statements.push(
      env.DB.prepare(
        "INSERT OR IGNORE INTO accounts(id,email,created) VALUES('writeshape-system','',0)",
      ),
    );
    statements.push(
      env.DB.prepare(
        "UPDATE access_codes SET created_by='writeshape-system',label='Premium code' WHERE created_by=?",
      ).bind(id),
    );
  }
  for (const table of ["file_shares", "file_edit_shares"])
    statements.push(
      env.DB.prepare(
        `DELETE FROM ${table} WHERE owner=? OR recipient_id=?`,
      ).bind(id, id),
    );
  for (const table of [
    "cloud_storage_grants",
    "account_identities",
    "account_sessions",
    "oauth_attempts",
    "checkout_attempts",
    "live_checkout_attempts",
    "drive_oauth_attempts",
    "drive_connections",
    "drive_link_state",
    "access_code_attempts",
    "access_code_audit",
    "access_redemptions",
    "cancellation_feedback",
    "live_room_members",
    "cloud_backup_notices",
    "expiring_cloud_accounts",
    "cloud_backup_grace",
  ])
    statements.push(
      env.DB.prepare(`DELETE FROM ${table} WHERE account_id=?`).bind(id),
    );
  statements.push(
    env.DB.prepare("DELETE FROM file_versions WHERE owner=?").bind(id),
  );
  statements.push(
    env.DB.prepare(
      "DELETE FROM live_room_registry WHERE file_id IN (SELECT 'library_'||id FROM items WHERE owner=?)",
    ).bind(id),
  );
  statements.push(
    env.DB.prepare("DELETE FROM file_retention WHERE owner=?").bind(id),
  );
  statements.push(env.DB.prepare("DELETE FROM items WHERE owner=?").bind(id));
  statements.push(
    env.DB.prepare("DELETE FROM deleting_accounts WHERE account_id=?").bind(id),
  );
  statements.push(env.DB.prepare("DELETE FROM accounts WHERE id=?").bind(id));
  await env.DB.batch(statements);
  const response = json({ ok: true, deleted: true });
  response.headers.append(
    "Set-Cookie",
    "__Host-writeshape_session=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0",
  );
  response.headers.append(
    "Set-Cookie",
    "__Host-writeshape_oauth=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0",
  );
  response.headers.append(
    "Set-Cookie",
    "__Host-writeshape_drive_oauth=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0",
  );
  return response;
}
