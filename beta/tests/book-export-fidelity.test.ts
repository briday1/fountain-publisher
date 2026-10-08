import { afterEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { PDFPage } from "pdf-lib";
import { unzipSync, strFromU8 } from "fflate";
import { bookExportFixture } from "./fixtures/book-export";
import { bookFrontMatter, type PublicationBlock } from "../src/core/book";
import { footnoteRuns } from "../src/core/footnotes";
import { parseMarkdown, serializeMarkdown } from "../src/core/markdown";
import {
  novelDocx,
  novelEpub,
  novelPdf,
  novelRtf,
} from "../src/core/novelExport";
import { fontKeys, type FontBytes } from "../src/core/writingFonts";

afterEach(() => vi.restoreAllMocks());
const fonts = Object.fromEntries(
  fontKeys.map((key) => [
    key,
    new Uint8Array(readFileSync(`src/fonts/DejaVuSerif-${key}.woff`)),
  ]),
) as FontBytes;
const xml = (bytes: Uint8Array) => {
  const parsed = new DOMParser().parseFromString(
    strFromU8(bytes),
    "application/xml",
  );
  expect(parsed.querySelector("parsererror")).toBeNull();
  return parsed;
};

it("preserves every saved manuscript paragraph and note in DOCX and EPUB, including double-digit references", () => {
  const original = bookExportFixture();
  const doc = parseMarkdown(serializeMarkdown(original));
  expect(doc.blocks.map((b) => [b.id, b.kind, b.level, b.text])).toEqual(
    original.blocks.map((b) => [b.id, b.kind, b.level, b.text]),
  );
  const counter = { value: 0 };
  const blocks = (
    [...bookFrontMatter(doc), ...doc.blocks] as PublicationBlock[]
  ).filter((b) => b.front !== "break");
  const expected = blocks.map((b) => footnoteRuns(b, counter));
  const notes = expected.flat().flatMap((r) => (r.note ? [r.note] : []));
  expect(notes).toHaveLength(12);
  for (const options of [{}, { fontName: "DejaVu Serif", fontBytes: fonts }]) {
    const word = unzipSync(novelDocx(doc, options));
    const paragraphs = Array.from(
      xml(word["word/document.xml"]).getElementsByTagName("w:p"),
    );
    expect(paragraphs).toHaveLength(blocks.length);
    paragraphs.forEach((p, i) => {
      const text = Array.from(p.querySelectorAll("*"))
        .filter((e) =>
          ["w:t", "w:br", "w:footnoteReference"].includes(e.tagName),
        )
        .map((e) =>
          e.tagName === "w:br"
            ? "\n"
            : e.tagName === "w:footnoteReference"
              ? e.getAttribute("w:id")
              : e.textContent,
        )
        .join("");
      expect(text).toBe(
        blocks[i].kind === "pageBreak"
          ? "* * *"
          : expected[i].map((r) => r.text).join(""),
      );
    });
    const wordNotes = xml(word["word/footnotes.xml"]);
    for (const note of notes) {
      const actual = Array.from(
        wordNotes.getElementsByTagName("w:footnote"),
      ).find((e) => e.getAttribute("w:id") === String(note.number));
      expect(actual?.textContent?.trim()).toBe(note.text);
    }
    const epub = unzipSync(novelEpub(doc, options));
    const body = xml(epub["EPUB/book.xhtml"]);
    const references = Array.from(
      body.querySelectorAll('a[role="doc-noteref"]'),
    );
    expect(references).toHaveLength(12);
    for (const note of notes) {
      const ref = body.getElementById(`ref${note.number}`)!;
      const target = body.getElementById(ref.getAttribute("href")!.slice(1))!;
      expect(target.textContent).toBe(`${note.number} ${note.text}`);
      const back = target.querySelector("a")!;
      expect(body.getElementById(back.getAttribute("href")!.slice(1))).toBe(
        ref,
      );
    }
    const content = Array.from(body.querySelectorAll("body > *")).filter(
      (e) => !e.matches("aside,.front-break"),
    );
    expect(content).toHaveLength(blocks.length);
    content.forEach((e, i) => {
      if (blocks[i].kind === "pageBreak") expect(e.tagName).toBe("hr");
      else
        expect(e.textContent).toBe(
          expected[i]
            .map((r) => r.text)
            .join("")
            .replaceAll("\n", ""),
        );
    });
  }
});

it("keeps all PDF body and note text, bottom-note space, and the selected font through long-note continuation", async () => {
  const doc = bookExportFixture();
  const spy = vi.spyOn(PDFPage.prototype, "drawText");
  await novelPdf(doc, { fontName: "DejaVu Serif", fontBytes: fonts });
  const rows = spy.mock.calls.map(([text, options], i) => ({
    text,
    ...options!,
    page: spy.mock.contexts[i],
  }));
  const body = rows.filter((r) => r.size !== 9);
  const counter = { value: 0 };
  const expected = (
    [...bookFrontMatter(doc), ...doc.blocks] as PublicationBlock[]
  ).flatMap((b) =>
    b.kind === "pageBreak"
      ? [{ text: b.front ? "" : "* * *" }]
      : footnoteRuns(b, counter),
  );
  const compact = (text: string) => text.replace(/\s/g, "");
  expect(compact(body.map((r) => r.text).join(""))).toBe(
    compact(expected.map((r) => r.text).join("")),
  );
  const notes = rows.filter((r) => r.size === 9 && r.y! > 30);
  const expectedNotes = expected.flatMap((r) =>
    "note" in r && r.note ? [`${r.note.number}. ${r.note.text}`] : [],
  );
  expect(compact(notes.map((r) => r.text).join(""))).toBe(
    compact(expectedNotes.join("")),
  );
  for (const page of new Set(rows.map((r) => r.page))) {
    const onPage = notes.filter((r) => r.page === page);
    if (!onPage.length) continue;
    const noteTop = Math.max(...onPage.map((r) => r.y!));
    expect(Math.min(...onPage.map((r) => r.y!))).toBeGreaterThanOrEqual(62);
    for (const row of body.filter((r) => r.page === page))
      expect(row.y!).toBeGreaterThan(noteTop + 8);
  }
  expect(
    new Set(
      notes
        .filter((r) => r.text.includes("original ledger"))
        .map((r) => r.page),
    ).size,
  ).toBeGreaterThan(1);
  expect(rows.every((r) => r.font!.name.startsWith("DejaVuSerif"))).toBe(true);
}, 15000);

it("reports missing glyphs in a selected PDF font in body text and footnotes", async () => {
  const doc = parseMarkdown("Body 漢字.^[Note 漢字.]");
  const result = await novelPdf(doc, {
    fontName: "DejaVu Serif",
    fontBytes: fonts,
  });
  expect(result.warnings).toEqual([
    "4 unsupported characters were shown as ? in this PDF. Markdown, DOCX, EPUB and RTF retain the original Unicode text.",
  ]);
});

it("sets the RTF default paragraph font so native note numbers inherit the selected family", () => {
  const doc = bookExportFixture();
  const result = novelRtf(doc, { fontName: "DejaVu Serif" });
  expect(result).toContain("{\\f0 DejaVu Serif;}");
  expect(result).toContain("{\\s0\\f0\\fs24 Normal;}");
  expect(result.match(/\\footnote\\/g)).toHaveLength(12);
  expect(result).toContain("LONG NOTE END.");
  expect(result).toContain("MANUSCRIPT FINAL WORDS.");
});

it.each([{}, { fontName: "DejaVu Serif", fontBytes: fonts }])(
  "expands tabs in PDF body and notes without replacing them with missing characters",
  async (options) => {
    const spy = vi.spyOn(PDFPage.prototype, "drawText");
    const result = await novelPdf(
      parseMarkdown("Body\twords.^[Note\twords.]"),
      options,
    );
    expect(result.warnings).toEqual([]);
    expect(spy.mock.calls.map(([text]) => text).join("")).toContain(
      "Body    words.",
    );
    expect(spy.mock.calls.map(([text]) => text).join("")).toContain(
      "Note    words.",
    );
  },
);
