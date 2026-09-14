import type { PDFFont, PDFPage } from "pdf-lib";
import { newId } from "./model";
import type { Screenplay, ScriptBlock, TextMark, TextSpan } from "./model";
import { blockSpans } from "./fountain";
import { analyzeScreenplay, publishedKinds } from "./insights";
import regularFontUrl from "@fontsource/courier-prime/files/courier-prime-latin-400-normal.woff?url";
import boldFontUrl from "@fontsource/courier-prime/files/courier-prime-latin-700-normal.woff?url";
import italicFontUrl from "@fontsource/courier-prime/files/courier-prime-latin-400-italic.woff?url";
import boldItalicFontUrl from "@fontsource/courier-prime/files/courier-prime-latin-700-italic.woff?url";

export interface PdfOptions {
  includeTitlePage?: boolean;
  pageSize?: "letter" | "a4";
  sceneNumbers?: "margin" | "inline" | "off";
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
  glyphs: Glyph[];
  width: number;
  x: number;
  boxWidth: number;
  align?: "left" | "right" | "center";
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
  const flush = () => {
    lines.push({
      glyphs: current,
      width: currentWidth,
      x,
      boxWidth: width,
      align,
    });
    current = [];
    currentWidth = 0;
  };
  for (const glyph of all) {
    if (glyph.text === "\n") {
      flush();
      continue;
    }
    if (current.length && currentWidth + glyph.width > width + 0.05) {
      let space = current.length - 1;
      while (space >= 0 && !/\s/.test(current[space].text)) space--;
      if (space > 0) {
        const after = current.slice(space + 1);
        current = current.slice(0, space);
        currentWidth = current.reduce((sum, item) => sum + item.width, 0);
        flush();
        current = after;
        currentWidth = current.reduce((sum, item) => sum + item.width, 0);
      } else flush();
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

/** A self-contained screenplay compositor. Its returned count is read from the PDF itself. */
export async function exportPdf(
  document: Screenplay,
  options: PdfOptions = {},
): Promise<PdfExport> {
  const [{ PDFDocument, StandardFonts, rgb }, { default: fontkit }] =
    await Promise.all([import("pdf-lib"), import("@pdf-lib/fontkit")]);
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
  const right = 72;
  const fullWidth = pageWidth - left - right;
  const top = pageHeight - 72;
  const bottom = 72;
  const leading = 12;
  let page: PDFPage;
  let y = top;
  let scriptPageCount = 0;
  let titlePageCount = 0;
  const drawLine = (line: Line, atY: number, target: PDFPage = page) => {
    let x =
      line.x +
      (line.align === "right"
        ? line.boxWidth - line.width
        : line.align === "center"
          ? (line.boxWidth - line.width) / 2
          : 0);
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
      if (text)
        target.drawText(text, {
          x,
          y: atY,
          size: 12,
          font: first.font,
          color: rgb(0.07, 0.07, 0.07),
        });
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
    scriptPageCount++;
    if (scriptPageCount > 1)
      drawLine(
        textLines(`${scriptPageCount}.`, left, fullWidth, "right")[0],
        pageHeight - 36,
      );
  };
  const hasTitle = !!(
    document.titlePage.title ||
    document.titlePage.author ||
    document.titlePage.source ||
    document.titlePage.contact ||
    document.titlePage.draftDate
  );
  if (options.includeTitlePage !== false && hasTitle) {
    let titlePage = pdf.addPage([pageWidth, pageHeight]);
    titlePageCount = 1;
    const fields = [
      document.titlePage.title || "Untitled",
      document.titlePage.credit,
      document.titlePage.author,
      document.titlePage.source,
    ].filter(Boolean);
    const centerLines = fields.map((field, i) =>
      textLines(
        field,
        72,
        pageWidth - 144,
        "center",
        i === 0 ? ["bold"] : undefined,
      ),
    );
    let titleY = pageHeight * 0.66;
    for (const field of centerLines) {
      for (const line of field) {
        if (titleY < 240) {
          titlePage = pdf.addPage([pageWidth, pageHeight]);
          titlePageCount++;
          titleY = top;
        }
        drawLine(line, titleY, titlePage);
        titleY -= leading;
      }
      titleY -= 24;
    }
    const footer = [document.titlePage.contact, document.titlePage.draftDate]
      .filter(Boolean)
      .join("\n\n");
    const footerLines = textLines(footer, 72, pageWidth - 144);
    let footerY = Math.min(
      216,
      72 + Math.max(0, footerLines.length - 1) * leading,
    );
    for (const line of footerLines) {
      if (footerY < 60) {
        titlePage = pdf.addPage([pageWidth, pageHeight]);
        titlePageCount++;
        footerY = top;
      }
      drawLine(line, footerY, titlePage);
      footerY -= leading;
    }
  }
  newPage();
  const numbers = sceneNumbers(document, options.sceneNumberFormat);
  const blocks = document.blocks.filter((block) =>
    publishedKinds.has(block.kind),
  );
  const styledLines = (block: ScriptBlock, dualColumn?: number): Line[] => {
    let x = left;
    let width = fullWidth;
    let align: Line["align"] = "left";
    if (dualColumn !== undefined) {
      const columnWidth = (fullWidth - 24) / 2;
      x = left + dualColumn * (columnWidth + 24);
      width = columnWidth;
      if (block.kind === "character") {
        x += 24;
        width -= 24;
      }
      if (block.kind === "parenthetical") {
        x += 12;
        width -= 12;
      }
    } else if (block.kind === "character") {
      x = 252;
      width = pageWidth - right - x;
    } else if (block.kind === "dialogue" || block.kind === "lyrics") {
      x = 180;
      width = Math.min(252, pageWidth - right - x);
    } else if (block.kind === "parenthetical") {
      x = 216;
      width = Math.min(216, pageWidth - right - x);
    } else if (block.kind === "transition") align = "right";
    else if (block.kind === "centered") align = "center";
    let spans = blockSpans(block);
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
    if (block.kind === "scene" && options.sceneNumbers === "inline")
      spans = [{ text: `${numbers.get(block.id)}  ` }, ...spans];
    return wrap(spans, fonts, x, width, warnings, align);
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
          cues.forEach((line, index) => drawLine(line, y - index * leading));
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
      block.kind === "scene"
        ? Math.min(3, lines.length + 2)
        : Math.min(2, lines.length);
    if (y - (reserve - 1) * leading < bottom) newPage();
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      if (y < bottom) newPage();
      if (
        block.kind === "scene" &&
        lineIndex === 0 &&
        options.sceneNumbers === "margin"
      ) {
        const number = numbers.get(block.id)!;
        drawLine(textLines(number, 42, 54, "right")[0], y);
        drawLine(textLines(number, pageWidth - right + 12, right - 24)[0], y);
      }
      drawLine(lines[lineIndex], y);
      y -= leading;
    }
    i++;
  }
  const bytes = await pdf.save();
  return {
    bytes,
    pageCount: pdf.getPageCount(),
    scriptPageCount: pdf.getPageCount() - titlePageCount,
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

function styledHtml(block: ScriptBlock): string {
  return blockSpans(block)
    .map((span) => {
      let text = xml(span.text).replace(/\n/g, "<br>");
      for (const mark of span.marks ?? []) {
        const tag = mark === "bold" ? "strong" : mark === "italic" ? "em" : "u";
        text = `<${tag}>${text}</${tag}>`;
      }
      return text;
    })
    .join("");
}

export function exportHtml(document: Screenplay): string {
  const title = document.titlePage;
  const titleHtml =
    title.title || title.author
      ? `<header class="title-page"><h1>${xml(title.title || "Untitled")}</h1><p>${xml(title.credit)}</p><p>${xml(title.author).replace(/\n/g, "<br>")}</p><p>${xml(title.source).replace(/\n/g, "<br>")}</p><address>${xml(title.contact).replace(/\n/g, "<br>")}<br>${xml(title.draftDate)}</address></header>`
      : "";
  const blocks = document.blocks.filter((block) =>
    publishedKinds.has(block.kind),
  );
  const html: string[] = [];
  const paragraph = (block: ScriptBlock) =>
    block.kind === "pageBreak"
      ? '<div class="page-break"></div>'
      : `<p class="${block.kind}">${styledHtml(block)}</p>`;
  for (let i = 0; i < blocks.length;) {
    if (blocks[i].kind === "character") {
      const first = dialogueGroup(blocks, i);
      if (blocks[first.end]?.kind === "character" && blocks[first.end].dual) {
        const second = dialogueGroup(blocks, first.end);
        html.push(
          `<div class="dual"><div>${first.group.map(paragraph).join("")}</div><div>${second.group.map(paragraph).join("")}</div></div>`,
        );
        i = second.end;
        continue;
      }
    }
    html.push(paragraph(blocks[i++]));
  }
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${xml(title.title || "Untitled screenplay")}</title><style>body{margin:0;background:#eee;color:#111;font:12pt/1 "Courier Prime",Courier,monospace}.script,.title-page{box-sizing:border-box;max-width:8.5in;margin:24px auto;padding:1in 1in 1in 1.5in;background:white}p{white-space:pre-wrap;overflow-wrap:break-word;margin:0 0 12pt}.scene{break-after:avoid}.character{margin-left:2in;margin-bottom:0;break-after:avoid}.dialogue,.lyrics{margin-left:1in;margin-right:1.5in;margin-bottom:0}.parenthetical{margin-left:1.5in;margin-right:1.5in;margin-bottom:0;break-after:avoid}.lyrics{font-style:italic}.transition{text-align:right}.centered{text-align:center}.page-break{break-before:page}.dual{display:grid;grid-template-columns:1fr 1fr;gap:24pt;margin-bottom:12pt}.dual p{margin-left:0;margin-right:0}.dual .character{margin-left:24pt}.title-page{min-height:11in;text-align:center;padding-top:3in;position:relative;break-after:page}.title-page h1{font-size:12pt}.title-page p{margin-top:24pt}.title-page address{font-style:normal;white-space:pre-wrap;text-align:left;margin-top:2in}@media print{body{background:white}.script,.title-page{margin:0;max-width:none;padding:0;box-shadow:none}.title-page{min-height:8in;padding-top:2in}@page{size:letter;margin:1in 1in 1in 1.5in}}@media(max-width:640px){.script,.title-page{padding:32px 20px}.character{margin-left:35%}.dialogue,.lyrics{margin-left:15%;margin-right:15%}.parenthetical{margin-left:20%;margin-right:20%}}</style></head><body>${titleHtml}<main class="script">${html.join("\n")}</main></body></html>`;
}

export function exportBeatSheetCsv(document: Screenplay): string {
  const scenes = new Map(
    analyzeScreenplay(document).scenes.map((scene) => [scene.id, scene]),
  );
  const cell = (value: unknown) => {
    let text = String(value ?? "");
    // Spreadsheet applications otherwise interpret a beat title beginning '=' as a formula.
    if (/^[\s]*[=+@-]/.test(text) || /^[\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const rows: unknown[][] = [
    ["Beat", "Act", "Description", "Scene", "Scene heading", "Color"],
  ];
  for (const beat of document.metadata.beats) {
    const scene = beat.sceneId ? scenes.get(beat.sceneId) : undefined;
    rows.push([
      beat.title,
      beat.act,
      beat.description,
      scene?.number ?? "",
      scene?.heading ?? "",
      beat.color,
    ]);
  }
  return `\uFEFF${rows.map((row) => row.map(cell).join(",")).join("\r\n")}\r\n`;
}

export function beatSheetDocument(document: Screenplay): Screenplay {
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
    const scene = document.blocks.find((block) => block.id === beat.sceneId);
    if (scene) add(`Scene: ${scene.text}`);
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
    },
    blocks,
  };
}
