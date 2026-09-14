import { parseFountain } from "../core/fountain";
import type { RemoteLocation } from "./cloud";
import { workspace } from "./workspace";
import type { WorkspaceDocument, WorkspaceRepository } from "./workspace";

export const legacyWorkspaceKey = "fountain-publisher.workspace.v1";
const importedPrefix = "fp2.legacy-workspace.imported.";
type CacheStorage = Pick<Storage, "getItem" | "setItem">;
type Repository = Pick<WorkspaceRepository, "importDraft">;

function oldStorage(): CacheStorage | undefined {
  try {
    return localStorage;
  } catch {
    return undefined;
  }
}

function githubLocation(value: unknown): RemoteLocation | undefined {
  if (!value || typeof value !== "object") return;
  const file = value as Record<string, unknown>;
  if (
    typeof file.owner !== "string" ||
    !/^[\w.-]+$/.test(file.owner) ||
    typeof file.repo !== "string" ||
    !/^[\w.-]+$/.test(file.repo) ||
    typeof file.branch !== "string" ||
    !file.branch ||
    /[\x00-\x1f\x7f]/.test(file.branch) ||
    typeof file.path !== "string" ||
    !/\.(fountain|txt)$/i.test(file.path) ||
    file.path.startsWith("/") ||
    /[\\\x00-\x1f\x7f]/.test(file.path) ||
    file.path.split("/").some((part) => part === "." || part === "..") ||
    typeof file.sha !== "string" ||
    !/^[a-f0-9]{40,64}$/i.test(file.sha)
  )
    return;
  return {
    provider: "github",
    owner: file.owner,
    repo: file.repo,
    branch: file.branch,
    path: file.path,
    sha: file.sha,
  };
}

/** Import the old origin's draft once, leaving its original source available for recovery. */
export async function migrateLegacyWorkspace(
  repository: Repository = workspace,
  storage = oldStorage(),
): Promise<WorkspaceDocument | undefined> {
  if (!storage) return;
  let cached: Record<string, unknown>;
  try {
    const value: unknown = JSON.parse(
      storage.getItem(legacyWorkspaceKey) || "null",
    );
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    cached = value as Record<string, unknown>;
  } catch {
    return;
  }
  if (cached.version !== 1 || typeof cached.source !== "string") return;
  const name =
    typeof cached.filename === "string" && cached.filename.trim()
      ? cached.filename
      : "Untitled.fountain";
  // Viewport timestamps change without writing. Identity follows only the draft,
  // so a still-open old tab can save later writing without replacing this import.
  const digest = new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(JSON.stringify([name, cached.source])),
    ),
  );
  const fingerprint = [...digest]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const id = `legacy-workspace-${fingerprint}`;
  const marker = `${importedPrefix}${fingerprint}`;
  try {
    // A writer may have deliberately deleted a previously imported document.
    if (storage.getItem(marker) === id) return;
  } catch {
    // A durable document ID still prevents duplicates if preferences are blocked.
  }
  const saved = await repository.importDraft(
    {
      id,
      name,
      screenplay: parseFountain(cached.source),
      remote:
        cached.saveDestination === "github"
          ? githubLocation(cached.githubFile)
          : undefined,
    },
    typeof cached.savedSource === "string" &&
      cached.savedSource !== cached.source
      ? parseFountain(cached.savedSource)
      : undefined,
  );
  try {
    storage.setItem(marker, id);
  } catch {
    // The original cache and committed IndexedDB copy remain intact.
  }
  return saved;
}
