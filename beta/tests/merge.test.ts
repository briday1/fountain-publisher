import { expect, it } from "vitest";
import {
  mergeScreenplays,
  mergeText,
  alignScreenplayIds,
} from "../src/core/merge";
import { emptyScreenplay } from "../src/core/model";
import { parseFountain } from "../src/core/fountain";
import {
  emptyWritingReview,
  recordWritingChanges,
  undoWritingChange,
} from "../src/core/changeReview";

it("merges independent words, Unicode, whitespace and separate passages without inventing a replacement word", () => {
  expect(
    mergeText(
      "A quiet room. He stays.",
      "A bright room. He stays.",
      "A quiet room. He leaves.",
    ),
  ).toEqual({ value: "A bright room. He leaves.", conflicts: [] });
  expect(mergeText("cat", "bat", "car").conflicts).toHaveLength(1);
  expect(mergeText("é 🇬🇧 café", "É 🇬🇧 café", "é 🇬🇧 tea").value).toBe(
    "É 🇬🇧 tea",
  );
  expect(mergeText("Hello", "Hello!", "Hello!")).toEqual({
    value: "Hello!",
    conflicts: [],
  });
});
it("overlaps require an explicit choice and keep surrounding independent edits", () => {
  const base = "A quiet room. He stays.",
    current = "A bright room. He stays.",
    incoming = "A dark room. He leaves.";
  const review = mergeText(base, current, incoming);
  expect(review.conflicts).toHaveLength(1);
  expect(review.value).toBe("A bright room. He leaves.");
  expect(
    mergeText(base, current, incoming, { [review.conflicts[0].id]: "incoming" })
      .value,
  ).toBe("A dark room. He leaves.");
});
it("keeps rich formatting, independent paragraphs and story notes", () => {
  const base = emptyScreenplay();
  base.blocks[0].text = "A quiet room. He stays.";
  const current = structuredClone(base),
    incoming = structuredClone(base);
  current.blocks[0] = {
    ...current.blocks[0],
    text: "A bright room. He stays.",
    spans: [
      { text: "A " },
      { text: "bright", marks: ["bold"] },
      { text: " room. He stays." },
    ],
  };
  incoming.blocks[0].text = "A quiet room. He leaves.";
  current.blocks.push({ id: "left", kind: "action", text: "Left paragraph." });
  incoming.blocks.push({
    id: "right",
    kind: "action",
    text: "Right paragraph.",
  });
  incoming.metadata.notes = "A new story note.";
  const result = mergeScreenplays(base, current, incoming);
  expect(result.conflicts).toEqual([]);
  expect(result.value.blocks[0].text).toBe("A bright room. He leaves.");
  expect(
    result.value.blocks[0].spans?.find((s) => s.text === "bright")?.marks,
  ).toEqual(["bold"]);
  expect(
    result.value.blocks
      .slice(1)
      .map((b) => b.id)
      .sort(),
  ).toEqual(["left", "right"]);
  expect(result.value.metadata.notes).toBe("A new story note.");
});
it("does not silently delete a paragraph edited by the other writer", () => {
  const base = emptyScreenplay();
  base.blocks[0].text = "Original writing.";
  const current = structuredClone(base),
    incoming = structuredClone(base);
  current.blocks = [];
  incoming.blocks[0].text = "Important new writing.";
  const result = mergeScreenplays(base, current, incoming);
  expect(result.conflicts).toHaveLength(1);
  const kept = mergeScreenplays(base, current, incoming, {
    [result.conflicts[0].id]: "incoming",
  });
  expect(kept.value.blocks[0].text).toBe("Important new writing.");
});
it("merges separate beat edits and aligns IDs in older plain files", () => {
  const base = parseFountain("INT. ROOM - DAY\n\n!A quiet room.\n\n!He stays.");
  const incoming = alignScreenplayIds(
    base,
    parseFountain("INT. ROOM - DAY\n\n!A bright room.\n\n!He stays."),
  );
  expect(incoming.blocks.map((b) => b.id)).toEqual(
    base.blocks.map((b) => b.id),
  );
  base.metadata.beats = [
    { id: "a", title: "A", description: "", color: "red", act: "" },
    { id: "b", title: "B", description: "", color: "blue", act: "" },
  ];
  const current = structuredClone(base),
    right = structuredClone(base);
  current.metadata.beats[0].description = "Left note";
  right.metadata.beats[1].description = "Right note";
  const result = mergeScreenplays(base, current, right);
  expect(result.conflicts).toEqual([]);
  expect(result.value.metadata.beats.map((b) => b.description)).toEqual([
    "Left note",
    "Right note",
  ]);
});
it("attributes only written characters and undo retains another writer's later edit", () => {
  const base = emptyScreenplay();
  base.blocks[0].text = "A quiet room. He stays.";
  const first = structuredClone(base);
  first.blocks[0].text = "A bright room. He stays.";
  const alice = { id: "alice", name: "Alice Writer", color: "#123456" },
    bob = { id: "bob", name: "Bob Writer", color: "#654321" };
  const journal = recordWritingChanges(
    emptyWritingReview(),
    base,
    first,
    alice,
    100,
    "alice-tab",
  );
  expect(
    journal.attribution[base.blocks[0].id].every(
      (s) => s.author.id === "alice",
    ),
  ).toBe(true);
  const later = structuredClone(first);
  later.blocks[0].text = "A bright room. He leaves.";
  const all = recordWritingChanges(journal, first, later, bob, 200, "bob-tab");
  expect(all.changes).toHaveLength(2);
  expect(
    new Set(all.attribution[base.blocks[0].id].map((s) => s.author.id)),
  ).toEqual(new Set(["alice", "bob"]));
  const undo = undoWritingChange(later, all.changes[0]);
  expect(undo.conflicts).toEqual([]);
  expect(undo.value.blocks[0].text).toBe("A quiet room. He leaves.");
  expect(journal.changes).toHaveLength(1);
});
it("undo detects later overlapping writing and a viewed change stops growing", () => {
  const base = emptyScreenplay();
  base.blocks[0].text = "A quiet room.";
  const first = structuredClone(base);
  first.blocks[0].text = "A bright room.";
  const author = { id: "a", name: "A", color: "#123456" };
  const review = recordWritingChanges(
    emptyWritingReview(),
    base,
    first,
    author,
    100,
    "tab",
  );
  review.sealedAt = 110;
  const later = structuredClone(first);
  later.blocks[0].text = "A dark room.";
  const next = recordWritingChanges(review, first, later, author, 120, "tab");
  expect(next.changes).toHaveLength(2);
  const undo = undoWritingChange(later, next.changes[0]);
  expect(undo.conflicts).toHaveLength(1);
  expect(undo.value.blocks[0].text).toBe("A dark room.");
});
it("reviews and undoes paragraph moves while keeping later writing in those paragraphs", () => {
  const base = emptyScreenplay();
  base.blocks = [
    { id: "a", kind: "action", text: "First." },
    { id: "b", kind: "action", text: "Second." },
    { id: "c", kind: "action", text: "Third." },
  ];
  const moved = structuredClone(base);
  moved.blocks = [moved.blocks[2], moved.blocks[0], moved.blocks[1]];
  const review = recordWritingChanges(
    emptyWritingReview(),
    base,
    moved,
    { id: "writer", name: "Writer", color: "#123456" },
    1,
    "tab",
  );
  expect(review.changes).toHaveLength(1);
  expect(review.changes[0].order).toBeTruthy();
  const current = structuredClone(moved);
  current.blocks[1].text = "First with later writing.";
  const undone = undoWritingChange(current, review.changes[0]);
  expect(undone.conflicts).toEqual([]);
  expect(undone.value.blocks.map((b) => b.id)).toEqual(["a", "b", "c"]);
  expect(undone.value.blocks[0].text).toBe("First with later writing.");
});
