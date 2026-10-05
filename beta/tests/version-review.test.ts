import { expect, it } from "vitest";
import {
  reviewDiff,
  resolveReview,
  type ReviewChoice,
} from "../src/core/versionReview";
import { parseFountain, serializeFountain } from "../src/core/fountain";
const choose = (review: ReturnType<typeof reviewDiff>, side: ReviewChoice) =>
  Object.fromEntries(
    review.parts.flatMap((p) => ("id" in p ? [[p.id, side]] : [])),
  );
it("a one-way review can keep either side, including whitespace, additions, deletions, unicode and large changes", () => {
  for (const [a, b] of [
    ["A quiet room.\n\nHe stays.", "A bright room.\n\nShe leaves."],
    ["", "new\n"],
    ["gone\n", ""],
    ["é 🇬🇧  café\r\n", "é 🇫🇷 café\n"],
    ["old ".repeat(1500), "new ".repeat(1500)],
  ]) {
    const review = reviewDiff(a, b);
    expect(resolveReview(review, choose(review, "older"))).toBe(a);
    expect(resolveReview(review, choose(review, "current"))).toBe(b);
    expect(() => resolveReview(review, {})).toThrow(/every change/);
  }
});
it("individual choices compose a new document and do not mutate either input", () => {
  const review = reviewDiff(
    "A quiet room.\n\nHe stays.",
    "A bright room.\n\nHe leaves.",
  );
  expect(review.count).toBe(2);
  expect(resolveReview(review, { 0: "older", 1: "current" })).toBe(
    "A quiet room.\n\nHe leaves.",
  );
});
it("ordinary typing doesn't produce a bookkeeping change; changed notes remain reviewable and survive mixed text decisions", () => {
  const a = parseFountain("INT. ROOM - DAY\n\nA quiet room.");
  const b = structuredClone(a);
  b.blocks[1].text = "A bright room.";
  const review = reviewDiff(serializeFountain(a), serializeFountain(b));
  expect(review.count).toBe(1);
  const old = parseFountain(resolveReview(review, { 0: "older" }));
  expect(old.blocks[1].text).toBe("A quiet room.");
  b.metadata.notes = "Keep this note";
  const notes = reviewDiff(serializeFountain(a), serializeFountain(b));
  expect(notes.count).toBe(2);
  const mixed = parseFountain(
    resolveReview(notes, { 0: "older", 1: "current" }),
  );
  expect(mixed.metadata.notes).toBe("Keep this note");
  expect(mixed.blocks[1].text).toBe("A quiet room.");
});
