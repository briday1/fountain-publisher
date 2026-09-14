import { describe, expect, test } from "vitest";
import { beatPacing } from "../src/components/beat-pacing";
import { emptyScreenplay } from "../src/core/model";
import type { Beat } from "../src/core/model";

const beat = (id: string, sceneId?: string): Beat => ({
  id,
  title: id,
  description: "",
  act: "Act I",
  color: "#75a8ed",
  sceneId,
});
const screenplay = () => ({
  ...emptyScreenplay(),
  blocks: [
    { id: "s1", kind: "scene" as const, text: "INT. FIRST ROOM - DAY" },
    {
      id: "a1",
      kind: "action" as const,
      text: "one two three four five six seven eight nine ten",
    },
    { id: "s2", kind: "scene" as const, text: "INT. SECOND ROOM - DAY" },
    { id: "c1", kind: "character" as const, text: "THE WRITER" },
    { id: "p1", kind: "parenthetical" as const, text: "(very softly)" },
    {
      id: "d1",
      kind: "dialogue" as const,
      text: "one two three four five six seven eight nine ten",
    },
    { id: "s3", kind: "scene" as const, text: "EXT. THIRD ROOM - NIGHT" },
    {
      id: "a2",
      kind: "action" as const,
      text: "one two three four five six seven eight nine ten",
    },
    {
      id: "n1",
      kind: "note" as const,
      text: "This private note should not change the pacing.",
    },
  ],
});

describe("beat pacing", () => {
  test("counts screenplay prose and positions assigned beats at scene starts", () => {
    const doc = screenplay();
    doc.metadata.beats = [
      beat("first", "s1"),
      beat("second", "s2"),
      beat("third", "s3"),
    ];
    const result = beatPacing(doc);
    expect(result.total).toBe(30);
    expect(result.positions.map((point) => point.words)).toEqual([0, 10, 20]);
    expect(result.positions.every((point) => point.assigned)).toBe(true);
  });
  test("interpolates unassigned beats between real scene positions", () => {
    const doc = screenplay();
    doc.metadata.beats = [
      beat("first", "s1"),
      beat("middle"),
      beat("third", "s3"),
      beat("ending"),
    ];
    expect(beatPacing(doc).positions.map((point) => point.words)).toEqual([
      0, 10, 20, 25,
    ]);
  });
  test("uses estimates for deleted scene links and never changes stored assignments", () => {
    const doc = screenplay();
    doc.metadata.beats = [beat("missing", "deleted"), beat("late", "s3")];
    const result = beatPacing(doc);
    expect(result.positions[0]).toMatchObject({ words: 10, assigned: false });
    expect(doc.metadata.beats[0].sceneId).toBe("deleted");
  });
  test("preserves backwards assignments so misplaced beats remain visible", () => {
    const doc = screenplay();
    doc.metadata.beats = [
      beat("late", "s3"),
      beat("middle"),
      beat("early", "s1"),
    ];
    expect(beatPacing(doc).positions.map((point) => point.words)).toEqual([
      20, 10, 0,
    ]);
  });
  test("empty scripts and all-unassigned beats have finite positions", () => {
    const doc = emptyScreenplay();
    doc.metadata.beats = [beat("first"), beat("last")];
    expect(beatPacing(doc).positions.map((point) => point.words)).toEqual([
      0, 0,
    ]);
    const written = screenplay();
    written.metadata.beats = [beat("first"), beat("last")];
    expect(beatPacing(written).positions.map((point) => point.words)).toEqual([
      10, 20,
    ]);
  });
});
