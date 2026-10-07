import type { Screenplay, ScriptBlock } from "./model";
import { mergeScreenplays, sameValue, type MergeChoice } from "./merge";
import { sequenceDiff } from "./versionDiff";

export interface ChangeAuthor {
  id: string;
  name: string;
  color: string;
}
export interface WritingChange {
  id: string;
  author: ChangeAuthor;
  at: number;
  updatedAt: number;
  blockId?: string;
  before?: ScriptBlock;
  after?: ScriptBlock;
  previousId?: string;
  nextId?: string;
  details?: {
    before: Pick<Screenplay, "titlePage" | "metadata">;
    after: Pick<Screenplay, "titlePage" | "metadata">;
  };
  undoneBy?: string;
  undoOf?: string;
  connection?: string;
  order?: { before: string[]; after: string[] };
}
export interface AttributedSpan {
  start: number;
  end: number;
  author: ChangeAuthor;
  at: number;
  changeId: string;
}
export interface WritingReview {
  changes: WritingChange[];
  attribution: Record<string, AttributedSpan[]>;
  sealedAt?: number;
}
export const emptyWritingReview = (): WritingReview => ({
  changes: [],
  attribution: {},
});
function mapAttribution(
  before: string,
  after: string,
  spans: AttributedSpan[],
  stamp: Omit<AttributedSpan, "start" | "end">,
) {
  const result: AttributedSpan[] = [];
  let oldOffset = 0,
    newOffset = 0;
  let spanIndex = 0;
  const append = (value: AttributedSpan) => {
    const last = result.at(-1);
    if (
      last &&
      last.end === value.start &&
      last.changeId === value.changeId &&
      last.at === value.at
    )
      last.end = value.end;
    else result.push(value);
  };
  for (const edit of sequenceDiff(
    before.split(""),
    after.split(""),
    (a, b) => a === b,
  )) {
    if (edit.change === "removed") {
      oldOffset++;
      continue;
    }
    if (edit.change === "added")
      append({ ...stamp, start: newOffset, end: newOffset + 1 });
    else {
      while (spans[spanIndex] && spans[spanIndex].end <= oldOffset) spanIndex++;
      const previous =
        spans[spanIndex]?.start <= oldOffset ? spans[spanIndex] : undefined;
      if (previous)
        append({ ...previous, start: newOffset, end: newOffset + 1 });
      oldOffset++;
    }
    newOffset++;
  }
  return result;
}
/** Only the authenticated room calls this. Existing untracked writing stays unattributed. */
export function recordWritingChanges(
  review: WritingReview,
  before: Screenplay,
  after: Screenplay,
  author: ChangeAuthor,
  at: number,
  connection: string,
  undoOf?: string,
): WritingReview {
  const next = structuredClone(review);
  const previous = new Map(before.blocks.map((b) => [b.id, b]));
  const current = new Map(after.blocks.map((b) => [b.id, b]));
  const add = (
    input: Omit<
      WritingChange,
      "id" | "author" | "at" | "updatedAt" | "connection"
    >,
  ) => {
    const last = next.changes.at(-1);
    const grouping =
      !undoOf &&
      last &&
      !last.undoneBy &&
      !last.undoOf &&
      last.blockId === input.blockId &&
      last.connection === connection &&
      last.author.id === author.id &&
      last.updatedAt > (next.sealedAt || 0) &&
      at - last.updatedAt < 10_000 &&
      sameValue(last.after, input.before) &&
      sameValue(last.details?.after, input.details?.before) &&
      sameValue(last.order?.after, input.order?.before);
    if (grouping) {
      last.after = input.after;
      if (last.details && input.details)
        last.details.after = input.details.after;
      if (last.order && input.order) last.order.after = input.order.after;
      last.updatedAt = at;
      last.author = author;
      return last;
    }
    const change: WritingChange = {
      ...input,
      id: crypto.randomUUID(),
      author,
      at,
      updatedAt: at,
      connection,
      ...(undoOf ? { undoOf } : {}),
    };
    next.changes.push(change);
    return change;
  };
  for (const id of new Set([...previous.keys(), ...current.keys()])) {
    const a = previous.get(id),
      b = current.get(id);
    if (sameValue(a, b)) continue;
    const list = b ? after.blocks : before.blocks;
    const index = list.findIndex((block) => block.id === id);
    const change = add({
      blockId: id,
      before: a,
      after: b,
      previousId: list[index - 1]?.id,
      nextId: list[index + 1]?.id,
    });
    if (!b) delete next.attribution[id];
    else
      next.attribution[id] = mapAttribution(
        a?.text || "",
        b.text,
        next.attribution[id] || [],
        { author, at, changeId: change.id },
      );
  }
  const details = (doc: Screenplay) => ({
    titlePage: doc.titlePage,
    metadata: doc.metadata,
  });
  if (!sameValue(details(before), details(after)))
    add({ details: { before: details(before), after: details(after) } });
  const beforeIds = before.blocks.map((b) => b.id),
    afterIds = after.blocks.map((b) => b.id);
  if (
    beforeIds.length === afterIds.length &&
    beforeIds.every((id) => afterIds.includes(id)) &&
    !sameValue(beforeIds, afterIds)
  )
    add({ order: { before: beforeIds, after: afterIds } });
  // Bounded recent-change history; author spans survive beyond the undo window.
  while (
    next.changes.length > 200 ||
    JSON.stringify(next.changes).length > 1_500_000
  )
    next.changes.shift();
  if (JSON.stringify(next.attribution).length > 3_000_000) {
    const oldest = Object.keys(next.attribution).sort(
      (a, b) =>
        Math.max(...next.attribution[a].map((s) => s.at), 0) -
        Math.max(...next.attribution[b].map((s) => s.at), 0),
    );
    while (oldest.length && JSON.stringify(next.attribution).length > 3_000_000)
      delete next.attribution[oldest.shift()!];
  }
  return next;
}
/** Apply one inverse change to the latest document, retaining subsequent independent writing. */
export function undoWritingChange(
  current: Screenplay,
  change: WritingChange,
  choices: Record<string, MergeChoice> = {},
) {
  const base = structuredClone(current),
    target = structuredClone(current);
  if (change.order) {
    const ordered = (ids: string[]) => {
      const remaining = new Map(current.blocks.map((b) => [b.id, b]));
      const blocks: ScriptBlock[] = [];
      for (const id of ids) {
        const block = remaining.get(id);
        if (block) {
          blocks.push(block);
          remaining.delete(id);
        }
      }
      for (const block of remaining.values()) {
        const index = current.blocks.findIndex((b) => b.id === block.id);
        const previous = current.blocks
          .slice(0, index)
          .reverse()
          .find((b) => blocks.some((value) => value.id === b.id));
        blocks.splice(
          previous ? blocks.findIndex((b) => b.id === previous.id) + 1 : 0,
          0,
          block,
        );
      }
      return blocks;
    };
    base.blocks = ordered(change.order.after);
    target.blocks = ordered(change.order.before);
  } else if (change.details) {
    base.titlePage = change.details.after.titlePage;
    base.metadata = change.details.after.metadata;
    target.titlePage = change.details.before.titlePage;
    target.metadata = change.details.before.metadata;
  } else if (change.blockId) {
    const replace = (doc: Screenplay, block?: ScriptBlock) => {
      const index = doc.blocks.findIndex((b) => b.id === change.blockId);
      if (index >= 0) {
        if (block) doc.blocks[index] = block;
        else doc.blocks.splice(index, 1);
      } else if (block) {
        const previous = doc.blocks.findIndex(
          (b) => b.id === change.previousId,
        );
        const next = doc.blocks.findIndex((b) => b.id === change.nextId);
        doc.blocks.splice(
          previous >= 0 ? previous + 1 : next >= 0 ? next : doc.blocks.length,
          0,
          block,
        );
      }
    };
    replace(base, change.after);
    replace(target, change.before);
  }
  return mergeScreenplays(base, current, target, choices);
}
