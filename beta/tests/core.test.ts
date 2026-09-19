import { describe, it, expect } from "vitest";
import {
  parseFountain,
  serializeFountain,
  parseInline,
  formatInline,
} from "../src/core/fountain";
import { emptyScreenplay, newId } from "../src/core/model";
import type { BlockKind, TextSpan } from "../src/core/model";
import { analyzeScreenplay } from "../src/core/insights";
import { exportFdx, exportBeatSheetCsv, exportPdf } from "../src/core/export";
import { PDFDocument } from "pdf-lib";
import { readFile, mkdir, writeFile } from "node:fs/promises";
const canonical = (source: string) => {
  const doc = parseFountain(source);
  return { ...doc, blocks: doc.blocks.map(({ id, ...block }) => block) };
};
describe("portable document contract", () => {
  it("roundtrips every element, exact visible text, styles, title fields and arbitrary beat metadata", () => {
    const doc = emptyScreenplay();
    doc.titlePage = {
      ...doc.titlePage,
      title: "A *literal* title",
      author: "Renée",
      extra: { Copyright: "Mine" },
    };
    doc.metadata = {
      version: 1,
      notes: "A note containing */ and [[tokens]]",
      beats: [
        {
          id: newId(),
          title: "Beginning",
          description: "Change!",
          act: "Act I",
          color: "#abcdef",
        },
      ],
      future: { nested: ["kept"] },
    };
    doc.blocks = (
      [
        "scene",
        "action",
        "character",
        "dialogue",
        "parenthetical",
        "transition",
        "section",
        "synopsis",
        "note",
        "lyrics",
        "centered",
        "pageBreak",
        "boneyard",
      ] as BlockKind[]
    ).map((kind) => ({
      id: newId(),
      kind,
      text:
        kind === "pageBreak"
          ? ""
          : kind === "boneyard"
            ? "hidden */ content"
            : `${kind} visible * _ [ ] 🦊 café`,
      ...(kind === "scene" ? { sceneNumber: "12A" } : {}),
    }));
    doc.blocks.push({
      id: newId(),
      kind: "action",
      text: "bold and italic",
      spans: [
        { text: "bold", marks: ["bold"] },
        { text: " and " },
        { text: "italic", marks: ["italic", "underline"] },
      ],
    });
    expect(parseFountain(serializeFountain(doc))).toEqual(doc);
  });
  it("remains ordinary Fountain without the application comment", () => {
    const doc = emptyScreenplay();
    doc.titlePage.title = "Portable";
    doc.blocks = [
      { id: newId(), kind: "scene", text: "INT. ROOM - DAY" },
      { id: newId(), kind: "character", text: "MARA" },
      { id: newId(), kind: "dialogue", text: "Hello." },
      { id: newId(), kind: "action", text: "ALL CAPS ACTION" },
    ];
    const text = serializeFountain(doc).split("/*\nFOUNTAIN-PUBLISHER")[0];
    expect(parseFountain(text).blocks.map((b) => [b.kind, b.text])).toEqual(
      doc.blocks.map((b) => [b.kind, b.text]),
    );
  });
  it("honors external body edits even when embedded metadata is stale", () => {
    const doc = parseFountain("INT. ROOM - DAY\n\nOriginal text.");
    const serialized = serializeFountain(doc).replace(
      "!Original text.",
      "!Revised elsewhere.",
    );
    const parsed = parseFountain(serialized);
    expect(parsed.blocks.map((b) => b.text)).toContain("Revised elsewhere.");
    expect(parsed.blocks[0].id).toBe(doc.blocks[0].id);
  });
  it("preserves unknown comments and handles inline notes without printing them as prose", () => {
    const doc = parseFountain(
      "INT. ROOM - DAY\n\nA [[remember this]] small room.\n\n/* custom data */",
    );
    expect(doc.blocks.map((b) => b.kind)).toEqual([
      "scene",
      "action",
      "note",
      "boneyard",
    ]);
    expect(doc.blocks[1].text).toBe("A  small room.");
    expect(parseFountain(serializeFountain(doc))).toEqual(doc);
  });
  it("migrates the original application beat and character notes into editable metadata", () => {
    const beats = encodeURIComponent(
      JSON.stringify({
        premise: "A test premise",
        beats: [{ text: "A new world", range: { startLine: 2, endLine: 5 } }],
      }),
    );
    const source = `INT. ROOM - DAY\n\nAn action.\n\n[[FP-BEATS:${beats}]]\n[[FP-GENERAL:${encodeURIComponent("Keep this note")}]]\n[[FP-CHARACTER:MARA:${encodeURIComponent("She is listening.")}]]`;
    const doc = parseFountain(source);
    expect(doc.metadata).toMatchObject({
      notes: "Keep this note",
      premise: "A test premise",
      characterNotes: { MARA: "She is listening." },
    });
    expect(doc.metadata.beats[0]).toMatchObject({
      title: "A new world",
      sceneId: doc.blocks[0].id,
    });
    expect(doc.blocks.every((b) => !b.text.includes("FP-"))).toBe(true);
    expect(parseFountain(serializeFountain(doc)).metadata).toEqual(
      doc.metadata,
    );
  });
  it.each([
    "*italic*",
    "**bold**",
    "***both***",
    "_underline_",
    "**bold *nested* text**",
    "\\*literal\\*",
    "**x**",
    "Café 🦊",
  ])("reads and rewrites emphasis: %s", (source) => {
    const spans = parseInline(source);
    expect(parseInline(formatInline(spans))).toEqual(spans);
  });
  it("retains whitespace and adjacent mark ranges in its own document roundtrip", () => {
    const spans: TextSpan[] = [
      { text: " bold ", marks: ["bold"] },
      { text: "italic", marks: ["italic"] },
      { text: " under", marks: ["underline"] },
    ];
    const doc = emptyScreenplay();
    doc.blocks = [
      {
        id: newId(),
        kind: "action",
        text: spans.map((s) => s.text).join(""),
        spans,
      },
    ];
    expect(parseFountain(serializeFountain(doc)).blocks).toEqual(doc.blocks);
  });
  it("recognizes title pages, scene numbers, dual dialogue and forced action", () => {
    const result = canonical(
      "Title: Test\nAuthor: A\n\nINT. ROOM - DAY #12#\n\nMARA\nHi.\n\nELI ^\nHello.\n\n!LOUD ACTION",
    );
    expect(result.blocks.map((b) => b.kind)).toEqual([
      "scene",
      "character",
      "dialogue",
      "character",
      "dialogue",
      "action",
    ]);
    expect(result.blocks[0].sceneNumber).toBe("12");
    expect(result.blocks[3].dual).toBe(true);
  });
  it("computes character and location counts without counting annotations as dialogue", () => {
    const doc = parseFountain(
      "INT. ROOM - DAY\n\nMARA\nHello there.\n\n[[private note]]\n\nEXT. ROOM - NIGHT\n\nMARA\nHello again.",
    );
    const stats = analyzeScreenplay(doc);
    expect(stats.sceneCount).toBe(2);
    expect(stats.characters[0]).toMatchObject({
      name: "MARA",
      dialogueWords: 4,
      sceneCount: 2,
      speeches: 2,
    });
    expect(stats.locations[0].sceneCount).toBe(2);
  });
  it("exports valid escaped FDX and HTML with notes omitted, and neutralizes CSV formulas", () => {
    const doc = parseFountain(
      "INT. ROOM - DAY\n\n!A <script> & a thought.\n\n[[Secret note]]",
    );
    doc.metadata.beats = [
      {
        id: "a",
        title: '=HYPERLINK("bad")',
        description: "hello, world",
        act: "Act I",
        color: "#aaa",
      },
    ];
    const xml = new DOMParser().parseFromString(
      exportFdx(doc),
      "application/xml",
    );
    expect(xml.querySelector("parsererror")).toBeNull();
    expect(xml.querySelector("Content")?.textContent).toContain(
      "A <script> & a thought.",
    );
    expect(exportFdx(doc)).not.toContain("Secret note");
    expect(exportBeatSheetCsv(doc)).toContain("'=HYPERLINK");
  });
});
it("composes actual PDF pages with embedded fonts and reports an exact page count", async () => {
  const fonts = {
    regular: "400-normal",
    bold: "700-normal",
    italic: "400-italic",
    boldItalic: "700-italic",
  };
  const fontBytes = Object.fromEntries(
    await Promise.all(
      Object.entries(fonts).map(async ([key, name]) => [
        key,
        new Uint8Array(
          await readFile(
            `node_modules/@fontsource/courier-prime/files/courier-prime-latin-${name}.woff`,
          ),
        ),
      ]),
    ),
  ) as {
    regular: Uint8Array;
    bold: Uint8Array;
    italic: Uint8Array;
    boldItalic: Uint8Array;
  };
  const doc = parseFountain(
    "Title: The Quiet Hour\nAuthor: A Writer\n\nINT. STUDIO - NIGHT\n\n" +
      Array.from(
        { length: 65 },
        (_, i) =>
          `!Paragraph ${i + 1}. The room is quiet. A story is finding its voice.`,
      ).join("\n\n"),
  );
  const result = await exportPdf(doc, { fontBytes, sceneNumbers: "margin" });
  const pdf = await PDFDocument.load(result.bytes);
  expect(result.pageCount).toBe(pdf.getPageCount());
  expect(result.pageCount).toBeGreaterThan(2);
  expect(result.scriptPageCount).toBe(result.pageCount - 1);
  expect(result.warnings).toEqual([]);
  await mkdir("tmp/pdfs", { recursive: true });
  await writeFile("tmp/pdfs/verification.pdf", result.bytes);
}, 20000);
