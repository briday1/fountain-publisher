import { z } from "zod";
export { LiveScreenplayRoom } from "./liveRoom";
interface Fetcher {
  fetch(input: Request | string, init?: RequestInit): Promise<Response>;
}
export interface BetaEnvironment {
  LIVE_ROOMS?: { idFromName(name: string): unknown; get(id: unknown): Fetcher };
  ASSETS: Fetcher;
  SHARED_API: Fetcher;
  BETA_ORIGIN: string;
  SHARED_ORIGIN: string;
  API_ORIGIN: string;
  BETA_ASSET_ORIGIN?: string;
}
const cookie = (request: Request, key: string) =>
  request.headers
    .get("cookie")
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(`${key}=`))
    ?.slice(key.length + 1) ?? "";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "REQUEST_FAILED",
  ) {
    super(message);
  }
}
const id = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[\w-]+$/);
const segment = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[\w.-]+$/)
  .refine((s) => s !== "." && s !== "..");
const branch = z
  .string()
  .min(1)
  .max(255)
  .refine((s) => !/[\x00-\x1f\x7f]/.test(s));
const path = z
  .string()
  .max(1024)
  .refine(
    (s) =>
      !s.startsWith("/") &&
      !s.split("/").some((p) => p === "." || p === "..") &&
      !/[\\\x00-\x1f\x7f]/.test(s),
  );
const filePath = path.refine((s) => /\.(fountain|txt)$/i.test(s));
const content = z
  .string()
  .max(5_000_000)
  .refine((s) => !s.includes("\0"));
const githubLocation = z.object({
  owner: segment,
  repo: segment,
  branch,
  path: filePath,
});
const encodePath = (s: string) =>
  s.split("/").map(encodeURIComponent).join("/");
function params(values: Record<string, string | number | boolean | undefined>) {
  return new URLSearchParams(
    Object.entries(values)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)]),
  ).toString();
}
async function checked(response: Response): Promise<Response> {
  if (response.ok) return response;
  const data = (await response.json().catch(() => ({}))) as {
    error?: string | { message?: string };
    message?: string;
  };
  const status = [409, 412, 422].includes(response.status)
    ? 409
    : response.status;
  throw new HttpError(
    status,
    status === 409
      ? "This file changed remotely. Your current draft is safe. Open the latest version or save a new copy."
      : typeof data.error === "string"
        ? data.error
        : (data.error?.message ??
          data.message ??
          "The connected service could not complete the request."),
    status === 409
      ? "CONFLICT"
      : status === 401
        ? "NOT_CONNECTED"
        : "UPSTREAM_ERROR",
  );
}
async function boundedText(response: Response) {
  if (Number(response.headers.get("content-length")) > 5_000_000)
    throw new HttpError(413, "This file is larger than the 5 MB limit.");
  const reader = response.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let length = 0,
    text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 5_000_000) {
      await reader.cancel();
      throw new HttpError(413, "This file is larger than the 5 MB limit.");
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}
/** Both app origins share the established account service and live room namespace. */
export function createBetaWorker(network: typeof fetch = fetch) {
  return {
    async fetch(request: Request, env: BetaEnvironment): Promise<Response> {
      const url = new URL(request.url);
      const appOrigins = new Set([env.BETA_ORIGIN, env.SHARED_ORIGIN]);
      const requestOrigin = request.headers.get("origin") ?? "";
      const allowed = appOrigins.has(requestOrigin);
      const shared = (route: string, init: RequestInit = {}) => {
        const headers = new Headers(init.headers);
        headers.set("origin", env.SHARED_ORIGIN);
        headers.set("cookie", request.headers.get("cookie") ?? "");
        const ip = request.headers.get("cf-connecting-ip");
        if (ip) headers.set("cf-connecting-ip", ip);
        return env.SHARED_API.fetch(
          new Request(`${env.API_ORIGIN}${route}`, {
            ...init,
            headers,
            redirect: "manual",
          }),
        );
      };
      // Keep the registered OAuth callback addresses. The primary app's callbacks pass through.
      if (
        url.hostname === new URL(env.API_ORIGIN).hostname &&
        /^\/auth\/(github|google)\/callback$/.test(url.pathname)
      ) {
        const provider = url.pathname.split("/")[2];
        const upstream = await env.SHARED_API.fetch(request);
        const returnCookie = cookie(request, "fp_beta_return");
        const [returnProvider, encodedOrigin] = returnCookie.split("|");
        if (returnProvider !== provider) return upstream;
        let returnOrigin = env.BETA_ORIGIN;
        if (encodedOrigin) {
          try {
            returnOrigin = decodeURIComponent(encodedOrigin);
          } catch {
            return upstream;
          }
          if (!appOrigins.has(returnOrigin)) return upstream;
        }
        const headers = new Headers(upstream.headers);
        headers.append(
          "Set-Cookie",
          "fp_beta_return=; Path=/auth/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
        );
        if (!headers.get("content-type")?.includes("text/html"))
          return new Response(upstream.body, {
            status: upstream.status,
            headers,
          });
        const html = (await upstream.text()).replaceAll(
          JSON.stringify(env.SHARED_ORIGIN),
          JSON.stringify(returnOrigin),
        );
        headers.delete("content-length");
        headers.set("cache-control", "no-store");
        return new Response(html, { status: upstream.status, headers });
      }
      if (url.pathname === "/health")
        return json({ ok: true, application: "fountain-publisher-beta" });
      if (!url.pathname.startsWith("/beta/api/")) {
        if (!["GET", "HEAD"].includes(request.method))
          return new Response("Method not allowed", { status: 405 });
        const immutableAsset =
          /^\/assets\/.+-[\w-]+\.[\w]+$/.test(url.pathname) ||
          /^\/offline-shell-[a-f0-9]+\.html$/.test(url.pathname);
        const assetUrl = env.BETA_ASSET_ORIGIN
          ? new URL(`${env.BETA_ASSET_ORIGIN}${url.pathname}${url.search}`)
          : undefined;
        // The Pages origin is itself behind a CDN. A unique upstream URL also
        // bypasses already-cached responses there, independent of zone cache rules.
        if (assetUrl && !immutableAsset)
          assetUrl.searchParams.set("_fp_refresh", crypto.randomUUID());
        const response = assetUrl
          ? await network(assetUrl.href, {
              method: request.method,
              redirect: "follow",
              ...(immutableAsset
                ? {}
                : {
                    cache: "no-store" as const,
                    headers: { "Cache-Control": "no-cache" },
                  }),
            })
          : await env.ASSETS.fetch(request);
        const headers = new Headers(response.headers);
        if (!immutableAsset || !response.ok) {
          // Mutable HTML and sw.js must always agree with the current release.
          // In particular, a stale sw.js can reference assets removed by Pages.
          headers.set("Cache-Control", "no-store");
          headers.set("CDN-Cache-Control", "no-store");
          headers.set("Cloudflare-CDN-Cache-Control", "no-store");
          headers.delete("Expires");
          headers.delete("Age");
        }
        headers.set("X-Content-Type-Options", "nosniff");
        headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
        headers.set(
          "Permissions-Policy",
          "camera=(), microphone=(), geolocation=()",
        );
        headers.set(
          "Content-Security-Policy",
          `default-src 'self'; script-src 'self' https://apis.google.com https://www.gstatic.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://www.gstatic.com https://ssl.gstatic.com; font-src 'self'; connect-src wss://api.fountain-publisher.com https://apis.google.com https://www.googleapis.com 'self' ${env.API_ORIGIN}; worker-src 'self' blob:; frame-src 'self' blob: https://docs.google.com https://drive.google.com https://accounts.google.com; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`,
        );
        return new Response(response.body, {
          status: response.status,
          headers,
        });
      }
      const cors = (response: Response) => {
        const headers = new Headers(response.headers);
        headers.set("cache-control", "no-store");
        headers.set("X-Content-Type-Options", "nosniff");
        headers.set("Vary", "Origin");
        if (allowed) {
          headers.set("Access-Control-Allow-Origin", requestOrigin);
          headers.set("Access-Control-Allow-Credentials", "true");
          headers.set(
            "Access-Control-Allow-Headers",
            "Content-Type, X-CSRF-Token",
          );
          headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        }
        return new Response(response.body, {
          status: response.status,
          headers,
        });
      };
      if (request.method === "OPTIONS")
        return cors(new Response(null, { status: allowed ? 204 : 403 }));
      try {
        const route = url.pathname.slice("/beta/api".length);
        const query = Object.fromEntries(url.searchParams);
        const liveRoute = route.match(
          /^\/collaboration\/([A-Za-z0-9_-]{10,200})\/(bootstrap|connect|checkpoint|recovery)$/,
        );
        if (liveRoute && liveRoute[2] === "connect" && !allowed)
          throw new HttpError(
            403,
            "Open shared writing from Fountain Publisher.",
          );
        if (
          !["GET", "HEAD"].includes(request.method) &&
          (!allowed ||
            !cookie(request, "fp_beta_csrf") ||
            request.headers.get("x-csrf-token") !==
              cookie(request, "fp_beta_csrf"))
        )
          throw new HttpError(
            403,
            "Reload Fountain Publisher before trying again.",
            "CSRF_REJECTED",
          );
        const body = async () => {
          if (Number(request.headers.get("content-length")) > 6_000_000)
            throw new HttpError(413, "This upload is too large.");
          return JSON.parse(await boundedText(new Response(request.body)));
        };
        const upstreamJson = async (route: string, init?: RequestInit) =>
          await (await checked(await shared(route, init))).json();
        if (liveRoute) {
          if (!env.LIVE_ROOMS)
            throw new HttpError(
              503,
              "Live collaboration is being configured. Your draft is kept.",
            );
          const [, fileId, action] = liveRoute;
          if (
            action === "connect" &&
            (request.method !== "GET" ||
              request.headers.get("upgrade")?.toLowerCase() !== "websocket")
          )
            throw new HttpError(426, "A live connection is required.");
          if (
            (action === "bootstrap" || action === "checkpoint") &&
            request.method !== "POST"
          )
            throw new HttpError(405, "Method not allowed.");
          if (action === "recovery" && (!allowed || request.method !== "GET"))
            throw new HttpError(403, "Open recovery from Fountain Publisher.");
          const room = env.LIVE_ROOMS.get(
            env.LIVE_ROOMS.idFromName(`structured-v1:${fileId}`),
          );
          const headers = new Headers({
            cookie: request.headers.get("cookie") ?? "",
            origin: requestOrigin,
          });
          if (action === "connect") headers.set("Upgrade", "websocket");
          const target = new URL(`https://room.internal/${action}`);
          target.searchParams.set("fileId", fileId);
          if (url.searchParams.has("clientId"))
            target.searchParams.set(
              "clientId",
              url.searchParams.get("clientId")!,
            );
          const response = await room.fetch(
            new Request(target, {
              method: request.method,
              headers,
              ...(request.method === "POST"
                ? { body: JSON.stringify(await body()) }
                : {}),
            }),
          );
          return response.status === 101 ? response : cors(response);
        }
        if (route === "/status" && request.method === "GET") {
          const [gh, google] = await Promise.all([
            shared("/api/session"),
            shared("/api/google/session"),
          ]);
          const info = async (
            response: Response,
            provider: "github" | "google",
          ) => {
            if (response.status === 401)
              return { configured: true, connected: false };
            const data = (await (await checked(response)).json()) as {
              login?: string;
              account?: { name?: string; email?: string };
            };
            return {
              configured: true,
              connected: true,
              account:
                provider === "github"
                  ? data.login
                  : (data.account?.email ?? data.account?.name),
            };
          };
          const csrfToken =
            cookie(request, "fp_beta_csrf") || crypto.randomUUID();
          const response = json({
            csrfToken,
            collaboration: true,
            github: await info(gh, "github"),
            google: await info(google, "google"),
            sharedInfrastructure: true,
          });
          response.headers.append(
            "Set-Cookie",
            `fp_beta_csrf=${csrfToken}; Path=/beta/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`,
          );
          return cors(response);
        }
        const start = route.match(/^\/auth\/(github|google)\/start$/);
        if (start && request.method === "GET") {
          const returnOrigin =
            url.searchParams.get("returnOrigin") ??
            (allowed ? requestOrigin : env.BETA_ORIGIN);
          if (!appOrigins.has(returnOrigin))
            throw new HttpError(403, "Start sign-in from Fountain Publisher.");
          const response = await shared(`/auth/${start[1]}/start`);
          const headers = new Headers(response.headers);
          headers.set("Cache-Control", "no-store");
          headers.append(
            "Set-Cookie",
            `fp_beta_return=${start[1]}|${encodeURIComponent(returnOrigin)}; Path=/auth/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
          );
          return new Response(response.body, {
            status: response.status,
            headers,
          });
        }
        const disconnect = route.match(/^\/auth\/(github|google)\/disconnect$/);
        if (disconnect && request.method === "POST")
          return cors(
            await checked(
              await shared(
                disconnect[1] === "google"
                  ? "/auth/google/logout"
                  : "/auth/logout",
                { method: "POST" },
              ),
            ),
          );
        if (route === "/github/repos" && request.method === "GET") {
          const data = (await upstreamJson("/api/repositories")) as {
            repositories: {
              fullName: string;
              private: boolean;
              defaultBranch: string;
            }[];
          };
          return cors(
            json({
              items: data.repositories.map((r) => ({
                ...r,
                owner: r.fullName.split("/")[0],
                name: r.fullName.split("/")[1],
              })),
            }),
          );
        }
        if (route === "/github/branches" && request.method === "GET") {
          const q = z.object({ owner: segment, repo: segment }).parse(query);
          const data = (await upstreamJson(`/api/branches?${params(q)}`)) as {
            branches: string[];
          };
          return cors(json({ items: data.branches.map((name) => ({ name })) }));
        }
        if (route === "/github/files" && request.method === "GET") {
          const q = z
            .object({
              owner: segment,
              repo: segment,
              branch,
              path: path.default(""),
            })
            .parse(query);
          const data = (await upstreamJson(`/api/contents?${params(q)}`)) as {
            name: string;
            path: string;
            type: string;
            sha: string;
            size: number;
          }[];
          if (!Array.isArray(data))
            throw new HttpError(400, "Choose a repository folder.");
          return cors(
            json({
              items: data.filter(
                (e) =>
                  e.type === "dir" || /\.(fountain|txt|fdx)$/i.test(e.name),
              ),
            }),
          );
        }
        if (route === "/github/open" && request.method === "GET") {
          const q = githubLocation
            .extend({
              path: path.refine((value) =>
                /\.(fountain|txt|fdx)$/i.test(value),
              ),
            })
            .parse(query);
          const data = (await upstreamJson(`/api/contents?${params(q)}`)) as {
            name: string;
            content: string;
            sha: string;
            size: number;
            encoding: string;
          };
          if (data.size > 5_000_000)
            throw new HttpError(
              413,
              "This screenplay exceeds the file size limit.",
            );
          if (data.encoding !== "base64" || typeof data.content !== "string")
            throw new HttpError(
              422,
              "The repository did not return readable file contents.",
            );
          const bytes = Uint8Array.from(
            atob(data.content.replace(/\s/g, "")),
            (c) => c.charCodeAt(0),
          );
          return cors(
            json({
              name: data.name,
              content: new TextDecoder().decode(bytes),
              remote: { provider: "github", ...q, sha: data.sha },
            }),
          );
        }
        if (route === "/github/save" && request.method === "POST") {
          const q = githubLocation
            .extend({
              content,
              sha: z
                .string()
                .regex(/^[a-f0-9]{40,64}$/)
                .optional(),
              message: z.string().min(1).max(500),
            })
            .parse(await body());
          const data = (await upstreamJson(
            `/api/contents?${params({ owner: q.owner, repo: q.repo, branch: q.branch, path: q.path })}`,
            {
              method: "PUT",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                content: q.content,
                sha: q.sha,
                message: q.message,
              }),
            },
          )) as { sha: string };
          return cors(
            json({
              name: q.path.split("/").at(-1),
              content: q.content,
              remote: {
                provider: "github",
                owner: q.owner,
                repo: q.repo,
                branch: q.branch,
                path: q.path,
                sha: data.sha,
              },
            }),
          );
        }
        if (route === "/google/picker" && request.method === "GET") {
          if (!allowed)
            throw new HttpError(
              403,
              "Open the picker from Fountain Publisher.",
            );
          const config = (await upstreamJson("/api/google/picker/config")) as {
            accessToken?: string;
            apiKey?: string;
            appId?: string;
          };
          return cors(
            json({
              accessToken: config.accessToken ?? "",
              apiKey: config.apiKey ?? "",
              appId: config.appId ?? "",
            }),
          );
        }
        // A per-request token stays inside the Worker and uses the existing account's narrow Drive scope.
        let tokenPromise: Promise<string> | undefined;
        const drive = async (route: string, init: RequestInit = {}) => {
          const accessToken = await (tokenPromise ??= upstreamJson(
            "/api/google/picker/config",
          ).then((value) => {
            const token = (value as { accessToken?: string }).accessToken;
            if (!token)
              throw new HttpError(
                401,
                "Connect Google Drive first.",
                "NOT_CONNECTED",
              );
            return token;
          }));
          const headers = new Headers(init.headers);
          headers.set("Authorization", `Bearer ${accessToken}`);
          return checked(
            await network(`https://www.googleapis.com${route}`, {
              ...init,
              headers,
              signal: AbortSignal.timeout(30_000),
            }),
          );
        };
        const metadata = async (fileId: string, importing = false) => {
          const [modern, version] = await Promise.all([
            drive(
              `/drive/v3/files/${fileId}?fields=id,name,mimeType,webViewLink,capabilities(canEdit)&supportsAllDrives=true`,
            ),
            drive(
              `/drive/v2/files/${fileId}?fields=id,etag&supportsAllDrives=true`,
            ),
          ]);
          const [file, v] = (await Promise.all([
            modern.json(),
            version.json(),
          ])) as [
            {
              id: string;
              name: string;
              mimeType: string;
              webViewLink?: string;
              capabilities?: { canEdit?: boolean };
            },
            { etag?: string },
          ];
          if (
            !(importing ? /\.(fountain|txt|fdx)$/i : /\.(fountain|txt)$/i).test(
              file.name,
            )
          )
            throw new HttpError(400, "Choose a Fountain or text screenplay.");
          if (!v.etag || v.etag === "*" || v.etag.startsWith("W/"))
            throw new HttpError(
              503,
              "Drive did not supply a version check. Try again before saving.",
              "MISSING_VERSION",
            );
          return { ...file, etag: v.etag };
        };
        if (route === "/google/files" && request.method === "GET") {
          const q = z
            .object({
              parent: id.default("root"),
              all: z.enum(["true", "false"]).default("false"),
              pageToken: z.string().max(4096).optional(),
              shared: z.enum(["true", "false"]).default("false"),
            })
            .parse(query);
          const filter =
            q.all === "true"
              ? ""
              : q.shared === "true" && q.parent === "root"
                ? "sharedWithMe"
                : `'${q.parent}' in parents`;
          const data = (await (
            await drive(
              `/drive/v3/files?${params({ q: `trashed=false${filter ? ` and ${filter}` : ""} and (mimeType='application/vnd.google-apps.folder' or name contains '.fountain' or name contains '.txt' or name contains '.fdx')`, fields: "nextPageToken,files(id,name,mimeType,modifiedTime,webViewLink,capabilities(canEdit),shared)", orderBy: "folder,name", pageSize: 100, pageToken: q.pageToken, supportsAllDrives: true, includeItemsFromAllDrives: true })}`,
            )
          ).json()) as { files: unknown[]; nextPageToken?: string };
          return cors(
            json({
              items: data.files ?? [],
              nextPageToken: data.nextPageToken,
            }),
          );
        }
        if (route === "/google/open" && request.method === "GET") {
          const q = z.object({ id }).parse(query);
          const before = await metadata(q.id, true);
          const text = await boundedText(
            await drive(
              `/drive/v3/files/${q.id}?alt=media&supportsAllDrives=true`,
            ),
          );
          const after = await metadata(q.id, true);
          if (before.etag !== after.etag)
            throw new HttpError(
              409,
              "The file changed while opening. Try again.",
              "CONFLICT",
            );
          return cors(
            json({
              name: after.name,
              content: text,
              remote: {
                provider: "google",
                id: q.id,
                etag: after.etag,
                webViewLink: after.webViewLink,
              },
            }),
          );
        }
        if (route === "/google/save" && request.method === "POST") {
          const q = z
            .object({
              id,
              content,
              etag: z
                .string()
                .min(1)
                .max(512)
                .refine(
                  (v) => v !== "*" && !v.startsWith("W/") && !/[\r\n]/.test(v),
                ),
            })
            .parse(await body());
          if (env.LIVE_ROOMS) {
            const room = env.LIVE_ROOMS.get(
              env.LIVE_ROOMS.idFromName(`structured-v1:${q.id}`),
            );
            return cors(
              await room.fetch(
                new Request(
                  `https://room.internal/plain-save?fileId=${encodeURIComponent(q.id)}`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Cookie: request.headers.get("cookie") ?? "",
                    },
                    body: JSON.stringify({
                      expectedContent: q.content,
                      etag: q.etag,
                    }),
                  },
                ),
              ),
            );
          }
          const before = await metadata(q.id);
          if (!before.capabilities?.canEdit)
            throw new HttpError(
              403,
              "You have view access to this Drive file. Save a new copy to keep your edits.",
            );
          if (before.etag !== q.etag)
            throw new HttpError(
              409,
              "This file changed on Drive. Save a copy or open its latest version.",
              "CONFLICT",
            );
          const response = await drive(
            `/upload/drive/v2/files/${q.id}?uploadType=media&supportsAllDrives=true&fields=id,title,etag`,
            {
              method: "PUT",
              headers: {
                "Content-Type": "text/plain;charset=utf-8",
                "If-Match": q.etag,
              },
              body: q.content,
            },
          );
          const result = (await response.json()) as { etag?: string };
          const etag = result.etag || response.headers.get("etag");
          if (!etag)
            throw new HttpError(
              503,
              "Drive accepted the upload but did not return its version. Reopen the file before saving again.",
              "MISSING_VERSION",
            );
          return cors(
            json({
              name: before.name,
              content: q.content,
              remote: {
                provider: "google",
                id: q.id,
                etag,
                webViewLink: before.webViewLink,
              },
            }),
          );
        }
        if (route === "/google/create" && request.method === "POST") {
          const q = z
            .object({
              name: z
                .string()
                .max(200)
                .regex(/^[^/\\\x00-\x1f]+\.(fountain|txt)$/i),
              content,
              parent: id.optional(),
            })
            .parse(await body());
          const result = (await upstreamJson("/api/google/drive/files", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              name: q.name,
              content: q.content,
              parentId: q.parent,
            }),
          })) as { file: { id: string; name: string } };
          const file = await metadata(result.file.id);
          return cors(
            json({
              name: file.name,
              content: q.content,
              remote: {
                provider: "google",
                id: file.id,
                etag: file.etag,
                webViewLink: file.webViewLink,
              },
            }),
          );
        }
        if (route === "/google/revisions" && request.method === "GET") {
          const q = z
            .object({ id, pageToken: z.string().max(4096).optional() })
            .parse(query);
          const data = (await (
            await drive(
              `/drive/v3/files/${q.id}/revisions?${params({ pageSize: 100, pageToken: q.pageToken, fields: "nextPageToken,revisions(id,modifiedTime,keepForever,lastModifyingUser(displayName))" })}`,
            )
          ).json()) as { revisions: unknown[]; nextPageToken?: string };
          return cors(
            json({
              items: data.revisions ?? [],
              nextPageToken: data.nextPageToken,
            }),
          );
        }
        if (route === "/google/revision" && request.method === "GET") {
          const q = z.object({ id, revisionId: id }).parse(query);
          return cors(
            json({
              content: await boundedText(
                await drive(
                  `/drive/v3/files/${q.id}/revisions/${q.revisionId}?alt=media`,
                ),
              ),
            }),
          );
        }
        if (route === "/google/share" && request.method === "POST") {
          const q = z
            .object({
              id,
              email: z.string().email().max(320),
              role: z.enum(["reader", "writer"]),
            })
            .parse(await body());
          await drive(
            `/drive/v3/files/${q.id}/permissions?sendNotificationEmail=false&supportsAllDrives=true`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: "user",
                emailAddress: q.email,
                role: q.role,
              }),
            },
          );
          return cors(json({ ok: true }));
        }
        return cors(
          json(
            { code: "NOT_FOUND", error: "This endpoint does not exist." },
            404,
          ),
        );
      } catch (error) {
        if (error instanceof HttpError)
          return cors(
            json({ code: error.code, error: error.message }, error.status),
          );
        if (error instanceof z.ZodError || error instanceof SyntaxError)
          return cors(
            json(
              {
                code: "INVALID_INPUT",
                error:
                  "Check the filename, folder, or save values and try again.",
              },
              400,
            ),
          );
        return cors(
          json(
            {
              code: "SERVER_ERROR",
              error:
                "The account service could not finish this request. Your local draft is unchanged.",
            },
            502,
          ),
        );
      }
    },
  };
}
export default createBetaWorker();
