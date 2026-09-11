const GITHUB_API = "https://api.github.com";
const API_VERSION = "2022-11-28";
const SESSION_COOKIE = "fp_github_session";
const OAUTH_COOKIE = "fp_github_oauth";
const GOOGLE_SESSION_COOKIE = "fp_google_session";
const GOOGLE_OAUTH_COOKIE = "fp_google_oauth";
const GOOGLE_SCOPES = "openid email profile https://www.googleapis.com/auth/drive.file";
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

function bytesFromBase64Url(value) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  return base64ToBytes(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
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
    env.DB.prepare("DELETE FROM google_sessions WHERE expires_at <= ?").bind(now),
    env.DB.prepare("DELETE FROM google_oauth_states WHERE expires_at <= ?").bind(now),
    env.DB.prepare("DELETE FROM rate_limits WHERE reset_at <= ?").bind(now),
  ]);
}

function base64Url(bytes) {
  return bytesToBase64(bytes).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

async function pkceChallenge(verifier) {
  return base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
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

async function getGoogleSession(request, env) {
  const id = cookieValue(request, GOOGLE_SESSION_COOKIE);
  if (!id) return null;
  const now = Math.floor(Date.now() / 1000);
  const session = await env.DB.prepare("SELECT * FROM google_sessions WHERE id=? AND expires_at>?").bind(id, now).first();
  if (!session) return null;
  try {
    session.access_token = await decryptToken(session.access_token, env);
    session.refresh_token = await decryptToken(session.refresh_token, env);
  } catch {
    await env.DB.prepare("DELETE FROM google_sessions WHERE id=?").bind(id).run();
    return null;
  }
  if (session.access_expires_at <= now + 60) {
    if (!session.refresh_token) return null;
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: session.refresh_token,
      }),
    });
    const token = await response.json();
    if (!response.ok || !token.access_token) {
      await env.DB.prepare("DELETE FROM google_sessions WHERE id=?").bind(id).run();
      return null;
    }
    session.access_token = token.access_token;
    session.access_expires_at = now + Number(token.expires_in || 3600);
    await env.DB.prepare("UPDATE google_sessions SET access_token=?, access_expires_at=? WHERE id=?")
      .bind(await encryptToken(session.access_token, env), session.access_expires_at, id).run();
  }
  return session;
}

async function driveFetch(path, token, init = {}) {
  const url = new URL(path, "https://www.googleapis.com");
  url.searchParams.set("supportsAllDrives", "true");
  const response = await fetch(url, {
    ...init,
    headers: { authorization: `Bearer ${token}`, ...init.headers },
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw json({ error: detail.error?.message || `Google Drive returned ${response.status}` }, response.status);
  }
  return response;
}

// v3 omits the ETag resource field. Use Drive's v2 file validator explicitly
// for conditional media writes; never fall back to an unconditional overwrite.
async function driveVersion(fileId, token) {
  const file = await (await driveFetch(`/drive/v2/files/${encodeURIComponent(fileId)}?fields=id,etag`, token)).json();
  if (!file.etag || file.etag === "*" || /^W\//.test(file.etag)) throw json({ error: "Drive did not return a usable version validator. Save a local copy and retry." }, 503);
  return file.etag;
}

async function driveSnapshot(fileId, token) {
  const etag = await driveVersion(fileId, token);
  const response = await driveFetch(`/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, token);
  if (Number(response.headers.get("content-length")) > 20_000_000) throw json({ error: "Document is too large" }, 413);
  const content = await response.text();
  if (content.length > 5_000_000) throw json({ error: "Document is too large" }, 413);
  if (etag !== await driveVersion(fileId, token)) throw json({ error: "Drive changed while it was being read. Reopen the document." }, 409);
  return { content, etag, hash: await digest(content) };
}

function safeDriveId(value) {
  return /^[A-Za-z0-9_-]{10,200}$/.test(value || "");
}

function driveMultipart(metadata, content) {
  const boundary = `fp_${randomToken(16)}`;
  return {
    contentType: `multipart/related; boundary=${boundary}`,
    body: `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${content}\r\n--${boundary}--`,
  };
}

async function googleApiRequest(request, env, url) {
  const session = await getGoogleSession(request, env);
  if (!session) return json({ error: "Not signed in with Google" }, 401);
  if (url.pathname === "/api/google/session") return json({
    connected: true,
    account: { id: session.google_sub, email: session.email, name: session.display_name, picture: session.picture_url },
  });
  if (url.pathname === "/api/google/picker/config" && request.method === "GET") return json({
    accessToken: session.access_token,
    apiKey: env.GOOGLE_API_KEY || "",
    appId: env.GOOGLE_APP_ID || "",
  }, 200, { "cache-control": "no-store" });
  if (url.pathname === "/api/google/drive/files" && request.method === "GET") {
    const fileId = url.searchParams.get("fileId");
    if (!fileId) {
      const query = encodeURIComponent("trashed=false and appProperties has { key='fountainPublisherDocument' and value='true' }");
      const fields = encodeURIComponent("files(id,name,modifiedTime,owners,appProperties,capabilities(canEdit,canShare))");
      const result = await (await driveFetch(`/drive/v3/files?q=${query}&orderBy=modifiedTime desc&pageSize=100&fields=${fields}`, session.access_token)).json();
      return json({ files: result.files || [] });
    }
    if (!safeDriveId(fileId)) return json({ error: "Invalid Drive file" }, 400);
    const metadata = await (await driveFetch(`/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,modifiedTime,owners,appProperties,capabilities(canEdit,canShare)`, session.access_token)).json();
    const content = await (await driveFetch(`/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, session.access_token)).text();
    return json({ file: metadata, content });
  }
  if (url.pathname === "/api/google/drive/files" && request.method === "POST") {
    const body = await request.json();
    if (typeof body.content !== "string" || body.content.length > 5_000_000) return json({ error: "Document content is required and must be under 5 MB" }, 400);
    const name = String(body.name || "Untitled.fountain").trim();
    if (!name || name.length > 200 || /[\\/\0]/.test(name)) return json({ error: "Invalid filename" }, 400);
    const documentId = randomToken(24);
    const upload = driveMultipart({ name, mimeType: "text/plain", appProperties: { fountainPublisherDocument: "true", fountainPublisherDocumentId: documentId } }, body.content);
    const file = await (await driveFetch("/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,appProperties,capabilities(canEdit,canShare)", session.access_token, {
      method: "POST", headers: { "content-type": upload.contentType }, body: upload.body,
    })).json();
    return json({ file }, 201);
  }
  const adoptMatch = url.pathname.match(/^\/api\/google\/drive\/files\/([^/]+)\/adopt$/);
  if (adoptMatch && request.method === "POST") {
    const fileId = decodeURIComponent(adoptMatch[1]);
    if (!safeDriveId(fileId)) return json({ error: "Invalid Drive file" }, 400);
    const fields = encodeURIComponent("id,name,mimeType,modifiedTime,appProperties,capabilities(canEdit,canShare)");
    const existing = await (await driveFetch(`/drive/v3/files/${encodeURIComponent(fileId)}?fields=${fields}`, session.access_token)).json();
    const screenplayTypes = ["text/plain", "text/x-fountain", "application/x-fountain", "application/octet-stream"];
    if (!screenplayTypes.includes(existing.mimeType) || !/\.(?:fountain|txt)$/i.test(existing.name || "")) return json({ error: "Choose a .fountain or .txt screenplay" }, 400);
    if (existing.appProperties?.fountainPublisherDocumentId) return json({ file: existing });
    if (existing.capabilities?.canEdit !== true) return json({ file: existing });
    const version = await (await driveFetch(`/drive/v2/files/${encodeURIComponent(fileId)}?fields=id,etag,properties`, session.access_token)).json();
    const currentIdentity = version.properties?.find((property) => property.key === "fountainPublisherDocumentId" && property.visibility === "PRIVATE")?.value;
    const refetch = async () => (await driveFetch(`/drive/v3/files/${encodeURIComponent(fileId)}?fields=${fields}`, session.access_token)).json();
    if (currentIdentity) return json({ file: await refetch() });
    if (!version.etag || version.etag === "*" || /^W\//.test(version.etag)) return json({ error: "Drive did not return a version validator. Try opening this file again." }, 503);
    const documentId = randomToken(24);
    const properties = (version.properties || []).filter((property) => property.visibility !== "PRIVATE" || !["fountainPublisherDocument", "fountainPublisherDocumentId"].includes(property.key));
    properties.push({ key: "fountainPublisherDocument", value: "true", visibility: "PRIVATE" }, { key: "fountainPublisherDocumentId", value: documentId, visibility: "PRIVATE" });
    try {
      await driveFetch(`/drive/v2/files/${encodeURIComponent(fileId)}?fields=id`, session.access_token, {
        method: "PATCH", headers: { "content-type": "application/json", "if-match": version.etag }, body: JSON.stringify({ properties }),
      });
    } catch (error) {
      if (!(error instanceof Response) || error.status !== 412) throw error;
      const winner = await refetch();
      if (winner.appProperties?.fountainPublisherDocumentId) return json({ file: winner });
      return json({ error: "Drive changed while preparing collaboration. Reopen this file." }, 409);
    }
    return json({ file: await refetch() });
  }
  const fileMatch = url.pathname.match(/^\/api\/google\/drive\/files\/([^/]+)$/);
  if (fileMatch && request.method === "PUT") {
    const fileId = decodeURIComponent(fileMatch[1]);
    if (!safeDriveId(fileId)) return json({ error: "Invalid Drive file" }, 400);
    const body = await request.json();
    if (typeof body.content !== "string" || body.content.length > 5_000_000) return json({ error: "Document content is required and must be under 5 MB" }, 400);
    const file = await (await driveFetch(`/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,appProperties,capabilities(canEdit)`, session.access_token)).json();
    const documentId = file.appProperties?.fountainPublisherDocumentId;
    if (!/^[a-f0-9]{48}$/.test(documentId || "") || file.capabilities?.canEdit !== true) return json({ error: "Open this file in the current editor before saving." }, 409);
    // Old clients cannot overwrite the live room using a stale plain-text
    // snapshot. The room alone decides whether this exact text is saveable.
    const room = env.COLLAB_ROOMS.get(env.COLLAB_ROOMS.idFromName(documentId));
    return room.fetch(new Request(`https://room.internal/checkpoint?fileId=${encodeURIComponent(fileId)}&documentId=${documentId}`, {
      method: "POST", headers: { cookie: request.headers.get("cookie") || "" }, body: JSON.stringify({ expectedContent: body.content }),
    }));
  }
  const permissionMatch = url.pathname.match(/^\/api\/google\/drive\/files\/([^/]+)\/permissions$/);
  if (permissionMatch && request.method === "GET") {
    const fileId = decodeURIComponent(permissionMatch[1]);
    if (!safeDriveId(fileId)) return json({ error: "Invalid Drive file" }, 400);
    const fields = encodeURIComponent("permissions(id,type,role,emailAddress,displayName,photoLink,pendingOwner)");
    const result = await (await driveFetch(`/drive/v3/files/${encodeURIComponent(fileId)}/permissions?fields=${fields}`, session.access_token)).json();
    return json({ permissions: result.permissions || [] });
  }
  if (permissionMatch && request.method === "POST") {
    const fileId = decodeURIComponent(permissionMatch[1]);
    const body = await request.json();
    if (!safeDriveId(fileId)) return json({ error: "Invalid Drive file" }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email || "")) return json({ error: "A valid email address is required" }, 400);
    if (!["reader", "writer"].includes(body.role)) return json({ error: "Role must be reader or writer" }, 400);
    const permission = await (await driveFetch(`/drive/v3/files/${encodeURIComponent(fileId)}/permissions?sendNotificationEmail=true&fields=id,type,role,emailAddress`, session.access_token, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "user", role: body.role, emailAddress: body.email }),
    })).json();
    return json({ permission }, 201);
  }
  const permissionDeleteMatch = url.pathname.match(/^\/api\/google\/drive\/files\/([^/]+)\/permissions\/([^/]+)$/);
  if (permissionDeleteMatch && request.method === "DELETE") {
    const fileId = decodeURIComponent(permissionDeleteMatch[1]);
    const permissionId = decodeURIComponent(permissionDeleteMatch[2]);
    if (!safeDriveId(fileId) || !safeDriveId(permissionId)) return json({ error: "Invalid Drive permission" }, 400);
    await driveFetch(`/drive/v3/files/${encodeURIComponent(fileId)}/permissions/${encodeURIComponent(permissionId)}`, session.access_token, { method: "DELETE" });
    return json({ removed: true });
  }
  return json({ error: "Not found" }, 404);
}

async function authorizeCollaboration(request, env, url) {
  const checkpoint = url.pathname.endsWith("/checkpoint") && request.method === "POST";
  const recovery = url.pathname.endsWith("/recovery") && request.method === "GET";
  if (!checkpoint && !recovery && request.headers.get("upgrade")?.toLowerCase() !== "websocket") return json({ error: "WebSocket upgrade required" }, 426);
  if (request.headers.get("origin") !== env.APP_ORIGIN) return json({ error: "Invalid request origin" }, 403);
  const session = await getGoogleSession(request, env);
  if (!session) return json({ error: "Not signed in with Google" }, 401);
  const match = url.pathname.match(/^\/api\/collaboration\/([a-f0-9]{48})(?:\/(?:checkpoint|recovery))?$/);
  const fileId = url.searchParams.get("fileId");
  if (!match || !safeDriveId(fileId)) return json({ error: "Invalid collaboration room" }, 400);
  const fields = "id,trashed,appProperties,capabilities(canEdit)";
  const file = await (await driveFetch(`/drive/v3/files/${encodeURIComponent(fileId)}?fields=${encodeURIComponent(fields)}`, session.access_token)).json();
  if (file.trashed || file.appProperties?.fountainPublisherDocumentId !== match[1]) return json({ error: "Document identity mismatch" }, 403);
  const room = env.COLLAB_ROOMS.get(env.COLLAB_ROOMS.idFromName(match[1]));
  if (recovery) return room.fetch(new Request(`https://room.internal/recovery?fileId=${encodeURIComponent(fileId)}&documentId=${match[1]}`, {
    headers: { cookie: request.headers.get("cookie") || "" },
  }));
  if (checkpoint) return room.fetch(new Request(`https://room.internal/checkpoint?fileId=${encodeURIComponent(fileId)}&documentId=${match[1]}`, {
    method: "POST", headers: { cookie: request.headers.get("cookie") || "" }, body: request.body,
  }));
  const headers = new Headers(request.headers);
  headers.set("x-fp-user-id", session.google_sub);
  headers.set("x-fp-user-name", session.display_name || session.email);
  headers.set("x-fp-user-email", session.email);
  headers.set("x-fp-can-edit", String(file.capabilities?.canEdit === true));
  headers.set("x-fp-session-id", cookieValue(request, GOOGLE_SESSION_COOKIE));
  headers.set("x-fp-file-id", fileId);
  headers.set("x-fp-document-id", match[1]);
  headers.set("x-fp-authorized-until", String(Math.floor(Date.now() / 1000) + 30));
  const snapshot = await driveSnapshot(fileId, session.access_token);
  const initialized = await room.fetch(new Request("https://room.internal/initialize", { method: "POST", body: JSON.stringify({ fileId, documentId: match[1], ...snapshot }) }));
  if (!initialized.ok) return initialized;
  return room.fetch(new Request(request, { headers }));
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
  if (url.pathname === "/auth/google/start") {
    const limited = await rateLimited(request, env, "google-oauth-start", 10, 600);
    if (limited) return limited;
    const state = randomToken();
    const binding = randomToken();
    const verifier = base64Url(crypto.getRandomValues(new Uint8Array(48)));
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare("INSERT INTO google_oauth_states (state,binding_hash,pkce_verifier,expires_at) VALUES (?,?,?,?)")
      .bind(state, await digest(binding), verifier, now + 600).run();
    const authorize = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authorize.search = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: `${url.origin}/auth/google/callback`,
      response_type: "code",
      scope: GOOGLE_SCOPES,
      access_type: "offline",
      include_granted_scopes: "true",
      prompt: "consent",
      state,
      code_challenge: await pkceChallenge(verifier),
      code_challenge_method: "S256",
    }).toString();
    return new Response(null, { status: 302, headers: { location: authorize.toString(), "set-cookie": secureCookie(GOOGLE_OAUTH_COOKIE, binding, 600) } });
  }
  if (url.pathname === "/auth/google/callback") {
    const limited = await rateLimited(request, env, "google-oauth-callback", 20, 600);
    if (limited) return limited;
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const binding = cookieValue(request, GOOGLE_OAUTH_COOKIE);
    const now = Math.floor(Date.now() / 1000);
    const valid = state && binding && await env.DB.prepare("DELETE FROM google_oauth_states WHERE state=? AND expires_at>? AND binding_hash=? RETURNING pkce_verifier")
      .bind(state, now, await digest(binding)).first();
    if (!code || !valid) return popupResponse(env, "google-error", "Google authorization expired. Please try again.");
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${url.origin}/auth/google/callback`,
        grant_type: "authorization_code",
        code_verifier: valid.pkce_verifier,
      }),
    });
    const token = await tokenResponse.json();
    if (!tokenResponse.ok || !token.access_token) return popupResponse(env, "google-error", "Google authorization failed.");
    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${token.access_token}` } });
    const profile = await profileResponse.json();
    if (!profileResponse.ok || !profile.sub || !profile.email || profile.email_verified !== true) return popupResponse(env, "google-error", "Google did not return a verified account.");
    const id = randomToken();
    const expiresAt = now + 30 * DAY;
    await env.DB.prepare("INSERT INTO google_sessions (id,google_sub,email,display_name,picture_url,access_token,refresh_token,access_expires_at,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
      .bind(id, profile.sub, profile.email, profile.name || null, profile.picture || null, await encryptToken(token.access_token, env), await encryptToken(token.refresh_token, env), now + Number(token.expires_in || 3600), now, expiresAt).run();
    const response = popupResponse(env, "google-connected");
    response.headers.append("set-cookie", secureCookie(GOOGLE_SESSION_COOKIE, id, 30 * DAY));
    response.headers.append("set-cookie", secureCookie(GOOGLE_OAUTH_COOKIE, "", 0));
    return response;
  }
  if (url.pathname === "/auth/google/logout" && request.method === "POST") {
    const id = cookieValue(request, GOOGLE_SESSION_COOKIE);
    if (id) await env.DB.prepare("DELETE FROM google_sessions WHERE id=?").bind(id).run();
    return json({ connected: false }, 200, { "set-cookie": secureCookie(GOOGLE_SESSION_COOKIE, "", 0) });
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
  if (url.pathname.startsWith("/api/google/")) {
    const limited = await rateLimited(request, env, "google-api", 180, 60);
    if (limited) return limited;
    return googleApiRequest(request, env, url);
  }
  if (url.pathname.startsWith("/api/collaboration/")) return authorizeCollaboration(request, env, url);
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
    if (!["GET", "HEAD"].includes(request.method) && request.headers.get("origin") !== env.APP_ORIGIN) {
      return json({ error: "Invalid request origin" }, 403, cors);
    }
    if (Math.random() < 0.01) context.waitUntil(cleanupExpired(env));
    try {
      const response = await handle(request, env);
      // WebSocket upgrade responses have immutable headers in the Workers runtime.
      if (response.status !== 101) Object.entries(cors).forEach(([key, value]) => response.headers.set(key, value));
      return response;
    } catch (error) {
      if (error instanceof Response) {
        Object.entries(cors).forEach(([key, value]) => error.headers.set(key, value));
        return error;
      }
      console.error("Worker request failed", error?.stack || error);
      return json({ error: "GitHub integration failed" }, 500, cors);
    }
  },
  async scheduled(_controller, env, context) {
    context.waitUntil(cleanupExpired(env));
  },
};

const ROOM_CHUNK_BYTES = 60 * 1024;
const MAX_ROOM_BYTES = 12 * 1024 * 1024;
const MAX_ROOM_MESSAGE = 17 * 1024 * 1024;

function publicIdentity(identity) {
  if (!identity) return null;
  const { id, name, email, canEdit, connectionId } = identity;
  return { id, name, email, canEdit, connectionId };
}

export class CollaborationRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.document = new Y.Doc();
    this.queue = Promise.resolve();
    this.ready = state.blockConcurrencyWhile(async () => {
      this.meta = await state.storage.get("room-meta") || null;
      const layout = await state.storage.get("snapshot-layout");
      this.snapshotChunks = layout?.chunks || 0;
      if (layout) {
        if (layout.bytes > MAX_ROOM_BYTES || layout.chunks > Math.ceil(MAX_ROOM_BYTES / ROOM_CHUNK_BYTES)) throw new Error("Invalid room snapshot");
        const snapshot = new Uint8Array(layout.bytes);
        for (let index = 0; index < layout.chunks; index += 1) {
          const chunk = await state.storage.get(`snapshot-${index}`);
          if (!chunk) throw new Error("Incomplete room snapshot");
          snapshot.set(new Uint8Array(chunk), index * ROOM_CHUNK_BYTES);
        }
        Y.applyUpdate(this.document, snapshot);
      } else {
        const snapshot = await state.storage.get("yjs-snapshot");
        if (snapshot) Y.applyUpdate(this.document, new Uint8Array(snapshot));
      }
      this.initialized = await state.storage.get("initialized") === true;
    });
  }

  // Durable Object requests can interleave across awaits. Serialize document
  // mutation, durable acknowledgment, and Drive writes as one ordered stream.
  run(operation) {
    const result = this.queue.then(async () => { await this.ready; return operation(); });
    this.queue = result.catch(() => {});
    return result;
  }

  async persist(document = this.document, meta = this.meta) {
    const snapshot = Y.encodeStateAsUpdate(document);
    if (snapshot.length > MAX_ROOM_BYTES) throw json({ error: "The collaboration history is too large. Save a copy as a new document." }, 413);
    const chunks = Math.ceil(snapshot.length / ROOM_CHUNK_BYTES);
    await this.state.storage.transaction(async (storage) => {
      for (let index = 0; index < chunks; index += 1) await storage.put(`snapshot-${index}`, snapshot.slice(index * ROOM_CHUNK_BYTES, (index + 1) * ROOM_CHUNK_BYTES));
      for (let index = chunks; index < this.snapshotChunks; index += 1) await storage.delete(`snapshot-${index}`);
      await storage.put({ initialized: true, "snapshot-layout": { chunks, bytes: snapshot.length }, "room-meta": meta });
      await storage.delete("yjs-snapshot");
    });
    this.snapshotChunks = chunks;
  }

  fetch(request) {
    return this.run(() => this.handleFetch(request)).catch((error) => {
      if (error instanceof Response) return error;
      throw error;
    });
  }

  async handleFetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/initialized") return json({ initialized: this.initialized });
    if (url.pathname === "/initialize" && request.method === "POST") {
      const input = await request.json();
      if (!safeDriveId(input.fileId) || !/^[a-f0-9]{48}$/.test(input.documentId || "") || typeof input.content !== "string" || input.content.length > 5_000_000) return json({ error: "Invalid document initialization" }, 400);
      if (this.meta && (this.meta.fileId !== input.fileId || this.meta.documentId !== input.documentId)) return json({ error: "This room belongs to another Drive file" }, 403);
      const hash = await digest(input.content);
      if (this.initialized && !this.meta && this.document.getText("source").toString() !== input.content) return json({ error: "Legacy live room and Drive differ. Preserve both versions before continuing." }, 409);
      if (this.meta && hash !== this.meta.driveHash && hash !== this.meta.pendingCheckpoint?.hash) return json({ error: "Drive was edited outside the live room. Save a local copy and resolve both versions before continuing." }, 409);
      const document = this.initialized ? this.document : new Y.Doc();
      if (!this.initialized) document.getText("source").insert(0, input.content);
      const meta = this.meta || { fileId: input.fileId, documentId: input.documentId, driveHash: hash, revision: 0, savedRevision: 0 };
      await this.persist(document, meta);
      this.document = document;
      this.meta = meta;
      this.initialized = true;
      return json({ initialized: true });
    }
    if (url.pathname === "/checkpoint" && request.method === "POST") {
      if (!this.meta || this.meta.fileId !== url.searchParams.get("fileId") || this.meta.documentId !== url.searchParams.get("documentId")) return json({ error: "Open the live document before saving" }, 409);
      return this.checkpoint(request);
    }
    if (url.pathname === "/recovery" && request.method === "GET") {
      if (!this.meta || this.meta.fileId !== url.searchParams.get("fileId") || this.meta.documentId !== url.searchParams.get("documentId")) return json({ error: "This legacy room has no verified Drive-file binding. Its content cannot safely be disclosed through a copied file. Preserve any existing browser/local copy." }, 409);
      const session = await getGoogleSession(request, this.env);
      if (!session) return json({ error: "Sign in again before recovering this document" }, 401);
      const authorized = await this.authorize({ id: session.google_sub, sessionId: cookieValue(request, GOOGLE_SESSION_COOKIE) }, true);
      const snapshot = await driveSnapshot(this.meta.fileId, authorized.session.access_token);
      return json({ roomContent: this.document.getText("source").toString(), driveContent: snapshot.content, file: authorized.file }, 200, { "cache-control": "no-store" });
    }
    if (!this.meta || this.meta.fileId !== request.headers.get("x-fp-file-id") || this.meta.documentId !== request.headers.get("x-fp-document-id")) return json({ error: "Room binding mismatch" }, 403);
    if (url.searchParams.get("protocol") !== "2") return json({ error: "Reload Fountain Publisher to update collaboration" }, 409);
    if (this.state.getWebSockets().length >= 100) return json({ error: "Collaboration room is full" }, 503);
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    const identity = {
      id: request.headers.get("x-fp-user-id"), name: request.headers.get("x-fp-user-name"), email: request.headers.get("x-fp-user-email"),
      canEdit: request.headers.get("x-fp-can-edit") === "true", sessionId: request.headers.get("x-fp-session-id"),
      authorizedUntil: Number(request.headers.get("x-fp-authorized-until")), connectionId: randomToken(12),
    };
    // Initialization/queued work may have outlived the upstream read lease.
    // Revalidate before the very first byte of room content is disclosed.
    await this.authorize(identity);
    this.state.acceptWebSocket(server);
    server.serializeAttachment(identity);
    server.send(JSON.stringify({ type: "sync", protocol: 2, update: base64Url(Y.encodeStateAsUpdate(this.document)), stateVector: base64Url(Y.encodeStateVector(this.document)), self: publicIdentity(identity) }));
    for (const existing of this.state.getWebSockets()) {
      if (existing === server) continue;
      const user = existing.deserializeAttachment();
      if (user) server.send(JSON.stringify({ type: "presence", action: "join", user: publicIdentity(user), presence: user.presence || null }));
    }
    await this.broadcast({ type: "presence", action: "join", user: publicIdentity(identity) }, server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async authorize(identity, force = false) {
    if (!identity?.sessionId || !this.meta) throw json({ error: "Authorization expired. Sign in again." }, 401);
    if (!force && identity.authorizedUntil > Math.floor(Date.now() / 1000)) return null;
    const request = new Request("https://room.internal/session", { headers: { cookie: `${GOOGLE_SESSION_COOKIE}=${encodeURIComponent(identity.sessionId)}` } });
    const session = await getGoogleSession(request, this.env);
    if (!session || session.google_sub !== identity.id) throw json({ error: "Authorization expired. Sign in again." }, 401);
    const file = await (await driveFetch(`/drive/v3/files/${encodeURIComponent(this.meta.fileId)}?fields=id,name,trashed,appProperties,capabilities(canEdit,canShare)`, session.access_token)).json();
    if (file.trashed || file.appProperties?.fountainPublisherDocumentId !== this.meta.documentId) throw json({ error: "Document access or identity changed" }, 403);
    identity.canEdit = file.capabilities?.canEdit === true;
    identity.authorizedUntil = Math.floor(Date.now() / 1000) + 30;
    return { session, file };
  }

  webSocketMessage(socket, message) {
    return this.run(async () => {
      try { await this.handleMessage(socket, message); }
      catch (error) {
        // No acknowledgment is sent for an unpersisted update. Reconnect can
        // retry its idempotent Yjs delta after a transient storage failure.
        socket.close(error instanceof Response && [401, 403, 404].includes(error.status) ? 4003 : 4000, "Collaboration could not verify or persist this change");
      }
    });
  }

  async handleMessage(socket, message) {
    if (typeof message !== "string" || message.length > MAX_ROOM_MESSAGE) return socket.close(1009, "Message too large; save a local copy");
    let payload;
    try { payload = JSON.parse(message); } catch { return socket.close(1003, "Invalid message"); }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return socket.close(1003, "Invalid message");
    const identity = socket.deserializeAttachment();
    await this.authorize(identity, payload.type === "update");
    socket.serializeAttachment(identity);
    if (payload.type === "update") {
      if (!identity.canEdit) return socket.close(4003, "Editing permission was removed; save a local copy");
      if (payload.protocol !== 2 || !Number.isSafeInteger(payload.id) || payload.id < 1) return socket.close(4010, "Reload the editor before collaborating");
      let update;
      try { update = bytesFromBase64Url(payload.update || ""); } catch { return socket.close(1003, "Invalid update"); }
      if (!update.length || update.length > MAX_ROOM_BYTES) return socket.close(1009, "Update too large; save a local copy");
      const candidate = new Y.Doc();
      try {
        Y.applyUpdate(candidate, Y.encodeStateAsUpdate(this.document));
        Y.applyUpdate(candidate, update);
        const source = candidate.getText("source");
        if (candidate.share.size !== 1 || source.length > 5_000_000 || source.toDelta().some((item) => typeof item.insert !== "string" || item.attributes)) return socket.close(1009, "Unsupported document content; save a local copy");
        const meta = { ...this.meta, revision: this.meta.revision + 1, checkpointSessionId: identity.sessionId };
        // Schedule before committing the new durable revision: if scheduling
        // fails there is no ACK; if snapshot persistence fails the alarm is a
        // harmless no-op against the preceding revision. This also saves after
        // the last browser closes, without trusting a browser checkpoint timer.
        await this.state.storage.setAlarm(Date.now() + 2000);
        await this.persist(candidate, meta);
        Y.applyUpdate(this.document, update);
        this.meta = meta;
      } finally { candidate.destroy(); }
      socket.send(JSON.stringify({ type: "ack", id: payload.id, revision: this.meta.revision, stateVector: base64Url(Y.encodeStateVector(this.document)) }));
      await this.broadcast({ type: "update", update: payload.update, sender: identity.connectionId }, socket);
      return;
    }
    if (payload.type === "presence") {
      const presence = payload.presence || {};
      const position = (value) => Number.isSafeInteger(value) && value >= 0 && value <= this.document.getText("source").length ? value : null;
      const safePresence = {
        cursor: position(presence.cursor), selectionStart: position(presence.selectionStart), selectionEnd: position(presence.selectionEnd),
        mode: ["source", "preview", "beats"].includes(presence.mode) ? presence.mode : null,
      };
      identity.presence = safePresence;
      socket.serializeAttachment(identity);
      await this.broadcast({ type: "presence", action: "update", user: publicIdentity(identity), presence: safePresence }, socket);
      return;
    }
    socket.close(1003, "Unknown message type");
  }

  async checkpoint(request) {
    const session = await getGoogleSession(request, this.env);
    if (!session) return json({ error: "Sign in again before saving" }, 401);
    const identity = { id: session.google_sub, sessionId: cookieValue(request, GOOGLE_SESSION_COOKIE) };
    const authorized = await this.authorize(identity, true);
    if (!identity.canEdit) return json({ error: "Editing permission was removed. Save a local copy." }, 403);
    const body = await request.json();
    const content = this.document.getText("source").toString();
    if (body.expectedContent !== content) return json({ error: "The live document changed before Save. Wait for synchronization and try again." }, 409);
    const snapshot = await driveSnapshot(this.meta.fileId, authorized.session.access_token);
    const hash = await digest(content);
    const knownHash = this.meta.driveHash;
    if (snapshot.hash !== knownHash && snapshot.hash !== this.meta.pendingCheckpoint?.hash) return json({ error: "Drive was edited outside the live room. Save a local copy before resolving the conflict." }, 412);
    if (snapshot.hash !== hash) {
      const pendingMeta = {
        ...this.meta,
        // A previous upload may have succeeded even if its response/final
        // persistence was lost. Adopt that proven Drive baseline before
        // replacing its intent, so another failed upload remains retryable.
        driveHash: snapshot.hash,
        savedRevision: snapshot.hash === this.meta.pendingCheckpoint?.hash ? this.meta.pendingCheckpoint.revision : this.meta.savedRevision,
        pendingCheckpoint: { hash, revision: this.meta.revision },
      };
      await this.state.storage.put("room-meta", pendingMeta);
      this.meta = pendingMeta;
      // Persist intent before the external write so retries after response loss
      // recognize our own completed write, but not an unrelated Drive edit.
      await driveFetch(`/upload/drive/v2/files/${encodeURIComponent(this.meta.fileId)}?uploadType=media&fields=id,etag`, authorized.session.access_token, {
        method: "PUT", headers: { "content-type": "text/plain; charset=UTF-8", "if-match": snapshot.etag }, body: content,
      });
    }
    const meta = { ...this.meta, driveHash: hash, savedRevision: this.meta.revision, pendingCheckpoint: null };
    await this.state.storage.put("room-meta", meta);
    this.meta = meta;
    return json({ file: authorized.file, content, saved: true, revision: meta.savedRevision });
  }

  alarm() {
    return this.run(async () => {
      if (!this.meta?.checkpointSessionId || this.meta.savedRevision >= this.meta.revision) return;
      try {
        const response = await this.checkpoint(new Request("https://room.internal/checkpoint", {
          method: "POST", headers: { cookie: `${GOOGLE_SESSION_COOKIE}=${encodeURIComponent(this.meta.checkpointSessionId)}` },
          body: JSON.stringify({ expectedContent: this.document.getText("source").toString() }),
        }));
        if (!response.ok) throw response;
        const result = await response.json();
        // File capabilities are user-specific; never broadcast the last
        // writer's permissions to viewers as though they were their own.
        await this.broadcast({ type: "checkpoint", result: { ...result, file: { id: this.meta.fileId } } });
      } catch (error) {
        const terminal = error instanceof Response && [401, 403, 404, 409, 412].includes(error.status);
        await this.broadcast({ type: "checkpoint-status", status: "save-error", detail: terminal
          ? "Drive saving is paused because permissions or the Drive file changed. Save a local copy before resolving the conflict."
          : "Drive saving failed. The live room retains acknowledged edits and will retry." });
        // Cloudflare retries thrown alarm failures. Permanent permission/content
        // conflicts remain in the durable room and require explicit recovery.
        if (!terminal) throw error;
      }
    });
  }

  webSocketClose(socket) { return this.run(() => this.broadcast({ type: "presence", action: "leave", user: publicIdentity(socket.deserializeAttachment()) }, socket)); }

  async broadcast(payload, except = null) {
    const message = JSON.stringify(payload);
    for (const socket of this.state.getWebSockets()) if (socket !== except) {
      try {
        const identity = socket.deserializeAttachment();
        await this.authorize(identity);
        socket.serializeAttachment(identity);
        socket.send(message);
      } catch { socket.close(4003, "Document permission could not be revalidated"); }
    }
  }
}
import * as Y from "yjs";
