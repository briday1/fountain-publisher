import { HttpError, json, sameOrigin, bodyJson } from "./http.mjs";
import { cloudStorageAllowed, inviteOnlyStorage } from "./cloud-access.mjs";
import { premium } from "./accounts.mjs";

const pilotReason = "External sharing is unavailable during the private pilot.";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const grantColumns =
  "id,file_id AS fileId,recipient_email AS recipientEmail,role,created_at AS createdAt,revoked_at AS revokedAt";
const sharingEnabled = (env) =>
  env.LIVE_COLLABORATION === "true" ||
  (env.PUBLIC_LAUNCH === "true" && env.SHARING_ENABLED === "true");
const grantSource = (env) =>
  env.LIVE_COLLABORATION === "true"
    ? "(SELECT * FROM file_shares UNION ALL SELECT * FROM file_edit_shares)"
    : "file_shares";
const missing = () => {
  throw new HttpError(404, "File or share not found.");
};

async function ownedFile(env, owner, fileId) {
  const file = await env.DB.prepare(
    "SELECT id FROM items WHERE id=? AND owner=? AND kind='file'",
  )
    .bind(fileId, owner)
    .first();
  if (!file) missing();
}
async function capabilities(env, user) {
  if (!sharingEnabled(env)) return { canShare: false, reason: pilotReason };
  if (!(await cloudStorageAllowed(user, env)))
    return {
      canShare: false,
      reason:
        "Cloud storage requires an owner invitation. Existing shares can still be revoked.",
    };
  return { canShare: true, reason: null };
}
async function ownerGrant(env, owner, fileId, shareId) {
  const grant = await env.DB.prepare(
    `SELECT ${grantColumns} FROM ${grantSource(env)} WHERE id=? AND owner=? AND file_id=?`,
  )
    .bind(shareId, owner, fileId)
    .first();
  if (!grant) missing();
  return grant;
}

// The worker must resolve the account before dispatching here. Share IDs are identifiers,
// never bearer tokens: every read checks the signed-in stable recipient account ID.
export async function sharingRoutes(request, env, user) {
  const path = new URL(request.url).pathname;
  const ownerRoute = path.match(/^\/api\/library\/([^/]+)\/shares(?:\/(.*))?$/);
  const recipientRoute =
    path === "/api/shared" || path.startsWith("/api/shared/");
  if (!ownerRoute && !recipientRoute) return null;
  if (!user) throw new HttpError(401, "Sign in to your WriteShape account.");

  if (ownerRoute) {
    const fileId = ownerRoute[1];
    if (!uuid.test(fileId)) missing();
    await ownedFile(env, user.id, fileId);
    const tail = ownerRoute[2];
    if (request.method === "GET" && tail === undefined) {
      const shares = await env.DB.prepare(
        `SELECT ${grantColumns} FROM ${grantSource(env)} WHERE owner=? AND file_id=? ORDER BY created_at DESC,id`,
      )
        .bind(user.id, fileId)
        .all();
      return json({
        shares: shares.results,
        ...(await capabilities(env, user)),
        canCollaborate: env.LIVE_COLLABORATION === "true" && premium(user),
      });
    }
    if (request.method !== "POST") missing();
    sameOrigin(request);
    const revoke = tail?.match(/^([^/]+)\/revoke$/);
    if (revoke) {
      if (!uuid.test(revoke[1])) missing();
      const grant = await ownerGrant(env, user.id, fileId, revoke[1]);
      // The first revocation timestamp is retained; repeated requests are idempotent.
      await env.DB.prepare(
        `UPDATE ${grant.role === "read-write" ? "file_edit_shares" : "file_shares"} SET revoked_at=? WHERE id=? AND owner=? AND file_id=? AND revoked_at IS NULL`,
      )
        .bind(new Date().toISOString(), revoke[1], user.id, fileId)
        .run();
      return json({ share: await ownerGrant(env, user.id, fileId, revoke[1]) });
    }
    if (tail !== undefined) missing();
    const capability = await capabilities(env, user);
    if (!capability.canShare) throw new HttpError(403, capability.reason);
    const input = await bodyJson(request);
    if (
      !input ||
      typeof input !== "object" ||
      Array.isArray(input) ||
      typeof input.email !== "string" ||
      input.email.length > 254 ||
      (input.role !== undefined &&
        input.role !== "read-only" &&
        !(env.LIVE_COLLABORATION === "true" && input.role === "read-write"))
    ) {
      throw new HttpError(
        400,
        "Enter a verified WriteShape account email and read-only access.",
      );
    }
    const email = input.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new HttpError(400, "Enter a valid recipient email.");
    // Do not merge accounts on email, or pick an arbitrary matching account. Only a
    // provider-verified account created by the existing account flow can receive a grant.
    const matches = await env.DB.prepare(
      "SELECT a.id,a.email,(a.private_tester=1 OR EXISTS(SELECT 1 FROM account_identities i WHERE i.account_id=a.id AND i.issuer='google')) AS verified FROM accounts a WHERE lower(a.email)=? LIMIT 2",
    )
      .bind(email)
      .all();
    if (matches.results.length !== 1 || !matches.results[0].verified)
      throw new HttpError(
        400,
        "Choose an unambiguous, already verified WriteShape account email. No invitation was sent.",
      );
    const recipient = matches.results[0];
    if (inviteOnlyStorage(env) && !(await cloudStorageAllowed(recipient, env)))
      throw new HttpError(
        403,
        "The recipient needs a separate owner invitation to cloud storage testing.",
      );
    if (recipient.id === user.id)
      throw new HttpError(400, "You already own this file.");
    const role = input.role || "read-only";
    const table = role === "read-write" ? "file_edit_shares" : "file_shares";
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    // The partial unique index serializes duplicate grants. Re-sharing after revocation
    // creates a new ID; a revoked ID can never regain access.
    const result = await env.DB.prepare(
      `INSERT INTO ${table}(id,file_id,owner,recipient_id,recipient_email,role,created_at) SELECT ?,id,?,?,?,?,? FROM items WHERE id=? AND owner=? AND kind='file' AND NOT EXISTS(SELECT 1 FROM ${grantSource(env)} s WHERE s.file_id=items.id AND s.owner=items.owner AND s.recipient_id=? AND s.revoked_at IS NULL) ON CONFLICT DO NOTHING`,
    )
      .bind(
        id,
        user.id,
        recipient.id,
        recipient.email,
        role,
        createdAt,
        fileId,
        user.id,
        recipient.id,
      )
      .run();
    const share = await env.DB.prepare(
      `SELECT ${grantColumns} FROM ${grantSource(env)} WHERE file_id=? AND owner=? AND recipient_id=? AND revoked_at IS NULL`,
    )
      .bind(fileId, user.id, recipient.id)
      .first();
    if (!share)
      throw new HttpError(
        409,
        "Sharing changed while this request was running. Refresh sharing and try again.",
      );
    if (share.role !== role)
      throw new HttpError(
        409,
        "Revoke the existing access before changing its role.",
      );
    const created = Boolean(result.meta.changes);
    return json({ share, created }, created ? 201 : 200);
  }

  if (request.method !== "GET") missing();
  if (path === "/api/shared") {
    if (!sharingEnabled(env))
      return json({ shares: [], canReadShared: false, reason: pilotReason });
    const shares = await env.DB.prepare(
      `SELECT s.id AS shareId,i.id AS fileId,i.name,i.kind,i.revision,i.updated,length(CAST(COALESCE(i.content,'') AS BLOB)) AS bytes,s.role,s.created_at AS sharedAt FROM ${grantSource(env)} s JOIN items i ON i.id=s.file_id AND i.owner=s.owner AND i.kind='file' WHERE s.recipient_id=? AND s.revoked_at IS NULL ORDER BY i.updated DESC,s.id`,
    )
      .bind(user.id)
      .all();
    return json({
      shares: shares.results.map(({ fileId, ...s }) => ({
        ...s,
        ...(env.LIVE_COLLABORATION === "true"
          ? { liveId: "library_" + fileId }
          : {}),
      })),
      canReadShared: true,
      reason: null,
    });
  }
  const shareId = path.slice("/api/shared/".length);
  if (!uuid.test(shareId)) missing();
  if (!sharingEnabled(env)) throw new HttpError(403, pilotReason);
  // Current content only: no folders, owner identifiers, or historical versions are exposed.
  const file = await env.DB.prepare(
    `SELECT s.id AS shareId,i.id AS fileId,i.name,i.content,i.revision,i.updated,length(CAST(COALESCE(i.content,'') AS BLOB)) AS bytes,s.role FROM ${grantSource(env)} s JOIN items i ON i.id=s.file_id AND i.owner=s.owner AND i.kind='file' WHERE s.id=? AND s.recipient_id=? AND s.revoked_at IS NULL`,
  )
    .bind(shareId, user.id)
    .first();
  if (!file) missing();
  const { fileId, ...result } = file;
  return json({
    ...result,
    readOnly: file.role !== "read-write",
    ...(env.LIVE_COLLABORATION === "true"
      ? { liveId: "library_" + fileId }
      : {}),
  });
}
