export interface LibraryFile {
  id: string;
  parent: string;
  name: string;
  kind: "file" | "folder";
  revision: number;
  updated?: string;
  bytes?: number;
  content?: string;
  versionId?: string;
}
export interface StorageUsage {
  usedBytes: number;
  currentBytes: number;
  historyBytes: number;
  quotaBytes: number | null;
  historyLimit: number | null;
  fileCount: number;
  folderCount: number;
  versionCount: number;
}
export interface LibraryVersion {
  id: string;
  revision: number;
  name: string;
  savedAt: string;
  bytes: number;
  current: boolean;
  content?: string;
}
export class LibraryError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}
export async function libraryRequest(
  path: string,
  body?: unknown,
): Promise<any> {
  return cloudRequest("/api/library" + path, body);
}
export async function cloudRequest(path: string, body?: unknown): Promise<any> {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.headers.get("Content-Type")?.includes("application/json"))
    throw new LibraryError(
      "Your sign-in needs refreshing. Your local draft is safe.",
      response.status,
    );
  const result = await response.json();
  if (!response.ok)
    throw new LibraryError(
      result.error || "Cloud storage is unavailable.",
      response.status,
      result.code,
    );
  return result;
}
export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes.toLocaleString()} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = bytes / 1024,
    index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index++;
  }
  return `${size.toLocaleString(undefined, { maximumFractionDigits: size < 10 ? 2 : 1 })} ${units[index]}`;
}
export function formatModified(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
export function sortedLibraryItems(
  items: LibraryFile[],
  query: string,
  sort: string,
) {
  const needle = query.trim().toLocaleLowerCase();
  return items
    .filter((item) => item.name.toLocaleLowerCase().includes(needle))
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
      const order =
        sort === "updated"
          ? (b.updated || "").localeCompare(a.updated || "")
          : sort === "size"
            ? (b.bytes || 0) - (a.bytes || 0)
            : 0;
      return (
        order ||
        a.name.localeCompare(b.name, undefined, {
          numeric: true,
          sensitivity: "base",
        })
      );
    });
}
