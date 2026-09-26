import { expect, it } from "vitest";
import { versionDiff, sequenceDiff } from "../src/core/versionDiff";
import { parseFountain, serializeFountain } from "../src/core/fountain";
it("keeps unchanged context and marks changed words inline", () => {
  const result = versionDiff(
    "INT. ROOM - DAY\n\nA quiet room.\n\nMARA\nHello there.",
    "INT. ROOM - DAY\n\nA bright room.\n\nMARA\nHello there.",
  );
  expect(result.filter((b) => b.changed)).toHaveLength(1);
  expect(result.find((b) => b.changed)?.parts).toEqual([
    { text: "A" },
    { text: " " },
    { text: "quiet", change: "removed" },
    { text: "bright", change: "added" },
    { text: " " },
    { text: "room." },
  ]);
  expect(result.some((b) => b.kind === "dialogue" && !b.changed)).toBe(true);
});
it("ignores hidden app metadata and preserves visible deletions", () => {
  const a = parseFountain("INT. ROOM - DAY\n\nA room.");
  const b = structuredClone(a);
  b.metadata.notes = "private metadata";
  expect(
    versionDiff(serializeFountain(a), serializeFountain(b)).some(
      (b) => b.changed,
    ),
  ).toBe(false);
  expect(
    versionDiff("INT. ROOM - DAY\n\nGone.", "INT. ROOM - DAY")
      .flatMap((b) => b.parts)
      .some((p) => p.change === "removed" && p.text === "Gone."),
  ).toBe(true);
});
it("bounded fallback retains all old/new content for large replacements", () => {
  const a = Array.from({ length: 1000 }, (_, i) => `a${i}`),
    b = Array.from({ length: 1000 }, (_, i) => `b${i}`);
  const result = sequenceDiff(a, b, (x, y) => x === y);
  expect(
    result.filter((p) => p.change !== "added").map((p) => p.value),
  ).toEqual(a);
  expect(
    result.filter((p) => p.change !== "removed").map((p) => p.value),
  ).toEqual(b);
});
