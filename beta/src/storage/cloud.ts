export type Provider = "github" | "google";
export type RemoteLocation =
  | {
      provider: "github";
      owner: string;
      repo: string;
      branch: string;
      path: string;
      sha: string;
    }
  | { provider: "google"; id: string; etag: string; webViewLink?: string };
export interface CloudDocument {
  name: string;
  content: string;
  remote: RemoteLocation;
}
export interface ProviderStatus {
  configured: boolean;
  connected: boolean;
  account?: string;
}
export interface CloudStatus {
  csrfToken: string;
  github: ProviderStatus;
  google: ProviderStatus;
}
export interface GitHubRepository {
  name: string;
  owner: string;
  fullName: string;
  defaultBranch: string;
  private: boolean;
}
export interface GitHubEntry {
  name: string;
  path: string;
  type: "file" | "dir";
  sha: string;
  size: number;
}
export interface DriveEntry {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
  capabilities?: { canEdit?: boolean };
  shared?: boolean;
}
export interface DriveRevision {
  id: string;
  modifiedTime?: string;
  keepForever?: boolean;
  lastModifyingUser?: { displayName?: string };
}
export class CloudError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
    this.name = "CloudError";
  }
}
export const apiBase = import.meta.env.VITE_API_BASE || "/api";
let csrfToken = "";
async function request<T>(
  path: string,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
): Promise<T> {
  if (method !== "GET" && !csrfToken) await cloud.status();
  let response: Response;
  try {
    response = await fetch(`${apiBase}${path}`, {
      method,
      credentials: apiBase.startsWith("https:") ? "include" : "same-origin",
      headers:
        body === undefined
          ? {}
          : { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new CloudError(
      "The connection is unavailable. Your draft remains on this device.",
      0,
      "OFFLINE",
    );
  }
  const data = await response
    .json()
    .catch(() => ({
      error: "The storage server returned an invalid response.",
      code: "SERVER_ERROR",
    }));
  if (!response.ok)
    throw new CloudError(
      data.error || "The request failed.",
      response.status,
      data.code || "REQUEST_FAILED",
    );
  return data as T;
}
const query = (values: Record<string, string | number | boolean | undefined>) =>
  new URLSearchParams(
    Object.entries(values)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)]),
  ).toString();
export const cloud = {
  async status() {
    const result = await request<CloudStatus>("/status");
    csrfToken = result.csrfToken;
    return result;
  },
  disconnect: (provider: Provider) =>
    request<{ ok: boolean }>(`/auth/${provider}/disconnect`, {}),
  githubRepos: (page = 1) =>
    request<{ items: GitHubRepository[]; nextPage?: number }>(
      `/github/repos?${query({ page })}`,
    ),
  githubBranches: (owner: string, repo: string, page = 1) =>
    request<{ items: { name: string }[]; nextPage?: number }>(
      `/github/branches?${query({ owner, repo, page })}`,
    ),
  githubFiles: (owner: string, repo: string, branch: string, path = "") =>
    request<{ items: GitHubEntry[] }>(
      `/github/files?${query({ owner, repo, branch, path })}`,
    ),
  githubOpen: (
    owner: string,
    repo: string,
    branch: string,
    path: string,
    ref?: string,
  ) =>
    request<CloudDocument>(
      `/github/open?${query({ owner, repo, branch, path, ref })}`,
    ),
  githubSave: (input: {
    owner: string;
    repo: string;
    branch: string;
    path: string;
    content: string;
    sha?: string;
    message: string;
  }) => request<CloudDocument>("/github/save", input),
  driveFiles: (parent = "root", pageToken?: string, shared = false) =>
    request<{ items: DriveEntry[]; nextPageToken?: string }>(
      `/google/files?${query({ parent, pageToken, shared })}`,
    ),
  driveOpen: (id: string) =>
    request<CloudDocument>(`/google/open?${query({ id })}`),
  driveSave: (input: { id: string; content: string; etag: string }) =>
    request<CloudDocument>("/google/save", input),
  driveCreate: (input: { name: string; content: string; parent?: string }) =>
    request<CloudDocument>("/google/create", input),
  driveRevisions: (id: string, pageToken?: string) =>
    request<{ items: DriveRevision[]; nextPageToken?: string }>(
      `/google/revisions?${query({ id, pageToken })}`,
    ),
  driveRevision: (id: string, revisionId: string) =>
    request<{ content: string }>(
      `/google/revision?${query({ id, revisionId })}`,
    ),
  driveShare: (input: {
    id: string;
    email: string;
    role: "reader" | "writer";
  }) => request<{ ok: boolean }>("/google/share", input),
};

export async function connectAccount(
  provider: Provider,
  before: () => Promise<void>,
): Promise<void> {
  if (!apiBase.startsWith("https:")) {
    await before();
    location.assign(`${apiBase}/auth/${provider}/start`);
    return;
  }
  const popup = window.open(
    "about:blank",
    "fountain-account",
    "popup,width=640,height=740",
  );
  if (!popup)
    throw new CloudError(
      "Allow a sign-in popup for Fountain Publisher and try again.",
      0,
      "POPUP_BLOCKED",
    );
  try {
    await before();
  } catch (error) {
    popup.close();
    throw error;
  }
  return new Promise((resolve, reject) => {
    const origin = new URL(apiBase).origin;
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", message);
      clearInterval(poll);
      clearTimeout(timeout);
      popup.close();
      if (error) reject(error);
      else resolve();
    };
    const message = (event: MessageEvent) => {
      if (event.origin !== origin || event.source !== popup) return;
      if (event.data?.type === `${provider}-connected`) finish();
      if (event.data?.type === `${provider}-error`)
        finish(
          new Error(
            String(event.data.message || "Sign-in could not complete."),
          ),
        );
    };
    window.addEventListener("message", message);
    const poll = setInterval(() => {
      if (popup.closed) {
        cloud
          .status()
          .then((status) =>
            finish(
              status[provider].connected
                ? undefined
                : new Error("Sign-in was closed before it finished."),
            ),
          )
          .catch(finish);
      }
    }, 700);
    const timeout = setTimeout(
      () => finish(new Error("Sign-in expired. Try connecting again.")),
      600000,
    );
    popup.location.href = `${apiBase}/auth/${provider}/start`;
  });
}
