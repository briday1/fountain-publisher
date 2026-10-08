import { beforeAll, expect, it } from "vitest";
import { PDFDocument, PDFDict, PDFName, PDFArray } from "pdf-lib";
import { strFromU8, unzipSync } from "fflate";
import { parseMarkdown } from "../src/core/markdown";
import {
  exportNovel,
  novelEpub,
  novelPdf,
  novelRtf,
} from "../src/core/novelExport";
import type { NovelPageSize } from "../src/core/novelExport";
import { mockBookExportFonts } from "./helpers/bookExportFonts";

beforeAll(() => {
  mockBookExportFonts();
});
const source =
  "## Chapter 1\n\nOpening **bold words** and *quiet thoughts*.[^source]\n\nAnother paragraph.\n\n---\n\nAfter the break.\n\n## Chapter 2\n\nThe final words.\n\n[^source]: A source with café, \\<brackets\\> & detail.";

it("honors paperback sizes and manuscript Letter/A4 through the actual export API, with embedded default fonts", async () => {
  for (const [pageSize, width, height, style, family] of [
    ["6x9", 432, 648, "book", "DejaVuSerif"],
    ["5.5x8.5", 396, 612, "book", "DejaVuSerif"],
    ["5x8", 360, 576, "book", "DejaVuSerif"],
    ["letter", 612, 792, "manuscript", "CourierPrime"],
    ["a4", 595.28, 841.89, "manuscript", "CourierPrime"],
  ] as const) {
    const result = await exportNovel(parseMarkdown(source), "pdf", {
      pageSize: pageSize as NovelPageSize,
      pdfStyle: style,
    });
    expect(result.blob.type).toBe("application/pdf");
    const pdf = await PDFDocument.load(
      await new Promise<Uint8Array>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          resolve(new Uint8Array(reader.result as ArrayBuffer));
        reader.onerror = reject;
        reader.readAsArrayBuffer(result.blob);
      }),
    );
    expect(result.warnings).toEqual([]);
    for (const page of pdf.getPages()) {
      expect(page.getWidth()).toBeCloseTo(width);
      expect(page.getHeight()).toBeCloseTo(height);
      const resources = page.node
        .Resources()!
        .lookup(PDFName.of("Font"), PDFDict);
      const fonts = resources
        .values()
        .map((ref) => pdf.context.lookup(ref, PDFDict));
      expect(
        fonts.some((font) =>
          font.get(PDFName.of("BaseFont"))?.toString().includes(family),
        ),
      ).toBe(true);
      for (const font of fonts) {
        const child = font
          .lookup(PDFName.of("DescendantFonts"), PDFArray)
          .lookup(0, PDFDict);
        const descriptor = child.lookup(PDFName.of("FontDescriptor"), PDFDict);
        expect(descriptor.has(PDFName.of("FontFile2"))).toBe(true);
      }
    }
  }
}, 15000);

it("gives double-spaced manuscripts more pages while retaining title, dedication, chapters, and long notes", async () => {
  const doc = parseMarkdown(source);
  doc.titlePage.title = "The Coast";
  doc.titlePage.author = "Alex Morgan";
  doc.titlePage.extra = { Dedication: "For the keepers." };
  doc.blocks.splice(3, 0, {
    id: "long",
    kind: "action",
    text: "A passage that moves across the page. ".repeat(90),
  });
  const book = await novelPdf(doc, { pageSize: "letter" }),
    manuscript = await novelPdf(doc, { pdfStyle: "manuscript" });
  expect(manuscript.pageCount).toBeGreaterThan(book.pageCount);
  expect(book.warnings).toEqual([]);
  expect(manuscript.warnings).toEqual([]);
});

it("produces reflowable EPUB with complete text, valid navigation, and footnote return links, and retains native RTF notes", () => {
  const doc = parseMarkdown(source),
    files = unzipSync(novelEpub(doc));
  const parse = (name: string) =>
    new DOMParser().parseFromString(strFromU8(files[name]), "application/xml");
  const body = parse("EPUB/book.xhtml"),
    nav = parse("EPUB/nav.xhtml"),
    opf = parse("EPUB/package.opf");
  for (const xml of [body, nav, opf])
    expect(xml.querySelector("parsererror")).toBeNull();
  expect(body.documentElement.namespaceURI).toBe(
    "http://www.w3.org/1999/xhtml",
  );
  expect(body.querySelector("strong")?.textContent).toBe("bold words");
  expect(body.querySelector("em")?.textContent).toBe("quiet thoughts");
  expect(body.querySelector('[role="doc-footnote"]')?.textContent).toContain(
    "café, <brackets> & detail.",
  );
  expect(body.querySelectorAll("h2")).toHaveLength(2);
  for (const link of [
    ...body.querySelectorAll('a[href^="#"]'),
    ...nav.querySelectorAll("a"),
  ])
    expect(
      body.getElementById(link.getAttribute("href")!.split("#")[1]),
    ).not.toBeNull();
  expect(opf.querySelector("spine itemref")?.getAttribute("idref")).toBe(
    "book",
  );
  expect(opf.querySelectorAll("spine itemref")).toHaveLength(1);
  expect(
    opf.querySelector('meta[property="rendition:layout"]')?.textContent,
  ).toBe("reflowable");
  const rtf = novelRtf(doc);
  expect(rtf).toContain("\\footnote");
  expect(rtf).toContain("The final words.");
  expect(rtf).not.toContain("^[");
});
