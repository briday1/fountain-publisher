const GITHUB_API = "https://api.github.com";
const API_VERSION = "2022-11-28";
const SESSION_COOKIE = "fp_github_session";
const OAUTH_COOKIE = "fp_github_oauth";
const DAY = 86_400;

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

function corsHeaders(request, env) {
  const origin = request.headers.get("origin");
  return origin === env.APP_ORIGIN ? {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET,PUT,POST,DELETE,OPTIONS",
    vary: "Origin",
  } : {};
}

function randomToken(bytes = 32) {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return [...value].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function cookieValue(request, name) {
  const match = request.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : "";
}

function secureCookie(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function sessionCookie(value, maxAge = 30 * DAY) {
  return secureCookie(SESSION_COOKIE, value, maxAge);
}

function bytesToBase64(bytes) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(binary);
}

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function tokenKey(env) {
  const bytes = base64ToBytes(env.TOKEN_ENCRYPTION_KEY || "");
  if (bytes.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes");
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptToken(value, env) {
  if (!value) return null;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await tokenKey(env), new TextEncoder().encode(value)));
  const packed = new Uint8Array(iv.length + encrypted.length);
  packed.set(iv); packed.set(encrypted, iv.length);
  return bytesToBase64(packed);
}

async function decryptToken(value, env) {
  if (!value) return null;
  const packed = base64ToBytes(value);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: packed.subarray(0, 12) }, await tokenKey(env), packed.subarray(12));
  return new TextDecoder().decode(decrypted);
}

async function digest(value) {
  return bytesToBase64(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
}

async function cleanupExpired(env, now = Math.floor(Date.now() / 1000)) {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions WHERE expires_at <= ? OR (refresh_expires_at IS NOT NULL AND refresh_expires_at <= ?)").bind(now, now),
    env.DB.prepare("DELETE FROM oauth_states WHERE expires_at <= ?").bind(now),
    env.DB.prepare("DELETE FROM rate_limits WHERE reset_at <= ?").bind(now),
  ]);
}

async function rateLimited(request, env, scope, limit, windowSeconds) {
  const identity = scope === "api"
    ? cookieValue(request, SESSION_COOKIE) || request.headers.get("CF-Connecting-IP") || "unknown"
    : request.headers.get("CF-Connecting-IP") || "unknown";
  const key = `${scope}:${await digest(identity)}`;
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(`
    INSERT INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET
      count = CASE WHEN reset_at <= ? THEN 1 ELSE count + 1 END,
      reset_at = CASE WHEN reset_at <= ? THEN excluded.reset_at ELSE reset_at END
    RETURNING count, reset_at
  `).bind(key, now + windowSeconds, now, now).first();
  return row.count > limit ? json({ error: "Too many requests. Please try again shortly." }, 429, { "retry-after": String(Math.max(1, row.reset_at - now)) }) : null;
}

function popupResponse(env, type, message = "") {
  const payload = JSON.stringify({ type, message }).replaceAll("<", "\\u003c");
  const origin = JSON.stringify(env.APP_ORIGIN);
  return new Response(`<!doctype html><meta charset="utf-8"><title>Fountain Publisher</title><p>Returning to Fountain Publisher…</p><script>window.opener?.postMessage(${payload},${origin});window.close();</script>`, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      "referrer-policy": "no-referrer",
    },
  });
}

async function githubFetch(path, token, init = {}) {
  const response = await fetch(path.startsWith("http") ? path : `${GITHUB_API}${path}`, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": API_VERSION,
      "user-agent": "fountain-publisher",
      ...init.headers,
    },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Response(JSON.stringify({ error: error.message || `GitHub returned ${response.status}` }), {
      status: response.status,
      headers: { "content-type": "application/json" },
    });
  }
  return response;
}

async function getSession(request, env) {
  const id = cookieValue(request, SESSION_COOKIE);
  if (!id) return null;
  const now = Math.floor(Date.now() / 1000);
  const session = await env.DB.prepare("SELECT * FROM sessions WHERE id = ? AND expires_at > ? AND token_version = 1").bind(id, now).first();
  if (!session) return null;
  try {
    session.access_token = await decryptToken(session.access_token, env);
    session.refresh_token = await decryptToken(session.refresh_token, env);
  } catch {
    await env.DB.prepare("DELETE FROM sessions WHERE id=?").bind(id).run();
    return null;
  }
  if (session.access_expires_at && session.access_expires_at <= now + 60 && session.refresh_token) {
    const response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: session.refresh_token,
      }),
    });
    const token = await response.json();
    if (!response.ok || token.error) return null;
    session.access_token = token.access_token;
    session.refresh_token = token.refresh_token || session.refresh_token;
    session.access_expires_at = token.expires_in ? now + token.expires_in : null;
    session.refresh_expires_at = token.refresh_token_expires_in ? now + token.refresh_token_expires_in : session.refresh_expires_at;
    await env.DB.prepare("UPDATE sessions SET access_token=?, refresh_token=?, access_expires_at=?, refresh_expires_at=? WHERE id=?")
      .bind(await encryptToken(session.access_token, env), await encryptToken(session.refresh_token, env), session.access_expires_at, session.refresh_expires_at, id).run();
  }
  return session;
}

function safeRepository(value) {
  return /^[A-Za-z0-9_.-]+$/.test(value || "");
}

function encodeContent(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(binary);
}

async function apiRequest(request, env, url) {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Not connected to GitHub" }, 401);
  if (url.pathname === "/api/session") {
    let login = session.login;
    if (!login) {
      const profile = await (await githubFetch("/user", session.access_token)).json();
      login = profile.login;
      await env.DB.prepare("UPDATE sessions SET login=? WHERE id=?").bind(login, session.id).run();
    }
    return json({ connected: true, login, installUrl: `https://github.com/apps/${env.GITHUB_APP_SLUG}/installations/new` });
  }
  if (url.pathname === "/api/repositories") {
    const installations = await (await githubFetch("/user/installations?per_page=100", session.access_token)).json();
    const repositories = [];
    for (const installation of installations.installations || []) {
      const result = await (await githubFetch(`/user/installations/${installation.id}/repositories?per_page=100`, session.access_token)).json();
      repositories.push(...(result.repositories || []).map((repo) => ({
        id: repo.id,
        fullName: repo.full_name,
        private: repo.private,
        defaultBranch: repo.default_branch,
      })));
    }
    return json({ repositories, installUrl: `https://github.com/apps/${env.GITHUB_APP_SLUG}/installations/new` });
  }
  const owner = url.searchParams.get("owner");
  const repo = url.searchParams.get("repo");
  if (!safeRepository(owner) || !safeRepository(repo)) return json({ error: "Invalid repository" }, 400);
  if (url.pathname === "/api/branches") {
    const [branchesResponse, repositoryResponse] = await Promise.all([
      githubFetch(`/repos/${owner}/${repo}/branches?per_page=100`, session.access_token),
      githubFetch(`/repos/${owner}/${repo}`, session.access_token),
    ]);
    const [branches, repository] = await Promise.all([branchesResponse.json(), repositoryResponse.json()]);
    return json({ branches: branches.map((branch) => branch.name), defaultBranch: repository.default_branch });
  }
  if (url.pathname === "/api/contents") {
    const path = url.searchParams.get("path") || "";
    const branch = url.searchParams.get("branch") || "";
    const encodedPath = path ? `/${path.split("/").map(encodeURIComponent).join("/")}` : "";
    const githubPath = `/repos/${owner}/${repo}/contents${encodedPath}`;
    if (request.method === "GET") {
      const readPath = `${githubPath}${branch ? `?ref=${encodeURIComponent(branch)}` : ""}`;
      return json(await (await githubFetch(readPath, session.access_token)).json());
    }
    if (request.method === "PUT") {
      const body = await request.json();
      if (typeof body.content !== "string" || !body.message) return json({ error: "Content and commit message are required" }, 400);
      const result = await (await githubFetch(githubPath, session.access_token, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: body.message, content: encodeContent(body.content), branch: branch || undefined, sha: body.sha || undefined }),
      })).json();
      if (!result.content?.sha || !result.commit?.html_url) return json({ error: "GitHub did not confirm the commit" }, 502);
      return json({ sha: result.content.sha, commit: result.commit.html_url });
    }
  }
  return json({ error: "Not found" }, 404);
}

async function handle(request, env) {
  const url = new URL(request.url);
  if (url.pathname === "/health") return json({ ok: true });
  if (url.pathname === "/auth/github/start") {
    const limited = await rateLimited(request, env, "oauth-start", 10, 600);
    if (limited) return limited;
    const state = randomToken();
    const binding = randomToken();
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare("DELETE FROM oauth_states WHERE expires_at <= ?").bind(now).run();
    await env.DB.prepare("INSERT INTO oauth_states (state, expires_at, binding_hash) VALUES (?, ?, ?)").bind(state, now + 600, await digest(binding)).run();
    const callback = `${url.origin}/auth/github/callback`;
    const authorize = new URL("https://github.com/login/oauth/authorize");
    authorize.search = new URLSearchParams({ client_id: env.GITHUB_CLIENT_ID, redirect_uri: callback, state }).toString();
    return new Response(null, { status: 302, headers: { location: authorize.toString(), "set-cookie": secureCookie(OAUTH_COOKIE, binding, 600) } });
  }
  if (url.pathname === "/auth/github/callback") {
    const limited = await rateLimited(request, env, "oauth-callback", 20, 600);
    if (limited) return limited;
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const binding = cookieValue(request, OAUTH_COOKIE);
    const now = Math.floor(Date.now() / 1000);
    const valid = state && binding && await env.DB.prepare("DELETE FROM oauth_states WHERE state=? AND expires_at> ? AND binding_hash=? RETURNING state")
      .bind(state, now, await digest(binding)).first();
    if (!code || !valid) {
      const response = popupResponse(env, "github-error", "GitHub authorization expired. Please try again.");
      response.headers.append("set-cookie", secureCookie(OAUTH_COOKIE, "", 0));
      return response;
    }
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code }),
    });
    const token = await tokenResponse.json();
    if (!tokenResponse.ok || token.error) return popupResponse(env, "github-error", token.error_description || "GitHub authorization failed.");
    const id = randomToken();
    const expiresAt = now + 30 * DAY;
    await env.DB.prepare("INSERT INTO sessions (id, access_token, refresh_token, access_expires_at, refresh_expires_at, created_at, expires_at, token_version) VALUES (?, ?, ?, ?, ?, ?, ?, 1)")
      .bind(id, await encryptToken(token.access_token, env), await encryptToken(token.refresh_token, env), token.expires_in ? now + token.expires_in : null, token.refresh_token_expires_in ? now + token.refresh_token_expires_in : null, now, expiresAt).run();
    const response = popupResponse(env, "github-connected");
    response.headers.append("set-cookie", sessionCookie(id));
    response.headers.append("set-cookie", secureCookie(OAUTH_COOKIE, "", 0));
    return response;
  }
  if (url.pathname === "/auth/github/installed") return popupResponse(env, "github-installed");
  if (url.pathname === "/auth/logout" && request.method === "POST") {
    const id = cookieValue(request, SESSION_COOKIE);
    if (id) await env.DB.prepare("DELETE FROM sessions WHERE id=?").bind(id).run();
    return json({ connected: false }, 200, { "set-cookie": sessionCookie("", 0) });
  }
  if (url.pathname.startsWith("/api/")) {
    const limited = await rateLimited(request, env, "api", 180, 60);
    if (limited) return limited;
    return apiRequest(request, env, url);
  }
  return json({ error: "Not found" }, 404);
}

export default {
  async fetch(request, env, context) {
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (Math.random() < 0.01) context.waitUntil(cleanupExpired(env));
    try {
      const response = await handle(request, env);
      Object.entries(cors).forEach(([key, value]) => response.headers.set(key, value));
      return response;
    } catch (error) {
      if (error instanceof Response) {
        Object.entries(cors).forEach(([key, value]) => error.headers.set(key, value));
        return error;
      }
      return json({ error: "GitHub integration failed" }, 500, cors);
    }
  },
  async scheduled(_controller, env, context) {
    context.waitUntil(cleanupExpired(env));
  },
};
