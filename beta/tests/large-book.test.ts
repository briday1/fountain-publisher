// @vitest-environment node
import { it, expect } from "vitest";
import { parseMarkdown, serializeMarkdown } from "../src/core/markdown";
import {
  novelDocx,
  novelEpub,
  novelRtf,
  novelPdf,
} from "../src/core/novelExport";
import { unzipSync, strFromU8 } from "fflate";
it("preserves a 100,000-word Book across Markdown and all export formats", async () => {
  const started = performance.now();
  const paragraph =
    "The writer returned to the quiet room and continued working. "
      .repeat(20)
      .trim();
  const source = Array.from(
    { length: 25 },
    (_, chapter) =>
      `## Chapter ${chapter + 1}\n\n` +
      Array.from(
        { length: 20 },
        (_, p) => `Marker${chapter}p${p} ${paragraph}`,
      ).join("\n\n"),
  ).join("\n\n");
  const doc = parseMarkdown(source),
    saved = serializeMarkdown(doc),
    reopened = parseMarkdown(saved);
  expect(source.split(/\s+/).length).toBeGreaterThan(100000);
  expect(reopened.blocks).toEqual(doc.blocks);
  const docx = unzipSync(novelDocx(doc)),
    epub = unzipSync(novelEpub(doc));
  expect(strFromU8(docx["word/document.xml"])).toContain("Marker24p19");
  const book = Object.entries(epub).find(([name]) =>
    name.endsWith("/book.xhtml"),
  );
  expect(book).toBeDefined();
  expect(strFromU8(book![1])).toContain("Marker24p19");
  expect(novelRtf(doc)).toContain("Marker24p19");
  const pdf = await novelPdf(doc);
  expect(pdf.pageCount).toBeGreaterThan(100);
  expect(pdf.warnings).toEqual([]);
  console.log(
    JSON.stringify({
      words: source.split(/\s+/).length,
      blocks: doc.blocks.length,
      pdfPages: pdf.pageCount,
      pdfBytes: pdf.bytes.length,
      elapsedMs: Math.round(performance.now() - started),
    }),
  );
}, 60000);
