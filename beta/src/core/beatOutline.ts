import type { Beat } from "./model";

/** Flat, portable storage; preorder is shared by the sheet, guide and exports. */
export function outlineBeats(input: Beat[]): Beat[] {
  const ids = new Set(input.map((b) => b.id));
  const beats = input.map((b) => ({
    ...b,
    parentId:
      typeof b.parentId === "string" &&
      ids.has(b.parentId) &&
      b.parentId !== b.id
        ? b.parentId
        : undefined,
  }));
  const byId = new Map(beats.map((b) => [b.id, b]));
  for (const beat of beats) {
    const visited = new Set([beat.id]);
    let parent = beat.parentId;
    while (parent) {
      if (visited.has(parent)) {
        beat.parentId = undefined;
        break;
      }
      visited.add(parent);
      parent = byId.get(parent)?.parentId;
    }
  }
  const result: Beat[] = [];
  const visit = (beat: Beat, parent?: Beat) => {
    if (parent) {
      beat.act = parent.act;
      beat.groupSceneId = parent.groupSceneId;
    }
    result.push(beat);
    beats.filter((b) => b.parentId === beat.id).forEach((b) => visit(b, beat));
  };
  beats.filter((b) => !b.parentId).forEach((b) => visit(b));
  return result;
}
export function beatAncestors(beats: Beat[], id: string): Beat[] {
  const result: Beat[] = [],
    seen = new Set([id]);
  let parent = beats.find((b) => b.id === id)?.parentId;
  while (parent && !seen.has(parent)) {
    seen.add(parent);
    const beat = beats.find((b) => b.id === parent);
    if (!beat) break;
    result.unshift(beat);
    parent = beat.parentId;
  }
  return result;
}
export function removeBeat(beats: Beat[], id: string): Beat[] {
  const parentId = beats.find((b) => b.id === id)?.parentId;
  return outlineBeats(
    beats
      .filter((b) => b.id !== id)
      .map((b) => (b.parentId === id ? { ...b, parentId } : b)),
  );
}
export function moveBeat(beats: Beat[], id: string, targetId: string): Beat[] {
  const ordered = outlineBeats(beats),
    from = ordered.findIndex((b) => b.id === id),
    to = ordered.findIndex((b) => b.id === targetId);
  if (from < 0 || to < 0 || from === to) return ordered;
  const source = ordered[from],
    target = ordered[to];
  if (
    source.parentId !== target.parentId ||
    source.act !== target.act ||
    source.groupSceneId !== target.groupSceneId
  )
    return ordered;
  const subtree = (root: string) =>
    new Set(
      ordered
        .filter(
          (b) =>
            b.id === root ||
            beatAncestors(ordered, b.id).some((p) => p.id === root),
        )
        .map((b) => b.id),
    );
  const moving = subtree(id),
    targetTree = subtree(targetId);
  const rest = ordered.filter((b) => !moving.has(b.id));
  const insertion =
    from < to
      ? rest.reduce((last, b, i) => (targetTree.has(b.id) ? i + 1 : last), 0)
      : rest.findIndex((b) => b.id === targetId);
  rest.splice(insertion, 0, ...ordered.filter((b) => moving.has(b.id)));
  return rest;
}
