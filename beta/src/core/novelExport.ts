import { footnoteRuns, type FootnoteRun } from "./footnotes";
import { bookFrontMatter, type PublicationBlock } from "./book";
import { zipSync, strToU8 } from "fflate";
import type { Screenplay, ScriptBlock, TextSpan } from "./model";
export type NovelExportFormat = "pdf" | "docx" | "epub" | "rtf";
const xml = (s: string) =>
  s
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
const spans = (b: ScriptBlock): TextSpan[] =>
  b.spans?.map((s) => s.text).join("") === b.text
    ? b.spans!
    : [{ text: b.text }];
const title = (doc: Screenplay) =>
  doc.titlePage.title ||
  doc.blocks.find((b) => b.kind === "section")?.text ||
  "Book";
const level = (b: ScriptBlock) => Math.max(1, Math.min(6, b.level || 2));
function htmlBlock(
  b: PublicationBlock,
  i: number,
  counter = { value: 0 },
  notes: { number: number; text: string }[] = [],
) {
  if (b.front === "break")
    return '<div class="front-break" style="break-after:page"></div>';
  const tag =
    b.kind === "section"
      ? `h${level(b)}`
      : b.kind === "dialogue"
        ? "blockquote"
        : "p";
  const content = footnoteRuns(b, counter)
    .map((s) => {
      if (s.note) {
        notes.push(s.note);
        return `<a epub:type="noteref" role="doc-noteref" id="ref${s.note.number}" href="#fn${s.note.number}"><sup>${s.note.number}</sup></a>`;
      }
      let t = xml(s.text).replace(/\n/g, "<br/>");
      if (s.marks?.includes("bold")) t = `<strong>${t}</strong>`;
      if (s.marks?.includes("italic")) t = `<em>${t}</em>`;
      if (s.marks?.includes("underline")) t = `<u>${t}</u>`;
      return t;
    })
    .join("");
  return b.kind === "pageBreak"
    ? `<hr id="p${i}"/>`
    : `<${tag} id="p${i}" class="${b.front ? `front-${b.front}` : b.kind}">${content || "&#160;"}</${tag}>`;
}
export function novelDocx(doc: Screenplay): Uint8Array {
  let frontPageBreak = false;
  const counter = { value: 0 },
    notes: { number: number; text: string }[] = [];
  const paragraph = (b: PublicationBlock) => {
    if (b.front === "break") {
      frontPageBreak = true;
      return "";
    }
    const pageBreak = frontPageBreak;
    frontPageBreak = false;
    const style = b.front
      ? b.front === "title"
        ? "BookTitle"
        : b.front === "author"
          ? "BookAuthor"
          : "Dedication"
      : b.kind === "section"
        ? `Heading${level(b)}`
        : b.kind === "dialogue"
          ? "Quote"
          : b.kind === "centered"
            ? "Epigraph"
            : b.kind === "parenthetical"
              ? "Attribution"
              : b.kind === "pageBreak"
                ? "SectionBreak"
                : "Normal";
    return `<w:p><w:pPr>${pageBreak ? "<w:pageBreakBefore/>" : ""}<w:pStyle w:val="${style}"/></w:pPr>${(b.kind ===
    "pageBreak"
      ? [{ text: "* * *" }]
      : footnoteRuns(b, counter)
    )
      .map((s: FootnoteRun) => {
        if (s.note) {
          notes.push(s.note);
          return `<w:r><w:rPr><w:vertAlign w:val="superscript"/></w:rPr><w:footnoteReference w:id="${s.note.number}"/></w:r>`;
        }
        return `<w:r><w:rPr>${s.marks?.includes("bold") ? "<w:b/>" : ""}${s.marks?.includes("italic") ? "<w:i/>" : ""}${s.marks?.includes("underline") ? '<w:u w:val="single"/>' : ""}</w:rPr>${s.text
          .split("\n")
          .map((t) => `<w:t xml:space="preserve">${xml(t)}</w:t>`)
          .join("<w:br/>")}</w:r>`;
      })
      .join("")}</w:p>`;
  };
  const ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const style = (id: string, properties: string, run = "") =>
    `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${id}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr>${properties}</w:pPr><w:rPr>${run}</w:rPr></w:style>`;
  const styles = `<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="${ns}"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:spacing w:after="160" w:line="360" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:sz w:val="24"/></w:rPr></w:style>${[1, 2, 3, 4, 5, 6].map((n) => style(`Heading${n}`, `<w:keepNext/><w:keepLines/><w:outlineLvl w:val="${n - 1}"/><w:spacing w:before="360" w:after="240"/>${n === 2 ? "<w:pageBreakBefore/>" : ""}`, `<w:b/><w:sz w:val="${n === 1 ? 36 : n === 2 ? 30 : 26}"/>`)).join("")}${style("BookTitle", '<w:jc w:val="center"/><w:spacing w:before="2200" w:after="480"/>', '<w:sz w:val="44"/>')}${style("BookAuthor", '<w:jc w:val="center"/>')}${style("Dedication", '<w:jc w:val="center"/><w:spacing w:before="2800"/>', "<w:i/>")}${style("Quote", '<w:ind w:left="720" w:right="720"/>')}${style("Epigraph", '<w:jc w:val="center"/><w:ind w:left="720" w:right="720"/>', "<w:i/>")}${style("Attribution", '<w:jc w:val="right"/><w:ind w:right="720"/>')}${style("SectionBreak", '<w:jc w:val="center"/>')}</w:styles>`;
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>',
    ),
    "_rels/.rels": strToU8(
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    ),
    "word/document.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="${ns}"><w:body>${[...bookFrontMatter(doc), ...doc.blocks].map(paragraph).join("")}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`,
    ),
    "word/_rels/document.xml.rels": strToU8(
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    ),
    "word/styles.xml": strToU8(styles),
  };
  if (notes.length) {
    files["word/footnotes.xml"] = strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><w:footnotes xmlns:w="${ns}"><w:footnote w:type="separator" w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:footnote><w:footnote w:type="continuationSeparator" w:id="0"><w:p><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>${notes.map((n) => `<w:footnote w:id="${n.number}"><w:p><w:pPr><w:spacing w:after="80" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:vertAlign w:val="superscript"/></w:rPr><w:footnoteRef/></w:r><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve"> ${xml(n.text)}</w:t></w:r></w:p></w:footnote>`).join("")}</w:footnotes>`,
    );
    const decoder = new TextDecoder();
    files["[Content_Types].xml"] = strToU8(
      decoder
        .decode(files["[Content_Types].xml"])
        .replace(
          "</Types>",
          '<Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/></Types>',
        ),
    );
    files["word/_rels/document.xml.rels"] = strToU8(
      decoder
        .decode(files["word/_rels/document.xml.rels"])
        .replace(
          "</Relationships>",
          '<Relationship Id="rIdFootnotes" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes" Target="footnotes.xml"/></Relationships>',
        ),
    );
  }
  return zipSync(files);
}
export function novelEpub(doc: Screenplay): Uint8Array {
  const counter = { value: 0 },
    notes: { number: number; text: string }[] = [];
  const bookTitle = xml(title(doc)),
    identifier = `urn:uuid:${crypto.randomUUID()}`;
  const xhtml = (name: string, body: string) =>
    `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="en" lang="en"><head><title>${xml(name)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head><body>${body}</body></html>`;
  const headings = doc.blocks.flatMap((b, i) =>
    b.kind === "section" ? [{ b, i }] : [],
  );
  const nav = `<nav epub:type="toc" id="toc"><h1>Contents</h1><ol>${(headings.length ? headings : [{ b: { text: title(doc) } as ScriptBlock, i: 0 }]).map(({ b, i }) => `<li><a href="book.xhtml#p${i}">${xml(b.text || "Untitled section")}</a></li>`).join("")}</ol></nav>`;
  return zipSync({
    mimetype: [strToU8("application/epub+zip"), { level: 0 }],
    "META-INF/container.xml": strToU8(
      '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
    ),
    "EPUB/package.opf": strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="en"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">${identifier}</dc:identifier><dc:title>${bookTitle}</dc:title><dc:language>en</dc:language>${doc.titlePage.author ? `<dc:creator>${xml(doc.titlePage.author)}</dc:creator>` : ""}<meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, "Z")}</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="book" href="book.xhtml" media-type="application/xhtml+xml"/><item id="style" href="style.css" media-type="text/css"/></manifest><spine><itemref idref="nav"/><itemref idref="book"/></spine></package>`,
    ),
    "EPUB/nav.xhtml": strToU8(xhtml("Contents", nav)),
    "EPUB/book.xhtml": strToU8(
      xhtml(
        title(doc),
        bookFrontMatter(doc)
          .map((b, i) => htmlBlock(b, -i - 1, counter, notes))
          .join("\n") +
          doc.blocks.map((b, i) => htmlBlock(b, i, counter, notes)).join("\n") +
          notes
            .map(
              (n) =>
                `<aside epub:type="footnote" role="doc-footnote" id="fn${n.number}"><p><a epub:type="backlink" href="#ref${n.number}" aria-label="Return to reference ${n.number}">${n.number}</a> ${xml(n.text)}</p></aside>`,
            )
            .join("\n"),
      ),
    ),
    "EPUB/style.css": strToU8(
      '.front-title{text-align:center;font-size:2em;margin-top:25%;}.front-author,.front-dedication{text-align:center;}.front-dedication{font-style:italic;margin-top:35%;}body{font-family:serif;line-height:1.65;margin:1em;}p{margin:0 0 1em;}h1,h2{break-before:page;page-break-before:always;}h1:first-child{break-before:auto;}h1,h2,h3,h4,h5,h6{break-after:avoid;}blockquote{margin:1em 8%;}.centered{text-align:center;font-style:italic;margin:2em 10% .5em;}.parenthetical{text-align:right;margin-right:10%;font-size:.9em;}hr{border:0;text-align:center;margin:2em;}hr:after{content:"* * *";}',
    ),
  });
}
const rtfEscape = (s: string) =>
  s
    .split("")
    .map((c) => {
      const n = c.charCodeAt(0);
      return c === "\n"
        ? "\\line "
        : /[\\{}]/.test(c)
          ? "\\" + c
          : n > 127
            ? "\\u" + (n > 32767 ? n - 65536 : n) + "?"
            : c;
    })
    .join("");
export function novelRtf(doc: Screenplay): string {
  const counter = { value: 0 };
  return (
    "{\\rtf1\\ansi\\deff0\\uc1{\\fonttbl{\\f0 Georgia;}}{\\stylesheet{\\s0 Normal;}" +
    [1, 2, 3, 4, 5, 6]
      .map(
        (n) =>
          `{\\s${n}\\sbasedon0\\snext0\\outlinelevel${n - 1} Heading ${n};}`,
      )
      .join("") +
    "}\\ftnbj\\ftnstart1\\paperw12240\\paperh15840\\margl1440\\margr1440\\margt1440\\margb1440\n" +
    [...bookFrontMatter(doc), ...(doc.blocks as PublicationBlock[])]
      .map((b) =>
        b.front === "break"
          ? "\\page\n"
          : `{\\pard\\f0\\fs24\\sa160\\sl360\\slmult1${b.kind === "section" ? `\\s${level(b)}\\b\\fs${level(b) === 1 ? 36 : 30}\\sb360\\keepn` : ""}${["dialogue", "centered", "parenthetical"].includes(b.kind) ? "\\li720\\ri720" : ""}${b.kind === "centered" ? (b.front === "title" || b.front === "author" ? "\\qc" : "\\qc\\i") : b.kind === "parenthetical" ? "\\qr" : b.kind === "pageBreak" ? "\\qc" : ""} ${(b.kind === "pageBreak" ? [{ text: "* * *" }] : footnoteRuns(b, counter)).map((s: FootnoteRun) => (s.note ? `{\\super\\chftn}{\\footnote\\pard\\plain\\f0\\fs20 {\\super\\chftn} ${rtfEscape(s.note.text)}\\par}` : `{${s.marks?.includes("bold") ? "\\b " : ""}${s.marks?.includes("italic") ? "\\i " : ""}${s.marks?.includes("underline") ? "\\ul " : ""}${rtfEscape(s.text)}}`)).join("")}\\par}\n`,
      )
      .join("") +
    "}"
  );
}
export async function novelPdf(
  doc: Screenplay,
  options: { pageSize?: "a4" | "letter" } = {},
) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  pdf.setTitle(title(doc));
  if (doc.titlePage.author) pdf.setAuthor(doc.titlePage.author);
  const fonts = {
    regular: await pdf.embedFont(StandardFonts.TimesRoman),
    bold: await pdf.embedFont(StandardFonts.TimesRomanBold),
    italic: await pdf.embedFont(StandardFonts.TimesRomanItalic),
    boldItalic: await pdf.embedFont(StandardFonts.TimesRomanBoldItalic),
  };
  const size: [number, number] =
    options.pageSize === "a4" ? [595.28, 841.89] : [612, 792];
  const margin = 64;
  let page = pdf.addPage(size),
    y = size[1] - margin;
  let missing = 0;
  let pageNotes: string[] = [];
  const counter = { value: 0 };
  const noteHeight = (lines: string[]) =>
    lines.length ? lines.length * 12 + 16 : 0;
  const drawNotes = () => {
    if (!pageNotes.length) return;
    const top = margin + pageNotes.length * 12;
    page.drawLine({
      start: { x: margin, y: top + 8 },
      end: { x: margin + 110, y: top + 8 },
      thickness: 0.5,
    });
    pageNotes.forEach((text, i) =>
      page.drawText(text, {
        x: margin,
        y: top - i * 12 - 2,
        size: 9,
        font: fonts.regular,
      }),
    );
    pageNotes = [];
  };
  const wrapNote = (note: { number: number; text: string }) => {
    const lines: string[] = [];
    let line = "";
    for (const token of `${note.number}. ${note.text}`.match(/\s+|[^\s]+/gu) ||
      []) {
      let safe = "";
      for (const c of token) {
        try {
          fonts.regular.encodeText(c);
          safe += c;
        } catch {
          safe += "?";
          missing++;
        }
      }
      if (
        line &&
        fonts.regular.widthOfTextAtSize(line + safe, 9) > size[0] - 2 * margin
      ) {
        lines.push(line.trimEnd());
        line = "";
      }
      for (const c of safe) {
        if (!line && /\s/.test(c)) continue;
        if (
          fonts.regular.widthOfTextAtSize(line + c, 9) >
          size[0] - 2 * margin
        ) {
          lines.push(line);
          line = "";
        }
        line += c;
      }
    }
    if (line) lines.push(line);
    return lines;
  };
  const newPage = () => {
    drawNotes();
    page = pdf.addPage(size);
    y = size[1] - margin;
  };
  for (const b of [
    ...bookFrontMatter(doc),
    ...(doc.blocks as PublicationBlock[]),
  ]) {
    if (b.front === "break") {
      newPage();
      continue;
    }
    if (b.front === "title" || b.front === "dedication") y = size[1] * 0.65;
    const heading = b.kind === "section",
      fs =
        b.front === "title"
          ? 24
          : heading
            ? level(b) === 1
              ? 24
              : level(b) === 2
                ? 19
                : 15
            : 12;
    const lineHeight = fs * 1.6;
    const inset = ["dialogue", "centered", "parenthetical"].includes(b.kind)
      ? 28
      : 0;
    const max = size[0] - 2 * (margin + inset);
    if (heading && level(b) <= 2 && y < size[1] - margin - 24) newPage();
    if (heading && y < margin + lineHeight * 3) newPage();
    type Glyph = {
      text: string;
      font: typeof fonts.regular;
      width: number;
      underline?: boolean;
      note?: { number: number; text: string };
    };
    let line: Glyph[] = [];
    let width = 0;
    const draw = () => {
      const added = line.flatMap((g) => (g.note ? wrapNote(g.note) : []));
      const required =
        margin + lineHeight + noteHeight([...pageNotes, ...added]);
      if (y < required && (pageNotes.length || y < size[1] - margin - 0.1))
        newPage();
      pageNotes.push(...added);
      let x = margin + inset;
      if (b.kind === "centered" || b.kind === "pageBreak")
        x = (size[0] - width) / 2;
      if (b.kind === "parenthetical") x = size[0] - margin - inset - width;
      for (const g of line) {
        page.drawText(g.text, {
          x,
          y: y + (g.note ? fs * 0.35 : 0),
          font: g.font,
          size: g.note ? fs * 0.7 : fs,
          color: rgb(0.12, 0.12, 0.12),
        });
        if (g.underline)
          page.drawLine({
            start: { x, y: y - 2 },
            end: { x: x + g.width, y: y - 2 },
            thickness: 0.6,
            color: rgb(0.12, 0.12, 0.12),
          });
        if (g.text) x += g.width;
      }
      y -= lineHeight;
      // Very long notes continue on following pages; reserve their space before more body text.
      while (noteHeight(pageNotes) > y - margin) {
        const available = Math.max(1, Math.floor((y - margin - 16) / 12));
        const remaining = pageNotes.splice(available);
        newPage();
        pageNotes = remaining;
      }
      line = [];
      width = 0;
    };
    for (const span of (b.kind === "pageBreak"
      ? [{ text: "* * *" }]
      : footnoteRuns(b, counter)) as FootnoteRun[]) {
      if (span.note) {
        const w = fonts.regular.widthOfTextAtSize(span.text, fs * 0.7);
        if (width + w > max && line.length) draw();
        line.push({
          text: span.text,
          font: fonts.regular,
          width: w,
          note: span.note,
        });
        width += w;
        continue;
      }
      const bold = heading || span.marks?.includes("bold"),
        italic =
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
        let safe = "";
        for (const c of token) {
          try {
            font.encodeText(c);
            safe += c;
          } catch {
            safe += "?";
            missing++;
          }
        }
        const tokenWidth = font.widthOfTextAtSize(safe, fs);
        if (width + tokenWidth > max && line.length) draw();
        if (!line.length && /^\s+$/.test(safe)) continue;
        for (const c of safe) {
          const w = font.widthOfTextAtSize(c, fs);
          if (width + w > max && line.length) draw();
          line.push({
            text: c,
            font,
            width: w,
            underline: span.marks?.includes("underline"),
          });
          width += w;
        }
      }
    }
    if (line.length) draw();
    y -= heading ? 12 : 9;
  }
  drawNotes();
  pdf.getPages().forEach((p, i) =>
    p.drawText(String(i + 1), {
      x: size[0] / 2 - 3,
      y: 30,
      font: fonts.regular,
      size: 9,
      color: rgb(0.4, 0.4, 0.4),
    }),
  );
  const pageCount = pdf.getPageCount();
  return {
    bytes: await pdf.save(),
    pageCount,
    scriptPageCount: pageCount,
    pageEquivalent: pageCount,
    warnings: missing
      ? [
          `${missing} unsupported characters were shown as ? in this PDF. Markdown, DOCX, EPUB and RTF retain the original Unicode text.`,
        ]
      : [],
  };
}
export async function exportNovel(
  doc: Screenplay,
  format: NovelExportFormat,
): Promise<{ blob: Blob; warnings: string[] }> {
  let content: Uint8Array | string;
  let warnings: string[] = [];
  let mime: string;
  if (format === "pdf") {
    const result = await novelPdf(doc);
    content = result.bytes;
    warnings = result.warnings;
    mime = "application/pdf";
  } else if (format === "docx") {
    content = novelDocx(doc);
    mime =
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  } else if (format === "epub") {
    content = novelEpub(doc);
    mime = "application/epub+zip";
  } else {
    content = novelRtf(doc);
    mime = "application/rtf";
  }
  return { blob: new Blob([content as BlobPart], { type: mime }), warnings };
}
