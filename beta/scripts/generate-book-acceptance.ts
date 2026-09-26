// Run from beta with: node_modules/.bin/tsx scripts/generate-book-acceptance.ts
// Synthetic content only; output is local QA material, never deployed.
import { writeFileSync, mkdirSync } from "node:fs";
import { parseMarkdown, serializeMarkdown } from "../src/core/markdown";
import {
  novelDocx,
  novelPdf,
  novelEpub,
  novelRtf,
} from "../src/core/novelExport";
mkdirSync("work/export-acceptance", { recursive: true });
const paragraph =
  "Mara crossed the quiet room and opened the notebook. The coast was changing, but the account in her hands remained clear. She marked the evidence carefully and returned to the question that had brought her here.";
const source =
  "# The Weather Ledger\n\n> *Every account begins with something we almost overlooked.*\n\n> — A fictional archivist\n\n## Chapter One\n\nA **bold observation** and an *italic reservation* can share a line with ***both kinds of emphasis*** and <u>an underlined phrase</u>. Curly quotes “stay legible,” as do café, naïve, and an em dash — here.\n\n> This inset quotation crosses more than one line so that the margin and paragraph spacing can be inspected. " +
  paragraph +
  "\n\n### A smaller heading\n\n" +
  Array.from(
    { length: 18 },
    (_, i) => "Paragraph " + (i + 1) + ". " + paragraph + " " + paragraph,
  ).join("\n\n") +
  "\n\n#### Evidence within the chapter\n\nA nested heading keeps its relationship to the discussion.\n\n##### A fifth-level note\n\nSmall details remain visible.\n\n###### A sixth-level observation\n\nThe deepest heading is preserved.\n\n---\n\n## Chapter Two\n\n> *A second beginning is still a beginning.*\n\n> — The same fictional archivist\n\n" +
  Array.from(
    { length: 8 },
    (_, i) => "Second passage " + (i + 1) + ". " + paragraph + " " + paragraph,
  ).join("\n\n") +
  "\n\nFinal marker: the ledger closes without losing its last line.";
const doc = parseMarkdown(source);
doc.titlePage.title = "The Weather Ledger";
doc.titlePage.author = "Synthetic acceptance fixture";
writeFileSync("work/export-acceptance/book.md", serializeMarkdown(doc));
writeFileSync("work/export-acceptance/book.docx", novelDocx(doc));
writeFileSync("work/export-acceptance/book.epub", novelEpub(doc));
writeFileSync("work/export-acceptance/book.rtf", novelRtf(doc));
const pdf = await novelPdf(doc);
writeFileSync("work/export-acceptance/book.pdf", pdf.bytes);
writeFileSync(
  "work/export-acceptance/generation.json",
  JSON.stringify(
    {
      words: source.split(/\s+/).length,
      blocks: doc.blocks.length,
      pdfPages: pdf.pageCount,
      warnings: pdf.warnings,
    },
    null,
    2,
  ),
);
console.log({
  blocks: doc.blocks.length,
  pages: pdf.pageCount,
  warnings: pdf.warnings,
});
