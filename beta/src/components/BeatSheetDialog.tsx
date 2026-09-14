import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import type { BeatRange, Screenplay } from "../core/model";
import { BeatBoard } from "./BeatBoard";
import { useModalScrollLock } from "./useModalScrollLock";
import "./beat-sheet-dialog.css";

export function BeatSheetDialog({
  doc,
  onChange,
  onAssign,
  onRange,
  onExport,
  onExportCsv,
  onClose,
}: {
  doc: Screenplay;
  onChange: (doc: Screenplay) => void;
  onAssign: (beatId: string) => void;
  onRange: (range: BeatRange) => void;
  onExport: () => void;
  onExportCsv: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useModalScrollLock(ref);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="beat-sheet-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        // React forwards a nested dialog's cancel event through this tree.
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="beat-sheet-dialog-frame">
        <header className="beat-sheet-dialog-heading">
          <h2 id={titleId}>Beat sheet</h2>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={17} />
          </button>
        </header>
        <div className="beat-sheet-dialog-scroll">
          <BeatBoard
            doc={doc}
            onChange={onChange}
            onAssign={onAssign}
            onRange={onRange}
            onExport={onExport}
            onExportCsv={onExportCsv}
          />
        </div>
      </div>
    </dialog>
  );
}
