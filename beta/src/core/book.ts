import type { Screenplay, ScriptBlock } from "./model";
import { titlePageExtra } from "./titlePage";
export function nextBookHeading(
  doc: Pick<Screenplay, "blocks">,
  level: 1 | 2,
): string {
  const label = level === 1 ? "Book" : "Chapter";
  const numbers = doc.blocks
    .filter((b) => b.kind === "section" && (b.level || 2) === level)
    .map((b) => new RegExp(`^${label}\\s+(\\d+)\\b`, "i").exec(b.text)?.[1])
    .filter(Boolean)
    .map(Number);
  return `${label} ${Math.max(0, ...numbers) + 1}`;
}
export type PublicationBlock = ScriptBlock & {
  front?: "title" | "author" | "dedication" | "break";
};
export function bookFrontMatter(doc: Screenplay): PublicationBlock[] {
  const result: PublicationBlock[] = [];
  const add = (front: PublicationBlock["front"], text: string) => {
    if (text.trim())
      result.push({ id: `front-${front}`, kind: "centered", text, front });
  };
  add("title", doc.titlePage.title);
  add("author", doc.titlePage.author);
  if (result.length)
    result.push({
      id: "front-title-break",
      kind: "pageBreak",
      text: "",
      front: "break",
    });
  add("dedication", titlePageExtra(doc.titlePage, "Dedication"));
  if (result.at(-1)?.front === "dedication")
    result.push({
      id: "front-dedication-break",
      kind: "pageBreak",
      text: "",
      front: "break",
    });
  return result;
}
