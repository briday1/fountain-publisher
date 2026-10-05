import type { Beat, Screenplay, TextAnchor } from "./model";
export const bookmarkPrefix = "writeshape-bookmark:";
export interface Bookmark {
  id: string;
  name: string;
  color: string;
  anchor?: TextAnchor;
}
export function bookmarks(doc: Screenplay): Bookmark[] {
  const values = doc.metadata.bookmarks;
  return Array.isArray(values)
    ? values.filter(
        (v): v is Bookmark =>
          v &&
          typeof v.id === "string" &&
          typeof v.name === "string" &&
          typeof v.color === "string" &&
          (!v.anchor ||
            (typeof v.anchor.blockId === "string" &&
              Number.isInteger(v.anchor.offset) &&
              v.anchor.offset >= 0)),
      )
    : [];
}
export function bookmarkBeats(doc: Screenplay): Beat[] {
  return bookmarks(doc).map((b) => ({
    id: bookmarkPrefix + b.id,
    title: b.name,
    color: b.color,
    description: "",
    act: "",
    ...(b.anchor ? { range: { start: b.anchor, end: b.anchor } } : {}),
  }));
}
export function anchoredItems(doc: Screenplay): Beat[] {
  return [...doc.metadata.beats, ...bookmarkBeats(doc)];
}
export function bookmarksFromBeats(items: Beat[]): Bookmark[] {
  return items
    .filter((b) => b.id.startsWith(bookmarkPrefix))
    .map((b) => ({
      id: b.id.slice(bookmarkPrefix.length),
      name: b.title,
      color: b.color,
      ...(b.range ? { anchor: b.range.start } : {}),
    }));
}
