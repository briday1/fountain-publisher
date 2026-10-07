import type { Screenplay, ScriptBlock, TextMark, TextSpan } from "./model";
import { sequenceDiff } from "./versionDiff";

export type MergeChoice = "current" | "incoming";
export interface MergeConflict {
  id: string;
  label: string;
  base: string;
  current: string;
  incoming: string;
}
export interface MergeResult<T> {
  value: T;
  conflicts: MergeConflict[];
}
export const sameValue = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a) === JSON.stringify(b);
/** Older plain files have no stable IDs. Align matching passages and bounded replacements once. */
export function alignScreenplayIds(
  base: Screenplay,
  incoming: Screenplay,
): Screenplay {
  if (incoming.blocks.some((b) => base.blocks.some((a) => a.id === b.id)))
    return incoming;
  const result = structuredClone(incoming);
  const diff = sequenceDiff(
    base.blocks,
    incoming.blocks,
    (a, b) => a.kind === b.kind && a.text === b.text,
  );
  let oldIndex = 0,
    newIndex = 0;
  for (let at = 0; at < diff.length;) {
    if (!diff[at].change) {
      result.blocks[newIndex++].id = base.blocks[oldIndex++].id;
      at++;
      continue;
    }
    const removed: ScriptBlock[] = [],
      added: ScriptBlock[] = [];
    while (at < diff.length && diff[at].change) {
      const part = diff[at++];
      (part.change === "removed" ? removed : added).push(part.value);
    }
    if (removed.length === added.length)
      for (let i = 0; i < added.length; i++)
        result.blocks[newIndex + i].id = removed[i].id;
    oldIndex += removed.length;
    newIndex += added.length;
  }
  return result;
}
type Edit<T> = { start: number; end: number; value: T[]; side: MergeChoice };
function edits<T>(
  base: T[],
  next: T[],
  side: MergeChoice,
  equal: (a: T, b: T) => boolean,
) {
  const result: Edit<T>[] = [];
  let offset = 0;
  for (const part of sequenceDiff(base, next, equal)) {
    if (!part.change) {
      offset++;
      continue;
    }
    let edit = result.at(-1);
    if (!edit || edit.end !== offset) {
      edit = { start: offset, end: offset, value: [], side };
      result.push(edit);
    }
    if (part.change === "removed") edit.end = ++offset;
    else edit.value.push(part.value);
  }
  return result;
}
function overlaps<T>(a: Edit<T>, b: Edit<T>) {
  if (a.start === a.end && b.start === b.end) return a.start === b.start;
  if (a.start === a.end) return a.start > b.start && a.start < b.end;
  if (b.start === b.end) return b.start > a.start && b.start < a.end;
  return a.start < b.end && b.start < a.end;
}
/** Changes are compared against their shared base, never by last-write-wins. */
function mergeSequence<T>(
  base: T[],
  current: T[],
  incoming: T[],
  equal: (a: T, b: T) => boolean,
  conflict: (
    base: T[],
    current: T[],
    incoming: T[],
    start: number,
  ) => MergeChoice,
): T[] {
  const pending = [
    ...edits(base, current, "current", equal),
    ...edits(base, incoming, "incoming", equal),
  ].sort(
    (a, b) =>
      a.start - b.start || a.end - b.end || a.side.localeCompare(b.side),
  );
  const result: T[] = [];
  let position = 0;
  while (pending.length) {
    const group = [pending.shift()!];
    // Transitive overlap matters when a large replacement crosses several edits.
    for (let i = 0; i < pending.length;) {
      if (group.some((edit) => overlaps(edit, pending[i]))) {
        group.push(pending.splice(i, 1)[0]);
        i = 0;
      } else i++;
    }
    const start = Math.min(...group.map((e) => e.start));
    const end = Math.max(...group.map((e) => e.end));
    result.push(...base.slice(position, start));
    const side = (which: MergeChoice) => {
      let at = start;
      const values: T[] = [];
      for (const edit of group
        .filter((e) => e.side === which)
        .sort((a, b) => a.start - b.start || a.end - b.end)) {
        values.push(...base.slice(at, edit.start), ...edit.value);
        at = edit.end;
      }
      values.push(...base.slice(at, end));
      return values;
    };
    const left = side("current"),
      right = side("incoming");
    const equalList = (a: T[], b: T[]) =>
      a.length === b.length && a.every((v, i) => equal(v, b[i]));
    const original = base.slice(start, end);
    const chosen =
      equalList(left, right) || equalList(right, original)
        ? left
        : equalList(left, original)
          ? right
          : conflict(original, left, right, start) === "incoming"
            ? right
            : left;
    result.push(...chosen);
    position = end;
  }
  result.push(...base.slice(position));
  return result;
}

export function mergeText(
  base: string,
  current: string,
  incoming: string,
  choices: Record<string, MergeChoice> = {},
  prefix = "text",
): MergeResult<string> {
  const conflicts: MergeConflict[] = [];
  const value = mergeSequence(
    base.match(/\s+|[^\s]+/gu) || [],
    current.match(/\s+|[^\s]+/gu) || [],
    incoming.match(/\s+|[^\s]+/gu) || [],
    (a, b) => a === b,
    (b, c, i, start) => {
      const id = `${prefix}:${start}`;
      conflicts.push({
        id,
        label: "Overlapping writing",
        base: b.join(""),
        current: c.join(""),
        incoming: i.join(""),
      });
      return choices[id] || "current";
    },
  ).join("");
  return { value, conflicts };
}

type RichCharacter = { text: string; marks: TextMark[] };
function characters(block: ScriptBlock): RichCharacter[] {
  return (block.spans || [{ text: block.text }]).flatMap((span) =>
    span.text
      .split("")
      .map((text) => ({ text, marks: [...(span.marks || [])].sort() })),
  );
}
function richWords(block: ScriptBlock): RichCharacter[][] {
  const words: RichCharacter[][] = [];
  for (const char of characters(block)) {
    const last = words.at(-1);
    if (last && /\s/u.test(last[0].text) === /\s/u.test(char.text))
      last.push(char);
    else words.push([char]);
  }
  return words;
}
export function mergeScreenplays(
  base: Screenplay,
  current: Screenplay,
  incoming: Screenplay,
  choices: Record<string, MergeChoice> = {},
): MergeResult<Screenplay> {
  const conflicts: MergeConflict[] = [];
  const choose = (
    id: string,
    b: unknown,
    c: unknown,
    i: unknown,
    label = "Document details",
  ) => {
    const display = (v: unknown) =>
      typeof v === "string"
        ? v
        : v && typeof v === "object" && "text" in v
          ? String(v.text)
          : JSON.stringify(v ?? null, null, 2);
    conflicts.push({
      id,
      label,
      base: display(b),
      current: display(c),
      incoming: display(i),
    });
    return choices[id] === "incoming" ? i : c;
  };
  const merge = (b: unknown, c: unknown, i: unknown, path: string): unknown => {
    if (sameValue(c, i) || sameValue(i, b)) return c;
    if (sameValue(c, b)) return i;
    if (
      typeof b === "string" &&
      typeof c === "string" &&
      typeof i === "string"
    ) {
      const result = mergeText(b, c, i, choices, path);
      conflicts.push(...result.conflicts);
      return result.value;
    }
    const object = (v: unknown): v is Record<string, unknown> =>
      !!v && typeof v === "object" && !Array.isArray(v);
    const identified = (v: unknown): v is { id: string }[] =>
      Array.isArray(v) &&
      v.every((item) => object(item) && typeof item.id === "string");
    if (identified(b) && identified(c) && identified(i)) {
      const before = new Map(b.map((item) => [item.id, item]));
      const left = new Map(c.map((item) => [item.id, item]));
      const right = new Map(i.map((item) => [item.id, item]));
      const order = [
        ...new Set([
          ...c.map((item) => item.id),
          ...i.map((item) => item.id),
          ...b.map((item) => item.id),
        ]),
      ];
      return order.flatMap((id) => {
        const item = merge(
          before.get(id),
          left.get(id),
          right.get(id),
          `${path}.${id}`,
        );
        return item === undefined ? [] : [item];
      });
    }
    if (object(b) && object(c) && object(i)) {
      const result: Record<string, unknown> = {};
      for (const key of new Set([
        ...Object.keys(b),
        ...Object.keys(c),
        ...Object.keys(i),
      ])) {
        const value = merge(b[key], c[key], i[key], `${path}.${key}`);
        if (value !== undefined)
          Object.defineProperty(result, key, {
            value,
            enumerable: true,
            writable: true,
            configurable: true,
          });
      }
      return result;
    }
    return choose(path, b, c, i);
  };
  const baseById = new Map(base.blocks.map((b) => [b.id, b]));
  const currentById = new Map(current.blocks.map((b) => [b.id, b]));
  const incomingById = new Map(incoming.blocks.map((b) => [b.id, b]));
  const ids = (doc: Screenplay) => doc.blocks.map((b) => b.id);
  const order = mergeSequence(
    ids(base),
    ids(current),
    ids(incoming),
    (a, b) => a === b,
    (b, c, i, start) => {
      // Independent new paragraphs at the same boundary can coexist.
      if (!b.length && [...c, ...i].every((id) => !baseById.has(id)))
        return "current";
      choose(`blocks.order:${start}`, b, c, i, "Paragraph order");
      return choices[`blocks.order:${start}`] || "current";
    },
  );
  // Include independent insertions that share a boundary, once each, beside their preceding paragraph.
  for (let index = 0; index < incoming.blocks.length; index++) {
    const id = incoming.blocks[index].id;
    if (baseById.has(id) || order.includes(id)) continue;
    const previous = incoming.blocks
      .slice(0, index)
      .reverse()
      .find((b) => order.includes(b.id));
    order.splice(previous ? order.indexOf(previous.id) + 1 : 0, 0, id);
  }
  const blocks: ScriptBlock[] = [];
  // Deleted paragraphs with new writing must remain available for review.
  for (const id of baseById.keys()) {
    if (
      !order.includes(id) &&
      !sameValue(currentById.get(id), incomingById.get(id)) &&
      !sameValue(currentById.get(id), baseById.get(id)) &&
      !sameValue(incomingById.get(id), baseById.get(id))
    ) {
      const index = base.blocks.findIndex((b) => b.id === id);
      const previous = base.blocks
        .slice(0, index)
        .reverse()
        .find((b) => order.includes(b.id));
      order.splice(previous ? order.indexOf(previous.id) + 1 : 0, 0, id);
    }
  }
  for (const id of [...new Set(order)]) {
    const b = baseById.get(id),
      c = currentById.get(id),
      i = incomingById.get(id);
    if (!b || !c || !i) {
      const value = merge(b, c, i, `blocks.${id}`) as ScriptBlock | undefined;
      if (value) blocks.push(value);
      continue;
    }
    const strip = ({ text: _text, spans: _spans, ...rest }: ScriptBlock) =>
      rest;
    const attributes = merge(
      strip(b),
      strip(c),
      strip(i),
      `blocks.${id}`,
    ) as Omit<ScriptBlock, "text" | "spans">;
    const rich = mergeSequence(
      richWords(b),
      richWords(c),
      richWords(i),
      sameValue,
      (before, left, right, start) => {
        const conflictId = `blocks.${id}.text:${start}`;
        choose(
          conflictId,
          before
            .flat()
            .map((s) => s.text)
            .join(""),
          left
            .flat()
            .map((s) => s.text)
            .join(""),
          right
            .flat()
            .map((s) => s.text)
            .join(""),
          "Overlapping writing",
        );
        return choices[conflictId] || "current";
      },
    );
    const spans: TextSpan[] = [];
    for (const char of rich.flat()) {
      const last = spans.at(-1);
      if (last && sameValue(last.marks || [], char.marks))
        last.text += char.text;
      else
        spans.push({
          text: char.text,
          ...(char.marks.length ? { marks: char.marks } : {}),
        });
    }
    blocks.push({
      ...attributes,
      text: rich
        .flat()
        .map((v) => v.text)
        .join(""),
      ...(spans.some((s) => s.marks?.length) ? { spans } : {}),
    });
  }
  return {
    value: {
      titlePage: merge(
        base.titlePage,
        current.titlePage,
        incoming.titlePage,
        "titlePage",
      ) as Screenplay["titlePage"],
      blocks,
      metadata: merge(
        base.metadata,
        current.metadata,
        incoming.metadata,
        "metadata",
      ) as Screenplay["metadata"],
    },
    conflicts,
  };
}
