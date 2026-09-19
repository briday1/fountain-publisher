import { expect, it } from "vitest";
import { driveBrowserPath, driveBrowserQuery } from "../shared/driveBrowser";
const params = (input: Record<string, string>) =>
  new URL(
    driveBrowserPath(driveBrowserQuery.parse(input)),
    "https://www.googleapis.com",
  ).searchParams;
it("browses My Drive hierarchically and uses independent virtual views", () => {
  expect(params({}).get("q")).toContain("'root' in parents");
  expect(params({ view: "shared" }).get("q")).toContain("sharedWithMe = true");
  expect(params({ view: "starred" }).get("q")).toContain("starred = true");
  expect(params({ view: "all" }).get("q")).not.toContain("in parents");
  expect(params({ view: "recent" }).get("orderBy")).toBe(
    "viewedByMeTime desc,modifiedTime desc",
  );
  expect(params({ view: "shared", parent: "folder" }).get("q")).toContain(
    "'folder' in parents",
  );
  expect(params({ view: "shared", parent: "folder" }).get("q")).not.toContain(
    "sharedWithMe",
  );
});
it("escapes search literals, preserves pagination and scopes shared-drive contents", () => {
  const p = params({
    view: "drives",
    parent: "folder",
    driveId: "drive-id",
    search: "Bob's \\ script",
    pageToken: "opaque+token",
  });
  expect(p.get("q")).toContain("name contains 'Bob\\'s \\\\ script'");
  expect(p.get("driveId")).toBe("drive-id");
  expect(p.get("corpora")).toBe("drive");
  expect(p.get("pageToken")).toBe("opaque+token");
  expect(p.get("includeItemsFromAllDrives")).toBe("true");
  expect(driveBrowserPath(driveBrowserQuery.parse({ view: "drives" }))).toMatch(
    /^\/drive\/v3\/drives\?/,
  );
  expect(() =>
    driveBrowserQuery.parse({ parent: "' or trashed=true" }),
  ).toThrow();
});
