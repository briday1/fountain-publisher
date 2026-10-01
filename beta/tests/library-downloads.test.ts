import { afterEach, expect, it, vi } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import { downloadLibraryItems } from "../src/storage/libraryDownloads";
import {
  libraryRequest,
  type LibraryFile,
} from "../src/storage/writeshapeLibrary";
import { downloadFile } from "../src/storage/files";
vi.mock("../src/storage/writeshapeLibrary", () => ({
  libraryRequest: vi.fn(),
}));
vi.mock("../src/storage/files", () => ({ downloadFile: vi.fn() }));
afterEach(() => vi.resetAllMocks());
const item = (
  id: string,
  name: string,
  kind: "file" | "folder" = "file",
): LibraryFile => ({ id, name, kind, revision: 1, parent: "" });
function bytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });
}
it("downloads nested folders with original text in a single complete ZIP", async () => {
  vi.mocked(libraryRequest).mockImplementation(async (path) => {
    if (path === "?parent=folder")
      return {
        items: [item("a", "Scene.fountain"), item("empty", "Empty", "folder")],
      };
    if (path === "?parent=empty") return { items: [] };
    if (path === "/a") return { content: "INT. ROOM - DAY\n\nCafé.\n" };
    if (path === "/b") return { content: "Second document." };
    throw new Error("Unexpected path");
  });
  await downloadLibraryItems([
    item("folder", "Drafts", "folder"),
    item("b", "Notes.md"),
  ]);
  expect(downloadFile).toHaveBeenCalledTimes(1);
  const [blob, name] = vi.mocked(downloadFile).mock.calls[0];
  expect(name).toBe("WriteShape-files.zip");
  const contents = unzipSync(await bytes(blob as Blob));
  expect(Object.keys(contents).sort()).toEqual([
    "Drafts/Empty/",
    "Drafts/Scene.fountain",
    "Notes.md",
  ]);
  expect(strFromU8(contents["Drafts/Scene.fountain"])).toBe(
    "INT. ROOM - DAY\n\nCafé.\n",
  );
});
it("never offers a partial backup after any file fails", async () => {
  vi.mocked(libraryRequest)
    .mockResolvedValueOnce({ content: "First" })
    .mockRejectedValueOnce(new Error("Offline"));
  await expect(
    downloadLibraryItems([item("a", "A.fountain"), item("b", "B.fountain")]),
  ).rejects.toThrow("Offline");
  expect(downloadFile).not.toHaveBeenCalled();
});
it("downloads a single file directly without a ZIP", async () => {
  vi.mocked(libraryRequest).mockResolvedValue({ content: "All my words." });
  await downloadLibraryItems([item("a", "Script.fountain")]);
  const [blob, name] = vi.mocked(downloadFile).mock.calls[0];
  expect(name).toBe("Script.fountain");
  expect(strFromU8(await bytes(blob as Blob))).toBe("All my words.");
});
