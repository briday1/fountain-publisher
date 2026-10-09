import { accessCodeOwner } from "./access-codes.mjs";
import { premium } from "./accounts.mjs";
import { HttpError, bodyJson, json, now, sameOrigin } from "./http.mjs";

// Default closed. The explicit legacy switch exists only for migration fixtures.
export const inviteOnlyStorage = (env) =>
  env.CLOUD_STORAGE_INVITE_ONLY !== "false";
export async function cloudStorageAllowed(account, env) {
  if (!account) return false;
  if (!inviteOnlyStorage(env)) return premium(account);
  if (accessCodeOwner(account, env)) return true;
  return !!(await env.DB.prepare(
    "SELECT account_id FROM cloud_storage_grants WHERE account_id=? AND revoked_at IS NULL",
  )
    .bind(account.id)
    .first());
}
export async function withCloudAccess(account, env) {
  if (!account) return account;
  return {
    ...account,
    cloud_storage: await cloudStorageAllowed(account, env),
    existing_cloud_files: !!(await env.DB.prepare(
      "SELECT id FROM items WHERE owner=? LIMIT 1",
    )
      .bind(account.id)
      .first()),
  };
}
export async function cloudAccessRoutes(request, env, account) {
  const path = new URL(request.url).pathname;
  if (!path.startsWith("/api/cloud-access")) return null;
  if (!accessCodeOwner(account, env))
    throw new HttpError(
      403,
      "Only the owner can manage cloud storage invitations.",
    );
  if (path === "/api/cloud-access" && request.method === "GET") {
    const grants = await env.DB.prepare(
      `SELECT g.account_id AS accountId,a.email,a.display_name AS displayName,
       g.granted_at AS grantedAt,g.revoked_at AS revokedAt
       FROM cloud_storage_grants g JOIN accounts a ON a.id=g.account_id
       ORDER BY g.granted_at DESC LIMIT 200`,
    ).all();
    return json({ grants: grants.results });
  }
  if (request.method !== "POST")
    throw new HttpError(405, "Unsupported storage invitation action.");
  sameOrigin(request);
  const input = await bodyJson(request);
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new HttpError(400, "Enter a storage invitation.");
  if (path === "/api/cloud-access") {
    const email =
      typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new HttpError(400, "Enter a verified WriteShape account email.");
    // Grants bind to one existing verified account, never an arbitrary email match.
    const candidates = await env.DB.prepare(
      `SELECT a.id FROM accounts a WHERE lower(a.email)=? AND
       (a.private_tester=1 OR EXISTS(SELECT 1 FROM account_identities i WHERE i.account_id=a.id))
       AND NOT EXISTS(SELECT 1 FROM deleting_accounts d WHERE d.account_id=a.id) LIMIT 2`,
    )
      .bind(email)
      .all();
    if (candidates.results.length !== 1)
      throw new HttpError(
        400,
        "That email must belong to one verified WriteShape account. Ask them to sign in first.",
      );
    const id = candidates.results[0].id;
    await env.DB.prepare(
      `INSERT INTO cloud_storage_grants(account_id,granted_by,granted_at) VALUES(?,?,?)
       ON CONFLICT(account_id) DO UPDATE SET granted_by=excluded.granted_by,
       granted_at=excluded.granted_at,revoked_at=NULL`,
    )
      .bind(id, account.id, now())
      .run();
    return json({ ok: true, accountId: id });
  }
  if (
    path === "/api/cloud-access/revoke" &&
    typeof input.accountId === "string"
  ) {
    await env.DB.prepare(
      "UPDATE cloud_storage_grants SET revoked_at=? WHERE account_id=? AND revoked_at IS NULL",
    )
      .bind(now(), input.accountId)
      .run();
    return json({ ok: true });
  }
  throw new HttpError(400, "Choose a storage invitation.");
}
