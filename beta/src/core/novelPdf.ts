import { fontKeys, loadWritingFont, type FontBytes } from "./writingFonts";
import { bookFrontMatter, type PublicationBlock } from "./book";
import { footnoteRuns, withoutFootnotes, type FootnoteRun } from "./footnotes";
import type { Screenplay } from "./model";
import type { NovelExportOptions, NovelPageSize } from "./novelExport";

const pageSizes: Record<NovelPageSize, [number, number]> = {
  "6x9": [432, 648],
  "5.5x8.5": [396, 612],
  "5x8": [360, 576],
  letter: [612, 792],
  a4: [595.28, 841.89],
};
const bookTitle = (doc: Screenplay) =>
  doc.titlePage.title ||
  withoutFootnotes(doc.blocks.find((b) => b.kind === "section")?.text || "") ||
  "Book";
const headingLevel = (b: PublicationBlock) =>
  Math.max(1, Math.min(6, b.level || 2));

export async function novelPdf(
  doc: Screenplay,
  options: NovelExportOptions = {},
) {
  const manuscript = options.pdfStyle === "manuscript";
  // Standard exports embed their fonts too, including all four genuine styles.
  const bytes =
    options.fontBytes ??
    (await loadWritingFont(manuscript ? "courier" : "serif"));
  const render = async (inside: number) => {
    const { PDFDocument, rgb } = await import("pdf-lib");
    const { default: fontkit } = await import("@pdf-lib/fontkit");
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    pdf.setTitle(bookTitle(doc));
    if (doc.titlePage.author) pdf.setAuthor(doc.titlePage.author);
    const fonts = Object.fromEntries(
      await Promise.all(
        fontKeys.map(async (key) => [
          key,
          await pdf.embedFont(bytes[key], {
            subset: true,
            features: { liga: false, clig: false, kern: false },
          }),
        ]),
      ),
    ) as Record<(typeof fontKeys)[number], import("pdf-lib").PDFFont>;
    const size = pageSizes[options.pageSize ?? (manuscript ? "letter" : "6x9")];
    const [pageWidth, pageHeight] = size;
    const outside = manuscript ? 72 : 45;
    const top = manuscript ? 72 : 54;
    const bottom = manuscript ? 72 : 54;
    const bodySize = 12;
    const bodyLeading = manuscript ? 24 : 16.5;
    let page = pdf.addPage(size),
      y = pageHeight - top;
    let missing = 0,
      bodyStart = 0;
    let pageNotes: string[] = [];
    const counter = { value: 0 };
    const leftMargin = () =>
      manuscript || pdf.getPageCount() % 2 === 1 ? inside : outside;
    const textWidth = pageWidth - inside - outside;
    const noteHeight = (lines: string[]) =>
      lines.length ? lines.length * 12 + 16 : 0;
    const characterSets = new Map(
      Object.values(fonts).map((font) => [
        font,
        new Set(font.getCharacterSet()),
      ]),
    );
    const glyphWidths = new Map<typeof fonts.regular, Map<string, number>>();
    const measure = (text: string, size: number, font = fonts.regular) => {
      let cache = glyphWidths.get(font);
      if (!cache) glyphWidths.set(font, (cache = new Map()));
      let total = 0;
      for (const char of text) {
        let width = cache.get(char);
        if (width === undefined) {
          width = font.widthOfTextAtSize(char, 1);
          cache.set(char, width);
        }
        total += width * size;
      }
      return total;
    };
    const safeText = (text: string, font = fonts.regular) => {
      let safe = "";
      for (const char of text) {
        if (characterSets.get(font)!.has(char.codePointAt(0)!)) {
          safe += char;
        } else {
          safe += "?";
          missing++;
        }
      }
      return safe;
    };
    const drawNotes = () => {
      if (!pageNotes.length) return;
      const x = leftMargin(),
        noteTop = bottom + pageNotes.length * 12;
      page.drawLine({
        start: { x, y: noteTop + 8 },
        end: { x: x + 90, y: noteTop + 8 },
        thickness: 0.5,
      });
      pageNotes.forEach((text, i) =>
        page.drawText(text, {
          x,
          y: noteTop - i * 12 - 2,
          size: 9,
          font: fonts.regular,
        }),
      );
      pageNotes = [];
    };
    const newPage = () => {
      drawNotes();
      page = pdf.addPage(size);
      y = pageHeight - top;
    };
    const wrapNote = (note: { number: number; text: string }) => {
      const lines: string[] = [];
      let line = "",
        width = 0;
      for (const token of safeText(`${note.number}. ${note.text}`).match(
        /\s+|[^\s]+/gu,
      ) || []) {
        if (line && width + measure(token, 9) > textWidth) {
          lines.push(line.trimEnd());
          line = "";
          width = 0;
        }
        for (const char of token) {
          if (!line && /\s/.test(char)) continue;
          if (line && width + measure(char, 9) > textWidth) {
            lines.push(line);
            line = "";
            width = 0;
          }
          line += char;
          width += measure(char, 9);
        }
      }
      if (line) lines.push(line.trimEnd());
      return lines;
    };
    type Glyph = {
      text: string;
      font: typeof fonts.regular;
      width: number;
      underline?: boolean;
      note?: { number: number; text: string };
    };
    const front = bookFrontMatter(doc);
    let openingParagraph = true;
    const blocks = [...front, ...(doc.blocks as PublicationBlock[])];
    for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
      const b = blocks[blockIndex];
      if (blockIndex === front.length) bodyStart = pdf.getPageCount() - 1;
      if (b.front === "break") {
        newPage();
        openingParagraph = true;
        continue;
      }
      // Blank editor paragraphs do not add spacing to a typeset book.
      if (!b.text.trim() && b.kind !== "pageBreak") continue;
      const heading = b.kind === "section";
      const fs =
        b.front === "title"
          ? manuscript
            ? 12
            : 24
          : heading
            ? manuscript
              ? 12
              : headingLevel(b) === 1
                ? 22
                : headingLevel(b) === 2
                  ? 18
                  : 14
            : bodySize;
      const leading = heading || b.front === "title" ? fs * 1.5 : bodyLeading;
      if (b.front === "title" || b.front === "dedication")
        y = pageHeight * 0.65;
      if (heading && headingLevel(b) <= 2) {
        if (y < pageHeight - top - 0.1) newPage();
        y -= manuscript ? 72 : 36;
      } else if (
        heading &&
        y < bottom + noteHeight(pageNotes) + leading * 2 + bodyLeading * 2
      ) {
        newPage();
      }
      const inset =
        ["dialogue", "centered", "parenthetical"].includes(b.kind) && !b.front
          ? 18
          : 0;
      const paragraph = !b.front && b.kind === "action";
      const indent =
        paragraph && (manuscript || !openingParagraph)
          ? manuscript
            ? 36
            : 18
          : 0;
      const maxWidth = textWidth - 2 * inset;
      const centered =
        b.kind === "centered" ||
        b.kind === "pageBreak" ||
        (heading && headingLevel(b) <= 2);
      let firstLine = true,
        line: Glyph[] = [],
        width = 0;
      const lineMax = () => maxWidth - (firstLine ? indent : 0);
      const draw = (justify = false) => {
        while (line.at(-1)?.text.match(/^\s$/)) width -= line.pop()!.width;
        if (!line.length) {
          y -= leading;
          return;
        }
        const added = line.flatMap((g) => (g.note ? wrapNote(g.note) : []));
        // Long notes can continue, so their reference only needs room to begin
        // the note here. Reserving all of it would strand chapter headings.
        const reservedNotes = Math.min(
          noteHeight([...pageNotes, ...added]),
          (pageHeight - top - bottom) / 2,
        );
        if (
          y <
            bottom +
              leading * (paragraph && firstLine && justify ? 2 : 1) +
              reservedNotes &&
          (pageNotes.length || y < pageHeight - top - 0.1)
        )
          newPage();
        pageNotes.push(...added);
        const left = leftMargin();
        let x = left + inset + (firstLine ? indent : 0);
        if (centered) x = left + (textWidth - width) / 2;
        if (b.kind === "parenthetical") x = left + textWidth - inset - width;
        const spaces = line.filter((g) => g.text === " ").length;
        const extra =
          !manuscript && paragraph && justify && spaces
            ? (lineMax() - width) / spaces
            : 0;
        // Leave very sparse lines ragged rather than adding excessive word spacing.
        const stretch = extra <= fs * 0.75 ? Math.max(0, extra) : 0;
        const runs: Glyph[] = [];
        for (const g of line) {
          const last = runs.at(-1);
          if (
            last &&
            last.font === g.font &&
            last.underline === g.underline &&
            !last.note &&
            !g.note &&
            (!stretch || (last.text !== " " && g.text !== " "))
          ) {
            last.text += g.text;
            last.width += g.width;
          } else runs.push({ ...g });
        }
        for (const g of runs) {
          page.drawText(g.text, {
            x,
            y: y + (g.note ? fs * 0.35 : 0),
            font: g.font,
            size: g.note ? fs * 0.7 : fs,
            color: rgb(0, 0, 0),
          });
          if (g.underline)
            page.drawLine({
              start: { x, y: y - 2 },
              end: { x: x + g.width, y: y - 2 },
              thickness: 0.6,
            });
          x += g.width + (g.text === " " ? stretch : 0);
        }
        y -= leading;
        // Split long notes before another body line can occupy their reserved area.
        while (noteHeight(pageNotes) > y - bottom) {
          const available = Math.max(1, Math.floor((y - bottom - 16) / 12));
          const remaining = pageNotes.splice(available);
          newPage();
          pageNotes = remaining;
        }
        firstLine = false;
        line = [];
        width = 0;
      };
      for (const span of (b.kind === "pageBreak"
        ? [{ text: manuscript ? "#" : "* * *" }]
        : footnoteRuns(b, counter)) as FootnoteRun[]) {
        if (span.note) {
          const w = measure(span.text, fs * 0.7);
          if (width + w > lineMax() && line.length) draw(true);
          line.push({
            text: span.text,
            font: fonts.regular,
            width: w,
            note: span.note,
          });
          width += w;
          continue;
        }
        const bold = heading || span.marks?.includes("bold");
        const italic =
          (b.kind === "centered" && (!b.front || b.front === "dedication")) ||
          span.marks?.includes("italic");
        const font =
          fonts[
            bold
              ? italic
                ? "boldItalic"
                : "bold"
              : italic
                ? "italic"
                : "regular"
          ];
        for (const token of span.text.match(/\n|[^\S\n]+|[^\s]+/gu) || []) {
          if (token === "\n") {
            draw();
            continue;
          }
          const safe = safeText(token, font);
          if (width + measure(safe, fs, font) > lineMax() && line.length)
            draw(true);
          if (!line.length && /^\s+$/.test(safe)) continue;
          for (const char of safe) {
            const w = measure(char, fs, font);
            if (width + w > lineMax() && line.length) draw(true);
            line.push({
              text: char,
              font,
              width: w,
              underline: span.marks?.includes("underline"),
            });
            width += w;
          }
        }
      }
      if (line.length) draw();
      if (heading) {
        y -= manuscript ? 24 : 18;
        openingParagraph = true;
      } else if (b.kind === "pageBreak") {
        y -= bodyLeading;
        openingParagraph = true;
      } else if (b.front) y -= 12;
      else if (paragraph) openingParagraph = false;
      else y -= 6;
    }
    drawNotes();
    const surname = doc.titlePage.author.trim().split(/\s+/).at(-1) || "Author";
    const header = `${surname} / ${bookTitle(doc)} / `;
    pdf.getPages().forEach((p, i) => {
      // Front matter has no running number; the body starts at page 1.
      if (
        i < bodyStart ||
        (front.length && !doc.blocks.some((b) => b.text.trim()))
      )
        return;
      const number = String(i - bodyStart + 1);
      let label = number;
      const font = fonts.regular,
        fontSize = 9;
      if (manuscript) {
        const safeHeader = safeText(header);
        label = safeHeader + number;
        while (
          font.widthOfTextAtSize(label, fontSize) > textWidth &&
          label.length > number.length + 4
        )
          label = label.slice(0, -(number.length + 5)) + "… / " + number;
      }
      const width = font.widthOfTextAtSize(label, fontSize);
      p.drawText(label, {
        x: manuscript || i % 2 === 0 ? pageWidth - outside - width : outside,
        y: manuscript ? pageHeight - 40 : 30,
        font,
        size: fontSize,
        color: rgb(0, 0, 0),
      });
    });
    return { pdf, missing };
  };
  let result = await render(manuscript ? 72 : 54);
  // Very long books need a wider gutter, based on their final pagination.
  if (!manuscript && result.pdf.getPageCount() > 700) result = await render(63);
  const pageCount = result.pdf.getPageCount();
  return {
    bytes: await result.pdf.save(),
    pageCount,
    scriptPageCount: pageCount,
    pageEquivalent: pageCount,
    warnings: result.missing
      ? [
          `${result.missing} unsupported characters were shown as ? in this PDF. Markdown, DOCX, EPUB and RTF retain the original Unicode text.`,
        ]
      : [],
  };
}
