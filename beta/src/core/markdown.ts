import { type FootnoteRun, footnoteRuns, footnotePattern, encodeFootnote } from "./footnotes";
import MarkdownIt from "markdown-it";
import type { Token } from "markdown-it";
import {
  emptyScreenplay,
  newId,
  type Screenplay,
  type ScriptBlock,
  type TextSpan,
  type TextMark,
} from "./model";
const markdown = new MarkdownIt({
  html: true,
  linkify: false,
  typographer: false,
});
export const isNovel = (doc: Screenplay) => doc.metadata.format === "markdown";
export const proseLabels = {
  action: "Body text",
  section: "Heading",
  dialogue: "Quote / inset passage",
  centered: "Epigraph",
  parenthetical: "Attribution",
  pageBreak: "Section break",
};
function inline(tokens: Token[] | null): TextSpan[] | undefined {
  const spans: TextSpan[] = [],
    marks: TextMark[] = [];
  for (const t of tokens || []) {
    if (t.type === "html_inline" && t.content === "<u>")
      marks.push("underline");
    else if (t.type === "html_inline" && t.content === "</u>")
      marks.splice(marks.lastIndexOf("underline"), 1);
    else if (t.type === "strong_open") marks.push("bold");
    else if (t.type === "em_open") marks.push("italic");
    else if (t.type === "strong_close")
      marks.splice(marks.lastIndexOf("bold"), 1);
    else if (t.type === "em_close")
      marks.splice(marks.lastIndexOf("italic"), 1);
    else if (["text", "softbreak", "hardbreak"].includes(t.type))
      spans.push({
        text: t.type === "text" ? t.content : "\n",
        ...(marks.length ? { marks: [...marks] } : {}),
      });
    else return undefined;
  }
  return spans;
}
export function parseMarkdown(input: string): Screenplay {
  let source = input.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  let saved: any;
  const envelope = source.match(
    /\n?<!-- WriteShape metadata\n([\s\S]*?)\n-->\s*$/,
  );
  if (envelope)
    try {
      const value = JSON.parse(envelope[1]);
      if (
        value?.version === 1 &&
        value.metadata &&
        Array.isArray(value.blocks)
      ) {
        saved = value;
        source = source.slice(0, envelope.index);
      }
    } catch {
      /* Retain unrecognized comments as source. */
    }
  // Standard Markdown reference notes are stored inline internally so edits and undo move them together.
  const definitions = new Map<string, string>();
  source = source.replace(
    /^\[\^([^\]\n]+)\]:[ \t]*(.*)(?:\n(?:[ \t]{4}|\t).*)*/gm,
    (definition) => {
      const match = definition.match(/^\[\^([^\]]+)\]:[ \t]*([\s\S]*)$/)!;
      const raw = match[2].replace(/\n(?: {4}|\t)/g, " ");
      const parsed = inline(markdown.parseInline(raw, {})[0]?.children || null);
      definitions.set(match[1], parsed?.map((s) => s.text).join("") ?? raw);
      return "";
    },
  );
  source = source.replace(/\[\^([^\]\n]+)\]/g, (match, id) =>
    definitions.has(id)
      ? escapeText(encodeFootnote(definitions.get(id)!))
      : match,
  );
  const doc = emptyScreenplay();
  doc.blocks = [];
  const raw: Record<string, string> = {};
  const lines = source.split("\n");
  const tokens = markdown.parse(source, {});
  const add = (
    kind: ScriptBlock["kind"],
    spans: TextSpan[],
    level?: number,
    rawSource?: string,
  ) => {
    const block: ScriptBlock = {
      id: newId(),
      kind,
      text: spans.map((s) => s.text).join(""),
      ...(spans.some((s) => s.marks?.length) ? { spans } : {}),
      ...(level ? { level } : {}),
    };
    doc.blocks.push(block);
    if (rawSource != null) raw[block.id] = rawSource;
  };
  for (let i = 0; i < tokens.length;) {
    const token = tokens[i];
    if (token.level !== 0 || !token.map) {
      i++;
      continue;
    }
    let end = i + 1;
    if (token.nesting === 1) {
      let depth = 1;
      while (end < tokens.length && depth) {
        depth += tokens[end].nesting;
        end++;
      }
    }
    const group = tokens.slice(i, end),
      rawSource = lines
        .slice(token.map[0], token.map[1])
        .join("\n")
        .replace(/\n+$/, "");
    if (["heading_open", "paragraph_open"].includes(token.type)) {
      const text = group.find((t) => t.type === "inline"),
        spans = inline(text?.children || null);
      if (spans)
        add(
          token.type === "heading_open" ? "section" : "action",
          spans,
          token.type === "heading_open"
            ? Number(token.tag.slice(1))
            : undefined,
        );
      else add("action", [{ text: rawSource }], undefined, rawSource);
    } else if (token.type === "hr") add("pageBreak", [{ text: "" }]);
    else if (
      token.type === "blockquote_open" &&
      group.every((t) =>
        [
          "blockquote_open",
          "blockquote_close",
          "paragraph_open",
          "paragraph_close",
          "inline",
        ].includes(t.type),
      ) &&
      group.filter((t) => t.type === "blockquote_open").length === 1
    ) {
      const paragraphs = group.filter((t) => t.type === "inline");
      if (paragraphs.every((t) => inline(t.children) !== undefined))
        for (const paragraph of paragraphs) {
          let spans = inline(paragraph.children)!;
          const text = spans.map((s) => s.text).join("");
          let kind: ScriptBlock["kind"] = spans
            .filter((s) => s.text.trim())
            .every((s) => s.marks?.includes("italic"))
            ? "centered"
            : "dialogue";
          if (/^—\s/.test(text)) {
            kind = "parenthetical";
            let remaining = 2;
            spans = spans.map((s) => {
              const trim = Math.min(s.text.length, remaining);
              remaining -= trim;
              return { ...s, text: s.text.slice(trim) };
            });
          }
          add(kind, spans);
        }
      else add("action", [{ text: rawSource }], undefined, rawSource);
    } else add("action", [{ text: rawSource }], undefined, rawSource);
    i = end;
  }
  if (!doc.blocks.length) doc.blocks = emptyScreenplay().blocks;
  if (saved) {
    const ids = new Set<string>();
    let savedIndex = 0;
    doc.blocks.forEach((block) => {
      const match = saved.blocks.findIndex(
        (old: any, i: number) => i >= savedIndex && old?.text === block.text,
      );
      const old = saved.blocks[match];
      if (match >= 0) savedIndex = match + 1;
      if (
        old &&
        typeof old.id === "string" &&
        old.id.length < 200 &&
        old.text === block.text &&
        !ids.has(old.id)
      ) {
        const originalId = block.id;
        block.id = old.id;
        ids.add(block.id);
        if (raw[originalId] != null) {
          raw[block.id] = raw[originalId];
          delete raw[originalId];
        }
      }
    });
    const meta = saved.metadata;
    doc.metadata = {
      ...meta,
      version: 1,
      notes: typeof meta.notes === "string" ? meta.notes : "",
      beats: Array.isArray(meta.beats)
        ? meta.beats
            .filter(
              (b: any) =>
                b && typeof b.id === "string" && typeof b.title === "string",
            )
            .map((b: any) => ({
              ...b,
              description:
                typeof b.description === "string" ? b.description : "",
              act: typeof b.act === "string" ? b.act : "Act I",
              color: typeof b.color === "string" ? b.color : "#75a8ed",
            }))
        : [],
    };
    if (saved.titlePage)
      for (const key of [
        "title",
        "credit",
        "author",
        "source",
        "draftDate",
        "contact",
      ] as const)
        if (typeof saved.titlePage[key] === "string")
          doc.titlePage[key] = saved.titlePage[key];
  }
  if (saved?.titlePage?.extra && typeof saved.titlePage.extra === "object")
    doc.titlePage.extra = Object.fromEntries(
      Object.entries(saved.titlePage.extra).filter(
        ([, value]) => typeof value === "string",
      ),
    ) as Record<string, string>;
  doc.metadata.format = "markdown";
  doc.metadata.markdownRaw = raw;
  return doc;
}
function escapeText(text: string): string {
  return text.replace(/([\\`*_{}\[\]<>])/g, "\\$1").replace(/\n/g, "  \n");
}
export function markdownInline(
  block: ScriptBlock,
  counter?: { value: number },
  notes?: { number: number; text: string }[],
): string {
  const spans: FootnoteRun[] | undefined = counter
    ? footnoteRuns(block, counter)
    : block.spans?.map((s) => s.text).join("") === block.text
      ? block.spans
      : [{ text: block.text }];
  return (spans || [])
    .map((s) => {
      if (s.note) {
        notes?.push(s.note);
        return `[^${s.note.number}]`;
      }
      const leading = s.text.match(/^\s*/)?.[0] || "",
        trailing = s.text.slice(leading.length).match(/\s*$/)?.[0] || "";
      let core = escapeText(
        s.text.slice(leading.length, s.text.length - trailing.length),
      );
      const marks = s.marks || [];
      if (core) {
        if (marks.includes("bold")) core = `**${core}**`;
        if (marks.includes("italic")) core = `*${core}*`;
        if (marks.includes("underline")) core = `<u>${core}</u>`;
      }
      return escapeText(leading) + core + escapeText(trailing);
    })
    .join("");
}
export function serializeMarkdown(doc: Screenplay): string {
  const raw = (doc.metadata.markdownRaw || {}) as Record<string, string>;
  const counter = { value: 0 },
    notes: { number: number; text: string }[] = [];
  const body = doc.blocks
    .map((block) => {
      if (
        !footnotePattern().test(block.text) &&
        raw[block.id] === block.text &&
        block.kind === "action" &&
        !block.spans?.some((s) => s.marks?.length)
      )
        return raw[block.id];
      let text =
        block.kind === "centered" ? "" : markdownInline(block, counter, notes);
      if (block.kind === "section")
        return (
          "#".repeat(Math.max(1, Math.min(6, block.level || 2))) + " " + text
        );
      if (block.kind === "pageBreak") return "---";
      if (block.kind === "centered") {
        text = markdownInline(
          {
            ...block,
            spans: (block.spans || [{ text: block.text }]).map((s) => ({
              ...s,
              marks: [...new Set([...(s.marks || []), "italic" as const])],
            })),
          },
          counter,
          notes,
        );
      }
      if (block.kind === "parenthetical") text = "— " + text;
      if (["dialogue", "centered", "parenthetical"].includes(block.kind))
        return text
          .split("\n")
          .map((line) => "> " + line)
          .join("\n");
      // Literal paragraph prefixes must not acquire heading, list or quote semantics on reopen.
      return text.replace(
        /^(\s*)([#>+-]|\d+\.)/gm,
        (_match, space: string, prefix: string) =>
          space +
          (/^\d/.test(prefix) ? prefix.replace(".", "\\.") : "\\" + prefix),
      );
    })
    .join("\n\n");
  const { markdownRaw, ...metadata } = doc.metadata;
  const envelope = JSON.stringify({
    version: 1,
    metadata,
    titlePage: doc.titlePage,
    blocks: doc.blocks.map((b) => ({ id: b.id, text: b.text })),
  })
    .replace(/</g, "\\u003c")
    .replace(/--/g, "\\u002d\\u002d");
  const definitions = notes
    .map((n) => `[^${n.number}]: ${escapeText(n.text)}`)
    .join("\n");
  return (
    body +
    (definitions ? "\n\n" + definitions : "") +
    "\n\n<!-- WriteShape metadata\n" +
    envelope +
    "\n-->\n"
  );
}
export function createNovel(): Screenplay {
  const doc = emptyScreenplay();
  doc.metadata.format = "markdown";
  doc.titlePage.credit = "";
  doc.blocks = [{ id: newId(), kind: "action", text: "" }];
  return doc;
}
