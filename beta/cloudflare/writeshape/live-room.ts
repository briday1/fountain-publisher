import { LiveScreenplayRoom, type LiveRoomContext } from "../liveRoom";
import { LiveError } from "../liveDrive";
import type { LiveEnvironment } from "../liveDrive";
import { parseMarkdown, isNovel } from "../../src/core/markdown";
import { parseFountain } from "../../src/core/fountain";
import { serializeDocument } from "../../src/core/documentFormat";
// The adapter is also exercised directly by the Node worker contract tests.
// @ts-ignore JavaScript Worker module
import { WriteShapeLiveStorage } from "./live-storage.mjs";
export class WriteShapeLiveRoom extends LiveScreenplayRoom {
  constructor(context: LiveRoomContext, env: LiveEnvironment) {
    const storage = new WriteShapeLiveStorage(env);
    const wrap =
      (method: string) =>
      async (...args: any[]) => {
        try {
          return await storage[method](...args);
        } catch (error: any) {
          throw new LiveError(
            error.status || 503,
            [401, 403, 404].includes(error.status)
              ? "LIVE_ACCESS"
              : error.status === 409
                ? "LIVE_CONFLICT"
                : "LIVE_UNAVAILABLE",
            error.status
              ? error.message
              : "Live storage is unavailable. Your local writing is preserved.",
          );
        }
      };
    super(context, env, {
      drive: {
        authorize: wrap("authorize"),
        snapshot: wrap("snapshot"),
        save: wrap("save"),
        verifyOriginalRoom: wrap("verifyOriginalRoom"),
      },
      parse: (content, name) =>
        /\.(md|markdown)$/i.test(name)
          ? parseMarkdown(content)
          : parseFountain(content),
      serialize: (doc, name) => {
        if (name && isNovel(doc) !== /\.(md|markdown)$/i.test(name))
          throw new Error(
            "Live document format cannot change. Save a new copy.",
          );
        return serializeDocument(doc);
      },
    });
  }
}
