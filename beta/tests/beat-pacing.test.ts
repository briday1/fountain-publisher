import { describe, expect, test } from "vitest";
import { beatPacing } from "../src/components/beat-pacing";
import { emptyScreenplay } from "../src/core/model";
import type { Beat } from "../src/core/model";
import { screenplayLines } from "../src/core/beatRanges";

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
  test("two beats inside one scene have different positions at their first assigned lines", () => {
    const doc = screenplay();
    const first = doc.blocks.find((block) => block.id === "a1")!;
    first.text = "one two three\nfour five six seven\neight nine ten";
    const lines = screenplayLines(doc);
    const line1 = lines.find(
      (line) => line.blockId === "a1" && line.start === 0,
    )!;
    const line3 = lines.find(
      (line) => line.blockId === "a1" && line.text === "eight nine ten",
    )!;
    doc.metadata.beats = [
      {
        ...beat("first"),
        range: {
          start: { blockId: "a1", offset: line1.start },
          end: { blockId: "a1", offset: line1.end },
        },
      },
      {
        ...beat("later"),
        range: {
          start: { blockId: "a1", offset: line3.start + 2 },
          end: { blockId: "a1", offset: line3.end },
        },
      },
    ];
    const result = beatPacing(doc);
    expect(result.positions.map((point) => point.words)).toEqual([0, 7]);
    expect(result.positions.map((point) => point.startLine)).toEqual([
      line1.number,
      line3.number,
    ]);
    expect(result.positions.map((point) => point.sceneHeading)).toEqual([
      "INT. FIRST ROOM - DAY",
      "INT. FIRST ROOM - DAY",
    ]);
    expect(result.total).toBe(30);
  });
  test("an explicit range takes priority over a legacy scene link", () => {
    const doc = screenplay();
    doc.metadata.beats = [
      {
        ...beat("range", "s1"),
        range: {
          start: { blockId: "d1", offset: 0 },
          end: { blockId: "d1", offset: 10 },
        },
      },
    ];
    expect(beatPacing(doc).positions[0]).toMatchObject({
      assigned: true,
      words: 10,
      sceneHeading: "INT. SECOND ROOM - DAY",
    });
  });
  test("invalid explicit ranges never fall back to legacy scene links", () => {
    const doc = screenplay();
    doc.metadata.beats = [
      {
        ...beat("invalid", "s1"),
        range: {
          start: { blockId: "deleted", offset: 0 },
          end: { blockId: "a1", offset: 10 },
        },
      },
    ];
    const result = beatPacing(doc).positions[0];
    expect(result).toMatchObject({ assigned: false, words: 15 });
    expect(result.range).toBeUndefined();
    expect(result.startLine).toBeUndefined();
  });
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
