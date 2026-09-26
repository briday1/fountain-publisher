import { importScreenplay } from "../core/fdx";
import { serializeDocument } from "../core/documentFormat";
import type {
  DestinationSnapshot,
  DestinationAdapter,
} from "../core/destinationSync";
import { cloudRequest, libraryRequest } from "./writeshapeLibrary";
import { readDirectoryFile, writeDirectoryFile } from "./localDirectory";
import type { FileHandle } from "./localDirectory";
export type DestinationProvider = "writeshape" | "drive" | "local";
export interface WriteShapeDestination {
  provider: DestinationProvider;
  id: string;
  accountId?: string;
  parent?: string;
  name: string;
  revision: string;
  baseContent: string;
  canWrite: boolean;
  handle?: FileHandle;
}
export function canonicalContent(content: string, name: string) {
  return serializeDocument(importScreenplay(content, name).screenplay);
}
export function destinationKey(value?: WriteShapeDestination) {
  return value ? `${value.provider}:${value.accountId || ""}:${value.id}` : "";
}
export function destinationLabel(value?: WriteShapeDestination) {
  return value
    ? {
        writeshape: "WriteShape",
        drive: "Google Drive",
        local: "Local folder",
      }[value.provider]
    : "Device draft";
}
export function destinationAdapter(
  binding: () => WriteShapeDestination,
): DestinationAdapter {
  return {
    async read() {
      const d = binding();
      const result =
        d.provider === "writeshape"
          ? await libraryRequest("/" + encodeURIComponent(d.id))
          : d.provider === "drive"
            ? await cloudRequest(
                "/api/drive/open?id=" + encodeURIComponent(d.id),
              )
            : await readDirectoryFile(d.handle!);
      const revision = String(result.revision ?? result.etag);
      return {
        name: result.name,
        revision,
        content:
          revision === d.revision && result.name === d.name
            ? d.baseContent
            : canonicalContent(result.content, result.name),
      };
    },
    async write(value: DestinationSnapshot) {
      const d = binding();
      if (d.provider !== "writeshape" && value.name !== d.name)
        throw new Error(
          "Use Save As to save this destination under a different filename.",
        );
      const result =
        d.provider === "writeshape"
          ? await libraryRequest("", {
              id: d.id,
              parent: d.parent || "",
              name: value.name,
              kind: "file",
              revision: Number(value.revision),
              content: value.content,
            })
          : d.provider === "drive"
            ? await cloudRequest("/api/drive/save", {
                id: d.id,
                etag: value.revision,
                content: value.content,
              })
            : await writeDirectoryFile(d.handle!, value);
      return {
        content: result.content ?? value.content,
        name: result.name ?? value.name,
        revision: String(result.revision ?? result.etag),
      };
    },
  };
}
