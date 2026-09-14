import type { Node, Schema } from "prosemirror-model";
import { Plugin, PluginKey } from "prosemirror-state";
import { Step, StepResult } from "prosemirror-transform";
import type { Mappable } from "prosemirror-transform";
import type { Beat, BeatRange, Screenplay, TextAnchor } from "../core/model";
import { isBeatRange, sceneBeatRange } from "../core/beatRanges";

type PositionRange = { from: number; to: number };
type StoredAnchor = PositionRange | { missing: BeatRange } | null;
export type BeatAnchors = Record<string, StoredAnchor>;

export const beatAnchorKey = new PluginKey<BeatAnchors>("fountainBeatAnchors");
const stepType = "fountainPublisherBeatAnchorsV1";

function readAnchors(value: unknown): BeatAnchors {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new RangeError("Invalid beat anchor snapshot");
  const result: BeatAnchors = Object.create(null);
  for (const [id, entry] of Object.entries(value)) {
    if (entry === null) result[id] = null;
    else if (
      entry &&
      typeof entry === "object" &&
      "missing" in entry &&
      isBeatRange(entry.missing)
    )
      result[id] = { missing: entry.missing };
    else if (
      entry &&
      typeof entry === "object" &&
      "from" in entry &&
      "to" in entry &&
      Number.isSafeInteger(entry.from) &&
      Number.isSafeInteger(entry.to) &&
      typeof entry.from === "number" &&
      typeof entry.to === "number" &&
      entry.from >= 0 &&
      entry.to >= entry.from
    )
      result[id] = { from: entry.from, to: entry.to };
    else throw new RangeError("Invalid beat anchor position");
  }
  return result;
}

/** History carries positional snapshots without changing document markup or native paragraph DOM. */
export class BeatAnchorStep extends Step {
  constructor(
    readonly before: BeatAnchors,
    readonly after: BeatAnchors,
  ) {
    super();
  }

  apply(doc: Node): StepResult {
    return StepResult.ok(doc);
  }
  invert(_doc?: Node): BeatAnchorStep {
    return new BeatAnchorStep(this.after, this.before);
  }
  map(mapping: Mappable): BeatAnchorStep {
    return new BeatAnchorStep(
      mapBeatAnchors(this.before, mapping),
      mapBeatAnchors(this.after, mapping),
    );
  }
  toJSON() {
    return { stepType, before: this.before, after: this.after };
  }
  static fromJSON(_schema: Schema, json: unknown): BeatAnchorStep {
    if (
      !json ||
      typeof json !== "object" ||
      !("before" in json) ||
      !("after" in json)
    )
      throw new RangeError("Invalid beat anchor step");
    return new BeatAnchorStep(
      readAnchors(json.before),
      readAnchors(json.after),
    );
  }
}
Step.jsonID(stepType, BeatAnchorStep);

export function beatAnchorPlugin(screenplay: Screenplay): Plugin<BeatAnchors> {
  return new Plugin<BeatAnchors>({
    key: beatAnchorKey,
    state: {
      init: (_config, state) => initialBeatAnchors(state.doc, screenplay),
      apply: (transaction, anchors) => {
        // A grouped undo may contain several snapshots interleaved with inverse
        // text steps. The last snapshot describes the transaction's final document.
        for (let index = transaction.steps.length - 1; index >= 0; index--) {
          const step = transaction.steps[index];
          if (step instanceof BeatAnchorStep) return step.after;
        }
        return transaction.docChanged
          ? mapBeatAnchors(anchors, transaction.mapping)
          : anchors;
      },
    },
  });
}

export function anchorPosition(
  doc: Node,
  anchor: TextAnchor,
): number | undefined {
  let found: number | undefined;
  doc.forEach((node, pos) => {
    if (
      node.attrs.id === anchor.blockId &&
      Number.isInteger(anchor.offset) &&
      anchor.offset >= 0 &&
      anchor.offset <= node.content.size
    )
      found = pos + 1 + anchor.offset;
  });
  return found;
}

export function textAnchor(
  doc: Node,
  position: number,
): TextAnchor | undefined {
  if (position < 0 || position > doc.content.size) return;
  const resolved = doc.resolve(position);
  if (!resolved.depth || !resolved.parent.isTextblock) return;
  return { blockId: resolved.parent.attrs.id, offset: resolved.parentOffset };
}

function storeRange(doc: Node, range: BeatRange): StoredAnchor {
  if (!isBeatRange(range)) return { missing: range };
  const from = anchorPosition(doc, range.start);
  const to = anchorPosition(doc, range.end);
  return from !== undefined && to !== undefined && from <= to
    ? { from, to }
    : { missing: range };
}

export function initialBeatAnchors(
  doc: Node,
  screenplay: Screenplay,
): BeatAnchors {
  const anchors: BeatAnchors = Object.create(null);
  for (const beat of screenplay.metadata.beats) {
    const range =
      beat.range ??
      (beat.sceneId ? sceneBeatRange(screenplay, beat.sceneId) : undefined);
    if (range) anchors[beat.id] = storeRange(doc, range);
  }
  return anchors;
}

/** Only a small array of beat positions is mapped on input, never the script. */
export function mapBeatAnchors(
  anchors: BeatAnchors,
  mapping: Mappable,
): BeatAnchors {
  let result = anchors;
  for (const [id, anchor] of Object.entries(anchors)) {
    if (!anchor || !("from" in anchor)) continue;
    const start = mapping.mapResult(anchor.from, 1);
    const end = mapping.mapResult(anchor.to, -1);
    let next: StoredAnchor;
    // A range swallowed inside a broader replacement no longer names that passage.
    // Replacing exactly its boundaries still maps to the replacement text.
    if (
      (start.pos === end.pos && anchor.from !== anchor.to) ||
      (start.deletedAcross && end.deletedAcross)
    )
      next = null;
    else
      next = {
        from: Math.min(start.pos, end.pos),
        to: Math.max(start.pos, end.pos),
      };
    if (!next || next.from !== anchor.from || next.to !== anchor.to) {
      if (result === anchors)
        result = Object.assign(Object.create(null), anchors);
      result[id] = next;
    }
  }
  return result;
}

export function rangesFromAnchors(
  doc: Node,
  beats: Beat[],
  anchors: BeatAnchors,
): Beat[] {
  return beats.map((beat) => {
    const anchor = Object.hasOwn(anchors, beat.id)
      ? anchors[beat.id]
      : undefined;
    let range: BeatRange | undefined;
    if (anchor && "missing" in anchor) range = anchor.missing;
    else if (anchor) {
      const start = textAnchor(doc, anchor.from);
      const end = textAnchor(doc, anchor.to);
      if (start && end) range = { start, end };
    }
    return { ...beat, sceneId: undefined, range };
  });
}

/** Metadata edits that did not change an assignment must not reset live anchors. */
export function updateBeatAnchors(
  doc: Node,
  next: Screenplay,
  previous: Beat[],
  anchors: BeatAnchors,
): BeatAnchors {
  const before = new Map(previous.map((beat) => [beat.id, beat]));
  let result = anchors;
  const currentIds = new Set(next.metadata.beats.map((beat) => beat.id));
  for (const id of Object.keys(anchors)) {
    if (currentIds.has(id)) continue;
    if (result === anchors)
      result = Object.assign(Object.create(null), anchors);
    delete result[id];
  }
  for (const beat of next.metadata.beats) {
    const old = before.get(beat.id);
    if (
      old &&
      JSON.stringify(old.range) === JSON.stringify(beat.range) &&
      old.sceneId === beat.sceneId
    )
      continue;
    const range =
      beat.range ??
      (beat.sceneId ? sceneBeatRange(next, beat.sceneId) : undefined);
    if (result === anchors)
      result = Object.assign(Object.create(null), anchors);
    result[beat.id] = range ? storeRange(doc, range) : null;
  }
  return result;
}
