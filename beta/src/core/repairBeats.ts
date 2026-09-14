import type { Beat, Screenplay } from "./model";
import { resolveBeatRange } from "./beatRanges";

export function hasLegacyBeatRanges(doc: Screenplay): boolean {
  return doc.metadata.beats.some((beat) => "legacyRange" in beat);
}

/** Repair the earlier scene-only import from the original source, never guessed line offsets. */
export function restoreImportedBeatRanges(
  current: Screenplay,
  original: Screenplay,
): Screenplay {
  if (
    current.blocks.length !== original.blocks.length ||
    current.blocks.some(
      (block, i) =>
        block.kind !== original.blocks[i].kind ||
        block.text !== original.blocks[i].text,
    )
  )
    throw new Error(
      "The original file and this draft have different screenplay text. Open the original as a separate document to recover its exact beat ranges; this draft has been kept.",
    );
  const ids = new Map(
    original.blocks.map((block, i) => [block.id, current.blocks[i].id]),
  );
  let restored = 0;
  const beats = current.metadata.beats.map((beat, i): Beat => {
    if (!("legacyRange" in beat)) return beat;
    const source =
      original.metadata.beats[i]?.title === beat.title
        ? original.metadata.beats[i]
        : original.metadata.beats.filter((b) => b.title === beat.title)
              .length === 1
          ? original.metadata.beats.find((b) => b.title === beat.title)
          : undefined;
    if (!source?.range || !resolveBeatRange(original, source.range))
      return beat;
    const {
      legacyRange: _legacy,
      sceneId: _scene,
      ...fields
    } = beat as Beat & { legacyRange?: unknown };
    restored++;
    return {
      ...fields,
      range: {
        start: {
          ...source.range.start,
          blockId: ids.get(source.range.start.blockId)!,
        },
        end: {
          ...source.range.end,
          blockId: ids.get(source.range.end.blockId)!,
        },
      },
    };
  });
  if (!restored)
    throw new Error(
      "No matching original beat ranges were found. Choose the original Fountain file that contains this draft’s beat annotations.",
    );
  return { ...current, metadata: { ...current.metadata, beats } };
}
