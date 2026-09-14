import { countWords } from "../core/insights";
import type { Beat, Screenplay } from "../core/model";

export interface BeatPosition {
  beat: Beat;
  words: number;
  assigned: boolean;
  sceneHeading?: string;
}

/** Position beats at the start of their linked scene; fill gaps between known positions. */
export function beatPacing(doc: Screenplay): {
  total: number;
  positions: BeatPosition[];
} {
  const scenes = new Map<string, { words: number; heading: string }>();
  let total = 0;
  for (const block of doc.blocks) {
    if (block.kind === "scene") {
      scenes.set(block.id, { words: total, heading: block.text });
    }
    if (
      ["action", "dialogue", "lyrics", "centered", "transition"].includes(
        block.kind,
      )
    ) {
      total += countWords(block.text);
    }
  }
  const positions = doc.metadata.beats.map((beat) => {
    const scene = beat.sceneId ? scenes.get(beat.sceneId) : undefined;
    return {
      beat,
      words: scene?.words ?? 0,
      assigned: !!scene,
      sceneHeading: scene?.heading,
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
