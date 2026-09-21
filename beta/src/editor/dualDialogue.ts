import type { Node as ProseMirrorNode } from "prosemirror-model";
import type { BlockKind } from "../core/model";

const dialogueKinds = new Set<BlockKind>([
  "dialogue",
  "parenthetical",
  "lyrics",
]);

interface BlockEntry {
  node: ProseMirrorNode;
  pos: number;
}

export interface DualDialogueRange {
  from: number;
  to: number;
  column: "left" | "right";
  start: boolean;
  end: boolean;
}

function entries(doc: ProseMirrorNode): BlockEntry[] {
  const result: BlockEntry[] = [];
  doc.forEach((node, pos) => result.push({ node, pos }));
  return result;
}

function cueIndex(blocks: BlockEntry[], index: number): number | undefined {
  if (index < 0 || index >= blocks.length) return;
  const kind = blocks[index].node.attrs.kind as BlockKind;
  if (kind === "character") return index;
  if (!dialogueKinds.has(kind)) return;
  let cursor = index - 1;
  while (
    cursor >= 0 &&
    dialogueKinds.has(blocks[cursor].node.attrs.kind as BlockKind)
  )
    cursor--;
  return blocks[cursor]?.node.attrs.kind === "character" ? cursor : undefined;
}

function groupEnd(blocks: BlockEntry[], cue: number): number {
  let end = cue + 1;
  while (
    end < blocks.length &&
    dialogueKinds.has(blocks[end].node.attrs.kind as BlockKind)
  )
    end++;
  return end;
}

function previousCue(blocks: BlockEntry[], cue: number): number | undefined {
  let cursor = cue - 1;
  while (
    cursor >= 0 &&
    dialogueKinds.has(blocks[cursor].node.attrs.kind as BlockKind)
  )
    cursor--;
  return blocks[cursor]?.node.attrs.kind === "character" ? cursor : undefined;
}

function partnerCue(blocks: BlockEntry[], cue: number): number | undefined {
  if (blocks[cue].node.attrs.dual) return cue;
  const next = groupEnd(blocks, cue);
  return blocks[next]?.node.attrs.kind === "character" &&
    blocks[next].node.attrs.dual
    ? next
    : undefined;
}

function blockIndex(blocks: BlockEntry[], pos: number): number {
  return blocks.findIndex((entry) => entry.pos === pos);
}

export function dualDialogueAtPosition(
  doc: ProseMirrorNode,
  blockPos: number,
): boolean {
  const blocks = entries(doc);
  const index = blockIndex(blocks, blockPos);
  const cue = cueIndex(blocks, index);
  return cue !== undefined && partnerCue(blocks, cue) !== undefined;
}

export function dualDialogueTargetPosition(
  doc: ProseMirrorNode,
  blockPos: number,
  enabled: boolean,
): number | undefined {
  const blocks = entries(doc);
  const index = blockIndex(blocks, blockPos);
  const cue = cueIndex(blocks, index);
  if (cue === undefined) return;

  const existing = partnerCue(blocks, cue);
  if (!enabled) return existing === undefined ? undefined : blocks[existing].pos;
  if (existing !== undefined) return blocks[existing].pos;

  // Fountain stores the ^ on the second cue. If this group already has a
  // dialogue group immediately before it, make this cue the right column.
  if (previousCue(blocks, cue) !== undefined) return blocks[cue].pos;

  // If the writer selected the first of two adjacent groups, mark the next cue.
  const next = groupEnd(blocks, cue);
  if (blocks[next]?.node.attrs.kind === "character") return blocks[next].pos;

  // Preserve standard Fountain semantics even before the partner is written.
  return blocks[cue].pos;
}

export function dualDialogueRanges(
  doc: ProseMirrorNode,
): DualDialogueRange[] {
  const blocks = entries(doc);
  const result: DualDialogueRange[] = [];

  blocks.forEach((entry, rightCue) => {
    if (
      entry.node.attrs.kind !== "character" ||
      !entry.node.attrs.dual
    )
      return;
    const leftCue = previousCue(blocks, rightCue);
    if (leftCue === undefined) return;
    const rightEnd = groupEnd(blocks, rightCue);

    for (let index = leftCue; index < rightCue; index++)
      result.push({
        from: blocks[index].pos,
        to: blocks[index].pos + blocks[index].node.nodeSize,
        column: "left",
        start: index === leftCue,
        end: index === rightCue - 1,
      });
    for (let index = rightCue; index < rightEnd; index++)
      result.push({
        from: blocks[index].pos,
        to: blocks[index].pos + blocks[index].node.nodeSize,
        column: "right",
        start: index === rightCue,
        end: index === rightEnd - 1,
      });
  });

  return result;
}
