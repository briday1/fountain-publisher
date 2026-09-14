import { describe, it, expect } from "vitest";
import { parseFountain, serializeFountain } from "../src/core/fountain";
import {
  hasLegacyBeatRanges,
  restoreImportedBeatRanges,
} from "../src/core/repairBeats";
import { resolveBeatRange, sceneBeatRange } from "../src/core/beatRanges";
import type { Beat } from "../src/core/model";
const body =
  "INT. ROOM - NIGHT\n\nFirst moment.\n\nMARA\nHello.\n\nSecond moment.\n\nMARA\nGoodbye.";
const raw = [
  { text: "Arrival", range: { startLine: 2, endLine: 5 } },
  { text: "Departure", range: { startLine: 7, endLine: 10 } },
];
const source =
  body +
  "\n\n[[FP-BEATS:" +
  encodeURIComponent(JSON.stringify({ beats: raw })) +
  "]]";
describe("repair earlier scene-wide imports", () => {
  it("restores separate original line anchors in one scene without changing screenplay or notes", () => {
    const original = parseFountain(source);
    const current = parseFountain(serializeFountain(original));
    current.metadata.notes = "Keep these notes";
    current.metadata.beats = current.metadata.beats.map(
      (b, i) =>
        ({
          ...b,
          legacyRange: raw[i].range,
          range: sceneBeatRange(current, current.blocks[0].id),
        }) as Beat,
    );
    expect(hasLegacyBeatRanges(current)).toBe(true);
    const fixed = restoreImportedBeatRanges(current, original);
    expect(fixed.blocks).toBe(current.blocks);
    expect(fixed.metadata.notes).toBe("Keep these notes");
    expect(hasLegacyBeatRanges(fixed)).toBe(false);
    expect(
      fixed.metadata.beats.map((b) => resolveBeatRange(fixed, b.range!)),
    ).toEqual(
      original.metadata.beats.map((b) => resolveBeatRange(original, b.range!)),
    );
    expect(parseFountain(serializeFountain(fixed)).metadata.beats).toEqual(
      fixed.metadata.beats,
    );
  });
  it("rejects mismatched screenplay text without guessing or modifying the draft", () => {
    const original = parseFountain(source);
    const current = structuredClone(original);
    current.blocks[1].text = "Edited writing";
    expect(() => restoreImportedBeatRanges(current, original)).toThrow(
      "different screenplay text",
    );
    expect(current.blocks[1].text).toBe("Edited writing");
  });
});
