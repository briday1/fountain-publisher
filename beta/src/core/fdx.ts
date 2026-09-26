import { parseMarkdown } from "./markdown";
import { emptyScreenplay, newId } from "./model";
import type {
  BlockKind,
  Screenplay,
  ScriptBlock,
  TextMark,
  TextSpan,
} from "./model";
import { parseFountain } from "./fountain";
const children = (element: Element, tag: string) =>
  Array.from(element.children).filter((child) => child.localName === tag);
const kinds: Record<string, BlockKind> = {
  "Scene Heading": "scene",
  Action: "action",
  Character: "character",
  Dialogue: "dialogue",
  Parenthetical: "parenthetical",
  Transition: "transition",
  Shot: "action",
  General: "action",
  Lyrics: "lyrics",
  Centered: "centered",
  Section: "section",
  Synopsis: "synopsis",
};
function spans(element: Element): TextSpan[] {
  return children(element, "Text").map((text) => {
    const style = (text.getAttribute("Style") ?? "")
      .split(/[+,\s]+/)
      .map((value) => value.toLowerCase());
    const marks = (["bold", "italic", "underline"] as TextMark[]).filter(
      (mark) => style.includes(mark),
    );
    return { text: text.textContent ?? "", ...(marks.length ? { marks } : {}) };
  });
}
const text = (element: Element) =>
  spans(element)
    .map((span) => span.text)
    .join("");
export function parseFdx(source: string): Screenplay {
  if (/<!DOCTYPE|<!ENTITY/i.test(source))
    throw new Error(
      "This FDX contains unsupported document entities. Export a standard Final Draft (.fdx) file and try again.",
    );
  const xml = new DOMParser().parseFromString(source, "application/xml");
  if (
    xml.getElementsByTagName("parsererror").length ||
    xml.documentElement.localName !== "FinalDraft"
  )
    throw new Error(
      "This is not a valid Final Draft (.fdx) screenplay. Your current draft has been kept.",
    );
  const content = children(xml.documentElement, "Content")[0];
  if (!content)
    throw new Error("This Final Draft file has no screenplay content.");
  const result = emptyScreenplay();
  result.blocks = [];
  function paragraph(element: Element, dual = false) {
    if (element.getAttribute("StartsNewPage") === "Yes")
      result.blocks.push({ id: newId(), kind: "pageBreak", text: "" });
    const pair = children(element, "DualDialogue")[0];
    if (pair) {
      let characters = 0;
      for (const child of children(pair, "Paragraph")) {
        const character = child.getAttribute("Type") === "Character";
        paragraph(child, character && characters++ > 0);
      }
      return;
    }
    const runs = spans(element);
    const value = runs.map((span) => span.text).join("");
    const type = element.getAttribute("Type") ?? "Action";
    const kind =
      kinds[type] ?? (/^Outline|^Section/i.test(type) ? "section" : "action");
    const block: ScriptBlock = {
      id: newId(),
      kind,
      text: value,
      ...(runs.some((span) => span.marks?.length) ? { spans: runs } : {}),
      ...(dual ? { dual: true } : {}),
      ...(kind === "scene" && element.getAttribute("Number")
        ? { sceneNumber: element.getAttribute("Number")! }
        : {}),
      ...(kind === "section"
        ? { level: Number(type.match(/\d+/)?.[0] ?? 1) }
        : {}),
    };
    result.blocks.push(block);
    for (const note of children(element, "ScriptNote")) {
      const value = children(note, "Paragraph").map(text).join("\n");
      if (value) result.blocks.push({ id: newId(), kind: "note", text: value });
    }
  }
  for (const element of content.children) {
    if (element.localName === "Paragraph") paragraph(element);
    else if (element.localName === "DualDialogue") {
      let characters = 0;
      for (const child of children(element, "Paragraph")) {
        const character = child.getAttribute("Type") === "Character";
        paragraph(child, character && characters++ > 0);
      }
    }
  }
  if (!result.blocks.length) result.blocks = emptyScreenplay().blocks;
  const title = children(xml.documentElement, "TitlePage")[0];
  const titleContent = title && children(title, "Content")[0];
  if (titleContent) {
    const center: string[] = [],
      contact: string[] = [];
    for (const row of children(titleContent, "Paragraph")) {
      const value = text(row).trim();
      if (!value) continue;
      if (/^(?:©|copyright\b)/i.test(value)) {
        (result.titlePage.extra ??= {}).Copyright = value;
        continue;
      }
      if (row.getAttribute("Alignment") === "Center") center.push(value);
      else contact.push(value);
    }
    result.titlePage.title = center.shift() ?? contact.shift() ?? "";
    if (center[0] && /^(?:written|screenplay|story)\s+by\b/i.test(center[0]))
      result.titlePage.credit = center.shift()!;
    if (center.length) result.titlePage.author = center.shift()!;
    if (center.length) result.titlePage.source = center.join("\n");
    result.titlePage.contact = contact.join("\n");
  }
  return result;
}
export function importScreenplay(
  content: string,
  name: string,
): { screenplay: Screenplay; name: string; converted: boolean } {
  const converted = /\.fdx$/i.test(name);
  return {
    screenplay: /\.(md|markdown)$/i.test(name) ? parseMarkdown(content) : converted ? parseFdx(content) : parseFountain(content),
    name: converted ? name.replace(/\.fdx$/i, ".fountain") : name,
    converted,
  };
}
