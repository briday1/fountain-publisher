import { serializeFountain } from "./fountain";
import { isNovel, serializeMarkdown } from "./markdown";
import type { Screenplay } from "./model";
export function serializeDocument(doc: Screenplay): string {
  return isNovel(doc) ? serializeMarkdown(doc) : serializeFountain(doc);
}

/** Keep filename-based readers in the document's actual format. */
export function documentFilename(
  requested: string,
  sourceName: string,
): string {
  const name = requested.trim();
  const novel = /\.(md|markdown)$/i.test(sourceName);
  if (novel ? /\.(md|markdown)$/i.test(name) : /\.(fountain|txt)$/i.test(name))
    return name;
  return (
    name.replace(/\.(md|markdown|fountain|txt)$/i, "") +
    (novel ? ".md" : ".fountain")
  );
}
