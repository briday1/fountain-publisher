import { createRemoteJWKSet, jwtVerify } from "jose";
import { identity } from "./access.mjs";
import { HttpError, json, now, sameOrigin, bodyJson } from "./http.mjs";
const SESSION = "__Host-writeshape_session";
const STATE = "__Host-writeshape_oauth";
const googleKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);
export const randomToken = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
export const hash = async (value) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
const cookie = (name, value, seconds) =>
  `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${seconds}`;
export function readCookie(request, name) {
  return (request.headers.get("Cookie") || "")
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(name + "="))
    ?.slice(name.length + 1);
}
export const googleConfigured = (env) =>
  Boolean(
    env.GOOGLE_CLIENT_ID &&
    env.GOOGLE_CLIENT_SECRET &&
    env.APP_ORIGIN === "https://writeshape.com",
  );
export const privateMode = (env) => env.PUBLIC_LAUNCH !== "true";
export function premium(account) {
  return (
    !!account &&
    (account.private_tester === 1 ||
      (account.premium_until > now() && account.billing_status === "active"))
  );
}
export async function accessAccount(user, env) {
  // Use the existing signed Access subject as account ID: no owner migration or email-based takeover.
  await env.DB.prepare(
    "INSERT OR IGNORE INTO accounts (id,email,private_tester,created) VALUES (?,?,1,?)",
  )
    .bind(user.id, user.email, now())
    .run();
  return env.DB.prepare("SELECT * FROM accounts WHERE id=?")
    .bind(user.id)
    .first();
}
export async function sessionAccount(request, env) {
  const token = readCookie(request, SESSION);
  if (!token || !/^\w{64}$/.test(token)) return null;
  return env.DB.prepare(
    "SELECT a.* FROM accounts a JOIN account_sessions s ON s.account_id=a.id WHERE s.token_hash=? AND s.expires>?",
  )
    .bind(await hash(token), now())
    .first();
}
export async function resolveAccount(request, env) {
  if (privateMode(env)) {
    let user;
    try {
      user = await identity(request, env);
    } catch {
      throw new HttpError(401, "Please sign in again.");
    }
    return accessAccount(user, env);
  }
  return sessionAccount(request, env);
}
export async function requireAccount(request, env) {
  const account = await resolveAccount(request, env);
  if (!account) throw new HttpError(401, "Sign in to your WriteShape account.");
  return account;
}
export async function issueSession(accountId, request, env) {
  const old = readCookie(request, SESSION);
  const token = randomToken();
  const statements = [
    env.DB.prepare(
      "INSERT INTO account_sessions (token_hash,account_id,expires) VALUES (?,?,?)",
    ).bind(await hash(token), accountId, now() + 604800),
  ];
  if (old)
    statements.push(
      env.DB.prepare("DELETE FROM account_sessions WHERE token_hash=?").bind(
        await hash(old),
      ),
    );
  statements.push(
    env.DB.prepare("DELETE FROM account_sessions WHERE expires<=?").bind(now()),
  );
  await env.DB.batch(statements);
  return cookie(SESSION, token, 604800);
}
export async function verifyGoogleToken(token, env, nonce, keys = googleKeys) {
  const { payload } = await jwtVerify(token, keys, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: env.GOOGLE_CLIENT_ID,
    algorithms: ["RS256"],
    requiredClaims: ["exp", "iat", "sub", "nonce"],
    maxTokenAge: "10m",
  });
  if (
    payload.nonce !== nonce ||
    payload.email_verified !== true ||
    typeof payload.email !== "string" ||
    !payload.email ||
    !payload.sub ||
    (payload.azp && payload.azp !== env.GOOGLE_CLIENT_ID)
  )
    throw new HttpError(401, "Google identity could not be verified.");
  return payload;
}
export async function googleAccount(claims, linkId, env) {
  const existing = await env.DB.prepare(
    "SELECT account_id FROM account_identities WHERE issuer=? AND subject=?",
  )
    .bind("google", claims.sub)
    .first();
  if (existing) {
    if (linkId && existing.account_id !== linkId)
      throw new HttpError(
        409,
        "This Google account already belongs to another WriteShape account.",
      );
    return existing.account_id;
  }
  if (linkId) {
    const owner = await env.DB.prepare("SELECT * FROM accounts WHERE id=?")
      .bind(linkId)
      .first();
    if (!owner || owner.email.toLowerCase() !== claims.email.toLowerCase())
      throw new HttpError(
        403,
        "Use the Google account with your current verified email to link sign-in.",
      );
    await env.DB.prepare(
      "INSERT INTO account_identities (issuer,subject,account_id) VALUES (?,?,?)",
    )
      .bind("google", claims.sub, linkId)
      .run();
    return linkId;
  }
  const id = crypto.randomUUID();
  // Never merge accounts by email; provider subject is the identity key.
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO accounts (id,email,display_name,created) VALUES (?,?,?,?)",
    ).bind(id, claims.email, String(claims.name || "").slice(0, 80), now()),
    env.DB.prepare(
      "INSERT INTO account_identities (issuer,subject,account_id) VALUES (?,?,?)",
    ).bind("google", claims.sub, id),
  ]);
  return id;
}
export async function accountRoutes(request, env, account, billingAvailable) {
  const url = new URL(request.url);
  if (url.pathname === "/api/account" && request.method === "GET") {
    const googleLinked = account
      ? !!(await env.DB.prepare(
          "SELECT subject FROM account_identities WHERE account_id=? AND issuer=?",
        )
          .bind(account.id, "google")
          .first())
      : false;
    return json({
      account: account
        ? {
            id: account.id,
            email: account.email,
            displayName: account.display_name,
            privateTester: account.private_tester === 1,
            googleLinked,
            billingStatus: account.billing_status,
            cancelAtPeriodEnd: !!account.cancel_at_period_end,
            premiumUntil: account.premium_until,
          }
        : null,
      premium: premium(account),
      googleAvailable: googleConfigured(env),
      billingAvailable,
      portalAvailable: billingAvailable && !!account?.stripe_customer,
      privateMode: privateMode(env),
    });
  }
  if (url.pathname === "/api/account/profile" && request.method === "POST") {
    sameOrigin(request);
    if (!account) throw new HttpError(401, "Sign in first.");
    const data = await bodyJson(request);
    if (
      typeof data.displayName !== "string" ||
      data.displayName.trim().length > 80 ||
      /[\x00-\x1f]/.test(data.displayName)
    )
      throw new HttpError(400, "Use a display name of up to 80 characters.");
    await env.DB.prepare("UPDATE accounts SET display_name=? WHERE id=?")
      .bind(data.displayName.trim(), account.id)
      .run();
    return json({ ok: true });
  }
  if (url.pathname === "/api/auth/logout" && request.method === "POST") {
    sameOrigin(request);
    const token = readCookie(request, SESSION);
    if (token)
      await env.DB.prepare("DELETE FROM account_sessions WHERE token_hash=?")
        .bind(await hash(token))
        .run();
    const response = json({ ok: true, privateMode: privateMode(env) });
    response.headers.append("Set-Cookie", cookie(SESSION, "", 0));
    return response;
  }
  if (url.pathname === "/api/auth/google/start" && request.method === "POST") {
    sameOrigin(request);
    if (!googleConfigured(env))
      throw new HttpError(503, "Google sign-in is not configured yet.");
    const state = randomToken(),
      nonce = randomToken(),
      verifier = randomToken();
    const digest = new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
    );
    const challenge = btoa(String.fromCharCode(...digest))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    await env.DB.batch([
      env.DB.prepare("DELETE FROM oauth_attempts WHERE expires<=?").bind(now()),
      env.DB.prepare(
        "INSERT INTO oauth_attempts (state_hash,nonce,verifier,account_id,expires) VALUES (?,?,?,?,?)",
      ).bind(
        await hash(state),
        nonce,
        verifier,
        account?.id || null,
        now() + 600,
      ),
    ]);
    const target = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    target.search = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: env.APP_ORIGIN + "/api/auth/google/callback",
      response_type: "code",
      scope: "openid email profile",
      state,
      nonce,
      code_challenge: challenge,
      code_challenge_method: "S256",
      prompt: "select_account",
    }).toString();
    const response = json({ url: target.href });
    response.headers.append("Set-Cookie", cookie(STATE, state, 600));
    return response;
  }
  if (
    url.pathname === "/api/auth/google/callback" &&
    request.method === "GET"
  ) {
    if (!googleConfigured(env))
      throw new HttpError(503, "Google sign-in is not configured yet.");
    const state = url.searchParams.get("state"),
      stored = readCookie(request, STATE);
    if (!state || !stored || state !== stored)
      throw new HttpError(401, "Sign-in expired. Please try again.");
    const attempt = await env.DB.prepare(
      "DELETE FROM oauth_attempts WHERE state_hash=? AND expires>? RETURNING *",
    )
      .bind(await hash(state), now())
      .first();
    if (!attempt || (attempt.account_id && account?.id !== attempt.account_id))
      throw new HttpError(401, "Sign-in expired. Please try again.");
    if (url.searchParams.has("error"))
      return new Response(null, {
        status: 303,
        headers: {
          Location: env.APP_ORIGIN + "/?account=cancelled",
          "Set-Cookie": cookie(STATE, "", 0),
          "Cache-Control": "no-store",
        },
      });
    const code = url.searchParams.get("code");
    if (!code) throw new HttpError(400, "Missing authorization code.");
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: env.APP_ORIGIN + "/api/auth/google/callback",
        grant_type: "authorization_code",
        code_verifier: attempt.verifier,
      }),
    });
    if (!response.ok)
      throw new HttpError(401, "Google sign-in failed. Please try again.");
    const tokens = await response.json();
    const claims = await verifyGoogleToken(tokens.id_token, env, attempt.nonce);
    const id = await googleAccount(claims, attempt.account_id, env);
    const headers = new Headers({
      Location: env.APP_ORIGIN + "/?account=signed-in",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    });
    headers.append("Set-Cookie", await issueSession(id, request, env));
    headers.append("Set-Cookie", cookie(STATE, "", 0));
    return new Response(null, { status: 303, headers });
  }
  return null;
}
