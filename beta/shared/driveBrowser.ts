import { z } from "zod";
const id = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[\w-]+$/);
export const driveBrowserQuery = z.object({
  view: z
    .enum(["my", "all", "shared", "recent", "starred", "drives"])
    .default("my"),
  parent: id.optional(),
  driveId: id.optional(),
  search: z.string().max(200).default(""),
  pageToken: z.string().max(4096).optional(),
});
export type DriveBrowserQuery = z.infer<typeof driveBrowserQuery>;
export function driveBrowserPath(input: DriveBrowserQuery): string {
  const escape = (text: string) =>
    text.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

  if (input.view === "drives" && !input.parent) {
    return `/drive/v3/drives?${new URLSearchParams({ pageSize: "100", fields: "nextPageToken,drives(id,name,capabilities(canAddChildren))", ...(input.search.trim() ? { q: `name contains '${escape(input.search.trim())}'` } : {}), ...(input.pageToken ? { pageToken: input.pageToken } : {}) })}`;
  }
  const filters = [
    "trashed = false",
    "(mimeType = 'application/vnd.google-apps.folder' or name contains '.fountain' or name contains '.txt' or name contains '.fdx')",
  ];
  if (input.parent) filters.push(`'${escape(input.parent)}' in parents`);
  else if (input.view === "my")
    filters.push(input.search ? "'me' in owners" : "'root' in parents");
  else if (input.view === "shared") filters.push("sharedWithMe = true");
  else if (input.view === "starred") filters.push("starred = true");
  if (input.search.trim())
    filters.push(`name contains '${escape(input.search.trim())}'`);
  return `/drive/v3/files?${new URLSearchParams({
    q: filters.join(" and "),
    pageSize: "100",
    orderBy:
      input.view === "recent" && !input.parent
        ? "viewedByMeTime desc,modifiedTime desc"
        : "folder,name_natural",
    fields:
      "nextPageToken,files(id,name,mimeType,modifiedTime,webViewLink,driveId,capabilities(canEdit,canAddChildren),shared)",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
    ...(input.driveId
      ? { corpora: "drive", driveId: input.driveId }
      : { corpora: "user" }),
    ...(input.pageToken ? { pageToken: input.pageToken } : {}),
  })}`;
}
