import { nextBookHeading } from "../src/core/book";
import { expect, it, beforeAll } from "vitest";
import {
  parseMarkdown,
  serializeMarkdown,
  createNovel,
} from "../src/core/markdown";
import {
  serializeDocument,
  documentFilename,
} from "../src/core/documentFormat";
import { importScreenplay } from "../src/core/fdx";
import {
  novelDocx,
  novelEpub,
  novelRtf,
  novelPdf,
} from "../src/core/novelExport";
import { unzipSync, strFromU8 } from "fflate";
import { EditorController } from "../src/editor/EditorController";
import { TextSelection } from "prosemirror-state";
import { sceneBeatRange } from "../src/core/beatRanges";
const source =
  "# The Last Light\n\n## Chapter One\n\nMara has **bold hopes** and *quiet doubts*.\n\n> A letter, read aloud.\n\n> *We find our way together.*\n\n> — June\n\n---\n\n### A turn\n\nINT. ROOM - NIGHT\n\nMARA\n\nThis is still prose.\n";
beforeAll(() => {
  Range.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 10, 20);
  Range.prototype.getClientRects = () =>
    [new DOMRect(0, 0, 10, 20)] as unknown as DOMRectList;
  HTMLElement.prototype.scrollIntoView = () => {};
  window.scrollBy = () => {};
});
it("opens Markdown without screenplay reinterpretation and round-trips structure, styles and planning", () => {
  const doc = importScreenplay(source, "Book.md").screenplay;
  expect(doc.metadata.format).toBe("markdown");
  expect(
    doc.blocks.some((b) => b.kind === "scene" || b.kind === "character"),
  ).toBe(false);
  expect(doc.blocks.map((b) => b.kind)).toContain("centered");
  expect(doc.blocks.map((b) => b.kind)).toContain("parenthetical");
  doc.metadata.beats = [
    {
      id: "b",
      title: "A choice",
      description: "Keep me",
      act: "Act I",
      color: "#123456",
      groupSceneId: doc.blocks[1].id,
    },
  ];
  doc.metadata.proseCharacters = [
    { id: "m", name: "Mara", description: "Keeps the light" },
  ];
  const loaded = parseMarkdown(serializeDocument(doc));
  expect(loaded.blocks).toEqual(doc.blocks);
  expect(loaded.metadata.beats).toEqual(doc.metadata.beats);
  expect(loaded.metadata.proseCharacters).toEqual(doc.metadata.proseCharacters);
  expect(sceneBeatRange(loaded, loaded.blocks[1].id)).toBeTruthy();
});
it("preserves unsupported Markdown and HTML as literal source", () => {
  const source =
    "- One\n- Two\n\n```js\nconst x = 1;\n```\n\n[Read](https://example.com)\n\n<script>alert(1)</script>";
  const doc = parseMarkdown(source);
  const saved = serializeMarkdown(doc);
  for (const text of [
    "- One\n- Two",
    "```js\nconst x = 1;\n```",
    "[Read](https://example.com)",
    "<script>alert(1)</script>",
  ])
    expect(saved).toContain(text);
  expect(parseMarkdown(saved).blocks.map((b) => b.text)).toEqual(
    doc.blocks.map((b) => b.text),
  );
});
it("keeps underline and literal paragraph prefixes", () => {
  const doc = createNovel();
  doc.blocks = [
    { id: "a", kind: "action", text: "1. Literal list prefix" },
    {
      id: "b",
      kind: "action",
      text: "Underline",
      spans: [{ text: "Underline", marks: ["underline"] }],
    },
  ];
  const loaded = parseMarkdown(serializeMarkdown(doc));
  expect(loaded.blocks.map((b) => b.text)).toEqual(
    doc.blocks.map((b) => b.text),
  );
  expect(loaded.blocks[1].spans?.[0].marks).toContain("underline");
});
it("Novel Enter does not auto-convert prose", () => {
  const doc = parseMarkdown("INT. ROOM - NIGHT");
  const host = document.createElement("div");
  document.body.append(host);
  const editor = new EditorController(host, doc);
  try {
    const view = editor.view;
    view.dispatch(
      view.state.tr.setSelection(
        TextSelection.create(view.state.doc, view.state.doc.content.size - 1),
      ),
    );
    view.someProp("handleKeyDown", (fn) =>
      fn(view, new KeyboardEvent("keydown", { key: "Enter" })),
    );
    expect(editor.getBlocks().map((b) => b.kind)).toEqual(["action", "action"]);
    view.dispatch(view.state.tr.insertText("MARA"));
    expect(editor.getBlocks()[1].kind).toBe("action");
    expect(view.dom.getAttribute("aria-label")).toBe("Book editor");
  } finally {
    editor.destroy();
    host.remove();
  }
});
it("DOCX preserves semantic headings, marks and text in well-formed package XML", () => {
  const files = unzipSync(novelDocx(parseMarkdown(source)));
  const body = strFromU8(files["word/document.xml"]),
    styles = strFromU8(files["word/styles.xml"]);
  expect(body).toContain("Heading2");
  expect(body).toContain("<w:b/>");
  expect(body).toContain("<w:i/>");
  expect(body).toContain("This is still prose.");
  expect(styles).toContain("w:outlineLvl");
  expect(strFromU8(files["_rels/.rels"])).toContain("word/document.xml");
  for (const [name, bytes] of Object.entries(files))
    if (name.endsWith(".xml") || name.endsWith(".rels"))
      expect(
        new DOMParser()
          .parseFromString(strFromU8(bytes), "application/xml")
          .querySelector("parsererror"),
      ).toBeNull();
});
it("EPUB stores mimetype first and links every chapter/heading in navigation", () => {
  const bytes = novelEpub(parseMarkdown(source)),
    files = unzipSync(bytes);
  expect(new DataView(bytes.buffer, bytes.byteOffset).getUint16(8, true)).toBe(
    0,
  );
  expect(strFromU8(bytes.slice(30, 38))).toBe("mimetype");
  expect(strFromU8(files.mimetype)).toBe("application/epub+zip");
  const nav = new DOMParser().parseFromString(
      strFromU8(files["EPUB/nav.xhtml"]),
      "application/xml",
    ),
    body = new DOMParser().parseFromString(
      strFromU8(files["EPUB/book.xhtml"]),
      "application/xml",
    );
  expect(nav.querySelector("parsererror")).toBeNull();
  expect(body.querySelector("parsererror")).toBeNull();
  for (const link of nav.querySelectorAll("a"))
    expect(
      body.getElementById(link.getAttribute("href")!.split("#")[1]),
    ).not.toBeNull();
  expect(nav.querySelectorAll("a")).toHaveLength(3);
});
it("RTF escapes special characters and Unicode", () => {
  const doc = createNovel();
  doc.blocks = [{ id: "u", kind: "action", text: "{A} \\ café 😀" }];
  const rtf = novelRtf(doc);
  expect(rtf).toContain("\\{A\\}");
  expect(rtf).toContain("\\\\");
  expect(rtf).toContain("\\u233?");
  expect(rtf).toContain("\\u-10179?\\u-8704?");
});
it("PDF produces prose pages", async () => {
  const result = await novelPdf(parseMarkdown(source));
  expect(strFromU8(result.bytes.slice(0, 4))).toBe("%PDF");
  expect(result.pageCount).toBeGreaterThan(0);
  expect(result.warnings).toEqual([]);
});

it("retains heading references after empty paragraphs and keeps filename format", () => {
  const doc = parseMarkdown("# Book 1\n\n## Chapter 1\n\nOpening.");
  doc.blocks.splice(1, 0, { id: "blank", kind: "action", text: "" });
  const chapter = doc.blocks[2].id;
  expect(
    parseMarkdown(serializeDocument(doc)).blocks.find(
      (b) => b.text === "Chapter 1",
    )?.id,
  ).toBe(chapter);
  expect(documentFilename("Book.fountain", "Draft.md")).toBe("Book.md");
  expect(documentFilename("Script.md", "Draft.fountain")).toBe(
    "Script.fountain",
  );
});

it("starts books empty and preserves title, author and dedication through saving and exports", async () => {
  const doc = createNovel();
  expect(doc.blocks.map((b) => b.text).join("")).toBe("");
  expect(doc.titlePage.title).toBe("");
  doc.titlePage.title = "The Coast";
  doc.titlePage.author = "Alex Morgan";
  doc.titlePage.extra = { Dedication: "For the keepers." };
  doc.blocks = [
    { id: "chapter", kind: "section", level: 2, text: "Chapter 1" },
    { id: "body", kind: "action", text: "Opening words." },
  ];
  const loaded = parseMarkdown(serializeMarkdown(doc));
  expect(loaded.titlePage).toEqual(doc.titlePage);
  const word = strFromU8(unzipSync(novelDocx(loaded))["word/document.xml"]);
  const epub = strFromU8(unzipSync(novelEpub(loaded))["EPUB/book.xhtml"]);
  const rtf = novelRtf(loaded);
  for (const text of [word, epub, rtf])
    for (const value of ["The Coast", "Alex Morgan", "For the keepers."])
      expect(text).toContain(value);
  expect(word.indexOf("For the keepers.")).toBeLessThan(
    word.indexOf("Chapter 1"),
  );
  expect((await novelPdf(loaded)).pageCount).toBeGreaterThanOrEqual(3);
});

it("numbers new books and chapters independently without overwriting custom titles", () => {
  const doc = parseMarkdown(
    "# Book 2 — The Coast\n\n## Chapter 4 — Home\n\n## Interlude\n\nOpening.",
  );
  expect(nextBookHeading(doc, 1)).toBe("Book 3");
  expect(nextBookHeading(doc, 2)).toBe("Chapter 5");
  expect(nextBookHeading(createNovel(), 2)).toBe("Chapter 1");
});

it("numbers consecutive insertions from current editor contents before the UI snapshot refreshes", () => {
  const initial = createNovel();
  const mount = document.createElement("div");
  document.body.append(mount);
  const editor = new EditorController(mount, initial, {});
  editor.insertBookHeading(2);
  editor.insertBookHeading(2);
  editor.insertBookHeading(1);
  editor.insertBookHeading(2);
  editor.insertBookHeading(1);
  expect(
    editor
      .getBlocks()
      .filter((b) => b.kind === "section")
      .map((b) => b.text),
  ).toEqual(["Chapter 1", "Chapter 2", "Book 1", "Chapter 3", "Book 2"]);
  expect(initial.blocks.map((b) => b.text)).toEqual([""]);
  editor.destroy();
  mount.remove();
});
