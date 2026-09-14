import { describe, expect, it } from "vitest";
import { parseFountain, serializeFountain } from "../src/core/fountain";
import {
  beatRangeFromLines,
  resolveBeatRange,
  sceneBeatRange,
  screenplayLines,
} from "../src/core/beatRanges";
import { emptyScreenplay } from "../src/core/model";
import type { Beat, BeatRange, BlockKind, Screenplay } from "../src/core/model";

const beat = (range?: BeatRange): Beat => ({
  id: "beat",
  title: "The turn",
  description: "",
  color: "#abcdef",
  act: "Act I",
  ...(range ? { range } : {}),
});

describe("authored beat line ranges", () => {
  it("numbers authored lines at their exact canonical Fountain positions, including titles, separators and omitted blocks", () => {
    const doc = emptyScreenplay();
    doc.titlePage = {
      ...doc.titlePage,
      title: "A title\nA subtitle",
      author: "A Writer",
      contact: "First contact line\nSecond contact line",
      extra: { Copyright: "2026" },
    };
    doc.blocks = (
      [
        "scene",
        "action",
        "character",
        "dialogue",
        "parenthetical",
        "dialogue",
        "note",
        "boneyard",
        "section",
        "lyrics",
        "centered",
        "transition",
        "synopsis",
        "pageBreak",
      ] as BlockKind[]
    ).map((kind, index) => ({
      id: `block-${index}`,
      kind,
      text: kind === "pageBreak" ? "" : `${kind} first\n${kind} second`,
    }));
    const serialized = serializeFountain(doc);
    const body = serialized.slice(
      0,
      serialized.lastIndexOf("\n\n/*\nFOUNTAIN-PUBLISHER v1\n"),
    );
    const envelope = JSON.parse(
      serialized.slice(
        serialized.lastIndexOf("FOUNTAIN-PUBLISHER v1\n") +
          "FOUNTAIN-PUBLISHER v1\n".length,
        serialized.lastIndexOf("\n*/"),
      ),
    );
    const expected = envelope.blocks.flatMap(
      (record: { id: string; start: number; end: number }) => {
        const line = body.slice(0, record.start).split("\n").length;
        return body
          .slice(record.start, record.end)
          .split("\n")
          .map((_text: string, index: number) => ({
            blockId: record.id,
            number: line + index,
          }));
      },
    );
    expect(
      screenplayLines(doc).map(({ blockId, number }) => ({ blockId, number })),
    ).toEqual(expected);
  });

  it("distinguishes beats inside one multiline paragraph and positions them at words before their assigned line", () => {
    const doc = parseFountain(
      "INT. ROOM - DAY\n\nFirst two.\nThree more words.\nLast line.\n\nMARA\nHello there.",
    );
    const lines = screenplayLines(doc);
    const start = lines.find((line) => line.text === "Three more words.")!;
    const end = lines.find((line) => line.text === "Last line.")!;
    const range = beatRangeFromLines(doc, start.number, end.number)!;
    expect(range).toEqual({
      start: { blockId: start.blockId, offset: 11 },
      end: { blockId: end.blockId, offset: 39 },
    });
    expect(resolveBeatRange(doc, range)).toEqual({
      startLine: start.number,
      endLine: end.number,
      words: 2,
      sceneHeading: "INT. ROOM - DAY",
    });
    const earlier = beatRangeFromLines(
      doc,
      start.number - 1,
      start.number - 1,
    )!;
    expect(resolveBeatRange(doc, earlier)?.words).toBe(0);
    expect(earlier.start.blockId).toBe(range.start.blockId);
    expect(earlier.start.offset).not.toBe(range.start.offset);
  });

  it("honors exclusive endpoints and UTF-16 selection offsets without advancing to the following line", () => {
    const doc = parseFountain("INT. ROOM - DAY\n\nA 🦊 waits.\nThen moves.");
    const block = doc.blocks[1];
    const lines = screenplayLines(doc).filter(
      (line) => line.blockId === block.id,
    );
    const range = {
      start: { blockId: block.id, offset: 2 },
      end: { blockId: block.id, offset: lines[1].start },
    };
    expect(resolveBeatRange(doc, range)?.endLine).toBe(lines[0].number);
    expect(
      resolveBeatRange(doc, {
        start: range.start,
        end: { blockId: block.id, offset: block.text.length },
      })?.endLine,
    ).toBe(lines[1].number);
  });

  it("selects content only inside numeric bounds and rejects invalid, empty, reversed and deleted ranges", () => {
    const doc = parseFountain(
      "INT. ROOM - DAY\n\nA line.\n\nEXT. STREET - NIGHT\n\nAnother line.",
    );
    const lines = screenplayLines(doc);
    const action = lines.find((line) => line.text === "A line.")!;
    expect(
      beatRangeFromLines(doc, action.number - 1, action.number)?.start.blockId,
    ).toBe(action.blockId);
    for (const [start, end] of [
      [0, 1],
      [2, 1],
      [action.number - 1, action.number - 1],
      [1, 1000],
      [1.5, 3],
    ])
      expect(beatRangeFromLines(doc, start, end)).toBeUndefined();
    const range = beatRangeFromLines(doc, action.number, action.number)!;
    expect(
      resolveBeatRange(doc, { start: range.end, end: range.start }),
    ).toBeUndefined();
    expect(
      resolveBeatRange(doc, {
        start: range.start,
        end: { ...range.end, offset: 999 },
      }),
    ).toBeUndefined();
    expect(
      resolveBeatRange(
        {
          ...doc,
          blocks: doc.blocks.filter((block) => block.id !== action.blockId),
        },
        range,
      ),
    ).toBeUndefined();
    const scene = sceneBeatRange(doc, doc.blocks[0].id)!;
    expect(scene.end).toEqual(range.end);
    expect(sceneBeatRange(doc, "deleted-scene")).toBeUndefined();
  });

  it("keeps exact anchors through Fountain roundtrip and leaves a deleted or externally changed assignment unassigned", () => {
    const doc = parseFountain(
      "INT. ROOM - DAY\n\nFirst line.\nThe turning point.",
    );
    const line = screenplayLines(doc).at(-1)!;
    const range = beatRangeFromLines(doc, line.number, line.number)!;
    doc.metadata.beats = [{ ...beat(range), sceneId: doc.blocks[0].id }];
    const source = serializeFountain(doc);
    expect(parseFountain(source)).toEqual(doc);
    const external = parseFountain(
      source.replace("The turning point.", "An external revision."),
    );
    expect(external.metadata.beats[0].range).toBeUndefined();
    expect(external.metadata.beats[0].sceneId).toBeUndefined();
    const invalid = {
      ...doc,
      metadata: {
        ...doc.metadata,
        beats: [
          {
            ...doc.metadata.beats[0],
            range: {
              start: { blockId: line.blockId, offset: -1 },
              end: range.end,
            },
          },
        ],
      },
    };
    expect(
      parseFountain(serializeFountain(invalid)).metadata.beats[0].range,
    ).toBeUndefined();
    expect(
      parseFountain(serializeFountain(invalid)).metadata.beats[0].sceneId,
    ).toBeUndefined();
  });

  it("reuses line indexes for metadata-only edits and rebuilds them for title or block edits", () => {
    const doc = parseFountain("INT. ROOM - DAY\n\nA line.");
    const initial = screenplayLines(doc);
    expect(
      screenplayLines({
        ...doc,
        metadata: { ...doc.metadata, beats: [beat()] },
      }),
    ).toBe(initial);
    const titled = screenplayLines({
      ...doc,
      titlePage: { ...doc.titlePage, title: "New title" },
    });
    expect(titled).not.toBe(initial);
    expect(titled[0].number).toBe(initial[0].number + 2);
    expect(screenplayLines({ ...doc, blocks: [...doc.blocks] })).not.toBe(
      initial,
    );
  });
});

describe("empty authored beat lines", () => {
  it("allows planning on empty authored lines but rejects arbitrary empty cursors and page breaks", () => {
    const doc = emptyScreenplay();
    doc.blocks = [
      { id: "opening", kind: "action", text: "First line.\n\nNext line." },
      { id: "empty", kind: "action", text: "" },
      { id: "break", kind: "pageBreak", text: "" },
    ];
    const lines = screenplayLines(doc);
    const blank = lines.find(
      (line) => line.blockId === "opening" && !line.text,
    )!;
    const empty = lines.find((line) => line.blockId === "empty")!;
    const pageBreak = lines.find((line) => line.blockId === "break")!;
    for (const line of [blank, empty]) {
      const range = beatRangeFromLines(doc, line.number, line.number)!;
      expect(range.start).toEqual(range.end);
      expect(resolveBeatRange(doc, range)).toMatchObject({
        startLine: line.number,
        endLine: line.number,
        words: line.wordsBefore,
      });
      const planned = {
        ...doc,
        metadata: { ...doc.metadata, beats: [beat(range)] },
      };
      expect(
        parseFountain(serializeFountain(planned)).metadata.beats[0].range,
      ).toEqual(range);
    }
    expect(
      resolveBeatRange(doc, {
        start: { blockId: "opening", offset: 2 },
        end: { blockId: "opening", offset: 2 },
      }),
    ).toBeUndefined();
    expect(
      beatRangeFromLines(doc, pageBreak.number, pageBreak.number),
    ).toBeUndefined();
    expect(
      resolveBeatRange(doc, {
        start: { blockId: "break", offset: 0 },
        end: { blockId: "break", offset: 0 },
      }),
    ).toBeUndefined();
    const spanning = beatRangeFromLines(doc, lines[0].number, empty.number)!;
    expect(resolveBeatRange(doc, spanning)?.endLine).toBe(empty.number);
  });
});

describe("original Fountain Publisher range migration", () => {
  function legacyDoc(
    lines: string[],
    ranges: { startLine: number; endLine: number }[],
  ): Screenplay {
    const payload = encodeURIComponent(
      JSON.stringify({
        premise: "A premise",
        beats: ranges.map((range, index) => ({
          text: `Beat ${index + 1}`,
          range,
        })),
      }),
    );
    return parseFountain([...lines, "", `[[FP-BEATS:${payload}]]`].join("\n"));
  }

  it("maps original physical line numbers to distinct text offsets inside the same scene and paragraph", () => {
    const source = [
      "Title: A story",
      "Author: A Writer",
      "",
      "# Act I",
      "",
      "INT. ROOM - DAY",
      "",
      "The first line.",
      "A **turning** point.",
      "An ending.",
    ];
    const doc = legacyDoc(source, [
      { startLine: 7, endLine: 7 },
      { startLine: 8, endLine: 9 },
    ]);
    const [first, second] = doc.metadata.beats;
    const action = doc.blocks.find((block) => block.kind === "action")!;
    expect(first.range).toEqual({
      start: { blockId: action.id, offset: 0 },
      end: { blockId: action.id, offset: 15 },
    });
    expect(second.range).toEqual({
      start: { blockId: action.id, offset: 16 },
      end: { blockId: action.id, offset: action.text.length },
    });
    expect(resolveBeatRange(doc, first.range!)?.words).toBe(0);
    expect(resolveBeatRange(doc, second.range!)?.words).toBe(3);
    expect(parseFountain(serializeFountain(doc)).metadata.beats).toEqual(
      doc.metadata.beats,
    );
  });

  it("does not attach invalid or noncontent original ranges to the nearest scene", () => {
    const source = [
      "Title: A story",
      "",
      "INT. ROOM - DAY",
      "",
      "An action.",
      "",
      "EXT. STREET - NIGHT",
      "",
      "Another action.",
    ];
    const doc = legacyDoc(source, [
      { startLine: -1, endLine: 4 },
      { startLine: 4, endLine: 3 },
      { startLine: 99, endLine: 100 },
      { startLine: 0, endLine: 1 },
      { startLine: 5, endLine: 5 },
    ]);
    for (const item of doc.metadata.beats) {
      expect(item.range).toBeUndefined();
      expect(item.sceneId).toBeUndefined();
    }
  });
});
