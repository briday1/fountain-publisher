import { countWords } from "../core/insights";
import { resolveBeatRange, sceneBeatRange } from "../core/beatRanges";
import type { Beat, BeatRange, Screenplay } from "../core/model";

export interface BeatPosition {
  beat: Beat;
  words: number;
  assigned: boolean;
  sceneHeading?: string;
  startLine?: number;
  endLine?: number;
  range?: BeatRange;
}

/** Measure words before each assigned range's first line; interpolate unassigned beats. */
export function beatPacing(doc: Screenplay): {
  total: number;
  positions: BeatPosition[];
} {
  let total = 0;
  for (const block of doc.blocks) {
    if (
      ["action", "dialogue", "lyrics", "centered", "transition"].includes(
        block.kind,
      )
    ) {
      total += countWords(block.text);
    }
  }
  const positions = doc.metadata.beats.map((beat) => {
    const range =
      beat.range === undefined && beat.sceneId
        ? sceneBeatRange(doc, beat.sceneId)
        : beat.range;
    const resolved = range ? resolveBeatRange(doc, range) : undefined;
    return {
      beat,
      words: resolved?.words ?? 0,
      assigned: !!resolved,
      sceneHeading: resolved?.sceneHeading,
      startLine: resolved?.startLine,
      endLine: resolved?.endLine,
      range: resolved ? range : undefined,
    };
  });
  // Walk each run of unassigned beats once, including the start/end boundaries.
  let previous = -1;
  for (let next = 0; next <= positions.length; next++) {
    if (next < positions.length && !positions[next].assigned) continue;
    const low = previous < 0 ? 0 : positions[previous].words;
    const high = next === positions.length ? total : positions[next].words;
    for (let i = previous + 1; i < next; i++) {
      positions[i].words = Math.round(
        low + ((high - low) * (i - previous)) / (next - previous),
      );
    }
    previous = next;
  }
  return { total, positions };
}
