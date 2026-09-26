import { useState } from "react";
import { Modal } from "./Modal";
import type { NovelExportFormat } from "../core/novelExport";
export function NovelExportDialog({
  busy,
  onClose,
  onExport,
}: {
  busy: boolean;
  onClose: () => void;
  onExport: (format: NovelExportFormat) => void;
}) {
  const [format, setFormat] = useState<NovelExportFormat>("pdf");
  return (
    <Modal title="Export book" onClose={onClose}>
      <label className="field">
        Export format
        <select
          value={format}
          disabled={busy}
          onChange={(e) => setFormat(e.target.value as NovelExportFormat)}
        >
          <option value="pdf">PDF · Reading and print</option>
          <option value="docx">Word (.docx) · Word and Scrivener</option>
          <option value="epub">EPUB · Ebook</option>
          <option value="rtf">Rich Text Format (.rtf)</option>
        </select>
      </label>
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
      <button
        className="primary"
        disabled={busy}
        onClick={() => onExport(format)}
      >
        {busy ? "Preparing export…" : "Export"}
      </button>
    </Modal>
  );
}
