import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { PDFDocument, PDFName, PDFDict } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { unzipSync, strFromU8 } from "fflate";
import {
  novelDocx,
  novelEpub,
  novelPdf,
  novelRtf,
} from "../src/core/novelExport";
import { exportPdf, exportFdx } from "../src/core/export";
import { parseMarkdown } from "../src/core/markdown";
import { parseFountain } from "../src/core/fountain";
import { fontKeys, type FontBytes } from "../src/core/writingFonts";
import { openTypeBytes } from "../src/core/fontEmbedding";
import { defaults, readPreferences } from "../src/components/Settings";
const fonts = Object.fromEntries(
  fontKeys.map((key) => [
    key,
    new Uint8Array(readFileSync(`src/fonts/DejaVuSerif-${key}.woff`)),
  ]),
) as FontBytes;
it("keeps existing writing defaults and remembers independent validated font choices", () => {
  localStorage.clear();
  expect(readPreferences().screenplayFont).toBe("courier");
  expect(readPreferences().bookFont).toBe("georgia");
  localStorage.setItem(
    "fp2.preferences",
    JSON.stringify({ screenplayFont: "mono", bookFont: "serif" }),
  );
  expect(readPreferences()).toMatchObject({
    screenplayFont: "mono",
    bookFont: "serif",
  });
  localStorage.setItem(
    "fp2.preferences",
    JSON.stringify({ screenplayFont: "constructor", bookFont: null }),
  );
  expect(readPreferences().bookFont).toBe(defaults.bookFont);
  expect(readPreferences().screenplayFont).toBe(defaults.screenplayFont);
  localStorage.clear();
});
it("preserves all font styles in Word and EPUB and writes the selected family to RTF and FDX", () => {
  const doc = parseMarkdown("A **bold** word and *italic* word.");
  const options = { fontName: "DejaVu Serif", fontBytes: fonts };
  const plain = unzipSync(novelDocx(doc));
  expect(plain["word/fontTable.xml"]).toBeUndefined();
  expect(strFromU8(plain["word/styles.xml"])).toContain('w:ascii="Georgia"');
  const word = unzipSync(novelDocx(doc, options));
  expect(strFromU8(word["word/styles.xml"])).toContain(
    'w:ascii="DejaVu Serif"',
  );
  const table = new DOMParser().parseFromString(
    strFromU8(word["word/fontTable.xml"]),
    "application/xml",
  );
  const key = table
    .getElementsByTagName("w:embedRegular")[0]
    .getAttribute("w:fontKey")!
    .replace(/[{}-]/g, "");
  const mask = Uint8Array.from(
    key
      .match(/../g)!
      .reverse()
      .map((v) => parseInt(v, 16)),
  );
  const restored = word["word/fonts/font0.odttf"].slice();
  for (let i = 0; i < 32; i++) restored[i] ^= mask[i % 16];
  expect(restored).toEqual(openTypeBytes(fonts.regular));
  expect((fontkit.create(restored) as any).familyName).toBe("DejaVu Serif");
  const epub = unzipSync(novelEpub(doc, options));
  expect(epub["EPUB/fonts/boldItalic.woff"]).toEqual(fonts.boldItalic);
  expect(strFromU8(epub["EPUB/style.css"])).toContain(
    'font-family:"DejaVu Serif"',
  );
  expect(novelRtf(doc, options)).toContain("\\f0 DejaVu Serif;");
  const screenplay = parseFountain("INT. ROOM - DAY\n\nHello.");
  expect(exportFdx(screenplay, "DejaVu Sans Mono")).toContain(
    'Font="DejaVu Sans Mono"',
  );
  expect(exportFdx(screenplay)).not.toContain('Font="DejaVu');
});
it("embeds the selected font in book and screenplay PDFs, leaving default book PDF unchanged", async () => {
  const doc = parseMarkdown("A **bold** claim.^[A supporting reference.]");
  const output = await novelPdf(doc, {
    fontName: "DejaVu Serif",
    fontBytes: fonts,
  });
  const pdf = await PDFDocument.load(output.bytes);
  const resources = pdf
    .getPage(0)
    .node.Resources()!
    .lookup(PDFName.of("Font"), PDFDict);
  const names = resources
    .values()
    .map((ref) =>
      pdf.context.lookup(ref, PDFDict).get(PDFName.of("BaseFont"))?.toString(),
    )
    .join(" ");
  expect(names).toContain("DejaVuSerif");
  expect(output.warnings).toEqual([]);
  const script = await exportPdf(
    parseFountain("INT. ROOM - DAY\n\nA **bold** word."),
    { fontBytes: fonts, strictFont: true },
  );
  expect(script.warnings).toEqual([]);
  const standard = await novelPdf(doc);
  const original = await PDFDocument.load(standard.bytes);
  const originalFonts = original
    .getPage(0)
    .node.Resources()!
    .lookup(PDFName.of("Font"), PDFDict);
  expect(
    originalFonts
      .values()
      .map((ref) =>
        original.context
          .lookup(ref, PDFDict)
          .get(PDFName.of("BaseFont"))
          ?.toString(),
      )
      .join(" "),
  ).toContain("Times-Roman");
}, 15000);
