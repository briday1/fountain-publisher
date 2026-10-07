import { HttpError, sameOrigin } from "./http.mjs";
export async function refreshLiveProfile(env, accountId) {
  if (env.LIVE_COLLABORATION !== "true" || !env.LIVE_ROOMS) return;
  const rooms = await env.DB.prepare(
    "SELECT file_id FROM live_room_members WHERE account_id=?",
  )
    .bind(accountId)
    .all();
  // A profile save succeeds even if an idle room cannot currently be reached.
  // Its next authenticated presence update will also pick up the saved name.
  await Promise.allSettled(
    rooms.results.map(({ file_id }) =>
      env.LIVE_ROOMS.get(
        env.LIVE_ROOMS.idFromName("writeshape-v1:" + file_id),
      ).fetch(
        new Request("https://room.internal/refresh-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId }),
        }),
      ),
    ),
  );
}
export function liveCredential(request) {
  // Internal DO transport only. Client-provided identity headers are never forwarded.
  return JSON.stringify({
    cookie: (request.headers.get("cookie") || "")
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.startsWith("__Host-writeshape_session="))
      .join(";"),
    assertion: request.headers.get("Cf-Access-Jwt-Assertion") || "",
  });
}
export async function liveRoutes(request, env, user) {
  const url = new URL(request.url),
    match = url.pathname.match(
      /^\/api\/collaboration\/((?:drive|library)_[A-Za-z0-9_-]{10,200})\/(bootstrap|connect|checkpoint|recovery|review|undo|merge)$/,
    );
  if (!match) return null;
  if (!user) throw new HttpError(401, "Sign in before joining live writing.");
  if (env.LIVE_COLLABORATION !== "true" || !env.LIVE_ROOMS)
    throw new HttpError(
      503,
      "Live writing is not available yet. Your local draft is preserved.",
    );
  if (request.method === "GET" && !request.headers.has("Origin")) {
    if (request.headers.get("Sec-Fetch-Site") !== "same-origin")
      throw new HttpError(403, "Invalid request origin.");
  } else sameOrigin(request);
  const [, fileId, action] = match;
  if (
    action === "connect" &&
    (request.method !== "GET" ||
      request.headers.get("upgrade")?.toLowerCase() !== "websocket")
  )
    throw new HttpError(426, "A live connection is required.");
  if (
    ["bootstrap", "checkpoint", "undo", "merge"].includes(action) &&
    request.method !== "POST"
  )
    throw new HttpError(405, "Use POST.");
  if (["recovery", "review"].includes(action) && request.method !== "GET")
    throw new HttpError(405, "Use GET.");
  const target = new URL("https://room.internal/" + action);
  target.searchParams.set("fileId", fileId);
  if (url.searchParams.has("clientId"))
    target.searchParams.set("clientId", url.searchParams.get("clientId"));
  const headers = new Headers({
    Cookie: liveCredential(request),
    "Content-Type": "application/json",
  });
  if (action === "connect") headers.set("Upgrade", "websocket");
  const body = request.method === "POST" ? await request.text() : undefined;
  if (body && new TextEncoder().encode(body).length > 131072)
    throw new HttpError(413, "Live request too large.");
  return env.LIVE_ROOMS.get(
    env.LIVE_ROOMS.idFromName("writeshape-v1:" + fileId),
  ).fetch(new Request(target, { method: request.method, headers, body }));
}
