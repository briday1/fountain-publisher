import { describe, expect, it } from "vitest";
import { buildCharacterAnalytics } from "../src/core/characterAnalytics";
import { parseFountain } from "../src/core/fountain";
import { analyzeScreenplay } from "../src/core/insights";
import { emptyScreenplay } from "../src/core/model";
import type { BlockKind, ScriptBlock } from "../src/core/model";

function screenplay(lines: [BlockKind, string, Partial<ScriptBlock>?][]) {
  return {
    ...emptyScreenplay(),
    blocks: lines.map(([kind, text, extra], index) => ({
      id: `block-${index}`,
      kind,
      text,
      ...extra,
    })),
  };
}

describe("character analytics", () => {
  it("counts explicit dialogue lines and positions speech around action without counting cues or annotations", () => {
    const data = buildCharacterAnalytics(
      screenplay([
        ["scene", "INT. VERY LONG SCENE HEADING - DAY"],
        ["action", "A clock ticks."],
        ["character", "MARA (V.O.)"],
        ["dialogue", "Hello there.\nCome inside."],
        ["parenthetical", "(after a very long pause)"],
        ["note", "Never counted in the Gantt"],
        ["dialogue", "Please."],
        ["action", "She opens the door."],
        ["character", "ELI ^"],
        ["dialogue", "I can't."],
      ]),
    );
    expect(data.groups[0].lines).toEqual({ MARA: 3, ELI: 1 });
    expect(data.groups[0].totalWords).toBe(14);
    expect(
      data.groups[0].segments.map(({ character, start, words }) => ({
        character,
        start,
        words,
      })),
    ).toEqual([
      { character: "MARA", start: 3, words: 2 },
      { character: "MARA", start: 5, words: 2 },
      { character: "MARA", start: 7, words: 1 },
      { character: "ELI", start: 12, words: 2 },
    ]);
    expect(data.characters).toEqual(["MARA", "ELI"]);
    expect([data.minLines, data.maxLines]).toEqual([1, 3]);
  });

  it("groups scenes under acts, resets header numbering per act, and preserves explicit scene numbers for detail", () => {
    const data = buildCharacterAnalytics(
      screenplay([
        ["scene", "EXT. PROLOGUE - NIGHT"],
        ["section", "Act I", { level: 1 }],
        ["scene", "INT. ROOM - DAY", { sceneNumber: "12A" }],
        ["character", "MARA"],
        ["dialogue", "One line."],
        ["section", "A sequence", { level: 2 }],
        ["scene", "EXT. ROOM - DAY"],
        ["section", "Act II", { level: 1 }],
        ["scene", "INT. CAR - NIGHT"],
        ["character", "ELI"],
        ["dialogue", "An answer."],
      ]),
    );
    expect(
      data.groups.map(({ label, act, sceneNumber }) => ({
        label,
        act,
        sceneNumber,
      })),
    ).toEqual([
      { label: "1", act: "Screenplay", sceneNumber: "1" },
      { label: "1", act: "Act I", sceneNumber: "12A" },
      { label: "2", act: "Act I", sceneNumber: "3" },
      { label: "1", act: "Act II", sceneNumber: "4" },
    ]);
    expect(data.acts.map((act) => act.lines)).toEqual([
      { MARA: 1 },
      { ELI: 1 },
    ]);
    expect(data.groups[1].actId).toBe(data.acts[0].id);
  });

  it("falls back to acts or the entire document without requiring scene headings", () => {
    const acts = buildCharacterAnalytics(
      screenplay([
        ["section", "Opening"],
        ["character", "MARA"],
        ["dialogue", "Welcome."],
        ["section", "Ending"],
        ["character", "ELI"],
        ["dialogue", "Goodbye."],
      ]),
    );
    expect(acts.groups.map((group) => group.kind)).toEqual(["act", "act"]);
    expect(acts.document.lines).toEqual({ MARA: 1, ELI: 1 });
    const unstructured = buildCharacterAnalytics(
      screenplay([
        ["character", "MARA"],
        ["dialogue", "Welcome."],
      ]),
    );
    expect(unstructured.groups).toEqual([unstructured.document]);
    expect(unstructured.document.segments[0].start).toBe(0);
  });

  it("ends a speaker at structural boundaries and keeps uncued dialogue on the word axis", () => {
    const data = buildCharacterAnalytics(
      screenplay([
        ["character", "MARA"],
        ["dialogue", "A beginning."],
        ["scene", "INT. ROOM - DAY"],
        ["dialogue", "No cue here."],
        ["character", "ELI"],
        ["dialogue", "A reply."],
      ]),
    );
    expect(data.groups[0].lines).toEqual({ ELI: 1 });
    expect(
      data.groups[0].segments.map(({ character, start }) => ({
        character,
        start,
      })),
    ).toEqual([{ character: "ELI", start: 3 }]);
    expect(data.groups[0].totalWords).toBe(5);
    expect(data.document.lines).toEqual({ MARA: 1, ELI: 1 });
  });

  it("handles a silent script and character names that match object property names", () => {
    const empty = buildCharacterAnalytics(emptyScreenplay());
    expect(empty.characters).toEqual([]);
    expect([empty.minLines, empty.maxLines, empty.document.totalWords]).toEqual(
      [0, 0, 0],
    );
    const data = buildCharacterAnalytics(
      screenplay([
        ["character", "constructor"],
        ["dialogue", "A real character."],
      ]),
    );
    expect(data.document.lines.CONSTRUCTOR).toBe(1);
  });

  it.each([
    { speech: "Hello.\n/* private omission */\nStill speaking.", words: 3 },
    { speech: "~Singing these words.\nStill speaking.", words: 5 },
  ])(
    "keeps speech attribution across omitted text and lyrics: $speech",
    ({ speech, words }) => {
      const doc = parseFountain(`INT. ROOM - DAY\n\nMARA\n${speech}`);
      const data = buildCharacterAnalytics(doc);
      const segments = data.groups[0].segments;
      expect(data.groups[0].lines.MARA).toBe(2);
      expect(segments.map((segment) => segment.character)).toEqual([
        "MARA",
        "MARA",
      ]);
      expect(
        segments.reduce((total, segment) => total + segment.words, 0),
      ).toBe(words);
      expect(data.groups[0].totalWords).toBe(words);
      expect(analyzeScreenplay(doc).characters[0].dialogueWords).toBe(words);
    },
  );
});
