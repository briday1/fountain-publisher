import { driveBrowserQuery, driveBrowserPath } from "../shared/driveBrowser";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { resolve } from "node:path";
import { z, ZodError } from "zod";
import { SessionVault } from "./vault";
import type { Session, Provider } from "./vault";
import { ApiError, Providers, encodePath, limitedText } from "./providers";
import type { ServerConfig } from "./providers";
const component = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[\w.-]+$/)
  .refine((v) => v !== "." && v !== "..");
const driveId = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[\w-]+$/);
const branch = z
  .string()
  .min(1)
  .max(255)
  .refine((v) => !/[\x00-\x1f\x7f]/.test(v));
const path = z
  .string()
  .max(1024)
  .refine(
    (v) =>
      !v.startsWith("/") &&
      !v.split("/").some((p) => p === "." || p === "..") &&
      !/[\x00-\x1f\x7f\\]/.test(v),
  );
const filePath = path.refine(
  (v) => /\.(fountain|txt)$/i.test(v),
  "Choose a .fountain or .txt file.",
);
const content = z
  .string()
  .max(10 * 1024 * 1024)
  .refine((v) => !v.includes("\0"));
const githubLocation = z.object({
  owner: component,
  repo: component,
  branch,
  path: filePath,
});
const page = z.coerce.number().int().min(1).max(1000).default(1);
function constantEqual(a: string, b: string) {
  return (
    a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))
  );
}
const session = (res: Response) => res.locals.session as Session;
const qp = (values: Record<string, string | number | undefined>) =>
  new URLSearchParams(
    Object.entries(values)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)]),
  ).toString();
export async function createApp(
  config: ServerConfig,
  network: typeof fetch = fetch,
) {
  const origin = new URL(config.origin).origin;
  if (
    config.production &&
    !origin.startsWith("https://") &&
    !["localhost", "127.0.0.1"].includes(new URL(origin).hostname)
  )
    throw new Error("APP_ORIGIN must use HTTPS in production.");
  const vault = new SessionVault(config.dataDirectory, config.encryptionKey);
  await vault.open();
  const providers = new Providers(config, vault, network);
  const app = express();
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()",
    );
    next();
  });
  if (config.production)
    app.use((_req, res, next) => {
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self' https://apis.google.com https://www.gstatic.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://www.gstatic.com https://ssl.gstatic.com; font-src 'self'; connect-src https://apis.google.com https://www.googleapis.com 'self'; worker-src 'self' blob:; frame-src 'self' blob: https://docs.google.com https://drive.google.com https://accounts.google.com; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      );
      next();
    });
  app.use("/api", cookieParser(), express.json({ limit: "12mb" }));
  app.use("/api", async (req, res, next) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      const supplied = req.cookies?.fp_session;
      let current =
        typeof supplied === "string" ? vault.sessions.get(supplied) : undefined;
      if (current && current.expiresAt < Date.now()) {
        vault.sessions.delete(current.id);
        current = undefined;
      }
      if (!current) {
        current = vault.create();
        await vault.persist();
      }
      res.locals.session = current;
      res.cookie("fp_session", current.id, {
        httpOnly: true,
        sameSite: "lax",
        secure: origin.startsWith("https://"),
        maxAge: Math.max(0, current.expiresAt - Date.now()),
        path: "/",
      });
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        if (
          req.get("origin") !== origin ||
          !constantEqual(req.get("x-csrf-token") ?? "", current.csrf)
        )
          throw new ApiError(
            403,
            "CSRF_REJECTED",
            "Reload this page before trying again.",
          );
      }
      next();
    } catch (error) {
      next(error);
    }
  });
  app.get("/api/status", (_req, res) => {
    const current = session(res);
    const status = (provider: Provider) => ({
      configured: !!config[provider],
      connected: !!current.credentials[provider],
      account: current.credentials[provider]?.account,
      ...(provider === "google"
        ? {
            driveAccess: current.credentials.google?.scope
              ?.split(" ")
              .includes("https://www.googleapis.com/auth/drive")
              ? "full"
              : "limited",
          }
        : {}),
    });
    res.json({
      csrfToken: current.csrf,
      collaboration: false,
      github: status("github"),
      google: status("google"),
    });
  });
  for (const provider of ["github", "google"] as const) {
    app.get(`/api/auth/${provider}/start`, async (_req, res) => {
      const settings = config[provider];
      if (!settings)
        throw new ApiError(
          503,
          "NOT_CONFIGURED",
          `${provider === "github" ? "GitHub" : "Google Drive"} needs server OAuth configuration. See docs/integrations.md.`,
        );
      const current = session(res);
      const state = randomBytes(32).toString("hex");
      const verifier = randomBytes(32).toString("base64url");
      current.oauth = {
        provider,
        state,
        verifier,
        expiresAt: Date.now() + 10 * 60 * 1000,
      };
      await vault.persist();
      const params = new URLSearchParams({
        client_id: settings.clientId,
        redirect_uri: `${origin}/api/auth/${provider}/callback`,
        state,
        response_type: "code",
        code_challenge: createHash("sha256")
          .update(verifier)
          .digest("base64url"),
        code_challenge_method: "S256",
        scope:
          provider === "github"
            ? "repo"
            : "https://www.googleapis.com/auth/drive",
        ...(provider === "google"
          ? { access_type: "offline", prompt: "consent" }
          : {}),
      });
      res.redirect(
        `${provider === "github" ? "https://github.com/login/oauth/authorize" : "https://accounts.google.com/o/oauth2/v2/auth"}?${params}`,
      );
    });
    app.get(`/api/auth/${provider}/callback`, async (req, res) => {
      const current = session(res);
      const pending = current.oauth;
      delete current.oauth;
      await vault.persist();
      if (
        !pending ||
        pending.provider !== provider ||
        pending.expiresAt < Date.now() ||
        typeof req.query.state !== "string" ||
        !constantEqual(pending.state, req.query.state)
      )
        throw new ApiError(
          400,
          "INVALID_STATE",
          "The connection request expired or is invalid. Return to the app and connect again.",
        );
      if (req.query.error) {
        res.redirect("/?connection=cancelled");
        return;
      }
      const code = z.string().min(1).max(4096).parse(req.query.code);
      const credential = await providers.tokenRequest(provider, {
        code,
        grant_type: "authorization_code",
        redirect_uri: `${origin}/api/auth/${provider}/callback`,
        code_verifier: pending.verifier,
      });
      current.credentials[provider] = credential;
      try {
        const accountResponse = await providers.request(
          current,
          provider,
          provider === "github"
            ? "/user"
            : "/drive/v3/about?fields=user(displayName,emailAddress)",
        );
        const account = (await accountResponse.json()) as {
          login?: string;
          user?: { displayName?: string; emailAddress?: string };
        };
        credential.account =
          provider === "github"
            ? account.login
            : (account.user?.emailAddress ?? account.user?.displayName);
      } catch {
        /* Authorization remains valid even if the account label cannot be loaded. */
      }
      await vault.persist();
      res.redirect(`/?connected=${provider}`);
    });
    app.post(`/api/auth/${provider}/disconnect`, async (_req, res) => {
      delete session(res).credentials[provider];
      await vault.persist();
      res.json({ ok: true });
    });
  }
  app.get("/api/github/repos", async (req, res) => {
    const p = page.parse(req.query.page);
    const response = await providers.request(
      session(res),
      "github",
      `/user/repos?per_page=100&sort=updated&page=${p}`,
    );
    const repos = (await response.json()) as {
      name: string;
      owner: { login: string };
      full_name: string;
      default_branch: string;
      private: boolean;
    }[];
    res.json({
      items: repos.map((r) => ({
        name: r.name,
        owner: r.owner.login,
        fullName: r.full_name,
        defaultBranch: r.default_branch,
        private: r.private,
      })),
      nextPage: response.headers.get("link")?.includes('rel="next"')
        ? p + 1
        : undefined,
    });
  });
  app.get("/api/github/branches", async (req, res) => {
    const q = z
      .object({ owner: component, repo: component, page })
      .parse(req.query);
    const response = await providers.request(
      session(res),
      "github",
      `/repos/${q.owner}/${q.repo}/branches?per_page=100&page=${q.page}`,
    );
    const branches = (await response.json()) as { name: string }[];
    res.json({
      items: branches.map((b) => ({ name: b.name })),
      nextPage: response.headers.get("link")?.includes('rel="next"')
        ? q.page + 1
        : undefined,
    });
  });
  app.get("/api/github/files", async (req, res) => {
    const q = z
      .object({
        owner: component,
        repo: component,
        branch,
        path: path.default(""),
      })
      .parse(req.query);
    const response = await providers.request(
      session(res),
      "github",
      `/repos/${q.owner}/${q.repo}/contents/${encodePath(q.path)}?ref=${encodeURIComponent(q.branch)}`,
    );
    const entries = (await response.json()) as {
      name: string;
      path: string;
      type: string;
      sha: string;
      size: number;
    }[];
    if (!Array.isArray(entries))
      throw new ApiError(400, "INVALID_FOLDER", "Choose a repository folder.");
    res.json({
      items: entries
        .filter(
          (e) =>
            e.type === "dir" ||
            (e.type === "file" && /\.(fountain|txt|fdx)$/i.test(e.name)),
        )
        .map((e) => ({
          name: e.name,
          path: e.path,
          type: e.type,
          sha: e.sha,
          size: e.size,
        })),
    });
  });
  app.get("/api/github/open", async (req, res) => {
    const q = githubLocation
      .extend({
        ref: branch.optional(),
        path: path.refine((value) => /\.(fountain|txt|fdx)$/i.test(value)),
      })
      .parse(req.query);
    res.json(
      await providers.githubOpen(
        session(res),
        q.owner,
        q.repo,
        q.branch,
        q.path,
        q.ref,
      ),
    );
  });
  app.post("/api/github/save", async (req, res) => {
    const q = githubLocation
      .extend({
        content,
        sha: z
          .string()
          .regex(/^[a-f0-9]{40,64}$/)
          .optional(),
        message: z.string().trim().min(1).max(500),
      })
      .parse(req.body);
    const response = await providers.request(
      session(res),
      "github",
      `/repos/${q.owner}/${q.repo}/contents/${encodePath(q.path)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: q.message,
          content: Buffer.from(q.content).toString("base64"),
          branch: q.branch,
          sha: q.sha,
        }),
      },
    );
    const result = (await response.json()) as { content: { sha: string } };
    res.json({
      name: q.path.split("/").at(-1),
      content: q.content,
      remote: {
        provider: "github",
        owner: q.owner,
        repo: q.repo,
        branch: q.branch,
        path: q.path,
        sha: result.content.sha,
      },
    });
  });
  app.get("/api/google/picker", async (req, res) => {
    if (req.get("origin") && req.get("origin") !== origin)
      throw new ApiError(
        403,
        "ORIGIN_REJECTED",
        "Open the picker from Fountain Publisher.",
      );
    const current = session(res);
    await providers.request(
      current,
      "google",
      "/drive/v3/about?fields=user(displayName)",
    );
    res.set("Cache-Control", "no-store").json({
      accessToken: current.credentials.google!.accessToken,
      apiKey: config.google?.apiKey ?? "",
      appId: config.google?.appId ?? "",
    });
  });
  app.get("/api/google/browser", async (req, res) => {
    const q = driveBrowserQuery.parse(req.query);
    const data = (await (
      await providers.request(session(res), "google", driveBrowserPath(q))
    ).json()) as {
      files?: unknown[];
      drives?: unknown[];
      nextPageToken?: string;
    };
    res.json({
      items: data.files ?? data.drives ?? [],
      nextPageToken: data.nextPageToken,
    });
  });
  app.get("/api/google/files", async (req, res) => {
    const q = z
      .object({
        parent: driveId.default("root"),
        all: z.enum(["true", "false"]).default("false"),
        pageToken: z.string().max(4096).optional(),
        shared: z.enum(["true", "false"]).default("false"),
      })
      .parse(req.query);
    const filter = `trashed = false${q.all === "true" ? "" : ` and ${q.shared === "true" && q.parent === "root" ? "sharedWithMe = true" : `'${q.parent}' in parents`}`} and (mimeType = 'application/vnd.google-apps.folder' or mimeType = 'text/plain' or name contains '.fountain' or name contains '.txt' or name contains '.fdx')`;
    const response = await providers.request(
      session(res),
      "google",
      `/drive/v3/files?${qp({ q: filter, pageSize: 100, orderBy: "folder,name", supportsAllDrives: "true", includeItemsFromAllDrives: "true", fields: "nextPageToken,files(id,name,mimeType,modifiedTime,webViewLink,capabilities(canEdit),shared)", pageToken: q.pageToken })}`,
    );
    const result = (await response.json()) as {
      files: unknown[];
      nextPageToken?: string;
    };
    res.json({ items: result.files, nextPageToken: result.nextPageToken });
  });
  app.get("/api/google/open", async (req, res) => {
    const id = driveId.parse(req.query.id);
    res.json(await providers.driveOpen(session(res), id));
  });
  app.post("/api/google/save", async (req, res) => {
    const q = z
      .object({
        id: driveId,
        content,
        etag: z
          .string()
          .min(1)
          .max(512)
          .refine((v) => v !== "*" && !/[\r\n]/.test(v)),
      })
      .parse(req.body);
    const current = session(res);
    const meta = await providers.driveMetadata(current, q.id);
    if (!meta.etag || meta.etag !== q.etag)
      throw new ApiError(
        409,
        "CONFLICT",
        "This file changed remotely, or its version cannot be verified. Open it again or save as a new file.",
      );
    const response = await providers.request(
      current,
      "google",
      `/upload/drive/v3/files/${q.id}?uploadType=media&supportsAllDrives=true&fields=id,name,webViewLink`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
          "If-Match": q.etag,
        },
        body: q.content,
      },
    );
    const result = (await response.json()) as {
      id: string;
      name: string;
      webViewLink?: string;
    };
    const etag = response.headers.get("etag") ?? "";
    res.json({
      name: result.name,
      content: q.content,
      remote: {
        provider: "google",
        id: q.id,
        etag,
        webViewLink: result.webViewLink,
      },
    });
  });
  app.post("/api/google/create", async (req, res) => {
    const q = z
      .object({
        name: z
          .string()
          .min(1)
          .max(255)
          .regex(/^[^/\\\x00-\x1f]+\.(fountain|txt)$/i),
        content,
        parent: driveId.optional(),
      })
      .parse(req.body);
    const boundary = `fp_${randomBytes(16).toString("hex")}`;
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: q.name, mimeType: "text/plain", ...(q.parent ? { parents: [q.parent] } : {}) })}\r\n--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${q.content}\r\n--${boundary}--`;
    const response = await providers.request(
      session(res),
      "google",
      "/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink",
      {
        method: "POST",
        headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
        body,
      },
    );
    const result = (await response.json()) as {
      id: string;
      name: string;
      webViewLink?: string;
    };
    res.json({
      name: result.name,
      content: q.content,
      remote: {
        provider: "google",
        id: result.id,
        etag: response.headers.get("etag") ?? "",
        webViewLink: result.webViewLink,
      },
    });
  });
  app.get("/api/google/revisions", async (req, res) => {
    const q = z
      .object({ id: driveId, pageToken: z.string().max(4096).optional() })
      .parse(req.query);
    const response = await providers.request(
      session(res),
      "google",
      `/drive/v3/files/${q.id}/revisions?${qp({ pageSize: 100, pageToken: q.pageToken, fields: "nextPageToken,revisions(id,modifiedTime,keepForever,lastModifyingUser(displayName))" })}`,
    );
    const result = (await response.json()) as {
      revisions: unknown[];
      nextPageToken?: string;
    };
    res.json({
      items: result.revisions ?? [],
      nextPageToken: result.nextPageToken,
    });
  });
  app.get("/api/google/revision", async (req, res) => {
    const q = z.object({ id: driveId, revisionId: driveId }).parse(req.query);
    const response = await providers.request(
      session(res),
      "google",
      `/drive/v3/files/${q.id}/revisions/${q.revisionId}?alt=media`,
    );
    res.json({ content: await limitedText(response) });
  });
  app.post("/api/google/share", async (req, res) => {
    const q = z
      .object({
        id: driveId,
        email: z.string().email().max(320),
        role: z.enum(["reader", "writer"]),
      })
      .parse(req.body);
    await providers.request(
      session(res),
      "google",
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
    res.json({ ok: true });
  });
  app.use("/api", (_req, res) => {
    res
      .status(404)
      .json({ code: "NOT_FOUND", error: "This API endpoint does not exist." });
  });
  if (config.production) {
    const dist = resolve(config.distDirectory ?? "dist");
    app.use(express.static(dist, { index: false }));
    app.get("/{*path}", (_req, res) =>
      res.sendFile(resolve(dist, "index.html")),
    );
  }
  app.use(
    (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
      if (error instanceof ApiError) {
        res
          .status(error.status)
          .json({ code: error.code, error: error.message });
        return;
      }
      if (error instanceof ZodError) {
        res.status(400).json({
          code: "INVALID_INPUT",
          error: "The request contains an invalid file, folder, or save value.",
        });
        return;
      }
      if ((error as { type?: string })?.type === "entity.too.large") {
        res.status(413).json({
          code: "TOO_LARGE",
          error: "This screenplay exceeds the upload limit.",
        });
        return;
      }
      if (error instanceof SyntaxError) {
        res.status(400).json({
          code: "INVALID_JSON",
          error: "The request body is not valid JSON.",
        });
        return;
      }
      res.status(500).json({
        code: "SERVER_ERROR",
        error:
          "The server could not complete this operation. Your device draft is unchanged.",
      });
    },
  );
  return { app, vault, providers };
}
