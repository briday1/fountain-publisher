import type { Credential, Provider, Session, SessionVault } from "./vault";
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export interface ProviderConfig {
  clientId: string;
  clientSecret: string;
  apiKey?: string;
  appId?: string;
}
export interface ServerConfig {
  origin: string;
  dataDirectory: string;
  encryptionKey?: string;
  github?: ProviderConfig;
  google?: ProviderConfig;
  production?: boolean;
  distDirectory?: string;
}
export const MAX_BYTES = 10 * 1024 * 1024;
export const encodePath = (path: string) =>
  path.split("/").map(encodeURIComponent).join("/");
export async function limitedText(response: Response): Promise<string> {
  const length = Number(response.headers.get("content-length") || 0);
  if (length > MAX_BYTES)
    throw new ApiError(
      413,
      "TOO_LARGE",
      "This screenplay exceeds the 10 MB limit.",
    );
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    size += result.value.length;
    if (size > MAX_BYTES) {
      await reader.cancel();
      throw new ApiError(
        413,
        "TOO_LARGE",
        "This screenplay exceeds the 10 MB limit.",
      );
    }
    chunks.push(result.value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
export class Providers {
  private refreshing = new Map<string, Promise<void>>();
  constructor(
    readonly config: ServerConfig,
    readonly vault: SessionVault,
    private readonly network: typeof fetch = fetch,
  ) {}
  async fetch(url: string, init: RequestInit = {}): Promise<Response> {
    try {
      return await this.network(url, {
        ...init,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new ApiError(
        502,
        "PROVIDER_UNAVAILABLE",
        "The storage provider is unavailable. Your device draft has not been changed.",
      );
    }
  }
  async tokenRequest(
    provider: Provider,
    params: Record<string, string>,
  ): Promise<Credential> {
    const settings = this.config[provider];
    if (!settings)
      throw new ApiError(
        503,
        "NOT_CONFIGURED",
        `${provider === "github" ? "GitHub" : "Google Drive"} is not configured on this server.`,
      );
    const response = await this.fetch(
      provider === "github"
        ? "https://github.com/login/oauth/access_token"
        : "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: settings.clientId,
          client_secret: settings.clientSecret,
          ...params,
        }),
      },
    );
    const token = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (!response.ok || !token.access_token)
      throw new ApiError(
        401,
        "AUTH_REQUIRED",
        "Connection expired or authorization failed. Connect this provider again.",
      );
    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: token.expires_in
        ? Date.now() + token.expires_in * 1000
        : undefined,
    };
  }
  async request(
    session: Session,
    provider: Provider,
    path: string,
    init: RequestInit = {},
  ): Promise<Response> {
    let credential = session.credentials[provider];
    if (!credential)
      throw new ApiError(
        401,
        "AUTH_REQUIRED",
        `Connect ${provider === "github" ? "GitHub" : "Google Drive"} first.`,
      );
    if (credential.expiresAt && credential.expiresAt < Date.now() + 60_000) {
      const key = `${session.id}:${provider}`;
      let job = this.refreshing.get(key);
      if (!job) {
        job = (async () => {
          if (!credential?.refreshToken)
            throw new ApiError(
              401,
              "AUTH_REQUIRED",
              "This connection expired. Connect again.",
            );
          try {
            const updated = await this.tokenRequest(provider, {
              grant_type: "refresh_token",
              refresh_token: credential.refreshToken,
            });
            session.credentials[provider] = {
              ...credential,
              ...updated,
              refreshToken: updated.refreshToken ?? credential.refreshToken,
            };
            await this.vault.persist();
          } catch (error) {
            if (error instanceof ApiError && error.status === 401) {
              delete session.credentials[provider];
              await this.vault.persist();
            }
            throw error;
          }
        })();
        this.refreshing.set(key, job);
      }
      try {
        await job;
      } finally {
        this.refreshing.delete(key);
      }
      credential = session.credentials[provider]!;
    }
    const base =
      provider === "github"
        ? "https://api.github.com"
        : "https://www.googleapis.com";
    const response = await this.fetch(base + path, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(provider === "github"
          ? { "X-GitHub-Api-Version": "2026-03-10" }
          : {}),
        ...init.headers,
        Authorization: `Bearer ${credential.accessToken}`,
      },
    });
    if (response.ok) return response;
    if (response.status === 401) {
      delete session.credentials[provider];
      await this.vault.persist();
      throw new ApiError(
        401,
        "AUTH_REQUIRED",
        "This connection expired. Connect again.",
      );
    }
    if (response.status === 409 || response.status === 412)
      throw new ApiError(
        409,
        "CONFLICT",
        "This file changed remotely. Open the current version or save your draft as a new file.",
      );
    if (response.status === 404)
      throw new ApiError(
        404,
        "NOT_FOUND",
        "The file or folder was not found, or you no longer have access.",
      );
    if (
      response.status === 429 ||
      (response.status === 403 &&
        response.headers.get("x-ratelimit-remaining") === "0")
    )
      throw new ApiError(
        429,
        "RATE_LIMITED",
        "The provider has temporarily limited requests. Try again later.",
      );
    if (response.status === 403)
      throw new ApiError(
        403,
        "FORBIDDEN",
        "You do not have permission for this operation. Check provider access and file permissions.",
      );
    if (response.status === 422)
      throw new ApiError(
        409,
        "CONFLICT",
        "The provider rejected this save. The file may have changed, or the branch may restrict commits.",
      );
    throw new ApiError(
      502,
      "PROVIDER_ERROR",
      "The storage provider could not complete this request. Your device draft is safe.",
    );
  }
  async githubOpen(
    session: Session,
    owner: string,
    repo: string,
    branch: string,
    path: string,
    ref = branch,
  ) {
    const response = await this.request(
      session,
      "github",
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`,
    );
    const data = (await response.json()) as {
      name: string;
      type: string;
      content?: string;
      encoding?: string;
      sha: string;
      size: number;
    };
    if (data.type !== "file" || data.encoding !== "base64")
      throw new ApiError(
        400,
        "INVALID_FILE",
        "Choose a plain text file smaller than 1 MB from GitHub.",
      );
    if (data.size > MAX_BYTES)
      throw new ApiError(
        413,
        "TOO_LARGE",
        "This file exceeds the screenplay size limit.",
      );
    const content = Buffer.from(data.content ?? "", "base64").toString("utf8");
    if (content.includes("\0"))
      throw new ApiError(
        400,
        "INVALID_FILE",
        "Choose a plain text Fountain file.",
      );
    return {
      name: data.name,
      content,
      remote: {
        provider: "github" as const,
        owner,
        repo,
        branch,
        path,
        sha: data.sha,
      },
    };
  }
  async driveMetadata(session: Session, id: string) {
    const response = await this.request(
      session,
      "google",
      `/drive/v3/files/${encodeURIComponent(id)}?supportsAllDrives=true&fields=id,name,mimeType,size,webViewLink,capabilities,version`,
    );
    const data = (await response.json()) as {
      id: string;
      name: string;
      mimeType: string;
      size?: string;
      webViewLink?: string;
      version: string;
      capabilities?: { canEdit?: boolean };
    };
    if (data.mimeType.startsWith("application/vnd.google-apps."))
      throw new ApiError(
        400,
        "INVALID_FILE",
        "Choose a Fountain or plain text file. Native Google documents cannot store Fountain screenplays.",
      );
    if (Number(data.size) > MAX_BYTES)
      throw new ApiError(
        413,
        "TOO_LARGE",
        "This screenplay exceeds the 10 MB limit.",
      );
    return { ...data, etag: response.headers.get("etag") ?? "" };
  }
  async driveOpen(session: Session, id: string) {
    const meta = await this.driveMetadata(session, id);
    const response = await this.request(
      session,
      "google",
      `/drive/v3/files/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true`,
      { headers: meta.etag ? { "If-Match": meta.etag } : {} },
    );
    const content = await limitedText(response);
    if (content.includes("\0"))
      throw new ApiError(
        400,
        "INVALID_FILE",
        "Choose a plain text Fountain file.",
      );
    const after = await this.driveMetadata(session, id);
    if (after.version !== meta.version)
      throw new ApiError(
        409,
        "CONFLICT",
        "This file changed while opening. Open it again.",
      );
    return {
      name: meta.name,
      content,
      remote: {
        provider: "google" as const,
        id,
        etag: after.etag,
        webViewLink: meta.webViewLink,
      },
    };
  }
}
