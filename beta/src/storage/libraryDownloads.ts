import { zipSync, strToU8 } from "fflate";
import { libraryRequest, type LibraryFile } from "./writeshapeLibrary";
import { downloadFile } from "./files";
/** Collect first, then offer one ZIP; a failed fetch never masquerades as a complete backup. */
export async function downloadLibraryItems(items: LibraryFile[]) {
  const files: Record<string, Uint8Array> = Object.create(null);
  let bytes = 0,
    count = 0;
  const seen = new Set<string>();
  async function collect(item: LibraryFile, prefix = "") {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    if (++count > 2000)
      throw new Error(
        "Choose fewer than 2,000 files and folders per download.",
      );
    const name = item.name
      .replace(/[\\/\x00-\x1f]/g, "_")
      .replace(/^\.+$/, "_");
    const path = prefix + name;
    if (item.kind === "folder") {
      const list = await libraryRequest(
        "?parent=" + encodeURIComponent(item.id),
      );
      if (!list.items.length) files[path + "/"] = new Uint8Array();
      for (const child of list.items) await collect(child, path + "/");
    } else {
      const file = await libraryRequest("/" + encodeURIComponent(item.id));
      const data = strToU8(file.content);
      if ((bytes += data.length) > 100 * 1024 * 1024)
        throw new Error(
          "This download exceeds 100 MB. Download smaller groups of files.",
        );
      if (Object.hasOwn(files, path))
        throw new Error(
          "Duplicate names in this download. Download those files separately.",
        );
      files[path] = data;
    }
  }
  for (const item of items) await collect(item);
  if (items.length === 1 && items[0].kind === "file") {
    const file = Object.entries(files)[0];
    downloadFile(new Blob([file[1] as BlobPart]), file[0]);
  } else
    downloadFile(
      new Blob([zipSync(files) as BlobPart], { type: "application/zip" }),
      "WriteShape-files.zip",
    );
}
