import { countWords } from "./insights";
import type { BeatRange, Screenplay, ScriptBlock, TextAnchor } from "./model";

export interface ScreenplayLine {
  /** One-based physical line in the canonical Fountain body, including title/separator offsets. */
  number: number;
  blockId: string;
  /** UTF-16 offsets within block.text, excluding the line's newline. */
  start: number;
  end: number;
  wordsBefore: number;
  text: string;
}

export interface ResolvedBeatRange {
  startLine: number;
  endLine: number;
  /** Story words before the first assigned authored line, not words inside the range. */
  words: number;
  sceneHeading?: string;
}

const storyKinds = new Set([
  "action",
  "dialogue",
  "lyrics",
  "centered",
  "transition",
]);
const lineCache = new WeakMap<
  Screenplay["blocks"],
  WeakMap<Screenplay["titlePage"], ScreenplayLine[]>
>();
const lineIndices = new WeakMap<
  ScreenplayLine[],
  {
    blocks: Map<string, number>;
    lines: Map<string, ScreenplayLine[]>;
    scenes: Map<string, string>;
  }
>();

/** Mirrors the serializer's line layout without serializing metadata or parsing source. */
export function screenplayLines(doc: Screenplay): ScreenplayLine[] {
  const cached = lineCache.get(doc.blocks)?.get(doc.titlePage);
  if (cached) return cached;
  const titleValues = [
    doc.titlePage.title,
    doc.titlePage.credit,
    doc.titlePage.author,
    doc.titlePage.source,
    doc.titlePage.draftDate,
    doc.titlePage.contact,
    ...Object.values(doc.titlePage.extra ?? {}),
  ].filter(Boolean);
  const titleLineCount = titleValues.reduce(
    (sum, value) =>
      sum + (value.includes("\n") ? value.split("\n").length + 1 : 1),
    0,
  );
  let number = titleLineCount || 1;
  let hasBody = titleLineCount > 0;
  let previous: ScriptBlock | undefined;
  let wordsBefore = 0;
  const result: ScreenplayLine[] = [];
  for (const block of doc.blocks) {
    const continuous =
      (block.kind === "dialogue" || block.kind === "parenthetical") &&
      previous &&
      ["character", "dialogue", "parenthetical"].includes(previous.kind);
    if (hasBody)
      number += continuous || (block.kind === "note" && previous) ? 1 : 2;
    if (block.kind === "boneyard") number++;
    let start = 0;
    const lines = block.kind === "pageBreak" ? [""] : block.text.split("\n");
    for (const [index, text] of lines.entries()) {
      if (index) number++;
      result.push({
        number,
        blockId: block.id,
        start,
        end: start + text.length,
        wordsBefore,
        text,
      });
      if (storyKinds.has(block.kind)) wordsBefore += countWords(text);
      start += text.length + 1;
    }
    if (block.kind === "boneyard") number++;
    hasBody ||= !!block.text || block.kind !== "dialogue";
    previous = block;
  }
  let byTitle = lineCache.get(doc.blocks);
  if (!byTitle) lineCache.set(doc.blocks, (byTitle = new WeakMap()));
  byTitle.set(doc.titlePage, result);
  const blocks = new Map<string, number>();
  const grouped = new Map<string, ScreenplayLine[]>();
  const scenes = new Map<string, string>();
  let sceneHeading: string | undefined;
  doc.blocks.forEach((block, index) => {
    blocks.set(block.id, index);
    if (block.kind === "scene") sceneHeading = block.text;
    if (sceneHeading) scenes.set(block.id, sceneHeading);
  });
  for (const line of result) {
    const group = grouped.get(line.blockId);
    if (group) group.push(line);
    else grouped.set(line.blockId, [line]);
  }
  lineIndices.set(result, { blocks, lines: grouped, scenes });
  return result;
}

export function isBeatRange(value: unknown): value is BeatRange {
  if (!value || typeof value !== "object") return false;
  const validAnchor = (anchor: unknown): anchor is TextAnchor => {
    if (!anchor || typeof anchor !== "object") return false;
    const candidate = anchor as TextAnchor;
    return (
      typeof candidate.blockId === "string" &&
      !!candidate.blockId &&
      Number.isSafeInteger(candidate.offset) &&
      candidate.offset >= 0
    );
  };
  return (
    validAnchor((value as BeatRange).start) &&
    validAnchor((value as BeatRange).end)
  );
}

export function resolveBeatRange(
  doc: Screenplay,
  range: BeatRange,
  lines = screenplayLines(doc),
): ResolvedBeatRange | undefined {
  if (!isBeatRange(range)) return;
  const index = lineIndices.get(lines);
  const startIndex =
    index?.blocks.get(range.start.blockId) ??
    doc.blocks.findIndex((block) => block.id === range.start.blockId);
  const endIndex =
    index?.blocks.get(range.end.blockId) ??
    doc.blocks.findIndex((block) => block.id === range.end.blockId);
  if (
    startIndex < 0 ||
    endIndex < startIndex ||
    range.start.offset > doc.blocks[startIndex].text.length ||
    range.end.offset > doc.blocks[endIndex].text.length ||
    doc.blocks[startIndex].kind === "pageBreak" ||
    doc.blocks[endIndex].kind === "pageBreak" ||
    (startIndex === endIndex && range.end.offset < range.start.offset)
  )
    return;
  const firstBlockLines =
    index?.lines.get(range.start.blockId) ??
    lines.filter((line) => line.blockId === range.start.blockId);
  const first = firstBlockLines.find(
    (line) =>
      range.start.offset >= line.start && range.start.offset <= line.end,
  );
  const lastBlockLines =
    index?.lines.get(range.end.blockId) ??
    lines.filter((line) => line.blockId === range.end.blockId);
  const emptyPoint =
    startIndex === endIndex && range.start.offset === range.end.offset;
  if (
    emptyPoint &&
    (!first || first.start !== first.end || range.start.offset !== first.start)
  )
    return;
  let last: ScreenplayLine | undefined;
  if (emptyPoint) last = first;
  else if (!doc.blocks[endIndex].text && range.end.offset === 0)
    last = lastBlockLines[0];
  for (let offset = lastBlockLines.length - 1; offset >= 0 && !last; offset--) {
    if (lastBlockLines[offset].start < range.end.offset) {
      last = lastBlockLines[offset];
      break;
    }
  }
  if (!last && range.end.offset === 0 && endIndex > startIndex) {
    for (let block = endIndex - 1; block >= startIndex && !last; block--)
      last = (
        index?.lines.get(doc.blocks[block].id) ??
        lines.filter((line) => line.blockId === doc.blocks[block].id)
      ).at(-1);
  }
  if (!first || !last || last.number < first.number) return;
  let sceneHeading = index?.scenes.get(range.start.blockId);
  if (!index)
    for (let block = startIndex; block >= 0; block--) {
      if (doc.blocks[block].kind === "scene") {
        sceneHeading = doc.blocks[block].text;
        break;
      }
    }
  return {
    startLine: first.number,
    endLine: last.number,
    words: first.wordsBefore,
    ...(sceneHeading ? { sceneHeading } : {}),
  };
}

/** Inclusive displayed line numbers; blank separators never expand the selection outside its bounds. */
export function beatRangeFromLines(
  doc: Screenplay,
  startLine: number,
  endLine: number,
): BeatRange | undefined {
  if (
    !Number.isSafeInteger(startLine) ||
    !Number.isSafeInteger(endLine) ||
    startLine < 1 ||
    endLine < startLine
  )
    return;
  const lines = screenplayLines(doc);
  if (endLine > (lines.at(-1)?.number ?? 0)) return;
  const nonContent = new Set(
    doc.blocks
      .filter((block) => block.kind === "pageBreak")
      .map((block) => block.id),
  );
  const selected = lines.filter(
    (line) =>
      line.number >= startLine &&
      line.number <= endLine &&
      !nonContent.has(line.blockId),
  );
  if (!selected.length) return;
  const first = selected[0];
  const last = selected.at(-1)!;
  return {
    start: { blockId: first.blockId, offset: first.start },
    end: { blockId: last.blockId, offset: last.end },
  };
}

export const lineRange = beatRangeFromLines;

export function sceneBeatRange(
  doc: Screenplay,
  sceneId: string,
): BeatRange | undefined {
  const start = doc.blocks.findIndex(
    (block) => block.id === sceneId && block.kind === "scene",
  );
  if (start < 0) return;
  let end = start + 1;
  while (end < doc.blocks.length && doc.blocks[end].kind !== "scene") end++;
  while (end > start + 1 && !doc.blocks[end - 1].text.length) end--;
  const last = doc.blocks[end - 1];
  const range = {
    start: { blockId: sceneId, offset: 0 },
    end: { blockId: last.id, offset: last.text.length },
  };
  return resolveBeatRange(doc, range) ? range : undefined;
}
