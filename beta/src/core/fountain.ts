import { emptyTitlePage, newId } from "./model";
import { isBeatRange, resolveBeatRange } from "./beatRanges";
import type {
  BlockKind,
  Screenplay,
  ScriptBlock,
  ScriptMetadata,
  TextMark,
  TextSpan,
  TitlePage,
} from "./model";

const marker = "FOUNTAIN-PUBLISHER v1";
const markOrder: TextMark[] = ["bold", "italic", "underline"];
const markSyntax: Record<TextMark, string> = {
  bold: "**",
  italic: "*",
  underline: "_",
};
const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

/** A small, deterministic fingerprint, used for reconciliation rather than security. */
export function fingerprint(text: string): string {
  let first = 2166136261;
  let second = 2246822519;
  for (let i = 0; i < text.length; i++) {
    first = Math.imul(first ^ text.charCodeAt(i), 16777619);
    second = Math.imul(second ^ text.charCodeAt(i), 3266489917);
  }
  return `${(first >>> 0).toString(36)}${(second >>> 0).toString(36)}:${text.length}`;
}

function appendSpan(spans: TextSpan[], text: string, marks: TextMark[]) {
  if (!text) return;
  const previous = spans.at(-1);
  if (previous && (previous.marks ?? []).join() === marks.join())
    previous.text += text;
  else spans.push(marks.length ? { text, marks: [...marks] } : { text });
}

/** Fountain emphasis is line-local. Unclosed and escaped delimiters stay literal. */
export function parseInline(source: string): TextSpan[] {
  const spans: TextSpan[] = [];
  source.split("\n").forEach((line, lineIndex) => {
    if (lineIndex) appendSpan(spans, "\n", []);
    const stack: { mark: TextMark; start: number; length: number }[] = [];
    const removed = new Set<number>();
    const events = new Map<number, { mark: TextMark; delta: number }[]>();
    const event = (position: number, mark: TextMark, delta: number) =>
      events.set(position, [...(events.get(position) ?? []), { mark, delta }]);
    for (let i = 0; i < line.length;) {
      if (line[i] === "\\" && /[\\*_\[\]]/.test(line[i + 1] ?? "")) {
        i += 2;
        continue;
      }
      if (line[i] !== "*" && line[i] !== "_") {
        i++;
        continue;
      }
      const char = line[i];
      let end = i + 1;
      while (line[end] === char) end++;
      let remaining = end - i;
      let offset = i;
      const canClose = i > 0 && !/\s/.test(line[i - 1]);
      const canOpen = end < line.length && !/\s/.test(line[end]);
      if (canClose) {
        while (remaining && stack.length) {
          const top = stack.at(-1)!;
          if (
            (top.mark === "underline") !== (char === "_") ||
            top.length > remaining
          )
            break;
          stack.pop();
          for (let p = top.start; p < top.start + top.length; p++)
            removed.add(p);
          for (let p = offset; p < offset + top.length; p++) removed.add(p);
          event(top.start + top.length, top.mark, 1);
          event(offset, top.mark, -1);
          offset += top.length;
          remaining -= top.length;
        }
      }
      if (canOpen) {
        while (remaining) {
          const length = char === "*" && remaining >= 2 ? 2 : 1;
          stack.push({
            mark: char === "_" ? "underline" : length === 2 ? "bold" : "italic",
            start: offset,
            length,
          });
          offset += length;
          remaining -= length;
        }
      }
      i = end;
    }
    const active: Record<TextMark, number> = {
      bold: 0,
      italic: 0,
      underline: 0,
    };
    for (let i = 0; i < line.length; i++) {
      for (const item of events.get(i) ?? []) active[item.mark] += item.delta;
      if (removed.has(i)) continue;
      const marks = markOrder.filter((mark) => active[mark] > 0);
      if (line[i] === "\\" && /[\\*_\[\]]/.test(line[i + 1] ?? ""))
        appendSpan(spans, line[++i], marks);
      else appendSpan(spans, line[i], marks);
    }
  });
  return spans.length ? spans : [{ text: "" }];
}

export function formatInline(spans: TextSpan[]): string {
  // Whitespace carries no visible emphasis. Keep it outside delimiters, as Fountain requires.
  const units: { text: string; marks: TextMark[] }[] = [];
  for (const span of spans) {
    for (const part of span.text.split(/(\s+)/)) {
      if (part)
        units.push({
          text: part,
          marks: /^\s+$/.test(part)
            ? []
            : markOrder.filter((mark) => span.marks?.includes(mark)),
        });
    }
  }
  // Keep internal spaces in one emphasis run when the surrounding styles agree.
  for (let i = 1; i < units.length - 1; i++) {
    if (/^[^\S\n]+$/.test(units[i].text))
      units[i].marks = units[i - 1].marks.filter((mark) =>
        units[i + 1].marks.includes(mark),
      );
  }
  let result = "";
  let open: TextMark[] = [];
  for (const unit of units) {
    let common = 0;
    while (
      common < open.length &&
      common < unit.marks.length &&
      open[common] === unit.marks[common]
    )
      common++;
    result += open
      .slice(common)
      .reverse()
      .map((mark) => markSyntax[mark])
      .join("");
    result += unit.marks
      .slice(common)
      .map((mark) => markSyntax[mark])
      .join("");
    result += unit.text.replace(/[\\*_\[\]]/g, "\\$&");
    open = unit.marks;
  }
  return (
    result +
    open
      .reverse()
      .map((mark) => markSyntax[mark])
      .join("")
  );
}

export function blockSpans(block: ScriptBlock): TextSpan[] {
  return block.spans?.map((span) => span.text).join("") === block.text
    ? block.spans
    : [{ text: block.text }];
}

interface BlockRecord {
  id: string;
  kind: BlockKind;
  hash: string;
  start: number;
  end: number;
  level?: number;
  dual?: boolean;
  sceneNumber?: string;
  raw?: boolean;
  escapedBoneyard?: boolean;
  styles?: { length: number; marks?: TextMark[] }[];
}
interface Envelope {
  format: "fountain-publisher";
  version: 1;
  bodyHash: string;
  bodyLength?: number;
  metadata: ScriptMetadata;
  blocks: BlockRecord[];
  titlePage?: TitlePage;
}
const blockKinds = new Set<BlockKind>([
  "scene",
  "action",
  "character",
  "dialogue",
  "parenthetical",
  "transition",
  "section",
  "synopsis",
  "note",
  "lyrics",
  "centered",
  "pageBreak",
  "boneyard",
]);

function validEnvelope(value: unknown): value is Envelope {
  return (
    isObject(value) &&
    value.format === "fountain-publisher" &&
    value.version === 1 &&
    typeof value.bodyHash === "string" &&
    isObject(value.metadata) &&
    Array.isArray(value.blocks) &&
    value.blocks.every(
      (record) =>
        isObject(record) &&
        typeof record.id === "string" &&
        typeof record.hash === "string" &&
        blockKinds.has(record.kind as BlockKind) &&
        Number.isSafeInteger(record.start) &&
        Number.isSafeInteger(record.end),
    )
  );
}

function normalizeMetadata(raw: Record<string, unknown>): ScriptMetadata {
  return {
    ...raw,
    version: 1,
    beats: Array.isArray(raw.beats)
      ? (raw.beats
          .filter(
            (beat) =>
              isObject(beat) &&
              typeof beat.id === "string" &&
              typeof beat.title === "string",
          )
          .map((beat) => ({
            ...beat,
            description:
              typeof beat.description === "string" ? beat.description : "",
            color: typeof beat.color === "string" ? beat.color : "#a3a880",
            act: typeof beat.act === "string" ? beat.act : "",
          }))
          .map((beat) => {
            if ("range" in beat && !isBeatRange(beat.range)) {
              const { range: _range, sceneId: _sceneId, ...unassigned } = beat;
              return unassigned;
            }
            return beat;
          }) as ScriptMetadata["beats"])
      : [],
    notes: typeof raw.notes === "string" ? raw.notes : "",
  };
}

const titleKeys: Record<string, keyof TitlePage> = {
  title: "title",
  credit: "credit",
  author: "author",
  authors: "author",
  source: "source",
  "draft date": "draftDate",
  date: "draftDate",
  contact: "contact",
  "contact info": "contact",
};

function readTitle(lines: string[]): { titlePage: TitlePage; end: number } {
  const titlePage = { ...emptyTitlePage(), credit: "" };
  const first = lines[0]?.match(/^([\p{L}][\p{L}\p{N} _-]*):(?:[ \t]*(.*))$/u);
  // A transition with no value is not a title-page field.
  if (
    !first ||
    (!titleKeys[first[1].toLowerCase()] &&
      !first[2] &&
      !/^(?: {3,}|\t)/.test(lines[1] ?? ""))
  )
    return { titlePage, end: 0 };
  let i = 0;
  let key = "";
  const fields: Record<string, string> = {};
  for (; i < lines.length; i++) {
    const line = lines[i];
    const field = line.match(/^([\p{L}][\p{L}\p{N} _-]*):[ \t]*(.*)$/u);
    if (field) {
      key = field[1];
      fields[key] = field[2];
    } else if (/^(?: {3,}|\t)/.test(line) && key)
      fields[key] +=
        `${fields[key] ? "\n" : ""}${line.replace(/^(?: {3,}|\t)/, "")}`;
    else break;
  }
  for (const [name, value] of Object.entries(fields)) {
    const target = titleKeys[name.toLowerCase()];
    if (target && target !== "extra")
      titlePage[target] = parseInline(value)
        .map((span) => span.text)
        .join("");
    else (titlePage.extra ??= {})[name] = value;
  }
  while (lines[i] === "") i++;
  return { titlePage, end: i };
}

export function parseFountain(
  input: string,
  options: { titlePage?: boolean } = {},
): Screenplay {
  let source = input.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const originalLineCount = source.split("\n").length;
  let envelope: Envelope | undefined;
  const legacy: { type: string; raw: string; payload: string; line: number }[] =
    [];
  source = source.replace(
    /^\[\[FP-(GENERAL|CHARACTER|BEATS):([^\n]*)\]\][ \t]*$/gm,
    (raw, type, payload, offset) => {
      if (source.lastIndexOf("/*", offset) > source.lastIndexOf("*/", offset))
        return raw;
      legacy.push({
        type,
        raw,
        payload,
        line: source.slice(0, offset).split("\n").length - 1,
      });
      return "";
    },
  );
  source = source.replace(/\/\*[\s\S]*?\*\//g, (comment) => {
    const inner = comment.slice(2, -2).trim();
    if (!inner.startsWith(`${marker}\n`)) return comment;
    try {
      const parsed: unknown = JSON.parse(inner.slice(marker.length).trim());
      if (validEnvelope(parsed)) {
        envelope = parsed;
        return "";
      }
    } catch {
      /* Malformed or future metadata remains an ordinary, recoverable boneyard. */
    }
    return comment;
  });
  if (
    envelope &&
    Number.isSafeInteger(envelope.bodyLength) &&
    envelope.bodyLength! >= 0 &&
    fingerprint(source.slice(0, envelope.bodyLength)) === envelope.bodyHash
  )
    source = source.slice(0, envelope.bodyLength);
  else source = source.trimEnd();
  const metadata = envelope
    ? normalizeMetadata(envelope.metadata)
    : { version: 1 as const, beats: [], notes: "" };
  const lines = source.split("\n");
  const title =
    options.titlePage === false
      ? { titlePage: emptyTitlePage(), end: 0 }
      : readTitle(lines);
  if (legacy.length) {
    metadata.legacyAnnotations = legacy.map((item) => item.raw);
    for (const item of legacy) {
      try {
        if (item.type === "GENERAL")
          metadata.notes +=
            (metadata.notes ? "\n\n" : "") + decodeURIComponent(item.payload);
        if (item.type === "CHARACTER") {
          const split = item.payload.indexOf(":");
          if (split >= 0) {
            const name = decodeURIComponent(item.payload.slice(0, split));
            metadata.characterNotes = {
              ...(isObject(metadata.characterNotes)
                ? metadata.characterNotes
                : {}),
              [name]: decodeURIComponent(item.payload.slice(split + 1)),
            };
          }
        }
        if (item.type === "BEATS") {
          const sheet = JSON.parse(decodeURIComponent(item.payload));
          if (isObject(sheet)) {
            metadata.premise =
              typeof sheet.premise === "string" ? sheet.premise : "";
            if (Array.isArray(sheet.beats))
              metadata.beats = sheet.beats.flatMap((beat) => {
                const text =
                  typeof beat === "string"
                    ? beat
                    : isObject(beat) && typeof beat.text === "string"
                      ? beat.text
                      : "";
                return text
                  ? [
                      {
                        id: newId(),
                        title: text,
                        description: "",
                        act: "Act I",
                        color: "#75a8ed",
                        ...(isObject(beat) && isObject(beat.range)
                          ? { legacyRange: beat.range }
                          : {}),
                      },
                    ]
                  : [];
              });
          }
        }
      } catch {
        /* Keep undecodable legacy annotations in the portable metadata envelope. */
      }
    }
  }
  if (envelope && envelope.bodyHash === fingerprint(source)) {
    const restored: ScriptBlock[] = [];
    const ids = new Set<string>();
    let valid = true;
    for (const record of envelope.blocks) {
      if (
        record.start < 0 ||
        record.end < record.start ||
        record.end > source.length
      ) {
        valid = false;
        break;
      }
      const raw = source.slice(record.start, record.end);
      let spans = record.raw
        ? [
            {
              text: record.escapedBoneyard ? raw.replace(/\*\\\//g, "*/") : raw,
            },
          ]
        : parseInline(raw);
      const text = spans.map((span) => span.text).join("");
      if (fingerprint(text) !== record.hash) {
        valid = false;
        break;
      }
      if (
        Array.isArray(record.styles) &&
        record.styles.every(
          (style) =>
            isObject(style) &&
            Number.isSafeInteger(style.length) &&
            style.length >= 0 &&
            (!style.marks ||
              (Array.isArray(style.marks) &&
                style.marks.every((mark) => markOrder.includes(mark)))),
        ) &&
        record.styles.reduce((sum, style) => sum + style.length, 0) ===
          text.length
      ) {
        let position = 0;
        spans = record.styles.map((style) => {
          const span = {
            text: text.slice(position, position + style.length),
            ...(style.marks?.length ? { marks: style.marks } : {}),
          };
          position += style.length;
          return span;
        });
      }
      const id = ids.has(record.id) ? newId() : record.id;
      ids.add(id);
      restored.push({
        id,
        kind: record.kind,
        text,
        ...(spans.some((span) => span.marks?.length) ? { spans } : {}),
        ...(record.level !== undefined ? { level: record.level } : {}),
        ...(record.dual ? { dual: true } : {}),
        ...(record.sceneNumber !== undefined
          ? { sceneNumber: record.sceneNumber }
          : {}),
      });
    }
    if (valid && restored.length) {
      const result = {
        titlePage:
          envelope.titlePage && isObject(envelope.titlePage)
            ? { ...title.titlePage, ...envelope.titlePage }
            : title.titlePage,
        blocks: restored,
        metadata,
      };
      validateBeatAnchors(result);
      return result;
    }
  }

  const blocks: ScriptBlock[] = [];
  const sourceRecords: {
    block: ScriptBlock;
    line: number;
    start: number;
    end: number;
  }[] = [];
  const add = (
    kind: BlockKind,
    raw: string,
    attributes: Partial<ScriptBlock> = {},
    sourceStart = i,
    lineOrigins?: number[],
  ) => {
    const spans = kind === "boneyard" ? [{ text: raw }] : parseInline(raw);
    const text = spans.map((span) => span.text).join("");
    const block: ScriptBlock = {
      id: newId(),
      kind,
      text,
      ...(spans.some((span) => span.marks?.length) ? { spans } : {}),
      ...attributes,
    };
    blocks.push(block);
    let offset = 0;
    for (const [index, line] of text.split("\n").entries()) {
      sourceRecords.push({
        block,
        line: lineOrigins?.[index] ?? sourceStart + index,
        start: offset,
        end: offset + line.length,
      });
      offset += line.length + 1;
    }
    return block;
  };
  let dialogue = false;
  let i = title.end;
  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line && !(dialogue && raw.length >= 2)) {
      dialogue = false;
      i++;
      continue;
    }
    if (line.startsWith("/*")) {
      const rest = lines.slice(i).join("\n");
      const close = rest.indexOf("*/", rest.indexOf("/*") + 2);
      if (close !== -1) {
        const consumed = rest.slice(0, close + 2);
        const content = consumed.slice(consumed.indexOf("/*") + 2, -2);
        add(
          "boneyard",
          content.replace(/^\n|\n$/g, ""),
          {},
          i + (content.startsWith("\n") ? 1 : 0),
        );
        const remainder = rest.slice(close + 2).split("\n")[0];
        i += consumed.split("\n").length - 1;
        if (remainder.trim()) lines[i] = remainder;
        else i++;
        continue;
      }
    }
    if (line.startsWith("[[")) {
      let note = raw.slice(raw.indexOf("[[") + 2);
      let end = i;
      while (
        !note.includes("]]") &&
        end + 1 < lines.length &&
        lines[end + 1] !== ""
      )
        note += `\n${lines[++end]}`;
      const close = note.indexOf("]]");
      if (close >= 0 && !note.slice(close + 2).trim()) {
        add("note", note.slice(0, close));
        i = end + 1;
        continue;
      }
    }
    if (/^={3,}$/.test(line)) {
      add("pageBreak", "");
      dialogue = false;
      i++;
      continue;
    }
    const section = line.match(/^(#+)\s*(.*)$/);
    if (section) {
      add("section", section[2], { level: section[1].length });
      dialogue = false;
      i++;
      continue;
    }
    if (/^=(?!=)/.test(line)) {
      add("synopsis", line.slice(1).trimStart());
      dialogue = false;
      i++;
      continue;
    }
    if (/^>.*<$/.test(line)) {
      add("centered", line.slice(1, -1).trim());
      dialogue = false;
      i++;
      continue;
    }
    if (line.startsWith(">")) {
      add("transition", line.slice(1).trimStart());
      dialogue = false;
      i++;
      continue;
    }
    if (line.startsWith("~")) {
      add("lyrics", line.slice(1));
      i++;
      continue;
    }
    const scene =
      /^(?:INT\.?\/EXT|INT\.?\/EXT\.?|INT|EXT|EST|I\/E)[. ]/i.test(line) ||
      /^\.[\p{L}\p{N}]/u.test(line);
    if (!dialogue && scene) {
      let heading = line.startsWith(".") ? line.slice(1) : line;
      const numbered = heading.match(/\s+#([A-Za-z0-9.-]+)#\s*$/);
      if (numbered) heading = heading.slice(0, numbered.index);
      add("scene", heading, numbered ? { sceneNumber: numbered[1] } : {});
      i++;
      continue;
    }
    const cue = line.replace(/\s*\^$/, "").replace(/\s*\([^)]*\)\s*$/, "");
    const previousBlank = i === title.end || !lines[i - 1].trim();
    const nextHasText = i + 1 < lines.length && !!lines[i + 1].trim();
    const automaticCue =
      previousBlank &&
      nextHasText &&
      /\p{L}/u.test(cue) &&
      cue === cue.toUpperCase() &&
      !/[.!?:]$/.test(cue) &&
      !/^[!#=~>]/.test(cue);
    if (line.startsWith("@") || (!dialogue && automaticCue)) {
      add(
        "character",
        line.replace(/^@/, "").replace(/\s*\^$/, ""),
        /\^$/.test(line) ? { dual: true } : {},
      );
      dialogue = true;
      i++;
      continue;
    }
    if (
      !dialogue &&
      /^[A-Z][A-Z\s\p{P}]*TO:$/u.test(line) &&
      !/\s$/.test(raw) &&
      previousBlank
    ) {
      add("transition", line);
      i++;
      continue;
    }
    if (dialogue && /^\(.*\)$/.test(line)) {
      add("parenthetical", line);
      i++;
      continue;
    }
    const kind: BlockKind = line.startsWith("!")
      ? "action"
      : dialogue
        ? "dialogue"
        : "action";
    if (kind === "action") dialogue = false;
    const paragraphStart = i;
    let paragraph =
      kind === "action"
        ? raw.replace(/^(\s*)!/, "$1").replace(/\t/g, "    ")
        : raw.trimStart();
    i++;
    while (i < lines.length) {
      const next = lines[i];
      const trimmed = next.trim();
      if (!trimmed && !(dialogue && next.length >= 2)) break;
      if (
        /^(?:@|!|#|=|>|~|\/\*|\[\[)/.test(trimmed) ||
        (dialogue && /^\(.*\)$/.test(trimmed))
      )
        break;
      paragraph += `\n${dialogue ? next.trimStart() : next.replace(/\t/g, "    ")}`;
      i++;
    }
    // Keep inline annotations as visible, editable note/omitted blocks, never source tokens in prose.
    const annotations: {
      kind: "note" | "boneyard";
      text: string;
      line: number;
    }[] = [];
    const originalParagraph = paragraph;
    const removed: { start: number; end: number }[] = [];
    paragraph = paragraph.replace(
      /(?<!\\)\[\[([^]*?)\]\]|\/\*([^]*?)\*\//g,
      (
        match,
        note: string | undefined,
        omitted: string | undefined,
        offset: number,
      ) => {
        annotations.push({
          kind: note !== undefined ? "note" : "boneyard",
          text: note ?? omitted ?? "",
          line:
            paragraphStart +
            originalParagraph.slice(0, offset).split("\n").length -
            1,
        });
        removed.push({ start: offset, end: offset + match.length });
        return "";
      },
    );
    const origins = [paragraphStart];
    let removedIndex = 0;
    let physicalLine = paragraphStart;
    for (let offset = 0; offset < originalParagraph.length; offset++) {
      while (
        removedIndex < removed.length &&
        removed[removedIndex].end <= offset
      )
        removedIndex++;
      if (originalParagraph[offset] === "\n") {
        physicalLine++;
        if (!(
          removedIndex < removed.length && removed[removedIndex].start <= offset
        ))
          origins.push(physicalLine);
      }
    }
    if (paragraph || !annotations.length)
      add(kind, paragraph, {}, paragraphStart, origins);
    for (const annotation of annotations)
      add(annotation.kind, annotation.text, {}, annotation.line);
  }
  if (!blocks.length) add("action", "");
  // Unchanged blocks retain identity after edits made in another Fountain editor. New text wins.
  if (envelope) {
    const byHash = new Map<string, BlockRecord[]>();
    for (const record of envelope.blocks)
      byHash.set(record.hash, [...(byHash.get(record.hash) ?? []), record]);
    const used = new Set<string>();
    for (const block of blocks) {
      const candidates = byHash.get(fingerprint(block.text));
      const match = candidates?.find(
        (candidate) => candidate.kind === block.kind && !used.has(candidate.id),
      );
      if (match) {
        block.id = match.id;
        used.add(match.id);
      }
    }
  }
  for (const beat of metadata.beats) {
    if (beat.range) continue;
    const range = (
      beat as unknown as {
        legacyRange?: { startLine?: number; endLine?: number };
      }
    ).legacyRange;
    if (!range) continue;
    delete (beat as unknown as { legacyRange?: unknown }).legacyRange;
    delete beat.sceneId;
    if (
      !Number.isSafeInteger(range.startLine) ||
      !Number.isSafeInteger(range.endLine) ||
      range.startLine! < 0 ||
      range.endLine! < range.startLine! ||
      range.endLine! >= originalLineCount
    )
      continue;
    const selected = sourceRecords.filter(
      (record) =>
        record.line >= range.startLine! &&
        record.line <= range.endLine! &&
        record.end > record.start,
    );
    if (!selected.length) continue;
    selected.sort(
      (left, right) =>
        blocks.indexOf(left.block) - blocks.indexOf(right.block) ||
        left.start - right.start,
    );
    const first = selected[0];
    const last = selected.at(-1)!;
    beat.range = {
      start: { blockId: first.block.id, offset: first.start },
      end: { blockId: last.block.id, offset: last.end },
    };
    for (let index = blocks.indexOf(first.block); index >= 0; index--) {
      if (blocks[index].kind === "scene") {
        beat.sceneId = blocks[index].id;
        break;
      }
    }
  }
  const result = { titlePage: title.titlePage, blocks, metadata };
  validateBeatAnchors(result);
  return result;
}

function validateBeatAnchors(doc: Screenplay) {
  for (const beat of doc.metadata.beats) {
    if (beat.range && !resolveBeatRange(doc, beat.range)) {
      delete beat.range;
      delete beat.sceneId;
    }
  }
}

export function serializeFountain(document: Screenplay): string {
  const titleFields: [string, string][] = [
    ["Title", document.titlePage.title],
    ["Credit", document.titlePage.credit],
    ["Author", document.titlePage.author],
    ["Source", document.titlePage.source],
    ["Draft date", document.titlePage.draftDate],
    ["Contact", document.titlePage.contact],
    ...Object.entries(document.titlePage.extra ?? {}),
  ];
  let body = titleFields
    .filter(([, value]) => value)
    .map(
      ([key, value]) =>
        `${key.replace(/[\n\r:]/g, " ")}:${
          value.includes("\n")
            ? `\n${value
                .split("\n")
                .map((line) => `    ${formatInline([{ text: line }])}`)
                .join("\n")}`
            : ` ${formatInline([{ text: value }])}`
        }`,
    )
    .join("\n");
  const records: BlockRecord[] = [];
  let previous: ScriptBlock | undefined;
  for (const block of document.blocks) {
    const continuous =
      (block.kind === "dialogue" || block.kind === "parenthetical") &&
      previous &&
      ["character", "dialogue", "parenthetical"].includes(previous.kind);
    if (body)
      body += continuous || (block.kind === "note" && previous) ? "\n" : "\n\n";
    let prefix = "";
    let suffix = "";
    let content = formatInline(blockSpans(block));
    switch (block.kind) {
      case "scene":
        prefix = ".";
        suffix = block.sceneNumber
          ? ` #${block.sceneNumber.replace(/[^\w.-]/g, "")}#`
          : "";
        break;
      case "action":
        prefix = "!";
        break;
      case "character":
        prefix = "@";
        suffix = block.dual ? " ^" : "";
        break;
      case "parenthetical":
        if (!block.text.startsWith("(")) prefix = "(";
        if (!block.text.endsWith(")")) suffix = ")";
        break;
      case "transition":
        prefix = ">";
        break;
      case "section":
        prefix = `${"#".repeat(Math.max(1, Math.min(12, block.level ?? 1)))} `;
        break;
      case "synopsis":
        prefix = "= ";
        break;
      case "note":
        prefix = "[[";
        suffix = "]]";
        break;
      case "lyrics":
        prefix = "~";
        break;
      case "centered":
        prefix = ">";
        suffix = "<";
        break;
      case "pageBreak":
        prefix = "===";
        content = "";
        break;
      case "boneyard":
        prefix = "/*\n";
        suffix = "\n*/";
        content = block.text.replace(/\*\//g, "*\\/");
        break;
    }
    body += prefix;
    const start = body.length;
    body += content;
    records.push({
      id: block.id,
      kind: block.kind,
      hash: fingerprint(block.kind === "pageBreak" ? "" : block.text),
      start,
      end: body.length,
      ...(block.level !== undefined ? { level: block.level } : {}),
      ...(block.dual ? { dual: true } : {}),
      ...(block.sceneNumber !== undefined
        ? { sceneNumber: block.sceneNumber }
        : {}),
      ...(block.kind === "boneyard"
        ? { raw: true, escapedBoneyard: true }
        : {}),
      ...(block.spans
        ? {
            styles: blockSpans(block).map((span) => ({
              length: span.text.length,
              ...(span.marks?.length ? { marks: span.marks } : {}),
            })),
          }
        : {}),
    });
    body += suffix;
    previous = block;
  }
  const envelope: Envelope = {
    format: "fountain-publisher",
    version: 1,
    bodyHash: fingerprint(body),
    bodyLength: body.length,
    metadata: document.metadata,
    blocks: records,
    titlePage: document.titlePage,
  };
  // Escape the slash in comment terminators so arbitrary notes cannot break the boneyard.
  const json = JSON.stringify(envelope).replace(/\*\//g, "*\\/");
  return `${body}\n\n/*\n${marker}\n${json}\n*/\n`;
}
