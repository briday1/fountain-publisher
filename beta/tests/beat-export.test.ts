import { describe, expect, it } from "vitest";
import { beatSheetDocument, exportBeatSheetCsv } from "../src/core/export";
import { parseFountain } from "../src/core/fountain";
import { screenplayLines } from "../src/core/beatRanges";
import { hasTitlePage } from "../src/core/titlePage";

function assignedDocument() {
  const doc = parseFountain(
    "Title: A story\nAuthor: A Writer\nCopyright: Copyright 2026\n\nINT. ROOM - DAY\n\n!Three opening words.\n\nMARA\nFirst line.\nSecond assigned line.\nThird assigned line.",
  );
  const dialogue = doc.blocks.find((block) => block.kind === "dialogue")!;
  const start = dialogue.text.indexOf("Second");
  doc.metadata.beats = [
    {
      id: "beat",
      title: "A change",
      description: "The turning point.",
      act: "Act I",
      color: "#aabbcc",
      range: {
        start: { blockId: dialogue.id, offset: start },
        end: { blockId: dialogue.id, offset: dialogue.text.length },
      },
    },
  ];
  const lines = screenplayLines(doc).filter(
    (line) => line.blockId === dialogue.id,
  );
  return { doc, first: lines[1].number, last: lines[2].number };
}

describe("beat assignments in exported documents", () => {
  it("exports migrated line assignments and words before their first line in CSV and PDF content", () => {
    const { doc, first, last } = assignedDocument();
    const csv = exportBeatSheetCsv(doc);
    expect(csv).toContain('"Lines","Words before first line"');
    expect(csv).toContain(`"${first}–${last}","5"`);
    expect(csv).toContain('"1","INT. ROOM - DAY"');
    const printable = beatSheetDocument(doc);
    expect(printable.blocks.map((block) => block.text)).toContain(
      `Lines ${first}–${last} · 5 words before first assigned line`,
    );
    expect(printable.blocks.map((block) => block.text)).toContain(
      "Scene: INT. ROOM - DAY",
    );
    expect(hasTitlePage(printable.titlePage)).toBe(false);
    expect(doc.titlePage.extra?.Copyright).toBe("Copyright 2026");
  });
  it("resolves legacy scene-only assignments without modifying the saved beat", () => {
    const { doc } = assignedDocument();
    doc.metadata.beats[0].range = undefined;
    doc.metadata.beats[0].sceneId = doc.blocks.find(
      (block) => block.kind === "scene",
    )!.id;
    const before = structuredClone(doc.metadata.beats[0]);
    expect(
      beatSheetDocument(doc).blocks.some((block) =>
        /^Lines \d+–\d+ · 0 words/.test(block.text),
      ),
    ).toBe(true);
    expect(exportBeatSheetCsv(doc)).toContain('"1","INT. ROOM - DAY"');
    expect(doc.metadata.beats[0]).toEqual(before);
  });
  it("does not silently replace a missing explicit range with a stale scene link", () => {
    const { doc } = assignedDocument();
    doc.metadata.beats[0].range!.start.blockId = "deleted";
    doc.metadata.beats[0].sceneId = doc.blocks.find(
      (block) => block.kind === "scene",
    )!.id;
    const printed = beatSheetDocument(doc).blocks.map((block) => block.text);
    expect(printed).toContain("Assigned lines are no longer available.");
    expect(printed.some((text) => text.startsWith("Scene:"))).toBe(false);
    expect(exportBeatSheetCsv(doc)).toContain(
      '"A change","Act I","The turning point.","","","#aabbcc","",""',
    );
  });
});
