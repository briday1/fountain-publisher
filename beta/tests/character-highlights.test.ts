import { describe, it, expect } from "vitest";
import {
  characterHighlights,
  highlightedPdfFilename,
} from "../src/core/characterHighlights";
describe("highlighted PDF selection and filenames", () => {
  it("normalizes cue extensions, deduplicates selections, and gives an ensemble unique colors", () => {
    expect(characterHighlights(["MARA", "Mara (V.O.)", "ELI"])).toEqual(
      characterHighlights(["ELI", "MARA"]),
    );
    const colors = characterHighlights(
      Array.from({ length: 120 }, (_, index) => `PERSON ${index}`),
    );
    expect(new Set(colors.map(({ color }) => color)).size).toBe(120);
  });
  it("identifies the screenplay and selected characters with a portable filename", () => {
    expect(highlightedPdfFilename("The Night.fountain", ["MARA", "ELI"])).toBe(
      "The-Night-highlighted-ELI-MARA.pdf",
    );
    const name = highlightedPdfFilename("🦊".repeat(100) + ".fountain", [
      "RENÉE / VOICE",
      ...Array.from({ length: 100 }, (_, i) => `PERSON ${i}`),
    ]);
    expect(new TextEncoder().encode(name).length).toBeLessThan(240);
    expect(name).not.toMatch(/[<>:"/\\|?*\u0000-\u001f]/);
    expect(name).toMatch(/and-\d+-more.pdf$/);
  });
});
