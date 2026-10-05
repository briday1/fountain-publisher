import { HttpError, bodyJson, json, now, sameOrigin } from "./http.mjs";
export const accessCodesAvailable = (env) =>
  typeof env.ACCESS_CODE_KEY === "string" && env.ACCESS_CODE_KEY.length >= 32;
export const accessCodeOwner = (account, env) =>
  !!account &&
  !!(env.OWNER_EMAIL || env.TESTER_EMAIL) &&
  account.email.toLowerCase() ===
    (env.OWNER_EMAIL || env.TESTER_EMAIL).toLowerCase();
export async function withComplimentaryAccess(account, env) {
  if (!account) return account;
  const grant = await env.DB.prepare(
    `SELECT MAX(r.expires_at) AS until, MAX(c.indefinite) AS indefinite FROM access_redemptions r
 JOIN access_codes c ON c.id=r.code_id WHERE r.account_id=? AND c.revoked_at IS NULL AND (c.indefinite=1 OR r.expires_at>?)`,
  )
    .bind(account.id, now())
    .first();
  return {
    ...account,
    complimentary_until: grant?.until || 0,
    complimentary_indefinite: grant?.indefinite === 1,
  };
}
function normalizeCode(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9-]{8,48}$/.test(value.trim()))
    throw new HttpError(
      400,
      "Use an access code with 8–48 letters, numbers or hyphens.",
    );
  return value.trim().toUpperCase();
}
async function codeHash(value, env) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(env.ACCESS_CODE_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return Array.from(
    new Uint8Array(
      await crypto.subtle.sign("HMAC", key, encoder.encode(value)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function accessCodeRoutes(request, env, account) {
  const path = new URL(request.url).pathname;
  if (!path.startsWith("/api/access-codes")) return null;
  if (!account) throw new HttpError(401, "Sign in to use an access code.");
  if (!accessCodesAvailable(env))
    throw new HttpError(503, "Access codes are not available yet.");
  if (request.method !== "GET") sameOrigin(request);
  if (path === "/api/access-codes/redeem" && request.method === "POST") {
    const time = now();
    const attempt = await env.DB.prepare(
      `INSERT INTO access_code_attempts(account_id,window_start,attempts) VALUES(?,?,1)
   ON CONFLICT(account_id) DO UPDATE SET window_start=CASE WHEN window_start<=? THEN excluded.window_start ELSE window_start END,
   attempts=CASE WHEN window_start<=? THEN 1 ELSE attempts+1 END RETURNING attempts`,
    )
      .bind(account.id, time, time - 3600, time - 3600)
      .first();
    if (attempt.attempts > 20)
      throw new HttpError(429, "Too many code attempts. Try again in an hour.");
    const data = await bodyJson(request);
    const hashed = await codeHash(normalizeCode(data.code), env);
    // One atomic INSERT ... SELECT checks capacity and expiry. The composite key makes
    // retries idempotent, including competing requests from another device.
    await env.DB.prepare(
      `INSERT OR IGNORE INTO access_redemptions(code_id,account_id,granted_at,expires_at)
   SELECT c.id,?,?,CASE WHEN c.indefinite=1 THEN 0 ELSE ?+c.duration_days*86400 END FROM access_codes c WHERE c.code_hash=?
   AND c.revoked_at IS NULL AND c.expires_at>? AND
   c.total_redemptions<c.max_redemptions`,
    )
      .bind(account.id, time, time, hashed, time)
      .run();
    const grant = await env.DB.prepare(
      `SELECT r.expires_at,c.indefinite FROM access_redemptions r JOIN access_codes c ON c.id=r.code_id
   WHERE c.code_hash=? AND r.account_id=? AND c.revoked_at IS NULL AND (c.indefinite=1 OR r.expires_at>?)`,
    )
      .bind(hashed, account.id, time)
      .first();
    if (!grant)
      throw new HttpError(
        400,
        "This code is invalid, expired, revoked or fully redeemed.",
      );
    return json({
      ok: true,
      expiresAt: grant.indefinite ? null : grant.expires_at,
    });
  }
  if (!accessCodeOwner(account, env))
    throw new HttpError(403, "Only the account owner can manage access codes.");
  if (path === "/api/access-codes" && request.method === "GET") {
    const codes = await env.DB.prepare(
      `SELECT c.id,c.label,CASE WHEN c.indefinite=1 THEN NULL ELSE c.duration_days END AS durationDays,c.expires_at AS expiresAt,
   c.max_redemptions AS maxRedemptions,c.revoked_at AS revokedAt,c.created,
   c.total_redemptions AS redemptions
   FROM access_codes c ORDER BY c.created DESC,c.id LIMIT 200`,
    ).all();
    return json({ codes: codes.results });
  }
  if (path === "/api/access-codes" && request.method === "POST") {
    const data = await bodyJson(request),
      time = now();
    if (
      typeof data.label !== "string" ||
      !data.label.trim() ||
      data.label.length > 80 ||
      /[\x00-\x1f]/.test(data.label) ||
      (data.durationDays !== null &&
        (!Number.isInteger(data.durationDays) ||
          data.durationDays < 1 ||
          data.durationDays > 3650)) ||
      !Number.isInteger(data.maxRedemptions) ||
      data.maxRedemptions < 1 ||
      data.maxRedemptions > 10000 ||
      !Number.isInteger(data.expiresAt) ||
      data.expiresAt <= time ||
      data.expiresAt > time + 3650 * 86400
    )
      throw new HttpError(
        400,
        "Choose a name, 1–3650 days or no end date, 1–10,000 uses, and a future redemption deadline within ten years.",
      );
    const code = data.code
      ? normalizeCode(data.code)
      : Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) =>
          b.toString(16).padStart(2, "0"),
        )
          .join("")
          .toUpperCase();
    const hashed = await codeHash(code, env),
      id = crypto.randomUUID();
    const inserted = await env.DB.prepare(
      `INSERT OR IGNORE INTO access_codes(id,label,code_hash,duration_days,indefinite,expires_at,max_redemptions,created_by,created)
   VALUES(?,?,?,?,?,?,?,?,?)`,
    )
      .bind(
        id,
        data.label.trim(),
        hashed,
        data.durationDays ?? 1,
        data.durationDays === null ? 1 : 0,
        data.expiresAt,
        data.maxRedemptions,
        account.id,
        time,
      )
      .run();
    if (!inserted.meta.changes)
      throw new HttpError(
        409,
        "That code has already been used. Choose a new code.",
      );
    return json({ id, code });
  }
  if (path === "/api/access-codes/revoke" && request.method === "POST") {
    const data = await bodyJson(request);
    if (typeof data.id !== "string")
      throw new HttpError(400, "Choose an access code.");
    const code = await env.DB.prepare("SELECT id FROM access_codes WHERE id=?")
      .bind(data.id)
      .first();
    if (!code) throw new HttpError(404, "Access code not found.");
    await env.DB.prepare(
      "UPDATE access_codes SET revoked_at=? WHERE id=? AND revoked_at IS NULL",
    )
      .bind(now(), data.id)
      .run();
    return json({ ok: true });
  }
  throw new HttpError(405, "Unsupported access-code action.");
}
