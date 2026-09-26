import { parseFountain } from "./fountain";
import type { BlockKind } from "./model";
export type DiffPart = { text: string; change?: "added" | "removed" };
export type DiffBlock = {
  kind: BlockKind;
  parts: DiffPart[];
  changed: boolean;
};
/** Bounded LCS: trim shared edges first, and use a replacement for very large rewrites. */
export function sequenceDiff<T>(
  a: T[],
  b: T[],
  equal: (a: T, b: T) => boolean,
): { value: T; change?: "added" | "removed" }[] {
  let start = 0,
    end = 0;
  while (start < a.length && start < b.length && equal(a[start], b[start]))
    start++;
  while (
    end < a.length - start &&
    end < b.length - start &&
    equal(a[a.length - 1 - end], b[b.length - 1 - end])
  )
    end++;
  const left = a.slice(start, a.length - end),
    right = b.slice(start, b.length - end);
  const middle: { value: T; change?: "added" | "removed" }[] = [];
  if (left.length * right.length > 500_000) {
    middle.push(
      ...left.map((value) => ({ value, change: "removed" as const })),
      ...right.map((value) => ({ value, change: "added" as const })),
    );
  } else {
    const width = right.length + 1,
      matrix = new Uint32Array((left.length + 1) * width);
    for (let i = left.length - 1; i >= 0; i--)
      for (let j = right.length - 1; j >= 0; j--)
        matrix[i * width + j] = equal(left[i], right[j])
          ? matrix[(i + 1) * width + j + 1] + 1
          : Math.max(matrix[(i + 1) * width + j], matrix[i * width + j + 1]);
    let i = 0,
      j = 0;
    while (i < left.length || j < right.length) {
      if (i < left.length && j < right.length && equal(left[i], right[j])) {
        middle.push({ value: right[j++] });
        i++;
      } else if (
        i < left.length &&
        (j === right.length ||
          matrix[(i + 1) * width + j] >= matrix[i * width + j + 1])
      )
        middle.push({ value: left[i++], change: "removed" });
      else middle.push({ value: right[j++], change: "added" });
    }
  }
  return [
    ...a.slice(0, start).map((value) => ({ value })),
    ...middle,
    ...b.slice(b.length - end).map((value) => ({ value })),
  ];
}
function visible(source: string) {
  const doc = parseFountain(source);
  const title = Object.entries(doc.titlePage.title || doc.titlePage.author ? doc.titlePage : {})
    .filter(
      ([key, value]) =>
        key !== "extra" && typeof value === "string" && value.trim(),
    )
    .map(([, text]) => ({ kind: "centered" as BlockKind, text: String(text) }));
  return [
    ...title,
    ...doc.blocks.filter(
      (b) => !["boneyard", "note", "synopsis", "section"].includes(b.kind),
    ),
  ];
}
export function versionDiff(older: string, newer: string): DiffBlock[] {
  const edits = sequenceDiff(
    visible(older),
    visible(newer),
    (a, b) => a.kind === b.kind && a.text === b.text,
  );
  const result: DiffBlock[] = [];
  for (let i = 0; i < edits.length;) {
    if (!edits[i].change) {
      result.push({
        kind: edits[i].value.kind,
        parts: [{ text: edits[i].value.text }],
        changed: false,
      });
      i++;
      continue;
    }
    const removed: { kind: BlockKind; text: string }[] = [],
      added: { kind: BlockKind; text: string }[] = [];
    while (i < edits.length && edits[i].change) {
      (edits[i].change === "removed" ? removed : added).push(edits[i++].value);
    }
    for (let j = 0; j < Math.max(removed.length, added.length); j++) {
      const a = removed[j],
        b = added[j];
      if (a && b && a.kind === b.kind) {
        const parts = sequenceDiff(
          a.text.match(/\s+|[^\s]+/gu) || [],
          b.text.match(/\s+|[^\s]+/gu) || [],
          (x, y) => x === y,
        ).map((p) => ({ text: p.value, change: p.change }));
        result.push({ kind: b.kind, parts, changed: true });
      } else {
        if (a)
          result.push({
            kind: a.kind,
            parts: [{ text: a.text, change: "removed" }],
            changed: true,
          });
        if (b)
          result.push({
            kind: b.kind,
            parts: [{ text: b.text, change: "added" }],
            changed: true,
          });
      }
    }
  }
  return result;
}
