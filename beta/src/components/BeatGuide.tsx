import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Pencil, X } from "lucide-react";
import type { Beat, BeatRange, Screenplay } from "../core/model";
import type { EditorController } from "../editor/EditorController";
import { resolveBeatRange, sceneBeatRange } from "../core/beatRanges";
import "./beat-guide.css";

function assignedRange(doc: Screenplay, beat: Beat): BeatRange | undefined {
  const range =
    beat.range === undefined && beat.sceneId
      ? sceneBeatRange(doc, beat.sceneId)
      : beat.range;
  return range && resolveBeatRange(doc, range) ? range : undefined;
}

/** A persistent writing prompt. It only changes on document snapshots or explicit guide actions. */
export function BeatGuide({
  doc,
  editor,
  onAssign,
  onRange,
  onEdit,
  onClose,
  targetBeatId,
}: {
  doc: Screenplay;
  editor: EditorController | null;
  onAssign: (beatId: string, range: BeatRange) => boolean;
  onRange: (range: BeatRange) => void;
  onEdit: () => void;
  onClose: () => void;
  targetBeatId?: string;
}) {
  const beats = doc.metadata.beats;
  const [activeId, setActiveId] = useState(
    () => (beats.find((beat) => !assignedRange(doc, beat)) ?? beats[0])?.id,
  );
  const [finished, setFinished] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!targetBeatId) return;
    setActiveId(targetBeatId);
    setFinished(false);
    setNotice("");
  }, [targetBeatId]);
  const index = Math.max(
    0,
    beats.findIndex((beat) => beat.id === activeId),
  );
  const beat = beats[index];

  const move = (offset: number) => {
    const next = beats[index + offset];
    if (!next) return;
    setActiveId(next.id);
    setFinished(false);
    setNotice("");
    const target = assignedRange(doc, next);
    if (target) onRange(target);
    else editor?.focus();
  };

  const assignAndNext = () => {
    const selection = editor?.selectedLines();
    if (!beat || !selection) {
      setNotice(
        "Place the cursor in a screenplay line, or select a passage to assign.",
      );
      return;
    }
    if (!onAssign(beat.id, selection)) return;
    const next = beats[index + 1];
    if (next) {
      setActiveId(next.id);
      setNotice("");
    } else {
      setFinished(true);
      setNotice(
        "Final beat assigned. You can revisit any beat with the arrows.",
      );
    }
    editor?.focus();
  };

  return (
    <section className="writing-beat-guide" aria-label="Writing beat guide">
      <div className="writing-beat-guide-row">
        {beat ? (
          <>
            <div
              className="writing-beat-prompt"
              aria-live="polite"
              aria-atomic="true"
            >
              <small>
                {index + 1}/{beats.length}
              </small>
              <strong>{finished ? "Final:" : "Next:"}</strong>
              <span
                title={
                  beat.description
                    ? `${beat.title}\n${beat.description}`
                    : beat.title
                }
              >
                {notice && !finished ? notice : beat.title || "Untitled beat"}
              </span>
            </div>
            <div className="writing-beat-actions">
              <button
                aria-label="Previous guide beat"
                title="Previous beat"
                disabled={index === 0}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => move(-1)}
              >
                <ArrowLeft size={14} />
              </button>
              <button
                onClick={onEdit}
                aria-label="Edit beat sheet"
                title="Edit beat sheet"
              >
                <Pencil size={13} />
              </button>
              <button
                className="writing-beat-assign"
                onMouseDown={(event) => event.preventDefault()}
                onClick={assignAndNext}
                title="Assign the selected screenplay lines to this beat, then advance"
              >
                Assign + Next
              </button>
              <button
                aria-label="Next guide beat"
                title="Next beat"
                disabled={index === beats.length - 1}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => move(1)}
              >
                <ArrowRight size={14} />
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="writing-beat-prompt">
              <strong>Beat Sheet</strong>
              <span>Add beats to guide your writing.</span>
            </div>
            <button onClick={onEdit}>Open Beat Sheet</button>
          </>
        )}
        <button
          className="writing-beat-close"
          aria-label="Hide writing beat guide"
          onClick={() => {
            onClose();
            editor?.focus();
          }}
        >
          <X size={16} />
        </button>
      </div>
      {notice && (
        <p className="writing-beat-notice" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
