import { expect, it } from "vitest";
import {
  outlineBeats,
  removeBeat,
  moveBeat,
  documentBeats,
} from "../src/core/beatOutline";
import { emptyScreenplay, type Beat } from "../src/core/model";
import { parseFountain, serializeFountain } from "../src/core/fountain";
const beat = (id: string, parentId?: string): Beat => ({
  id,
  parentId,
  title: id,
  description: `Detail ${id}`,
  act: "Act I",
  color: "#123456",
});
it("round-trips hierarchy and folded state without losing hidden detail", () => {
  const doc = emptyScreenplay();
  doc.metadata.beats = [beat("a"), beat("b", "a"), beat("c", "b")];
  doc.metadata.beatSheetCollapsed = ["a"];
  const restored = parseFountain(serializeFountain(doc));
  expect(
    restored.metadata.beats.map((b) => [b.id, b.parentId, b.description]),
  ).toEqual(doc.metadata.beats.map((b) => [b.id, b.parentId, b.description]));
  expect(restored.metadata.beatSheetCollapsed).toEqual(["a"]);
});
it("breaks cycles/orphans, preserves every beat and inherits organization", () => {
  const result = outlineBeats([
    { ...beat("a", "b"), groupSceneId: "scene" },
    beat("b", "a"),
    beat("c", "missing"),
  ]);
  expect(result.map((b) => b.id).sort()).toEqual(["a", "b", "c"]);
  expect(result.find((b) => b.id === "b")?.groupSceneId).toBe("scene");
  expect(result.find((b) => b.id === "c")?.parentId).toBeUndefined();
});
it("moves a complete subtree and refuses moving inside itself or across groups", () => {
  const beats = [beat("a"), beat("b", "a"), beat("c", "b"), beat("d")];
  expect(moveBeat(beats, "a", "d").map((b) => b.id)).toEqual([
    "d",
    "a",
    "b",
    "c",
  ]);
  expect(moveBeat(beats, "a", "b").map((b) => b.id)).toEqual([
    "a",
    "b",
    "c",
    "d",
  ]);
});
it("deleting a parent promotes children and retains grandchildren and descriptions", () => {
  const result = removeBeat([beat("a"), beat("b", "a"), beat("c", "b")], "a");
  expect(result[0]).toMatchObject({
    id: "b",
    parentId: undefined,
    description: "Detail b",
  });
  expect(result[1]).toMatchObject({ id: "c", parentId: "b" });
});

it("groups legacy book beats by chapter without mutating assignments or notes", () => {
  const doc = emptyScreenplay();
  doc.metadata.format = "markdown";
  doc.blocks = [
    { id: "c1", kind: "section", level: 2, text: "Chapter 1" },
    { id: "p1", kind: "action", text: "One." },
    { id: "c2", kind: "section", level: 2, text: "Chapter 2" },
    { id: "p2", kind: "action", text: "Two." },
  ];
  const first = {
    ...beat("first"),
    act: "Act III",
    range: {
      start: { blockId: "p1", offset: 0 },
      end: { blockId: "p1", offset: 4 },
    },
  };
  doc.metadata.beats = [
    { ...beat("second"), act: "Act I", groupSceneId: "c2" },
    first,
    { ...beat("child", "first"), act: "Act II" },
    { ...beat("peer"), act: "Act I", groupSceneId: "c1" },
  ];
  const ordered = documentBeats(doc);
  expect(ordered.map((b) => b.id)).toEqual([
    "first",
    "child",
    "peer",
    "second",
  ]);
  expect(ordered.every((b) => b.act === "")).toBe(true);
  expect(ordered[0].range).toEqual(first.range);
  expect(ordered[1].description).toBe("Detail child");
  expect(moveBeat(ordered, "first", "peer").map((b) => b.id)).toEqual([
    "peer",
    "first",
    "child",
    "second",
  ]);
  expect(doc.metadata.beats[1].act).toBe("Act III");
});
