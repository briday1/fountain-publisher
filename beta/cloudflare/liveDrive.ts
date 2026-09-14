export interface LiveEnvironment {
  SHARED_API: {
    fetch(input: Request | string, init?: RequestInit): Promise<Response>;
  };
  API_ORIGIN: string;
  SHARED_ORIGIN: string;
  BETA_ORIGIN: string;
}
export class LiveError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export interface LiveFile {
  id: string;
  name: string;
  mimeType?: string;
  webViewLink?: string;
  trashed?: boolean;
  appProperties?: Record<string, string>;
  capabilities?: { canEdit?: boolean };
}
export interface LiveIdentity {
  id: string;
  name: string;
  color: string;
  canEdit: boolean;
}
export interface LiveAuthorization {
  self: LiveIdentity;
  file: LiveFile;
  /** These credentials stay inside the Worker; they are never serialized into the shared document. */
  cookie: string;
  token: string;
}
export const MAX_CONTENT_BYTES = 5_000_000;
export const validFileId = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{10,200}$/.test(value);
export function sessionCookie(raw: string): string {
  const value = raw
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("fp_google_session="));
  return value && /^fp_google_session=[A-Za-z0-9_%.-]{1,1024}$/.test(value)
    ? value
    : "";
}
export async function contentHash(content: string): Promise<string> {
  const bytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content)),
  );
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
export async function boundedText(
  response: Response,
  limit = MAX_CONTENT_BYTES,
): Promise<string> {
  if (Number(response.headers.get("content-length")) > limit)
    throw new LiveError(
      413,
      "LIVE_TOO_LARGE",
      "This screenplay is too large for live editing.",
    );
  const reader = response.body?.getReader();
  if (!reader) return "";
  let bytes = 0;
  let result = "";
  const decoder = new TextDecoder();
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    bytes += next.value.byteLength;
    if (bytes > limit) {
      await reader.cancel();
      throw new LiveError(
        413,
        "LIVE_TOO_LARGE",
        "This screenplay is too large for live editing.",
      );
    }
    result += decoder.decode(next.value, { stream: true });
  }
  return result + decoder.decode();
}
function validEtag(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 512 &&
    value !== "*" &&
    !value.startsWith("W/") &&
    !/[\r\n]/.test(value)
  );
}
async function checked(response: Response): Promise<Response> {
  if (response.ok) return response;
  const status = response.status;
  if ([401, 403, 404].includes(status))
    throw new LiveError(
      status,
      "LIVE_ACCESS",
      "Google Drive access changed. Your local writing is preserved.",
    );
  if ([409, 412].includes(status))
    throw new LiveError(
      409,
      "LIVE_CONFLICT",
      "Google Drive changed outside this live session. Preserve both versions before continuing.",
    );
  throw new LiveError(
    502,
    "LIVE_UNAVAILABLE",
    "Google Drive could not complete this request. Your writing remains in the live room.",
  );
}
function identityColor(id: string): string {
  const colors = [
    "#3875c7",
    "#a04b9d",
    "#147f73",
    "#ac5c24",
    "#7956bd",
    "#ac4665",
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++)
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  return colors[(hash >>> 0) % colors.length];
}

/** OAuth stays in the shared service; each room operation obtains fresh, narrowly scoped authorization. */
export class LiveDrive {
  constructor(
    private env: LiveEnvironment,
    private network: typeof fetch = fetch,
  ) {
    // Workerd's native fetch requires the global receiver, even when injected.
    this.network = network.bind(globalThis);
  }

  private shared(route: string, cookie: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    headers.set("Origin", this.env.SHARED_ORIGIN);
    headers.set("Cookie", sessionCookie(cookie));
    return this.env.SHARED_API.fetch(
      new Request(`${this.env.API_ORIGIN}${route}`, { ...init, headers }),
    );
  }

  private request(route: string, token: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    return this.network(`https://www.googleapis.com${route}`, {
      ...init,
      headers,
      signal: AbortSignal.timeout(30_000),
    }).then(checked);
  }

  async authorize(
    fileId: string,
    rawCookie: string,
  ): Promise<LiveAuthorization> {
    if (!validFileId(fileId))
      throw new LiveError(
        400,
        "LIVE_INVALID_FILE",
        "Choose a valid Google Drive screenplay.",
      );
    const cookie = sessionCookie(rawCookie);
    if (!cookie)
      throw new LiveError(
        401,
        "LIVE_ACCESS",
        "Connect Google Drive to edit together.",
      );
    const [session, picker] = await Promise.all([
      this.shared("/api/google/session", cookie)
        .then(checked)
        .then((response) => response.json()) as Promise<{
        account?: { id?: string; name?: string; email?: string };
      }>,
      this.shared("/api/google/picker/config", cookie)
        .then(checked)
        .then((response) => response.json()) as Promise<{
        accessToken?: string;
      }>,
    ]);
    if (!session.account?.id || !picker.accessToken)
      throw new LiveError(
        401,
        "LIVE_ACCESS",
        "Connect Google Drive to edit together.",
      );
    const file = (await (
      await this.request(
        `/drive/v3/files/${fileId}?fields=id,name,mimeType,trashed,webViewLink,appProperties,capabilities(canEdit)&supportsAllDrives=true`,
        picker.accessToken,
      )
    ).json()) as LiveFile;
    if (file.id !== fileId || file.trashed)
      throw new LiveError(
        403,
        "LIVE_ACCESS",
        "This Drive screenplay is no longer available.",
      );
    if (
      !/\.(fountain|txt)$/i.test(file.name) ||
      (file.mimeType &&
        ![
          "text/plain",
          "text/x-fountain",
          "application/x-fountain",
          "application/octet-stream",
        ].includes(file.mimeType))
    )
      throw new LiveError(
        400,
        "LIVE_INVALID_FILE",
        "Live editing requires a Fountain or text screenplay.",
      );
    return {
      self: {
        id: session.account.id,
        name: String(
          session.account.name || session.account.email || "Writer",
        ).slice(0, 120),
        color: identityColor(session.account.id),
        canEdit: file.capabilities?.canEdit === true,
      },
      cookie,
      token: picker.accessToken,
      file,
    };
  }

  private async version(auth: LiveAuthorization): Promise<string> {
    const response = await this.request(
      `/drive/v2/files/${auth.file.id}?fields=id,etag&supportsAllDrives=true`,
      auth.token,
    );
    const data = (await response.json()) as { etag?: unknown };
    if (!validEtag(data.etag))
      throw new LiveError(
        503,
        "LIVE_MISSING_VERSION",
        "Drive did not provide a safe version check. Try again before saving.",
      );
    return data.etag;
  }

  async snapshot(
    auth: LiveAuthorization,
  ): Promise<{ content: string; etag: string; hash: string }> {
    const etag = await this.version(auth);
    const content = await boundedText(
      await this.request(
        `/drive/v3/files/${auth.file.id}?alt=media&supportsAllDrives=true`,
        auth.token,
      ),
    );
    if (etag !== (await this.version(auth)))
      throw new LiveError(
        409,
        "LIVE_CONFLICT",
        "Drive changed while opening this screenplay. Try again.",
      );
    return { content, etag, hash: await contentHash(content) };
  }

  async save(
    auth: LiveAuthorization,
    content: string,
    etag: string,
  ): Promise<string> {
    if (!auth.self.canEdit)
      throw new LiveError(
        403,
        "LIVE_READ_ONLY",
        "You have view access to this screenplay.",
      );
    if (!validEtag(etag))
      throw new LiveError(
        503,
        "LIVE_MISSING_VERSION",
        "A Drive version check is required before saving.",
      );
    const response = await this.request(
      `/upload/drive/v2/files/${auth.file.id}?uploadType=media&supportsAllDrives=true&fields=id,etag`,
      auth.token,
      {
        method: "PUT",
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "If-Match": etag,
        },
        body: content,
      },
    );
    const result = (await response.json()) as { etag?: unknown };
    const updated = result.etag ?? response.headers.get("etag");
    if (!validEtag(updated))
      throw new LiveError(
        503,
        "LIVE_MISSING_VERSION",
        "Drive accepted the upload without returning its version. The live room will verify it before retrying.",
      );
    return updated;
  }

  /** A protocol-2 handshake can safely establish the old room's binding; it never submits edits. */
  async verifyOriginalRoom(
    auth: LiveAuthorization,
    content: string,
  ): Promise<void> {
    const documentId = auth.file.appProperties?.fountainPublisherDocumentId;
    if (!documentId) return;
    if (!/^[a-f0-9]{48}$/.test(documentId))
      throw new LiveError(
        409,
        "LIVE_LEGACY_CONFLICT",
        "The original live document has an invalid identity. Preserve its existing version before continuing.",
      );
    const route = `/api/collaboration/${documentId}`;
    const query = `fileId=${encodeURIComponent(auth.file.id)}`;
    let response = await this.shared(`${route}/recovery?${query}`, auth.cookie);
    if (response.status === 409) {
      const joined = await this.shared(
        `${route}?${query}&protocol=2`,
        auth.cookie,
        { headers: { Upgrade: "websocket" } },
      );
      if (joined.status !== 101) {
        if ([401, 403, 404].includes(joined.status)) await checked(joined);
        throw new LiveError(
          409,
          "LIVE_LEGACY_CONFLICT",
          "The original live room could not safely verify this Drive file. Preserve its existing version before continuing.",
        );
      }
      const socket = (
        joined as Response & {
          webSocket?: {
            accept(): void;
            close(code?: number, reason?: string): void;
          };
        }
      ).webSocket;
      socket?.accept();
      socket?.close(1000, "Verified import");
      response = await this.shared(`${route}/recovery?${query}`, auth.cookie);
    }
    const recovery = (await (await checked(response)).json()) as {
      roomContent?: unknown;
      driveContent?: unknown;
      file?: { id?: string };
    };
    if (
      recovery.file?.id !== auth.file.id ||
      recovery.roomContent !== content ||
      recovery.driveContent !== content
    )
      throw new LiveError(
        409,
        "LIVE_LEGACY_CONFLICT",
        "The original live room has changes that differ from Google Drive. Save or recover that version before starting live collaboration.",
      );
  }
}
