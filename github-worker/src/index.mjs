const GITHUB_API = "https://api.github.com";
const API_VERSION = "2022-11-28";
const SESSION_COOKIE = "fp_github_session";
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

function sessionCookie(value, maxAge = 30 * DAY) {
  return `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
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
  const session = await env.DB.prepare("SELECT * FROM sessions WHERE id = ? AND expires_at > ?").bind(id, now).first();
  if (!session) return null;
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
      .bind(session.access_token, session.refresh_token, session.access_expires_at, session.refresh_expires_at, id).run();
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
    const branches = await (await githubFetch(`/repos/${owner}/${repo}/branches?per_page=100`, session.access_token)).json();
    return json({ branches: branches.map((branch) => branch.name) });
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
      return json({ sha: result.content?.sha, commit: result.commit?.html_url });
    }
  }
  return json({ error: "Not found" }, 404);
}

async function handle(request, env) {
  const url = new URL(request.url);
  if (url.pathname === "/health") return json({ ok: true });
  if (url.pathname === "/auth/github/start") {
    const state = randomToken();
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare("DELETE FROM oauth_states WHERE expires_at <= ?").bind(now).run();
    await env.DB.prepare("INSERT INTO oauth_states (state, expires_at) VALUES (?, ?)").bind(state, now + 600).run();
    const callback = `${url.origin}/auth/github/callback`;
    const authorize = new URL("https://github.com/login/oauth/authorize");
    authorize.search = new URLSearchParams({ client_id: env.GITHUB_CLIENT_ID, redirect_uri: callback, state }).toString();
    return Response.redirect(authorize, 302);
  }
  if (url.pathname === "/auth/github/callback") {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const now = Math.floor(Date.now() / 1000);
    const valid = state && await env.DB.prepare("DELETE FROM oauth_states WHERE state=? AND expires_at> ? RETURNING state").bind(state, now).first();
    if (!code || !valid) return popupResponse(env, "github-error", "GitHub authorization expired. Please try again.");
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code }),
    });
    const token = await tokenResponse.json();
    if (!tokenResponse.ok || token.error) return popupResponse(env, "github-error", token.error_description || "GitHub authorization failed.");
    const id = randomToken();
    const expiresAt = now + 30 * DAY;
    await env.DB.prepare("INSERT INTO sessions (id, access_token, refresh_token, access_expires_at, refresh_expires_at, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(id, token.access_token, token.refresh_token || null, token.expires_in ? now + token.expires_in : null, token.refresh_token_expires_in ? now + token.refresh_token_expires_in : null, now, expiresAt).run();
    const response = popupResponse(env, "github-connected");
    response.headers.set("set-cookie", sessionCookie(id));
    return response;
  }
  if (url.pathname === "/auth/github/installed") return popupResponse(env, "github-installed");
  if (url.pathname === "/auth/logout" && request.method === "POST") {
    const id = cookieValue(request, SESSION_COOKIE);
    if (id) await env.DB.prepare("DELETE FROM sessions WHERE id=?").bind(id).run();
    return json({ connected: false }, 200, { "set-cookie": sessionCookie("", 0) });
  }
  if (url.pathname.startsWith("/api/")) return apiRequest(request, env, url);
  return json({ error: "Not found" }, 404);
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
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
};
