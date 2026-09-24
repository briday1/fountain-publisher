import type { PDFFont, PDFPage } from "pdf-lib";
import { newId } from "./model";
import type {
  Beat,
  Screenplay,
  ScriptBlock,
  TextMark,
  TextSpan,
} from "./model";
import { blockSpans } from "./fountain";
import { hasTitlePage, titlePageExtra } from "./titlePage";
import {
  resolveBeatRange,
  sceneBeatRange,
  screenplayLines,
} from "./beatRanges";
import { analyzeScreenplay, characterName, publishedKinds } from "./insights";
import regularFontUrl from "@fontsource/courier-prime/files/courier-prime-latin-400-normal.woff?url";
import boldFontUrl from "@fontsource/courier-prime/files/courier-prime-latin-700-normal.woff?url";
import italicFontUrl from "@fontsource/courier-prime/files/courier-prime-latin-400-italic.woff?url";
import boldItalicFontUrl from "@fontsource/courier-prime/files/courier-prime-latin-700-italic.woff?url";

import { characterHighlights } from "./characterHighlights";

export interface PdfOptions {
  highlightCharacters?: string[];
  includeTitlePage?: boolean;
  pageSize?: "letter" | "a4";
  /** Reformat the already-rendered conventional PDF page-by-page for phone reading. */
  mobileLayout?: boolean;
  sceneNumbers?: "margin" | "inline" | "off";
  boldSceneHeadings?: boolean;
  sceneNumberFormat?: "sequential" | "act";
  /** Supply font bytes for non-browser rendering or custom font deployments. */
  fontBytes?: {
    regular: Uint8Array;
    bold: Uint8Array;
    italic: Uint8Array;
    boldItalic: Uint8Array;
  };
}
export interface PdfExport {
  bytes: Uint8Array;
  pageCount: number;
  scriptPageCount: number;
  /** Completed physical pages plus occupied eighths of the final script page. */
  pageEquivalent: number;
  warnings: string[];
}
type Fonts = Record<"regular" | "bold" | "italic" | "boldItalic", PDFFont>;
interface Glyph {
  text: string;
  marks: TextMark[];
  width: number;
  font: PDFFont;
}
interface Line {
  highlight?: [number, number, number];
  glyphs: Glyph[];
  width: number;
  x: number;
  boxWidth: number;
  align?: "left" | "right" | "center";
  sourceId?: string;
  sourceKind?: string;
  sourceRole?:
    "content" | "pageNumber" | "sceneNumber" | "title" | "more" | "continued";
  sourceColumn?: number;
  breakAfter?: "space" | "none" | "hard";
}

function fontKey(marks: TextMark[]): keyof Fonts {
  return marks.includes("bold")
    ? marks.includes("italic")
      ? "boldItalic"
      : "bold"
    : marks.includes("italic")
      ? "italic"
      : "regular";
}

function wrap(
  spans: TextSpan[],
  fonts: Fonts,
  x: number,
  width: number,
  warnings: Set<string>,
  align: Line["align"] = "left",
): Line[] {
  const all: Glyph[] = [];
  for (const span of spans) {
    const marks = span.marks ?? [];
    const font = fonts[fontKey(marks)];
    for (const text of span.text.replace(/\t/g, "    ")) {
      const code = text.codePointAt(0)!;
      if (text !== "\n" && !font.getCharacterSet().includes(code))
        warnings.add(
          `The PDF font does not contain ${text} (U+${code.toString(16).toUpperCase()}). Fountain and Final Draft exports preserve it.`,
        );
      let glyphWidth = 0;
      try {
        glyphWidth = text === "\n" ? 0 : font.widthOfTextAtSize(text, 12);
      } catch {
        glyphWidth = 7.2;
      }
      all.push({ text, marks, width: glyphWidth, font });
    }
  }
  const lines: Line[] = [];
  let current: Glyph[] = [];
  let currentWidth = 0;
  const flush = (breakAfter?: Line["breakAfter"]) => {
    lines.push({
      glyphs: current,
      width: currentWidth,
      x,
      boxWidth: width,
      align,
      breakAfter,
    });
    current = [];
    currentWidth = 0;
  };
  for (const glyph of all) {
    if (glyph.text === "\n") {
      flush("hard");
      continue;
    }
    if (current.length && currentWidth + glyph.width > width + 0.05) {
      let space = current.length - 1;
      while (space >= 0 && !/\s/.test(current[space].text)) space--;
      if (space > 0) {
        const after = current.slice(space + 1);
        current = current.slice(0, space);
        currentWidth = current.reduce((sum, item) => sum + item.width, 0);
        flush("space");
        current = after;
        currentWidth = current.reduce((sum, item) => sum + item.width, 0);
      } else flush("none");
      if (!current.length && /\s/.test(glyph.text)) continue;
    }
    current.push(glyph);
    currentWidth += glyph.width;
  }
  flush();
  return lines;
}

const dialogueKinds = new Set(["dialogue", "parenthetical", "lyrics"]);
function dialogueGroup(
  blocks: ScriptBlock[],
  start: number,
): { group: ScriptBlock[]; end: number } {
  const group = [blocks[start]];
  let end = start + 1;
  while (end < blocks.length && dialogueKinds.has(blocks[end].kind))
    group.push(blocks[end++]);
  return { group, end };
}

function sceneNumbers(
  document: Screenplay,
  format: PdfOptions["sceneNumberFormat"],
): Map<string, string> {
  const numbers = new Map<string, string>();
  let sequence = 0;
  let act = 0;
  let inAct = 0;
  for (const block of document.blocks) {
    if (block.kind === "section" && (block.level ?? 1) === 1) {
      act++;
      inAct = 0;
    }
    if (block.kind === "scene") {
      sequence++;
      inAct++;
      numbers.set(
        block.id,
        block.sceneNumber ||
          (format === "act" ? `A${Math.max(1, act)}S${inAct}` : `${sequence}`),
      );
    }
  }
  return numbers;
}

type PdfPageRecord = {
  highlight?: [number, number, number];
  spans: TextSpan[];
  sourceId?: string;
  sourceKind?: string;
  sourceRole:
    "content" | "pageNumber" | "sceneNumber" | "title" | "more" | "continued";
  sourceColumn?: number;
  align?: Line["align"];
  breakAfter?: Line["breakAfter"];
  baselineY?: number;
};

function pageRecordText(records: PdfPageRecord[]): string {
  let text = "";
  for (let index = 0; index < records.length; index++) {
    const record = records[index];
    if (index) {
      const previous = records[index - 1];
      const sameSource =
        previous.sourceId !== undefined &&
        previous.sourceId === record.sourceId &&
        previous.sourceRole === record.sourceRole &&
        previous.sourceColumn === record.sourceColumn;
      text += sameSource
        ? previous.breakAfter === "none"
          ? ""
          : previous.breakAfter === "hard"
            ? "\n"
            : " "
        : "\n";
    }
    text += record.spans.map((span) => span.text).join("");
  }
  return text;
}

function pageContentSignature(records: PdfPageRecord[]): string {
  return (pageRecordText(records).match(/\S+/g) ?? []).join("\u0000");
}

function mergeCanonicalRecords(records: PdfPageRecord[]): PdfPageRecord[] {
  const merged: PdfPageRecord[] = [];
  for (const record of records) {
    const previous = merged.at(-1);
    const sameSource =
      previous &&
      record.sourceId !== undefined &&
      previous.sourceId === record.sourceId &&
      previous.sourceKind === record.sourceKind &&
      previous.sourceRole === record.sourceRole &&
      previous.sourceColumn === record.sourceColumn &&
      previous.align === record.align &&
      JSON.stringify(previous.highlight) === JSON.stringify(record.highlight);
    if (!sameSource) {
      merged.push({
        ...record,
        spans: record.spans.map((span) => ({
          text: span.text,
          ...(span.marks?.length ? { marks: [...span.marks] } : {}),
        })),
      });
      continue;
    }
    const separator =
      previous.breakAfter === "none"
        ? ""
        : previous.breakAfter === "hard"
          ? "\n"
          : " ";
    if (separator) previous.spans.push({ text: separator });
    previous.spans.push(
      ...record.spans.map((span) => ({
        text: span.text,
        ...(span.marks?.length ? { marks: [...span.marks] } : {}),
      })),
    );
    previous.breakAfter = record.breakAfter;
  }
  return merged;
}

/**
 * Margin scene numbers and their headings share a canonical baseline, but are
 * separate drawing records because they occupy different horizontal boxes on
 * the full-size page. Mobile pages put the number inline with the heading, so
 * join that pair before narrow-page wrapping instead of laying each record on
 * its own row.
 */
function inlineMobileSceneNumbers(records: PdfPageRecord[]): PdfPageRecord[] {
  const result: PdfPageRecord[] = [];
  for (let index = 0; index < records.length; index++) {
    const record = records[index];
    const heading = records[index + 1];
    if (
      record.sourceRole === "sceneNumber" &&
      record.sourceId !== undefined &&
      heading?.sourceRole === "content" &&
      heading.sourceKind === "scene" &&
      heading.sourceId === record.sourceId
    ) {
      result.push({
        ...heading,
        spans: [
          ...record.spans.map((span) => ({
            text: span.text,
            ...(span.marks?.length ? { marks: [...span.marks] } : {}),
          })),
          { text: "  " },
          ...heading.spans.map((span) => ({
            text: span.text,
            ...(span.marks?.length ? { marks: [...span.marks] } : {}),
          })),
        ],
      });
      index++;
      continue;
    }
    result.push(record);
  }
  return result;
}

async function mobilePdfFromCanonical(
  bytes: Uint8Array,
  fontBytes?: PdfOptions["fontBytes"],
): Promise<{ bytes: Uint8Array; warnings: string[] }> {
  const [
    { PDFDocument, PDFHexString, PDFName, StandardFonts, rgb },
    { default: fontkit },
  ] = await Promise.all([import("pdf-lib"), import("@pdf-lib/fontkit")]);
  const source = await PDFDocument.load(bytes);
  const output = await PDFDocument.create();
  const warnings = new Set<string>();

  let fonts: Fonts;
  try {
    const bytes =
      fontBytes ??
      (Object.fromEntries(
        await Promise.all(
          Object.entries({
            regular: regularFontUrl,
            bold: boldFontUrl,
            italic: italicFontUrl,
            boldItalic: boldItalicFontUrl,
          }).map(async ([name, url]) => {
            const response = await fetch(url);
            if (!response.ok)
              throw new Error(`Font request failed (${response.status})`);
            return [name, new Uint8Array(await response.arrayBuffer())];
          }),
        ),
      ) as NonNullable<PdfOptions["fontBytes"]>);
    output.registerFontkit(fontkit);
    fonts = Object.fromEntries(
      await Promise.all(
        Object.entries(bytes).map(async ([name, data]) => [
          name,
          await output.embedFont(data, { subset: true }),
        ]),
      ),
    ) as Fonts;
  } catch {
    fonts = {
      regular: await output.embedFont(StandardFonts.Courier),
      bold: await output.embedFont(StandardFonts.CourierBold),
      italic: await output.embedFont(StandardFonts.CourierOblique),
      boldItalic: await output.embedFont(StandardFonts.CourierBoldOblique),
    };
    warnings.add(
      "Courier Prime could not be loaded. This mobile PDF uses standard Courier.",
    );
  }

  const mobileWidth = 336;
  const side = 20;
  const bodyWidth = mobileWidth - side * 2;
  const topBorder = 24;
  const bottomBorder = 24;
  const leading = 14;
  const fontSize = 12;

  // The canonical screenplay body is 61 Courier characters wide. Preserve
  // each standard indent and measure as a proportion of that usable width so
  // the narrow page keeps the same relative screenplay geometry.
  const canonicalColumns = 61;
  const scaledColumns = (columns: number) =>
    (bodyWidth * columns) / canonicalColumns;

  const layoutFor = (record: PdfPageRecord) => {
    let x = side;
    let width = bodyWidth;
    let align: Line["align"] = record.align ?? "left";
    if (record.sourceRole === "pageNumber") align = "right";
    else if (record.sourceKind === "character") {
      x += scaledColumns(19);
      width = scaledColumns(42);
    } else if (
      record.sourceKind === "dialogue" ||
      record.sourceKind === "lyrics"
    ) {
      x += scaledColumns(9);
      width = scaledColumns(36);
    } else if (record.sourceKind === "parenthetical") {
      x += scaledColumns(13);
      width = scaledColumns(48);
    } else if (record.sourceKind === "transition") align = "right";
    else if (record.sourceKind === "centered") align = "center";
    return { x, width, align };
  };

  const gapBefore = (
    record: PdfPageRecord,
    previous?: PdfPageRecord,
  ): number => {
    if (!previous) return 0;
    if (record.sourceRole === "pageNumber") return 0;
    if (previous.sourceRole === "pageNumber") return 10;
    if (
      record.sourceRole === "sceneNumber" ||
      previous.sourceRole === "sceneNumber"
    )
      return 0;
    if (
      record.sourceKind === "dialogue" ||
      record.sourceKind === "parenthetical" ||
      record.sourceRole === "more" ||
      record.sourceRole === "continued"
    )
      return 0;
    if (
      previous.sourceKind === "character" &&
      (record.sourceKind === "dialogue" ||
        record.sourceKind === "parenthetical")
    )
      return 0;
    return 10;
  };

  for (let index = 0; index < source.getPageCount(); index++) {
    const sourcePage = source.getPage(index);
    const raw = sourcePage.node.get(PDFName.of("FPPageLayout")) as
      { decodeText?: () => string } | undefined;
    if (!raw?.decodeText)
      throw new Error(
        `Mobile PDF conversion could not read canonical page ${index + 1}.`,
      );
    const canonicalRecords = JSON.parse(raw.decodeText()) as PdfPageRecord[];
    const groups = inlineMobileSceneNumbers(
      mergeCanonicalRecords(canonicalRecords),
    );
    const planned = groups.map((record, groupIndex) => {
      const box = layoutFor(record);
      const lines = wrap(
        record.spans,
        fonts,
        box.x,
        box.width,
        warnings,
        box.align,
      );
      return {
        record,
        lines,
        gap: gapBefore(record, groups[groupIndex - 1]),
      };
    });
    const totalRows = planned.reduce((sum, item) => sum + item.lines.length, 0);
    const totalGaps = planned.reduce((sum, item) => sum + item.gap, 0);
    // Size after layout, never before it. The first line's 12pt line box ends
    // exactly topBorder below the page edge; the final baseline lands exactly
    // bottomBorder above the bottom edge. Different canonical pages therefore
    // naturally produce different physical mobile-page heights.
    const contentHeight =
      totalRows > 0
        ? fontSize + Math.max(0, totalRows - 1) * leading + totalGaps
        : fontSize;
    const mobileHeight = topBorder + contentHeight + bottomBorder;
    const page = output.addPage([mobileWidth, mobileHeight]);
    const mobileRecords: PdfPageRecord[] = [];
    let y = mobileHeight - topBorder - fontSize;

    const drawMobileLine = (
      line: Line,
      record: PdfPageRecord,
      breakAfter?: Line["breakAfter"],
    ) => {
      let x =
        line.x +
        (line.align === "right"
          ? line.boxWidth - line.width
          : line.align === "center"
            ? (line.boxWidth - line.width) / 2
            : 0);
      if (record.highlight && line.width > 0)
        page.drawRectangle({
          x: x - 2,
          y: y - 2.5,
          width: line.width + 4,
          height: 13,
          color: rgb(...record.highlight),
          borderWidth: 0,
        });
      const renderedSpans: TextSpan[] = [];
      let start = 0;
      while (start < line.glyphs.length) {
        const first = line.glyphs[start];
        let end = start + 1;
        while (
          end < line.glyphs.length &&
          line.glyphs[end].font === first.font &&
          line.glyphs[end].marks.join() === first.marks.join()
        )
          end++;
        const glyphs = line.glyphs.slice(start, end);
        let text = glyphs.map((glyph) => glyph.text).join("");
        try {
          first.font.encodeText(text);
        } catch {
          text = text.replace(/[^\x20-\x7e]/g, "?");
        }
        const width = glyphs.reduce((sum, glyph) => sum + glyph.width, 0);
        if (text) {
          page.drawText(text, {
            x,
            y,
            size: fontSize,
            font: first.font,
            color: rgb(0.07, 0.07, 0.07),
          });
          renderedSpans.push({
            text,
            ...(first.marks.length ? { marks: [...first.marks] } : {}),
          });
        }
        if (first.marks.includes("underline") && width)
          page.drawLine({
            start: { x, y: y - 1.5 },
            end: { x: x + width, y: y - 1.5 },
            thickness: 0.5,
            color: rgb(0.07, 0.07, 0.07),
          });
        x += width;
        start = end;
      }
      mobileRecords.push({
        spans: renderedSpans,
        highlight: record.highlight,
        sourceId: record.sourceId,
        sourceKind: record.sourceKind,
        sourceRole: record.sourceRole,
        sourceColumn: record.sourceColumn,
        align: line.align,
        breakAfter,
        baselineY: y,
      });
    };

    for (const item of planned) {
      y -= item.gap;
      item.lines.forEach((line, lineIndex) => {
        drawMobileLine(line, item.record, line.breakAfter);
        if (
          lineIndex === item.lines.length - 1 &&
          item.record.breakAfter !== undefined
        )
          mobileRecords[mobileRecords.length - 1].breakAfter =
            item.record.breakAfter;
        y -= leading;
      });
    }

    const canonicalSignature = pageContentSignature(canonicalRecords);
    const mobileSignature = pageContentSignature(mobileRecords);
    if (canonicalSignature !== mobileSignature)
      throw new Error(
        `Mobile PDF conversion changed the content of canonical page ${index + 1}.`,
      );
    page.node.set(
      PDFName.of("FPPageLayout"),
      PDFHexString.fromText(JSON.stringify(mobileRecords)),
    );
    page.node.set(
      PDFName.of("FPPageText"),
      PDFHexString.fromText(mobileSignature),
    );
  }

  return { bytes: await output.save(), warnings: [...warnings] };
}

export async function pdfPageContentSignatures(
  bytes: Uint8Array,
): Promise<string[]> {
  const { PDFDocument, PDFName } = await import("pdf-lib");
  const pdf = await PDFDocument.load(bytes);
  return pdf.getPages().map((page, index) => {
    const raw = page.node.get(PDFName.of("FPPageText")) as
      { decodeText?: () => string } | undefined;
    if (!raw?.decodeText)
      throw new Error(`PDF page ${index + 1} has no content signature.`);
    return raw.decodeText();
  });
}

/** A self-contained screenplay compositor. Its returned count is read from the PDF itself. */
export async function exportPdf(
  document: Screenplay,
  options: PdfOptions = {},
): Promise<PdfExport> {
  if (options.mobileLayout) {
    const canonical = await exportPdf(document, {
      ...options,
      mobileLayout: false,
    });
    const mobile = await mobilePdfFromCanonical(
      canonical.bytes,
      options.fontBytes,
    );
    return {
      bytes: mobile.bytes,
      pageCount: canonical.pageCount,
      scriptPageCount: canonical.scriptPageCount,
      pageEquivalent: canonical.pageEquivalent,
      warnings: [...new Set([...canonical.warnings, ...mobile.warnings])],
    };
  }
  const [
    { PDFDocument, PDFHexString, PDFName, StandardFonts, rgb },
    { default: fontkit },
  ] = await Promise.all([import("pdf-lib"), import("@pdf-lib/fontkit")]);
  const highlights = new Map(
    characterHighlights(options.highlightCharacters ?? []).map(
      ({ name, rgb }) => [name, rgb],
    ),
  );
  const pdf = await PDFDocument.create();
  pdf.setTitle(document.titlePage.title || "Untitled screenplay");
  pdf.setAuthor(document.titlePage.author);
  pdf.setCreator("Fountain Publisher");
  pdf.setProducer("Fountain Publisher");
  const warnings = new Set<string>();
  let fonts: Fonts;
  try {
    const bytes =
      options.fontBytes ??
      (Object.fromEntries(
        await Promise.all(
          Object.entries({
            regular: regularFontUrl,
            bold: boldFontUrl,
            italic: italicFontUrl,
            boldItalic: boldItalicFontUrl,
          }).map(async ([name, url]) => {
            const response = await fetch(url);
            if (!response.ok)
              throw new Error(`Font request failed (${response.status})`);
            return [name, new Uint8Array(await response.arrayBuffer())];
          }),
        ),
      ) as NonNullable<PdfOptions["fontBytes"]>);
    pdf.registerFontkit(fontkit);
    fonts = Object.fromEntries(
      await Promise.all(
        Object.entries(bytes).map(async ([name, data]) => [
          name,
          await pdf.embedFont(data, { subset: true }),
        ]),
      ),
    ) as Fonts;
  } catch {
    fonts = {
      regular: await pdf.embedFont(StandardFonts.Courier),
      bold: await pdf.embedFont(StandardFonts.CourierBold),
      italic: await pdf.embedFont(StandardFonts.CourierOblique),
      boldItalic: await pdf.embedFont(StandardFonts.CourierBoldOblique),
    };
    warnings.add(
      "Courier Prime could not be loaded. This PDF uses standard Courier.",
    );
  }
  const [pageWidth, pageHeight] =
    options.pageSize === "a4" ? [595.28, 841.89] : [612, 792];
  const left = 108;
  const fullWidth = 61 * 7.2;
  const right = pageWidth - left - fullWidth;
  const leading = 12;
  const top = pageHeight - 72 - leading;
  const bottom = top - 54 * leading;
  const pageRecords = new Map<PDFPage, PdfPageRecord[]>();
  let page: PDFPage;
  let y = top;
  let scriptPageCount = 0;
  let titlePageCount = 0;
  let lastPageUsedRows = 0;
  const drawLine = (line: Line, atY: number, target: PDFPage = page) => {
    // Measure the actual ink-bearing body rows. Cover text, running page numbers,
    // and the compositor's trailing paragraph gaps do not advance this metric.
    if (
      scriptPageCount > 0 &&
      target === page &&
      atY <= top &&
      line.glyphs.some((glyph) => /\S/.test(glyph.text))
    )
      lastPageUsedRows = Math.max(lastPageUsedRows, (top - atY) / leading + 1);
    let x =
      line.x +
      (line.align === "right"
        ? line.boxWidth - line.width
        : line.align === "center"
          ? (line.boxWidth - line.width) / 2
          : 0);
    if (line.highlight && line.width > 0)
      target.drawRectangle({
        x: x - 2,
        y: atY - 2.5,
        width: line.width + 4,
        height: 13,
        color: rgb(...line.highlight),
        borderWidth: 0,
      });
    const renderedSpans: TextSpan[] = [];
    let start = 0;
    while (start < line.glyphs.length) {
      const first = line.glyphs[start];
      let end = start + 1;
      while (
        end < line.glyphs.length &&
        line.glyphs[end].font === first.font &&
        line.glyphs[end].marks.join() === first.marks.join()
      )
        end++;
      const glyphs = line.glyphs.slice(start, end);
      let text = glyphs.map((glyph) => glyph.text).join("");
      try {
        first.font.encodeText(text);
      } catch {
        text = text.replace(/[^\x20-\x7e]/g, "?");
      }
      const width = glyphs.reduce((sum, glyph) => sum + glyph.width, 0);
      if (text) {
        target.drawText(text, {
          x,
          y: atY,
          size: 12,
          font: first.font,
          color: rgb(0.07, 0.07, 0.07),
        });
        renderedSpans.push({
          text,
          ...(first.marks.length ? { marks: [...first.marks] } : {}),
        });
      }
      if (first.marks.includes("underline") && width)
        target.drawLine({
          start: { x, y: atY - 1.5 },
          end: { x: x + width, y: atY - 1.5 },
          thickness: 0.5,
          color: rgb(0.07, 0.07, 0.07),
        });
      x += width;
      start = end;
    }
    if (renderedSpans.length) {
      const records = pageRecords.get(target) ?? [];
      records.push({
        spans: renderedSpans,
        highlight: line.highlight,
        sourceId: line.sourceId,
        sourceKind: line.sourceKind,
        sourceRole: line.sourceRole ?? "content",
        sourceColumn: line.sourceColumn,
        align: line.align,
        breakAfter: line.breakAfter,
      });
      pageRecords.set(target, records);
    }
  };
  const textLines = (
    text: string,
    x: number,
    width: number,
    align?: Line["align"],
    marks?: TextMark[],
  ) => wrap([{ text, marks }], fonts, x, width, warnings, align);
  const newPage = () => {
    page = pdf.addPage([pageWidth, pageHeight]);
    y = top;
    lastPageUsedRows = 0;
    scriptPageCount++;
    const runningNumber = textLines(
      `${scriptPageCount}.`,
      left,
      fullWidth,
      "right",
    )[0];
    runningNumber.sourceRole = "pageNumber";
    drawLine(runningNumber, pageHeight - 42);
  };
  if (options.includeTitlePage !== false && hasTitlePage(document.titlePage)) {
    let titlePage = pdf.addPage([pageWidth, pageHeight]);
    titlePageCount = 1;
    const titleWidth = pageWidth - 2 * left;
    const titleLeading = leading * 2;
    type CoverRow = { line: Line; gap: number };
    const rows = (
      fields: { text: string; align: Line["align"]; gap: number }[],
    ) => {
      const result: CoverRow[] = [];
      for (const field of fields) {
        if (!field.text) continue;
        textLines(field.text, left, titleWidth, field.align).forEach(
          (line, index) => {
            line.sourceRole = "title";
            result.push({
              line,
              gap: result.length ? (index ? titleLeading : field.gap) : 0,
            });
          },
        );
      }
      return result;
    };
    const centerRows = rows([
      { text: document.titlePage.title, align: "center", gap: titleLeading },
      {
        text: document.titlePage.credit,
        align: "center",
        gap: titleLeading + leading,
      },
      { text: document.titlePage.author, align: "center", gap: titleLeading },
      { text: document.titlePage.source, align: "center", gap: titleLeading },
    ]);
    const footerRows = rows([
      { text: document.titlePage.draftDate, align: "left", gap: titleLeading },
      {
        text: document.titlePage.contact,
        align: "left",
        gap: titleLeading + leading,
      },
      {
        text: titlePageExtra(document.titlePage, "copyright"),
        align: "center",
        gap: titleLeading + leading,
      },
    ]);
    // The cover keeps the same twelve-point type as the script. Each multiline
    // field is double spaced, with a little more room before credit and contact.
    const centerHeight = centerRows.reduce((sum, row) => sum + row.gap, 0);
    const footerY =
      bottom + 18 + footerRows.reduce((sum, row) => sum + row.gap, 0);
    let titleY = Math.min(
      top,
      Math.max(top - 220, footerY + centerHeight + titleLeading),
    );
    const nextTitlePage = () => {
      titlePage = pdf.addPage([pageWidth, pageHeight]);
      titlePageCount++;
      titleY = top;
    };
    const drawRows = (coverRows: CoverRow[]) => {
      for (const row of coverRows) {
        titleY -= row.gap;
        if (titleY < bottom) nextTitlePage();
        drawLine(row.line, titleY, titlePage);
      }
    };
    drawRows(centerRows);
    if (footerRows.length) {
      // Long title/contact fields remain complete, even when an extra cover
      // page is necessary; none can overlap or be clipped below the paper.
      if (centerRows.length && titleY < footerY + titleLeading) nextTitlePage();
      titleY = Math.min(top, footerY);
      drawRows(footerRows);
    }
  }
  newPage();
  const numbers = sceneNumbers(document, options.sceneNumberFormat);
  const numberStyle = options.sceneNumbers ?? "margin";
  const isActHeading = (block: ScriptBlock) =>
    block.kind === "section" &&
    (block.level ?? 1) === 1 &&
    /^Act\b/i.test(block.text);
  const blocks = document.blocks.filter(
    (block) => publishedKinds.has(block.kind) || isActHeading(block),
  );
  const styledLines = (block: ScriptBlock, dualColumn?: number): Line[] => {
    let x = left;
    let width = fullWidth;
    let align: Line["align"] = "left";
    if (dualColumn !== undefined) {
      const columnWidth = fullWidth / 2;
      x = left + dualColumn * columnWidth;
      width = columnWidth;
      if (block.kind === "character") {
        x += 19 * 3.6;
        width -= 19 * 3.6;
      } else if (block.kind === "dialogue" || block.kind === "lyrics") {
        x += 9 * 3.6;
        width = 36 * 3.6;
      } else if (block.kind === "parenthetical") {
        x += 13 * 3.6;
        width -= 13 * 3.6;
      }
    } else if (block.kind === "character") {
      x = left + 19 * 7.2;
      width = pageWidth - right - x;
    } else if (block.kind === "dialogue" || block.kind === "lyrics") {
      x = left + 9 * 7.2;
      width = 36 * 7.2;
    } else if (block.kind === "parenthetical") {
      x = left + 13 * 7.2;
      width = pageWidth - right - x;
    } else if (block.kind === "transition") align = "right";
    else if (block.kind === "centered") align = "center";
    let spans = blockSpans(block);
    if (isActHeading(block))
      spans = spans.map((span) => ({ ...span, text: span.text.toUpperCase() }));
    if (
      isActHeading(block) ||
      (block.kind === "scene" && options.boldSceneHeadings !== false)
    )
      spans = spans.map((span) => ({
        ...span,
        marks: [...new Set([...(span.marks ?? []), "bold" as const])],
      }));
    if (block.kind === "parenthetical")
      spans = [
        ...(!block.text.startsWith("(") ? [{ text: "(" }] : []),
        ...spans,
        ...(!block.text.endsWith(")") ? [{ text: ")" }] : []),
      ];
    if (block.kind === "lyrics")
      spans = spans.map((span) => ({
        ...span,
        marks: [...new Set([...(span.marks ?? []), "italic" as const])],
      }));
    if (block.kind === "scene" && numberStyle === "inline")
      spans = [
        {
          text: `${numbers.get(block.id)}  `,
          marks: options.boldSceneHeadings !== false ? ["bold"] : undefined,
        },
        ...spans,
      ];
    const lines = wrap(spans, fonts, x, width, warnings, align);
    for (const line of lines) {
      line.sourceId = block.id;
      line.sourceKind = block.kind;
      line.sourceRole = "content";
      line.sourceColumn = dualColumn;
    }
    const highlight =
      block.kind === "character"
        ? highlights.get(characterName(block.text))
        : undefined;
    if (highlight) for (const line of lines) line.highlight = highlight;
    return lines;
  };
  const drawDialogue = (groups: ScriptBlock[][]) => {
    const columns = groups.map((group, column) =>
      group.flatMap((block) =>
        styledLines(block, groups.length > 1 ? column : undefined),
      ),
    );
    const maxRows = Math.max(...columns.map((column) => column.length));
    let row = 0;
    if (y < top) y -= leading;
    const initialMinimum = Math.min(
      maxRows,
      Math.max(
        ...groups.map(
          (group) =>
            styledLines(group[0], groups.length > 1 ? 0 : undefined).length +
            (group[1]?.kind === "parenthetical"
              ? styledLines(group[1], groups.length > 1 ? 0 : undefined).length
              : 0) +
            1,
        ),
      ),
    );
    if (
      Math.floor((y - bottom) / leading) + 1 <
      initialMinimum + (maxRows > initialMinimum ? 1 : 0)
    )
      newPage();
    while (row < maxRows) {
      const available = Math.floor((y - bottom) / leading) + 1;
      const remaining = maxRows - row;
      const fits = remaining <= available;
      const count = fits ? remaining : Math.max(1, available - 1);
      for (let offset = 0; offset < count && row < maxRows; offset++, row++) {
        for (const column of columns) if (column[row]) drawLine(column[row], y);
        y -= leading;
      }
      if (row < maxRows) {
        groups.forEach((group, column) => {
          if (row >= columns[column].length) return;
          const more = styledLines(
            { ...group[0], text: "(MORE)", spans: undefined },
            groups.length > 1 ? column : undefined,
          )[0];
          more.sourceRole = "more";
          drawLine(more, Math.max(bottom, y));
        });
        newPage();
        let cueHeight = 0;
        groups.forEach((group, column) => {
          if (row >= columns[column].length) return;
          const text = /\(CONT['’]D\)/i.test(group[0].text)
            ? group[0].text
            : `${group[0].text} (CONT'D)`;
          const cues = styledLines(
            { ...group[0], text, spans: undefined },
            groups.length > 1 ? column : undefined,
          );
          cues.forEach((line, index) => {
            line.sourceRole = "continued";
            drawLine(line, y - index * leading);
          });
          cueHeight = Math.max(cueHeight, cues.length);
        });
        y -= cueHeight * leading;
      }
    }
  };
  for (let i = 0; i < blocks.length;) {
    const block = blocks[i];
    if (block.kind === "pageBreak") {
      if (y < top) newPage();
      i++;
      continue;
    }
    if (block.kind === "character") {
      const first = dialogueGroup(blocks, i);
      if (blocks[first.end]?.kind === "character" && blocks[first.end].dual) {
        const second = dialogueGroup(blocks, first.end);
        drawDialogue([first.group, second.group]);
        i = second.end;
      } else {
        drawDialogue([first.group]);
        i = first.end;
      }
      continue;
    }
    const lines = styledLines(block);
    const gap = ["dialogue", "parenthetical"].includes(block.kind)
      ? 0
      : leading;
    if (y < top) y -= gap;
    const reserve =
      block.kind === "scene" || isActHeading(block)
        ? lines.length + 2
        : Math.min(2, lines.length);
    if (y - (reserve - 1) * leading < bottom) newPage();
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      if (y < bottom) newPage();
      if (
        block.kind === "scene" &&
        lineIndex === 0 &&
        numberStyle === "margin"
      ) {
        const number = numbers.get(block.id)!;
        const sceneNumber = textLines(number, 54, 48)[0];
        sceneNumber.sourceId = block.id;
        sceneNumber.sourceKind = "scene";
        sceneNumber.sourceRole = "sceneNumber";
        drawLine(sceneNumber, y);
      }
      drawLine(lines[lineIndex], y);
      y -= leading;
    }
    i++;
  }
  for (const renderedPage of pdf.getPages()) {
    const records = pageRecords.get(renderedPage) ?? [];
    renderedPage.node.set(
      PDFName.of("FPPageLayout"),
      PDFHexString.fromText(JSON.stringify(records)),
    );
    renderedPage.node.set(
      PDFName.of("FPPageText"),
      PDFHexString.fromText(pageContentSignature(records)),
    );
  }
  const bytes = await pdf.save();
  return {
    bytes,
    pageCount: pdf.getPageCount(),
    scriptPageCount: pdf.getPageCount() - titlePageCount,
    pageEquivalent:
      titlePageCount +
      Math.max(0, scriptPageCount - 1) +
      Math.min(1, Math.ceil((lastPageUsedRows / 55) * 8) / 8),
    warnings: [...warnings],
  };
}

const xml = (text: string): string =>
  text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[char]!,
  );
const fdxTypes: Record<string, string> = {
  scene: "Scene Heading",
  action: "Action",
  character: "Character",
  dialogue: "Dialogue",
  parenthetical: "Parenthetical",
  transition: "Transition",
  lyrics: "Lyrics",
  centered: "Action",
};
function fdxParagraph(block: ScriptBlock, pageBreak = false): string {
  const type = fdxTypes[block.kind] ?? "Action";
  let spans = blockSpans(block);
  if (block.kind === "parenthetical")
    spans = [
      ...(!block.text.startsWith("(") ? [{ text: "(" }] : []),
      ...spans,
      ...(!block.text.endsWith(")") ? [{ text: ")" }] : []),
    ];
  const text = spans
    .map(
      (span) =>
        `<Text${span.marks?.length ? ` Style="${span.marks.map((mark) => mark[0].toUpperCase() + mark.slice(1)).join("+")}"` : ""}>${xml(span.text)}</Text>`,
    )
    .join("");
  return `<Paragraph Type="${type}"${block.kind === "centered" ? ' Alignment="Center"' : ""}${block.sceneNumber ? ` Number="${xml(block.sceneNumber)}"` : ""}${pageBreak ? ' StartsNewPage="Yes"' : ""}>${text}</Paragraph>`;
}

export function exportFdx(document: Screenplay): string {
  const blocks = document.blocks.filter((block) =>
    publishedKinds.has(block.kind),
  );
  const paragraphs: string[] = [];
  let pageBreak = false;
  for (let i = 0; i < blocks.length;) {
    const block = blocks[i];
    if (block.kind === "pageBreak") {
      pageBreak = true;
      i++;
      continue;
    }
    if (block.kind === "character") {
      const first = dialogueGroup(blocks, i);
      if (blocks[first.end]?.kind === "character" && blocks[first.end].dual) {
        const second = dialogueGroup(blocks, first.end);
        paragraphs.push(
          `<Paragraph${pageBreak ? ' StartsNewPage="Yes"' : ""}><DualDialogue>${[...first.group, ...second.group].map((block) => fdxParagraph(block)).join("")}</DualDialogue></Paragraph>`,
        );
        pageBreak = false;
        i = second.end;
        continue;
      }
    }
    paragraphs.push(fdxParagraph(block, pageBreak));
    pageBreak = false;
    i++;
  }
  const title = [
    document.titlePage.title,
    document.titlePage.credit,
    document.titlePage.author,
    document.titlePage.source,
  ]
    .filter(Boolean)
    .map(
      (value, index) =>
        `<Paragraph Alignment="Center" SpaceBefore="${index === 0 ? "240" : "24"}"><Text>${xml(value)}</Text></Paragraph>`,
    )
    .join("");
  const contact = [document.titlePage.contact, document.titlePage.draftDate]
    .filter(Boolean)
    .map(
      (value) =>
        `<Paragraph Alignment="Left" SpaceBefore="24"><Text>${xml(value)}</Text></Paragraph>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n<FinalDraft DocumentType="Script" Template="No" Version="3"><Content>${paragraphs.join("\n")}</Content><TitlePage><Content>${title}${contact}</Content></TitlePage><PageLayout TopMargin="72" BottomMargin="72"><PageSize Width="8.50" Height="11.00"/></PageLayout></FinalDraft>\n`;
}

function beatExportAssignments(document: Screenplay) {
  const lines = screenplayLines(document);
  const scenes = analyzeScreenplay(document).scenes;
  const sceneForBlock = new Map<string, (typeof scenes)[number]>();
  let sceneIndex = -1;
  document.blocks.forEach((block, index) => {
    if (scenes[sceneIndex + 1]?.blockIndex === index) sceneIndex++;
    if (sceneIndex >= 0) sceneForBlock.set(block.id, scenes[sceneIndex]);
  });
  return (beat: Beat) => {
    const range =
      beat.range === undefined && beat.sceneId
        ? sceneBeatRange(document, beat.sceneId)
        : beat.range;
    const resolved = range
      ? resolveBeatRange(document, range, lines)
      : undefined;
    return resolved && range
      ? { ...resolved, scene: sceneForBlock.get(range.start.blockId) }
      : undefined;
  };
}

export function exportBeatSheetCsv(document: Screenplay): string {
  const assignmentFor = beatExportAssignments(document);
  const cell = (value: unknown) => {
    let text = String(value ?? "");
    // Spreadsheet applications otherwise interpret a beat title beginning '=' as a formula.
    if (/^[\s]*[=+@-]/.test(text) || /^[\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const rows: unknown[][] = [
    [
      "Beat",
      "Act",
      "Description",
      "Scene",
      "Scene heading",
      "Color",
      "Lines",
      "Words before first line",
    ],
  ];
  for (const beat of document.metadata.beats) {
    const assignment = assignmentFor(beat);
    rows.push([
      beat.title,
      beat.act,
      beat.description,
      assignment?.scene?.number ?? "",
      assignment?.sceneHeading ?? "",
      beat.color,
      assignment ? `${assignment.startLine}–${assignment.endLine}` : "",
      assignment?.words ?? "",
    ]);
  }
  return `\uFEFF${rows.map((row) => row.map(cell).join(",")).join("\r\n")}\r\n`;
}

export function beatSheetDocument(document: Screenplay): Screenplay {
  const assignmentFor = beatExportAssignments(document);
  const blocks: ScriptBlock[] = [];
  const add = (text: string, bold = false) =>
    blocks.push({
      id: newId(),
      kind: "action",
      text,
      ...(bold ? { spans: [{ text, marks: ["bold" as const] }] } : {}),
    });
  add(`${document.titlePage.title || "Untitled"} — Beat sheet`, true);
  if (document.metadata.premise) add(String(document.metadata.premise));
  document.metadata.beats.forEach((beat, index) => {
    add(`${index + 1}. ${beat.title || "Untitled beat"} · ${beat.act}`, true);
    if (beat.description) add(beat.description);
    const assignment = assignmentFor(beat);
    if (assignment) {
      add(
        `Lines ${assignment.startLine}–${assignment.endLine} · ${assignment.words.toLocaleString()} words before first assigned line`,
      );
      if (assignment.sceneHeading) add(`Scene: ${assignment.sceneHeading}`);
    } else if (beat.range !== undefined || beat.sceneId) {
      add("Assigned lines are no longer available.");
    }
  });
  return {
    ...document,
    titlePage: {
      ...document.titlePage,
      title: "",
      author: "",
      credit: "",
      source: "",
      contact: "",
      draftDate: "",
      extra: {},
    },
    blocks,
  };
}
