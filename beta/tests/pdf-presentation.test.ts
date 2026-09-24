import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { PDFDocument, PDFName, PDFPage } from "pdf-lib";
import {
  exportPdf,
  pdfPageContentSignatures,
  type PdfOptions,
} from "../src/core/export";
import { emptyScreenplay, newId } from "../src/core/model";
import { parseFountain } from "../src/core/fountain";
import { formatPageCount } from "../src/core/pageCount";

let fontBytes: NonNullable<PdfOptions["fontBytes"]>;
beforeAll(async () => {
  fontBytes = Object.fromEntries(
    await Promise.all(
      Object.entries({
        regular: "400-normal",
        bold: "700-normal",
        italic: "400-italic",
        boldItalic: "700-italic",
      }).map(async ([key, name]) => [
        key,
        new Uint8Array(
          await readFile(
            `node_modules/@fontsource/courier-prime/files/courier-prime-latin-${name}.woff`,
          ),
        ),
      ]),
    ),
  ) as NonNullable<PdfOptions["fontBytes"]>;
});
afterEach(() => vi.restoreAllMocks());

// Observe the actual drawing calls while still generating a complete, embedded-font
// PDF. Position assertions protect typesetting behavior without snapshotting bytes.
function observeDrawing() {
  const spy = vi.spyOn(PDFPage.prototype, "drawText");
  return () =>
    spy.mock.calls.map(([text, options], index) => ({
      text,
      x: options!.x!,
      y: options!.y!,
      size: options!.size!,
      font: options!.font!,
      page: spy.mock.contexts[index],
    }));
}

describe("established PDF presentation", () => {
  it("sets a regular twelve-point cover, centered title, lower-left date/contact, and centered copyright", async () => {
    const drawing = observeDrawing();
    const document = parseFountain("INT. STUDIO - NIGHT\n\nAn empty room.");
    document.titlePage = {
      title: "The Quiet Hour",
      credit: "Written by",
      author: "A Writer",
      source: "Based on an original story",
      draftDate: "September 14, 2026",
      contact: "A Writer\nwriter@example.com\nNew York, NY",
      extra: { Copyright: "Copyright 2026 A Writer" },
    };
    const result = await exportPdf(document, { fontBytes });
    const drawn = drawing();
    const cover = drawn.filter((row) => row.page === drawn[0].page);
    expect(cover.map(({ text }) => text)).toEqual([
      "The Quiet Hour",
      "Written by",
      "A Writer",
      "Based on an original story",
      "September 14, 2026",
      "A Writer",
      "writer@example.com",
      "New York, NY",
      "Copyright 2026 A Writer",
    ]);
    expect(cover.map(({ y }) => y)).toEqual([
      488, 452, 428, 404, 198, 162, 138, 114, 78,
    ]);
    for (const row of cover) {
      expect(row.size).toBe(12);
      expect(row.font.name).not.toMatch(/Bold|Italic/);
    }
    for (const row of [...cover.slice(0, 4), cover[8]])
      expect(row.x + row.font.widthOfTextAtSize(row.text, 12) / 2).toBeCloseTo(
        306,
      );
    expect(cover.slice(4, 8).every(({ x }) => x === 108)).toBe(true);
    expect(result.pageCount).toBe(2);
    expect(result.scriptPageCount).toBe(1);
    expect(result.warnings).toEqual([]);
    await mkdir("tmp/pdfs", { recursive: true });
    await writeFile("tmp/pdfs/presentation.pdf", result.bytes);
  });

  it("restores screenplay indents, first-page numbering and left-only scene labels", async () => {
    const drawing = observeDrawing();
    const underline = vi.spyOn(PDFPage.prototype, "drawLine");
    await exportPdf(
      parseFountain(
        "INT. STUDIO - NIGHT\n\nAn empty room.\n\nMARA\n(quietly)\nHello.",
      ),
      { fontBytes },
    );
    const drawn = drawing();
    const row = (text: string) => drawn.find((item) => item.text === text)!;
    expect(row("1.").y).toBe(750);
    expect(
      row("1.").x + row("1.").font.widthOfTextAtSize("1.", 12),
    ).toBeCloseTo(547.2);
    expect(drawn.filter(({ text }) => text === "1")).toHaveLength(1);
    expect(row("1")).toMatchObject({ x: 54, y: 708 });
    expect(row("INT. STUDIO - NIGHT")).toMatchObject({ x: 108, y: 708 });
    expect(row("INT. STUDIO - NIGHT").font.name).toMatch(/Bold/);
    expect(row("An empty room.")).toMatchObject({ x: 108, y: 684 });
    expect(row("MARA").x).toBeCloseTo(244.8);
    expect(row("MARA").y).toBe(660);
    expect(row("(quietly)").x).toBeCloseTo(201.6);
    expect(row("(quietly)").y).toBe(648);
    expect(row("Hello.").x).toBeCloseTo(172.8);
    expect(row("Hello.").y).toBe(636);
    expect(underline).not.toHaveBeenCalled();
  });

  it("prints only top-level Act headings, keeps them bold, and honors scene boldness and numbering choices", async () => {
    const drawing = observeDrawing();
    const document = parseFountain(
      "# Act One\n\nINT. STUDIO - NIGHT\n\nAn empty room.\n\n## Private section\n\n# Act Two\n\nEXT. PARK - DAY\n\nA quiet morning.",
    );
    await exportPdf(document, {
      fontBytes,
      sceneNumberFormat: "act",
      boldSceneHeadings: false,
    });
    const drawn = drawing();
    expect(drawn.find(({ text }) => text === "ACT ONE")?.font.name).toMatch(
      /Bold/,
    );
    expect(drawn.find(({ text }) => text === "ACT TWO")?.font.name).toMatch(
      /Bold/,
    );
    expect(drawn.some(({ text }) => text.includes("Private section"))).toBe(
      false,
    );
    expect(
      drawn.find(({ text }) => text === "INT. STUDIO - NIGHT")?.font.name,
    ).not.toMatch(/Bold/);
    expect(
      drawn
        .filter(({ text }) => /^A[12]S1$/.test(text))
        .map(({ text, x }) => ({ text, x })),
    ).toEqual([
      { text: "A1S1", x: 54 },
      { text: "A2S1", x: 54 },
    ]);
  });

  it("preserves authored bold when the scene preference is off and applies inline scene labels without margin copies", async () => {
    const drawing = observeDrawing();
    const document = parseFountain("INT. **STUDIO** - NIGHT\n\nAn empty room.");
    await exportPdf(document, {
      fontBytes,
      boldSceneHeadings: false,
      sceneNumbers: "inline",
    });
    const drawn = drawing();
    expect(drawn.find(({ text }) => text === "STUDIO")?.font.name).toMatch(
      /Bold/,
    );
    expect(drawn.some(({ text }) => text.includes("1  INT."))).toBe(true);
    expect(drawn.some(({ x }) => x === 54)).toBe(false);
    const before = drawn.length;
    await exportPdf(document, { fontBytes, sceneNumbers: "off" });
    expect(
      drawing()
        .slice(before)
        .some(({ x }) => x === 54),
    ).toBe(false);
  });

  it.each(["letter", "a4"] as const)(
    "keeps a 61-column, 55-line script frame on %s paper",
    async (pageSize) => {
      const drawing = observeDrawing();
      const document = emptyScreenplay();
      document.blocks[0].text = "X".repeat(61 * 56);
      const result = await exportPdf(document, { fontBytes, pageSize });
      const lines = drawing().filter(({ text }) => /^X+$/.test(text));
      const top = (pageSize === "a4" ? 841.89 : 792) - 84;
      expect(lines).toHaveLength(56);
      expect(lines.every(({ text }) => text.length === 61)).toBe(true);
      expect(lines.filter(({ page }) => page === lines[0].page)).toHaveLength(
        55,
      );
      expect(lines[0].y).toBeCloseTo(top);
      expect(lines[54].y).toBeCloseTo(top - 648);
      expect(lines[55].y).toBeCloseTo(top);
      expect(result.scriptPageCount).toBe(2);
    },
  );

  it("keeps a scene heading with its first action across a page boundary", async () => {
    const drawing = observeDrawing();
    const document = emptyScreenplay();
    document.blocks = [
      {
        id: newId(),
        kind: "action",
        text: Array.from({ length: 53 }, () => "An action line.").join("\n"),
      },
      { id: newId(), kind: "scene", text: "EXT. PARK - DAY" },
      { id: newId(), kind: "action", text: "The next scene begins." },
    ];
    await exportPdf(document, { fontBytes });
    const drawn = drawing();
    const heading = drawn.find(({ text }) => text === "EXT. PARK - DAY")!;
    const action = drawn.find(({ text }) => text === "The next scene begins.")!;
    expect(heading.page).toBe(action.page);
    expect(heading.y).toBe(708);
    expect(action.y).toBe(684);
  });

  it("retains every long cover row and dialogue line without clipping or losing continuation cues", async () => {
    const drawing = observeDrawing();
    const document = emptyScreenplay();
    document.titlePage.title = Array.from(
      { length: 35 },
      (_, index) => `Title row ${index}`,
    ).join("\n");
    document.titlePage.contact = Array.from(
      { length: 40 },
      (_, index) => `Contact row ${index}`,
    ).join("\n");
    document.blocks = [
      { id: newId(), kind: "character", text: "MARA" },
      {
        id: newId(),
        kind: "dialogue",
        text: Array.from(
          { length: 70 },
          (_, index) => `Dialogue row ${index}`,
        ).join("\n"),
      },
    ];
    const result = await exportPdf(document, { fontBytes });
    const drawn = drawing();
    for (const [prefix, count] of [
      ["Title", 35],
      ["Contact", 40],
      ["Dialogue", 70],
    ] as const)
      for (let index = 0; index < count; index++)
        expect(
          drawn.filter(({ text }) => text === `${prefix} row ${index}`),
        ).toHaveLength(1);
    expect(drawn.every(({ y }) => y >= 60 && y <= 750)).toBe(true);
    expect(drawn.some(({ text }) => text === "(MORE)")).toBe(true);
    expect(drawn.some(({ text }) => text === "MARA (CONT'D)")).toBe(true);
    expect(result.pageCount).toBeGreaterThan(result.scriptPageCount + 1);
    await mkdir("tmp/pdfs", { recursive: true });
    await writeFile("tmp/pdfs/presentation-overflow.pdf", result.bytes);
  });
});

describe("page progress from the generated PDF layout", () => {
  it.each([
    [1, 0.125],
    [7, 0.25],
    [14, 0.375],
    [21, 0.5],
    [28, 0.625],
    [35, 0.75],
    [42, 0.875],
    [49, 1],
    [55, 1],
    [56, 1.125],
  ])("rounds %i actual body rows up to %s pages", async (rows, expected) => {
    const doc = emptyScreenplay();
    doc.blocks[0].text = Array.from(
      { length: rows },
      (_, index) => `Row ${index + 1}.`,
    ).join("\n");
    const result = await exportPdf(doc, { fontBytes });
    expect(result.pageEquivalent).toBe(expected);
    expect(result.pageCount).toBe(rows > 55 ? 2 : 1);
  });

  it("does not count a page number, empty body, or trailing empty rows as writing", async () => {
    const doc = emptyScreenplay();
    expect(await exportPdf(doc, { fontBytes })).toMatchObject({
      pageCount: 1,
      pageEquivalent: 0,
    });
    doc.titlePage.title = "A cover page";
    expect(await exportPdf(doc, { fontBytes })).toMatchObject({
      pageCount: 2,
      pageEquivalent: 1,
    });
    doc.blocks[0].text = `Only one written row.${"\n".repeat(20)}`;
    expect(await exportPdf(doc, { fontBytes })).toMatchObject({
      pageCount: 2,
      pageEquivalent: 1.125,
    });
  });

  it("counts pages completed by explicit breaks as whole pages, even when the last page is empty", async () => {
    const doc = emptyScreenplay();
    doc.blocks = [
      { id: newId(), kind: "action", text: "First page." },
      { id: newId(), kind: "pageBreak", text: "" },
    ];
    expect(await exportPdf(doc, { fontBytes })).toMatchObject({
      pageCount: 2,
      pageEquivalent: 1,
    });
    doc.blocks.push({ id: newId(), kind: "action", text: "Second page." });
    expect(await exportPdf(doc, { fontBytes })).toMatchObject({
      pageCount: 2,
      pageEquivalent: 1.125,
    });
  });

  it.each([false, true])(
    "measures the final continued dialogue page once, including dual=%s",
    async (dual) => {
      const doc = emptyScreenplay();
      doc.titlePage.title = "A cover";
      doc.blocks = [
        { id: newId(), kind: "character", text: "MARA" },
        {
          id: newId(),
          kind: "dialogue",
          text: Array.from({ length: 70 }, (_, index) => `Word ${index}.`).join(
            "\n",
          ),
        },
        ...(dual
          ? [
              {
                id: newId(),
                kind: "character" as const,
                text: "ELI",
                dual: true,
              },
              {
                id: newId(),
                kind: "dialogue" as const,
                text: Array.from(
                  { length: 20 },
                  (_, index) => `Reply ${index}.`,
                ).join("\n"),
              },
            ]
          : []),
      ];
      const drawing = observeDrawing();
      const result = await exportPdf(doc, { fontBytes });
      expect(result).toMatchObject({
        pageCount: 3,
        scriptPageCount: 2,
        pageEquivalent: 2.375,
      });
      expect(drawing().some(({ text }) => text === "MARA (CONT'D)")).toBe(true);
    },
  );

  it("uses the same generated 55-line frame on A4 paper", async () => {
    const doc = emptyScreenplay();
    doc.blocks[0].text = Array.from(
      { length: 21 },
      (_, index) => `Row ${index}.`,
    ).join("\n");
    expect(await exportPdf(doc, { fontBytes, pageSize: "a4" })).toMatchObject({
      pageCount: 1,
      pageEquivalent: 0.5,
    });
  });

  it.each([
    [0, "0"],
    [0.125, "⅛"],
    [0.25, "¼"],
    [0.375, "⅜"],
    [0.5, "½"],
    [0.625, "⅝"],
    [0.75, "¾"],
    [0.875, "⅞"],
    [1, "1"],
    [1.125, "1⅛"],
    [12.5, "12½"],
    [NaN, "0"],
    [-1, "0"],
  ])("formats %s pages as %s", (value, expected) => {
    expect(formatPageCount(value as number)).toBe(expected);
  });
});

describe("character-highlighted PDFs", () => {
  it("highlights only chosen cues, including dual dialogue and continued cues, without changing pagination", async () => {
    const doc = parseFountain(
      `Title: Two Voices\nAuthor: A Writer\n\nINT. STUDIO - NIGHT\n\nMARA\nHello, ELI.\n\nELI ^\nHello, MARA.\n\n!MARA and ELI cross the room.\n\nJUNE\nI am not highlighted.\n\nMARA (V.O.)\n${"This speech continues across the next page. ".repeat(170)}`,
    );
    const plain = await exportPdf(doc, { fontBytes });
    const rectangle = vi.spyOn(PDFPage.prototype, "drawRectangle");
    const drawing = observeDrawing();
    const highlighted = await exportPdf(doc, {
      fontBytes,
      highlightCharacters: ["MARA", "ELI"],
    });
    expect(highlighted.pageCount).toBe(plain.pageCount);
    expect(highlighted.pageEquivalent).toBe(plain.pageEquivalent);
    const cues = drawing().filter(({ text }) =>
      /^(MARA|ELI)(?: \(|$)/.test(text),
    );
    expect(cues.some(({ text }) => text.includes("CONT'D"))).toBe(true);
    expect(rectangle.mock.calls).toHaveLength(cues.length);
    expect(
      new Set(
        rectangle.mock.calls.map(([options]) => JSON.stringify(options!.color)),
      ).size,
    ).toBe(2);
    for (const [index, cue] of cues.entries()) {
      const box = rectangle.mock.calls[index][0]!;
      expect(box.x).toBeCloseTo(cue.x - 2);
      expect(box.y).toBeLessThan(cue.y);
      expect(box.y! + box.height!).toBeGreaterThan(cue.y + 8);
      expect(rectangle.mock.contexts[index]).toBe(cue.page);
    }
    await mkdir("tmp/pdf-qa", { recursive: true });
    await writeFile("tmp/pdf-qa/highlighted.pdf", highlighted.bytes);
  });
  it("preserves character highlight colors through canonical-to-mobile conversion", async () => {
    const doc = parseFountain(
      `INT. ROOM - DAY\n\nMARA\nHello.\n\nELI ^\nHi.\n\nJUNE\nUnselected.\n\nMARA (V.O.)\n${"A long speech continues. ".repeat(250)}`,
    );
    const options = { fontBytes, highlightCharacters: ["MARA", "ELI"] };
    const canonical = await exportPdf(doc, options);
    const rectangles = vi.spyOn(PDFPage.prototype, "drawRectangle");
    const mobile = await exportPdf(doc, { ...options, mobileLayout: true });
    expect(await pdfPageContentSignatures(mobile.bytes)).toEqual(
      await pdfPageContentSignatures(canonical.bytes),
    );
    const mobileCalls = rectangles.mock.calls.flatMap(([box], i) =>
      (rectangles.mock.contexts[i] as PDFPage).getWidth() === 336 ? [box!] : [],
    );
    const canonicalCalls = rectangles.mock.calls.flatMap(([box], i) =>
      (rectangles.mock.contexts[i] as PDFPage).getWidth() !== 336 ? [box!] : [],
    );
    expect(mobileCalls.length).toBeGreaterThan(2);
    expect(mobileCalls.map((box) => box.color)).toEqual(
      canonicalCalls.map((box) => box.color),
    );
    const pdf = await PDFDocument.load(mobile.bytes);
    const records = pdf
      .getPages()
      .flatMap((page) =>
        JSON.parse(
          (page.node.get(PDFName.of("FPPageLayout")) as any).decodeText(),
        ),
      );
    expect(
      records
        .filter((record) => record.highlight)
        .every((record) =>
          /^(MARA|ELI)/.test(
            record.spans.map((span: any) => span.text).join(""),
          ),
        ),
    ).toBe(true);
  });
  it("keeps margin scene numbers inline and scales screenplay indents from canonical geometry on mobile", async () => {
    const document = parseFountain(
      `INT. AN EXTREMELY LONG OBSERVATORY CORRIDOR WITH WINDOWS - NIGHT #42#\n\nA VERY LONG CHARACTER NAME FOR MOBILE LAYOUT (V.O.)\nThis line verifies the dialogue measure too.`,
    );
    const drawing = observeDrawing();
    const rectangles = vi.spyOn(PDFPage.prototype, "drawRectangle");
    const options = {
      fontBytes,
      highlightCharacters: ["A VERY LONG CHARACTER NAME FOR MOBILE LAYOUT"],
    };
    const canonical = await exportPdf(document, options);
    const result = await exportPdf(document, {
      ...options,
      mobileLayout: true,
    });
    expect(await pdfPageContentSignatures(result.bytes)).toEqual(
      await pdfPageContentSignatures(canonical.bytes),
    );
    const mobileRows = drawing().filter(
      ({ page }) => (page as PDFPage).getWidth() === 336,
    );
    const number = mobileRows.find(({ text }) => text === "42  ")!;
    const heading = mobileRows.find(({ text }) =>
      text.startsWith("INT. AN EXTREMELY"),
    )!;
    expect(number).toBeDefined();
    expect(heading).toBeDefined();
    expect(number.y).toBe(heading.y);
    expect(number.x).toBe(20);
    expect(heading.x).toBeGreaterThan(number.x);

    const cueRows = mobileRows.filter(({ text }) =>
      /^(A VERY|LONG|CHARACTER|NAME|FOR|MOBILE|LAYOUT)/.test(text),
    );
    expect(cueRows.length).toBeGreaterThan(1);
    const expectedCueX = 20 + (296 * 19) / 61;
    for (const cue of cueRows) expect(cue.x).toBeCloseTo(expectedCueX);

    const mobileHighlightBoxes = rectangles.mock.calls.flatMap(([box], i) =>
      (rectangles.mock.contexts[i] as PDFPage).getWidth() === 336 ? [box!] : [],
    );
    expect(mobileHighlightBoxes).toHaveLength(cueRows.length);
    for (const box of mobileHighlightBoxes)
      expect(box.x).toBeCloseTo(expectedCueX - 2);

    const pdf = await PDFDocument.load(result.bytes);
    const records = pdf.getPages().flatMap((page) =>
      JSON.parse(
        (
          page.node.get(PDFName.of("FPPageLayout")) as unknown as {
            decodeText: () => string;
          }
        ).decodeText(),
      ),
    ) as Array<{
      sourceId?: string;
      sourceKind?: string;
      sourceRole?: string;
      baselineY?: number;
      spans: Array<{ text: string }>;
    }>;
    const sceneRecords = records.filter(
      ({ sourceKind }) => sourceKind === "scene",
    );
    expect(sceneRecords.some(({ sourceRole }) => sourceRole === "sceneNumber"))
      .toBe(false);
    expect(
      sceneRecords[0].spans.map(({ text }) => text).join(""),
    ).toContain("42  INT. AN EXTREMELY");
    await mkdir("tmp/pdf-qa", { recursive: true });
    await Promise.all([
      writeFile("tmp/pdf-qa/mobile-layout-standard.pdf", canonical.bytes),
      writeFile("tmp/pdf-qa/mobile-layout-mobile.pdf", result.bytes),
    ]);
  });
  it("keeps exact canonical page content on the corresponding mobile page while reflowing to narrow variable-height pages", async () => {
    const document = emptyScreenplay();
    // One source block crosses the canonical page boundary. This catches the
    // failure mode where a mobile reflow silently pulls text from page 2 back
    // onto page 1 (or pushes page-1 text forward).
    document.blocks[0].text = "X".repeat(61 * 56);

    const canonical = await exportPdf(document, { fontBytes });
    const mobile = await exportPdf(document, {
      fontBytes,
      mobileLayout: true,
    });

    expect(mobile.pageCount).toBe(canonical.pageCount);
    expect(mobile.scriptPageCount).toBe(canonical.scriptPageCount);
    expect(await pdfPageContentSignatures(mobile.bytes)).toEqual(
      await pdfPageContentSignatures(canonical.bytes),
    );

    const canonicalPdf = await PDFDocument.load(canonical.bytes);
    const mobilePdf = await PDFDocument.load(mobile.bytes);
    expect(mobilePdf.getPageCount()).toBe(canonicalPdf.getPageCount());

    const canonicalWidths = canonicalPdf
      .getPages()
      .map((page) => page.getWidth());
    const mobilePages = mobilePdf.getPages();
    expect(
      mobilePages.every(
        (page, index) => page.getWidth() < canonicalWidths[index],
      ),
    ).toBe(true);

    // The first canonical page owns 55 rows while the second owns one. Mobile
    // pages therefore remain one-to-one but are independently height-fitted.
    expect(mobilePages[0].getHeight()).toBeGreaterThan(
      mobilePages[1].getHeight(),
    );
    expect(new Set(mobilePages.map((page) => page.getHeight())).size).toBe(2);

    // Tightness is part of the format contract, not a visual guess. The
    // converter lays out first, then sizes the physical PDF page around those
    // baselines with exactly 24pt top and bottom layout borders.
    for (const page of mobilePages) {
      const raw = page.node.get(PDFName.of("FPPageLayout")) as
        { decodeText?: () => string } | undefined;
      expect(raw?.decodeText).toBeTypeOf("function");
      const records = JSON.parse(raw!.decodeText!()) as Array<{
        baselineY?: number;
      }>;
      const baselines = records
        .map((record) => record.baselineY)
        .filter((value): value is number => typeof value === "number");
      expect(baselines.length).toBeGreaterThan(0);
      expect(Math.min(...baselines)).toBeCloseTo(24);
      expect(Math.max(...baselines) + 12).toBeCloseTo(page.getHeight() - 24);
    }
  });
});
