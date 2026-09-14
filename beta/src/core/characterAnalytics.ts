import { characterName, countWords } from "./insights";
import type { Screenplay } from "./model";

export interface DialogueSegment {
  character: string;
  blockId: string;
  start: number;
  words: number;
}

export interface CharacterGroup {
  id: string;
  kind: "scene" | "act" | "document";
  heading: string;
  start: number;
  end: number;
  label: string;
  sceneNumber?: string;
  actId?: string;
  act: string;
  lines: Record<string, number>;
  segments: DialogueSegment[];
  totalWords: number;
}

export interface CharacterAnalyticsData {
  characters: string[];
  groups: CharacterGroup[];
  acts: CharacterGroup[];
  document: CharacterGroup;
  minLines: number;
  maxLines: number;
}

/** Positions count printed story words, excluding headings, cues and annotations.
 * Dialogue lines mean explicit lines in the document, never viewport wrapping. */
export function buildCharacterAnalytics(
  doc: Screenplay,
): CharacterAnalyticsData {
  const countGroup = (
    group: Omit<CharacterGroup, "lines" | "segments" | "totalWords">,
  ): CharacterGroup => {
    const lines: Record<string, number> = Object.create(null);
    const segments: DialogueSegment[] = [];
    let totalWords = 0;
    let speaker = "";
    for (let i = group.start; i < group.end; i++) {
      const block = doc.blocks[i];
      if (block.kind === "character") {
        speaker = characterName(block.text);
        continue;
      }
      if (["parenthetical", "note", "boneyard"].includes(block.kind)) continue;
      if (block.kind === "dialogue" || block.kind === "lyrics") {
        for (const line of block.text.split("\n")) {
          const words = countWords(line);
          if (speaker && line.trim())
            lines[speaker] = (lines[speaker] ?? 0) + 1;
          if (speaker && words)
            segments.push({
              character: speaker,
              blockId: block.id,
              start: totalWords,
              words,
            });
          totalWords += words;
        }
        continue;
      }
      // Blank editor paragraphs correspond to Fountain separators.
      if (block.kind === "action" && !block.text.trim()) continue;
      speaker = "";
      if (["action", "transition", "centered"].includes(block.kind))
        totalWords += countWords(block.text);
    }
    return { ...group, lines, segments, totalWords };
  };

  const document = countGroup({
    id: "entire-document",
    kind: "document",
    heading: "Entire Document",
    start: 0,
    end: doc.blocks.length,
    label: "1",
    act: "Screenplay",
  });
  const words = new Map<string, number>();
  for (const block of doc.blocks) {
    if (block.kind === "character") {
      const name = characterName(block.text);
      if (name) words.set(name, 0);
    }
  }
  for (const segment of document.segments)
    words.set(
      segment.character,
      (words.get(segment.character) ?? 0) + segment.words,
    );
  const characters = [...words]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name);
  const sectionIndices = doc.blocks.flatMap((block, index) =>
    block.kind === "section" && (block.level ?? 1) === 1 ? [index] : [],
  );
  const acts = sectionIndices.map((start, index) =>
    countGroup({
      id: doc.blocks[start].id,
      kind: "act",
      heading: doc.blocks[start].text,
      start,
      end: sectionIndices[index + 1] ?? doc.blocks.length,
      label: String(index + 1),
      act: "Acts",
    }),
  );
  const sceneIndices = doc.blocks.flatMap((block, index) =>
    block.kind === "scene" ? [index] : [],
  );
  const actSceneCounts = new Map<string, number>();
  let actIndex = -1;
  const scenes = sceneIndices.map((start, index) => {
    while (actIndex + 1 < acts.length && acts[actIndex + 1].start <= start)
      actIndex++;
    const act = acts[actIndex];
    const count = act ? (actSceneCounts.get(act.id) ?? 0) + 1 : index + 1;
    if (act) actSceneCounts.set(act.id, count);
    return countGroup({
      id: doc.blocks[start].id,
      kind: "scene",
      heading: doc.blocks[start].text,
      start,
      end: sceneIndices[index + 1] ?? doc.blocks.length,
      label: String(count),
      sceneNumber: doc.blocks[start].sceneNumber || String(index + 1),
      actId: act?.id,
      act: act?.heading || "Screenplay",
    });
  });
  const groups = scenes.length ? scenes : acts.length ? acts : [document];
  let minLines = Infinity;
  let maxLines = 0;
  for (const group of groups) {
    for (const count of Object.values(group.lines)) {
      if (count > 0) minLines = Math.min(minLines, count);
      maxLines = Math.max(maxLines, count);
    }
  }
  return {
    characters,
    groups,
    acts,
    document,
    minLines: Number.isFinite(minLines) ? minLines : 0,
    maxLines,
  };
}
