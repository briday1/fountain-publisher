import { HttpError, json, sameOrigin, now } from "./http.mjs";
import {
  premium,
  randomToken,
  hash,
  readCookie,
  verifyGoogleToken,
} from "./accounts.mjs";

const ORIGIN = "https://writeshape.com";
const CALLBACK = `${ORIGIN}/api/drive/callback`;
const SCOPE = "https://www.googleapis.com/auth/drive";
const STATE_COOKIE = "__Host-writeshape_drive_oauth";
const MAX_BYTES = 2_000_000;
const encoder = new TextEncoder();
const folderType = "application/vnd.google-apps.folder";
const unavailable = "Google Drive is not configured for WriteShape yet.";
const conflict = (
  message = "This file changed on Google Drive. Open its latest version or save a new copy.",
) => {
  const error = new HttpError(409, message);
  error.code = "DRIVE_CONFLICT";
  throw error;
};
const connectionChanged = () => {
  throw new HttpError(
    409,
    "Your Google Drive connection changed. Reopen the file before trying again.",
  );
};
const cookie = (value, seconds) =>
  `${STATE_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${seconds}`;
function b64(bytes) {
  return btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""));
}
function unb64(value) {
  return Uint8Array.from(
    atob(value.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0),
  );
}
function keyBytes(env) {
  try {
    if (
      typeof env.DRIVE_TOKEN_KEY !== "string" ||
      !/^[A-Za-z0-9+/_-]{43}=?$/.test(env.DRIVE_TOKEN_KEY)
    )
      return null;
    const bytes = unb64(env.DRIVE_TOKEN_KEY);
    return bytes.length === 32 ? bytes : null;
  } catch {
    return null;
  }
}
export function driveConfigured(env) {
  return Boolean(
    env.APP_ORIGIN === ORIGIN &&
    env.GOOGLE_CLIENT_ID &&
    env.GOOGLE_CLIENT_SECRET &&
    keyBytes(env),
  );
}
async function encrypt(env, account, purpose, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes(env),
    "AES-GCM",
    false,
    ["encrypt"],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: encoder.encode(`writeshape:drive:${purpose}:${account}`),
    },
    key,
    encoder.encode(JSON.stringify(value)),
  );
  return `v1.${b64(iv)}.${b64(new Uint8Array(cipher))}`;
}
async function decrypt(env, account, purpose, value) {
  try {
    const [version, iv, data] = value.split(".");
    if (version !== "v1") throw new Error();
    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes(env),
      "AES-GCM",
      false,
      ["decrypt"],
    );
    const plain = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: unb64(iv),
        additionalData: encoder.encode(
          `writeshape:drive:${purpose}:${account}`,
        ),
      },
      key,
      unb64(data),
    );
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(plain));
  } catch {
    throw new HttpError(
      503,
      "Google Drive connection needs attention. Reconnect Drive to continue.",
    );
  }
}
function validId(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,200}$/.test(value))
    throw new HttpError(400, "Choose a valid Google Drive file or folder.");
  return value;
}
function validEtag(value) {
  return (
    typeof value === "string" &&
    value.length <= 512 &&
    /^"[^"\x00-\x20\x7f]+"$/.test(value)
  );
}
function validFile(file) {
  if (
    !file ||
    file.trashed ||
    typeof file.name !== "string" ||
    !/\.(fountain|txt|md|markdown)$/i.test(file.name) ||
    typeof file.mimeType !== "string" ||
    file.mimeType.startsWith("application/vnd.google-apps.")
  )
    throw new HttpError(400, "Choose a Markdown, Fountain or text file.");
  if (file.size !== undefined && Number(file.size) > MAX_BYTES)
    throw new HttpError(413, "File too large (2 MB maximum).");
  return file;
}
async function boundedText(response, maximum = MAX_BYTES) {
  if (Number(response.headers.get("Content-Length")) > maximum)
    throw new HttpError(413, "File too large (2 MB maximum).");
  if (!response.body) return "";
  const reader = response.body.getReader();
  let length = 0;
  const chunks = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maximum) {
        await reader.cancel();
        throw new HttpError(413, "File too large (2 MB maximum).");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if (text.includes("\0")) throw new Error();
      return text;
    } catch {
      throw new HttpError(400, "Choose a UTF-8 Markdown, Fountain or text file.");
    }
  } finally {
    reader.releaseLock();
  }
}
async function inputBody(request) {
  if (!request.headers.get("Content-Type")?.startsWith("application/json"))
    throw new HttpError(415, "Expected JSON.");
  // JSON escaping can expand a 2 MB document up to sixfold. Bound transport separately.
  const raw = await boundedText(request, MAX_BYTES * 6 + 4096);
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    throw new HttpError(400, "Invalid file details.");
  }
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new HttpError(400, "Invalid file details.");
  return input;
}
function content(value) {
  if (
    typeof value !== "string" ||
    value.includes("\0") ||
    new TextDecoder().decode(encoder.encode(value)) !== value
  )
    throw new HttpError(400, "Choose UTF-8 text content.");
  if (encoder.encode(value).length > MAX_BYTES)
    throw new HttpError(413, "File too large (2 MB maximum).");
  return value;
}
function fileResult(file, text, etag) {
  return {
    id: file.id,
    name: file.name,
    content: text,
    etag,
    modifiedTime: file.modifiedTime || null,
    canEdit: file.capabilities?.canEdit === true,
  };
}

// Injection is for offline fixture tests; the production export always uses fetch and
// the existing cryptographic Google ID-token verifier. No browser controls these dependencies.
export function createDriveRoutes({
  fetch: network = globalThis.fetch,
  verifyIdToken = verifyGoogleToken,
} = {}) {
  async function external(url, init = {}) {
    try {
      return await network(url, {
        ...init,
        // Workerd supports manual/follow only. Never forward credentials through redirects.
        redirect: "manual",
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new HttpError(
        503,
        "Google Drive is temporarily unavailable. Your local writing is unchanged.",
      );
    }
  }
  async function tokenRequest(env, params) {
    const response = await external("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        ...params,
      }),
    });
    if (!response.ok)
      throw new HttpError(
        response.status === 400 || response.status === 401 ? 401 : 503,
        "Google Drive authorization could not be refreshed. Reconnect Drive to continue.",
      );
    let tokens;
    try {
      tokens = await response.json();
    } catch {
      throw new HttpError(
        503,
        "Google returned an invalid authorization response.",
      );
    }
    if (
      typeof tokens.access_token !== "string" ||
      !tokens.access_token ||
      !Number.isFinite(tokens.expires_in) ||
      tokens.expires_in <= 0 ||
      tokens.expires_in > 86400 ||
      (tokens.token_type || "").toLowerCase() !== "bearer"
    )
      throw new HttpError(
        503,
        "Google returned an invalid authorization response.",
      );
    return tokens;
  }
  async function connection(env, account) {
    let row = await env.DB.prepare(
      "SELECT * FROM drive_connections WHERE account_id=?",
    )
      .bind(account.id)
      .first();
    if (!row) throw new HttpError(401, "Connect Google Drive to continue.");
    let tokens = await decrypt(env, account.id, "tokens", row.token_cipher);
    if (row.expires <= now() + 60) {
      const lock = randomToken();
      const claim = await env.DB.prepare(
        "UPDATE drive_connections SET refresh_lock=?,refresh_until=? WHERE account_id=? AND generation=? AND token_cipher=? AND refresh_until<=?",
      )
        .bind(
          lock,
          now() + 45,
          account.id,
          row.generation,
          row.token_cipher,
          now(),
        )
        .run();
      if (!claim.meta.changes)
        throw new HttpError(
          409,
          "Google Drive is refreshing its connection. Try again shortly.",
        );
      try {
        const refreshed = await tokenRequest(env, {
          grant_type: "refresh_token",
          refresh_token: tokens.refreshToken,
        });
        if (
          refreshed.scope &&
          !String(refreshed.scope).split(" ").includes(SCOPE)
        )
          throw new HttpError(
            403,
            "Reconnect Google Drive and approve file access.",
          );
        tokens = {
          accessToken: refreshed.access_token,
          refreshToken: refreshed.refresh_token || tokens.refreshToken,
        };
        const cipher = await encrypt(env, account.id, "tokens", tokens);
        const saved = await env.DB.prepare(
          "UPDATE drive_connections SET token_cipher=?,expires=?,refresh_lock=NULL,refresh_until=0,updated=? WHERE account_id=? AND generation=? AND refresh_lock=?",
        )
          .bind(
            cipher,
            now() + refreshed.expires_in,
            now(),
            account.id,
            row.generation,
            lock,
          )
          .run();
        if (!saved.meta.changes) connectionChanged();
      } finally {
        await env.DB.prepare(
          "UPDATE drive_connections SET refresh_lock=NULL,refresh_until=0 WHERE account_id=? AND generation=? AND refresh_lock=?",
        )
          .bind(account.id, row.generation, lock)
          .run();
      }
    }
    return { ...row, accessToken: tokens.accessToken };
  }
  async function assertConnection(env, account, current) {
    const active = await env.DB.prepare(
      "SELECT generation FROM drive_connections WHERE account_id=?",
    )
      .bind(account.id)
      .first();
    if (active?.generation !== current.generation) connectionChanged();
  }
  async function drive(env, account, current, path, init = {}) {
    await assertConnection(env, account, current);
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${current.accessToken}`);
    const response = await external(`https://www.googleapis.com${path}`, {
      ...init,
      headers,
    });
    if (response.status === 412 || response.status === 409) conflict();
    if (response.status === 401)
      throw new HttpError(401, "Reconnect Google Drive to continue.");
    if (response.status === 403)
      throw new HttpError(
        403,
        "Google Drive did not allow this operation. Check file access and try again.",
      );
    if (response.status === 404)
      throw new HttpError(
        404,
        "Google Drive file not found or no longer accessible.",
      );
    if (!response.ok)
      throw new HttpError(
        503,
        "Google Drive is temporarily unavailable. Your local writing is unchanged.",
      );
    return response;
  }
  async function data(env, account, current, path, init) {
    const response = await drive(env, account, current, path, init);
    try {
      return await response.json();
    } catch {
      throw new HttpError(503, "Google Drive returned an invalid response.");
    }
  }
  async function version(env, account, current, id) {
    const result = await data(
      env,
      account,
      current,
      `/drive/v2/files/${id}?fields=id,etag&supportsAllDrives=true`,
    );
    if (!validEtag(result.etag))
      throw new HttpError(
        503,
        "Drive did not supply a version check. Reopen the file before saving.",
      );
    return result.etag;
  }
  async function metadata(env, account, current, id) {
    return data(
      env,
      account,
      current,
      `/drive/v3/files/${id}?fields=id,name,mimeType,size,modifiedTime,trashed,capabilities(canEdit,canAddChildren)&supportsAllDrives=true`,
    );
  }
  async function open(env, account, current, id) {
    // ETag brackets both metadata and content reads, avoiding mixed-version results.
    const before = await version(env, account, current, id);
    const file = validFile(await metadata(env, account, current, id));
    const text = await boundedText(
      await drive(
        env,
        account,
        current,
        `/drive/v3/files/${id}?alt=media&supportsAllDrives=true`,
      ),
    );
    const after = await version(env, account, current, id);
    if (before !== after)
      conflict("This file changed while opening. Try again.");
    return fileResult(file, text, after);
  }

  return async function route(request, env, account) {
    const url = new URL(request.url),
      path = url.pathname;
    if (path !== "/api/drive" && !path.startsWith("/api/drive/")) return null;
    if (!account)
      throw new HttpError(401, "Sign in to your WriteShape account.");
    const configured = driveConfigured(env);
    if (path === "/api/drive/status" && request.method === "GET") {
      if (!configured)
        return json({
          configured: false,
          connected: false,
          email: null,
          canWrite: false,
          reason: unavailable,
        });
      const linked = await env.DB.prepare(
        "SELECT email FROM drive_connections WHERE account_id=?",
      )
        .bind(account.id)
        .first();
      return json({
        configured: true,
        connected: Boolean(linked),
        email: linked?.email || null,
        canWrite: Boolean(linked && premium(account)),
        reason: !linked
          ? "Connect your Google Drive account."
          : !premium(account)
            ? "Premium is required to save to Google Drive. You can still open and download your files."
            : null,
      });
    }
    if (request.method === "POST") {
      sameOrigin(request);
      if (path !== "/api/drive/disconnect" && !premium(account))
        throw new HttpError(
          403,
          "Premium is required to connect or save to Google Drive.",
        );
    }
    if (path === "/api/drive/disconnect" && request.method === "POST") {
      // Invalidate pending callbacks and remove local authorization atomically. No
      // remote revoke: Google revocation can revoke this client's separate sign-in grant.
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO drive_link_state(account_id,epoch) VALUES (?,?) ON CONFLICT(account_id) DO UPDATE SET epoch=excluded.epoch",
        ).bind(account.id, randomToken()),
        env.DB.prepare(
          "DELETE FROM drive_oauth_attempts WHERE account_id=?",
        ).bind(account.id),
        env.DB.prepare("DELETE FROM drive_connections WHERE account_id=?").bind(
          account.id,
        ),
      ]);
      const response = json({ disconnected: true });
      response.headers.set("Set-Cookie", cookie("", 0));
      return response;
    }
    if (!configured) throw new HttpError(503, unavailable);
    if (path === "/api/drive/connect" && request.method === "POST") {
      const state = randomToken(),
        verifier = randomToken(),
        nonce = randomToken(),
        epoch = randomToken();
      const challenge = b64(
        new Uint8Array(
          await crypto.subtle.digest("SHA-256", encoder.encode(verifier)),
        ),
      )
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO drive_link_state(account_id,epoch) VALUES (?,?) ON CONFLICT(account_id) DO UPDATE SET epoch=excluded.epoch",
        ).bind(account.id, epoch),
        env.DB.prepare(
          "DELETE FROM drive_oauth_attempts WHERE account_id=? OR expires<=?",
        ).bind(account.id, now()),
        env.DB.prepare(
          "INSERT INTO drive_oauth_attempts VALUES (?,?,?,?,?,?)",
        ).bind(
          await hash(state),
          account.id,
          epoch,
          await encrypt(env, account.id, "oauth", verifier),
          nonce,
          now() + 600,
        ),
      ]);
      const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      auth.search = new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        redirect_uri: CALLBACK,
        response_type: "code",
        scope: `openid email ${SCOPE}`,
        state,
        nonce,
        access_type: "offline",
        prompt: "consent select_account",
        code_challenge: challenge,
        code_challenge_method: "S256",
      }).toString();
      const response = json({ url: auth.toString() });
      response.headers.set("Set-Cookie", cookie(state, 600));
      return response;
    }
    if (path === "/api/drive/callback" && request.method === "GET") {
      if (!premium(account))
        throw new HttpError(
          403,
          "Premium is required to connect Google Drive.",
        );
      const state = url.searchParams.get("state");
      if (
        !state ||
        !/^[a-f0-9]{64}$/.test(state) ||
        readCookie(request, STATE_COOKIE) !== state
      )
        throw new HttpError(
          400,
          "Google Drive connection expired. Start again.",
        );
      const stateHash = await hash(state);
      const attempt = await env.DB.prepare(
        "SELECT * FROM drive_oauth_attempts WHERE state_hash=? AND account_id=? AND expires>?",
      )
        .bind(stateHash, account.id, now())
        .first();
      if (!attempt)
        throw new HttpError(
          400,
          "Google Drive connection expired. Start again.",
        );
      // Conditional delete consumes the attempt exactly once, including failed/cancelled consent.
      const consumed = await env.DB.prepare(
        "DELETE FROM drive_oauth_attempts WHERE state_hash=? AND account_id=? AND expires>?",
      )
        .bind(stateHash, account.id, now())
        .run();
      if (!consumed.meta.changes)
        throw new HttpError(
          400,
          "Google Drive connection expired. Start again.",
        );
      if (url.searchParams.has("error"))
        throw new HttpError(
          400,
          "Google Drive connection was cancelled. Your writing is unchanged.",
        );
      const code = url.searchParams.get("code");
      if (!code || code.length > 4096)
        throw new HttpError(400, "Google Drive authorization code is missing.");
      const verifier = await decrypt(
        env,
        account.id,
        "oauth",
        attempt.verifier_cipher,
      );
      const tokens = await tokenRequest(env, {
        code,
        redirect_uri: CALLBACK,
        grant_type: "authorization_code",
        code_verifier: verifier,
      });
      if (
        typeof tokens.id_token !== "string" ||
        !tokens.refresh_token ||
        !String(tokens.scope || "")
          .split(" ")
          .includes(SCOPE)
      )
        throw new HttpError(
          403,
          "Reconnect Google Drive and approve file access.",
        );
      let claims;
      try {
        claims = await verifyIdToken(tokens.id_token, env, attempt.nonce);
      } catch {
        throw new HttpError(
          401,
          "Google Drive identity could not be verified.",
        );
      }
      const encrypted = await encrypt(env, account.id, "tokens", {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
      });
      const stored = await env.DB.prepare(
        "INSERT INTO drive_connections(account_id,google_subject,email,token_cipher,expires,generation,updated) SELECT account_id,?,?,?,?,?,? FROM drive_link_state WHERE account_id=? AND epoch=? ON CONFLICT(account_id) DO UPDATE SET google_subject=excluded.google_subject,email=excluded.email,token_cipher=excluded.token_cipher,expires=excluded.expires,generation=excluded.generation,refresh_lock=NULL,refresh_until=0,updated=excluded.updated",
      )
        .bind(
          claims.sub,
          claims.email,
          encrypted,
          now() + tokens.expires_in,
          randomToken(),
          now(),
          account.id,
          attempt.epoch,
        )
        .run();
      if (!stored.meta.changes) connectionChanged();
      return new Response(null, {
        status: 303,
        headers: {
          Location: `${ORIGIN}/?driveConnected=1`,
          "Set-Cookie": cookie("", 0),
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
        },
      });
    }
    const supported =
      (request.method === "GET" &&
        ["/api/drive/browser", "/api/drive/open"].includes(path)) ||
      (request.method === "POST" &&
        ["/api/drive/save", "/api/drive/create"].includes(path));
    if (!supported) throw new HttpError(404, "Not found.");
    const current = await connection(env, account);
    if (path === "/api/drive/browser") {
      const parent = validId(url.searchParams.get("parent") || "root");
      const search = url.searchParams.get("search") || "",
        pageToken = url.searchParams.get("pageToken");
      if (
        search.length > 200 ||
        /[\x00-\x1f]/.test(search) ||
        (pageToken && pageToken.length > 4096)
      )
        throw new HttpError(400, "Search or page token is too long.");
      const escaped = search.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
      const q = `trashed=false and '${parent}' in parents and (mimeType='${folderType}' or name contains '.fountain' or name contains '.txt' or name contains '.md' or name contains '.markdown')${search ? ` and name contains '${escaped}'` : ""}`;
      const params = new URLSearchParams({
        q,
        fields:
          "nextPageToken,files(id,name,mimeType,size,modifiedTime,capabilities(canEdit,canAddChildren))",
        orderBy: "folder,name",
        pageSize: "100",
        supportsAllDrives: "true",
        includeItemsFromAllDrives: "true",
      });
      if (pageToken) params.set("pageToken", pageToken);
      const result = await data(
        env,
        account,
        current,
        `/drive/v3/files?${params}`,
      );
      const items = (result.files || [])
        .filter(
          (f) =>
            f.mimeType === folderType ||
            (/\.(fountain|txt|md|markdown)$/i.test(f.name) &&
              !f.mimeType?.startsWith("application/vnd.google-apps.")),
        )
        .map((f) => ({
          id: f.id,
          name: f.name,
          kind: f.mimeType === folderType ? "folder" : "file",
          modifiedTime: f.modifiedTime || null,
          bytes: Number(f.size) || 0,
          canEdit: f.capabilities?.canEdit === true,
          canAddChildren: f.capabilities?.canAddChildren === true,
        }));
      return json({ items, nextPageToken: result.nextPageToken || null });
    }
    if (path === "/api/drive/open")
      return json(
        await open(env, account, current, validId(url.searchParams.get("id"))),
      );
    const input = await inputBody(request),
      text = content(input.content);
    if (path === "/api/drive/save") {
      const id = validId(input.id);
      if (!validEtag(input.etag))
        throw new HttpError(
          400,
          "A strong Google Drive file version is required.",
        );
      const beforeVersion = await version(env, account, current, id);
      const file = validFile(await metadata(env, account, current, id));
      if (!file.capabilities?.canEdit)
        throw new HttpError(
          403,
          "You have view access to this Drive file. Save a new copy to keep your edits.",
        );
      if (beforeVersion !== input.etag) conflict();
      const response = await drive(
        env,
        account,
        current,
        `/upload/drive/v2/files/${id}?uploadType=media&supportsAllDrives=true&fields=id,title,etag,modifiedDate`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "text/plain;charset=utf-8",
            "If-Match": input.etag,
          },
          body: text,
        },
      );
      let result;
      try {
        result = await response.json();
      } catch {
        result = {};
      }
      const etag = result.etag || response.headers.get("etag");
      if (!validEtag(etag)) {
        const error = new HttpError(
          503,
          "Drive accepted this save but did not return its version. Reopen the file before saving again.",
        );
        error.code = "DRIVE_REOPEN_REQUIRED";
        throw error;
      }
      // Use the acknowledged upload version, never a follow-up metadata version that
      // could pair this content with another writer's newer ETag.
      return json(
        fileResult(
          {
            ...file,
            name: result.title || file.name,
            modifiedTime: result.modifiedDate || null,
          },
          text,
          etag,
        ),
      );
    }
    if (
      typeof input.name !== "string" ||
      input.name.length > 200 ||
      !/^[^/\\\x00-\x1f]+\.(fountain|txt|md|markdown)$/i.test(input.name)
    )
      throw new HttpError(400, "Choose a .md, .markdown, .fountain or .txt filename.");
    const parent = validId(input.parent || "root");
    const destination = await metadata(env, account, current, parent);
    if (
      destination.mimeType !== folderType ||
      destination.trashed ||
      destination.capabilities?.canAddChildren !== true
    )
      throw new HttpError(
        403,
        "Choose a Google Drive folder where you can add files.",
      );
    const boundary = `writeshape_${randomToken()}`;
    const multipart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: input.name, mimeType: "text/plain", parents: [parent] })}\r\n--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${text}\r\n--${boundary}--`;
    let created;
    try {
      created = await data(
        env,
        account,
        current,
        "/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id",
        {
          method: "POST",
          headers: {
            "Content-Type": `multipart/related; boundary=${boundary}`,
          },
          body: multipart,
        },
      );
    } catch (error) {
      if (error.status !== 503) throw error;
      const uncertain = new HttpError(
        503,
        "Drive could not confirm whether the new file was created. Browse Drive before creating another copy.",
      );
      uncertain.code = "DRIVE_REOPEN_REQUIRED";
      throw uncertain;
    }
    // Read back the created content under an ETag bracket. Never attach a new remote
    // revision to stale local content if another client edits during creation.
    let result;
    try {
      result = await open(env, account, current, validId(created.id));
    } catch {
      const error = new HttpError(
        503,
        "Drive created the file, but it could not be reopened. Browse Drive before creating another copy.",
      );
      error.code = "DRIVE_REOPEN_REQUIRED";
      throw error;
    }
    if (result.content !== text)
      conflict("The new file changed on Drive. Open it before saving again.");
    return json(result, 201);
  };
}
export const driveRoutes = createDriveRoutes();
