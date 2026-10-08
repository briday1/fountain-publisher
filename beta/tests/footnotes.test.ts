import { beforeAll, expect, it } from "vitest";
import { mockBookExportFonts } from "./helpers/bookExportFonts";
import { TextSelection } from "prosemirror-state";
import { unzipSync, strFromU8 } from "fflate";
import { parseMarkdown, serializeMarkdown } from "../src/core/markdown";
import { encodeFootnote, footnoteRuns } from "../src/core/footnotes";
import {
  novelDocx,
  novelEpub,
  novelRtf,
  novelPdf,
} from "../src/core/novelExport";
import { EditorController } from "../src/editor/EditorController";
import type { AnnotationTarget } from "../src/editor/annotations";
import { versionDiff } from "../src/core/versionDiff";
beforeAll(() => {
  mockBookExportFonts();
  Range.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 10, 20);
  Range.prototype.getClientRects = () =>
    [new DOMRect(0, 0, 10, 20)] as unknown as DOMRectList;
  HTMLElement.prototype.scrollIntoView = () => {};
  window.scrollBy = () => {};
});
it("round-trips standard Markdown references, escaped note text, IDs and emphasis", () => {
  const doc = parseMarkdown(
    "A **bold** claim.[^source]\n\n[^source]: A source with \\[brackets\\], \\*stars\\* and \\\\ slash.",
  );
  const runs = footnoteRuns(doc.blocks[0]);
  expect(runs.find((s) => s.note)?.note?.text).toBe(
    "A source with [brackets], *stars* and \\ slash.",
  );
  expect(runs.some((s) => s.marks?.includes("bold"))).toBe(true);
  const source = serializeMarkdown(doc);
  expect(source).toContain("[^1]: A source");
  expect(parseMarkdown(source).blocks).toEqual(doc.blocks);
  const diff = versionDiff("A claim.", source, true);
  expect(
    diff
      .flatMap((b) => b.parts)
      .map((s) => s.text)
      .join(""),
  ).toContain("Footnote 1:");
});
it("inserts, edits, deletes and undoes a numbered inline note without exposing syntax", () => {
  const doc = parseMarkdown("A claim. Another claim.");
  let target: AnnotationTarget | undefined;
  const mount = document.createElement("div");
  document.body.append(mount);
  const editor = new EditorController(mount, doc, {
    onAnnotation: (t) => (target = t),
  });
  editor.view.dispatch(
    editor.view.state.tr.setSelection(
      TextSelection.create(editor.view.state.doc, 9),
    ),
  );
  editor.insertFootnote();
  editor.saveAnnotation(target!, "Source [one].");
  expect(mount.querySelector(".book-footnote-marker")?.textContent).toBe("1");
  expect(
    mount.querySelector(".footnote-source")?.getAttribute("aria-hidden"),
  ).toBe("true");
  (mount.querySelector(".book-footnote-marker") as HTMLButtonElement).click();
  // A concurrent edit before an open note must move its edit target too.
  editor.view.dispatch(editor.view.state.tr.insertText("New ", 1));
  editor.saveAnnotation(target!, "Revised source.");
  expect(editor.getBlocks()[0].text).toContain(
    "New A claim.^[Revised source.]",
  );
  (mount.querySelector(".book-footnote-marker") as HTMLButtonElement).click();
  editor.saveAnnotation(target!, null);
  expect(mount.querySelector(".book-footnote-marker")).toBeNull();
  editor.undo();
  expect(
    mount.querySelector(".book-footnote-marker")?.getAttribute("title"),
  ).toBe("Revised source.");
  const text = editor.getBlocks()[0].text;
  const start = text.indexOf("^[") + 1;
  const end = start + encodeFootnote("Revised source.").length;
  editor.view.dispatch(
    editor.view.state.tr.setSelection(
      TextSelection.create(editor.view.state.doc, end, end - 1),
    ),
  );
  expect(editor.view.state.selection.from).toBe(start);
  editor.view.dispatch(
    editor.view.state.tr.setSelection(
      TextSelection.create(editor.view.state.doc, end),
    ),
  );
  editor.view.dom.dispatchEvent(
    new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      inputType: "deleteContentBackward",
    }),
  );
  expect(editor.getBlocks()[0].text).not.toContain("^[");
  expect(editor.getBlocks()[0].text).toContain("New A claim.");
  editor.destroy();
  mount.remove();
});
it("exports native Word/RTF footnotes and accessible EPUB references with return links", () => {
  const doc = parseMarkdown("A claim. Another.");
  doc.blocks[0].text = `A claim.${encodeFootnote("First <source> & detail.")} Another.${encodeFootnote("Second source.")}`;
  const docx = unzipSync(novelDocx(doc));
  const body = strFromU8(docx["word/document.xml"]),
    notes = strFromU8(docx["word/footnotes.xml"]);
  expect(body).toContain('w:footnoteReference w:id="1"');
  expect(body).not.toContain("First");
  expect(notes).toContain("First &lt;source&gt; &amp; detail.");
  expect(notes).toContain('w:id="2"');
  expect(strFromU8(docx["word/_rels/document.xml.rels"])).toContain(
    'Target="footnotes.xml"',
  );
  const epub = strFromU8(unzipSync(novelEpub(doc))["EPUB/book.xhtml"]);
  expect(epub).toContain('epub:type="noteref"');
  expect(epub).toContain('epub:type="footnote"');
  expect(epub).toContain('href="#ref2"');
  const rtf = novelRtf(doc);
  expect(rtf.match(/\\footnote\\/g)).toHaveLength(2);
  expect(rtf).toContain("\\ftnbj");
  expect(rtf).not.toContain("^[");
});
it("paginates long footnotes without losing their text or overflowing the page", async () => {
  const doc = parseMarkdown("A claim.");
  doc.blocks[0].text += encodeFootnote(
    "A long supporting reference. ".repeat(1400) + "FINAL NOTE WORDS",
  );
  doc.blocks.push({
    id: "last",
    kind: "action",
    text: "Text after the reference.",
  });
  const result = await novelPdf(doc);
  expect(result.pageCount).toBeGreaterThan(3);
  expect(result.warnings).toEqual([]);
});
