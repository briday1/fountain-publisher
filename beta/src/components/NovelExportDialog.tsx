import { ExportFontOption } from "./ExportFontOption";
import type { WritingFont, FontBytes } from "../core/writingFonts";
import { useState } from "react";
import { Modal } from "./Modal";
import type {
  NovelExportFormat,
  NovelExportOptions,
  NovelPageSize,
  NovelPdfStyle,
} from "../core/novelExport";
export function NovelExportDialog({
  busy,
  font = "georgia",
  onClose,
  onExport,
}: {
  busy: boolean;
  font?: WritingFont;
  onClose: () => void;
  onExport: (
    format: NovelExportFormat,
    keepFont: boolean,
    fonts?: FontBytes,
    options?: NovelExportOptions,
  ) => void;
}) {
  const [format, setFormat] = useState<NovelExportFormat>("pdf");
  const [keepFont, setKeepFont] = useState(false);
  const [fonts, setFonts] = useState<FontBytes>();
  const [pdfStyle, setPdfStyle] = useState<NovelPdfStyle>("book");
  const [bookSize, setBookSize] = useState<NovelPageSize>("6x9");
  const [manuscriptSize, setManuscriptSize] = useState<NovelPageSize>("letter");
  return (
    <Modal title="Export book" onClose={onClose}>
      <p>
        Book exports are text only in Basic and Premium. Images, illustrations
        and embedded media are not supported in any book export format.
      </p>
      <label className="field">
        Export format
        <select
          value={format}
          disabled={busy}
          onChange={(e) => setFormat(e.target.value as NovelExportFormat)}
        >
          <option value="pdf">PDF · Book or manuscript</option>
          <option value="docx">Word (.docx) · Word and Scrivener</option>
          <option value="epub">EPUB · Ebook</option>
          <option value="rtf">Rich Text Format (.rtf)</option>
        </select>
      </label>
      {format === "pdf" && (
        <>
          <label className="field">
            PDF style
            <select
              value={pdfStyle}
              disabled={busy}
              onChange={(e) => setPdfStyle(e.target.value as NovelPdfStyle)}
            >
              <option value="book">Book · Paperback layout</option>
              <option value="manuscript">
                Manuscript · Editing and submissions
              </option>
            </select>
          </label>
          <label className="field">
            Page size
            <select
              value={pdfStyle === "book" ? bookSize : manuscriptSize}
              disabled={busy}
              onChange={(e) =>
                (pdfStyle === "book" ? setBookSize : setManuscriptSize)(
                  e.target.value as NovelPageSize,
                )
              }
            >
              {pdfStyle === "book" ? (
                <>
                  <option value="6x9">6 × 9 in · Trade paperback</option>
                  <option value="5.5x8.5">5.5 × 8.5 in · Paperback</option>
                  <option value="5x8">5 × 8 in · Compact paperback</option>
                </>
              ) : (
                <>
                  <option value="letter">US Letter · 8.5 × 11 in</option>
                  <option value="a4">A4 · 210 × 297 mm</option>
                </>
              )}
            </select>
          </label>
          <p className="muted">
            {pdfStyle === "book"
              ? "Serif type, indented paragraphs, chapter openings, and mirrored margins with room for binding."
              : "12-point Courier, double spacing, 1-inch margins, and author/title/page headers. Check your recipient’s submission requirements."}
          </p>
        </>
      )}
      <p>
        Exports include the complete document. Keep saving as Markdown to
        continue editing in WriteShape.
      </p>
      {format === "docx" && (
        <p>
          Chapter headings use Word heading styles for navigation and
          Scrivener’s Import and Split.
        </p>
      )}
      {format === "epub" && (
        <p className="muted">
          Reflowable EPUB 3 with chapter navigation, indented paragraphs, and
          linked footnotes. Readers can adjust the text size and font.
        </p>
      )}
      <ExportFontOption
        font={font}
        checked={keepFont}
        onChange={setKeepFont}
        pdf={format === "pdf"}
        busy={busy}
        onFonts={setFonts}
      />
      <button
        className="primary"
        disabled={
          busy || (keepFont && format === "pdf" && font === "georgia" && !fonts)
        }
        onClick={() =>
          onExport(
            format,
            keepFont,
            fonts,
            format === "pdf"
              ? {
                  pdfStyle,
                  pageSize: pdfStyle === "book" ? bookSize : manuscriptSize,
                }
              : {},
          )
        }
      >
        {busy ? "Preparing export…" : "Export"}
      </button>
    </Modal>
  );
}
