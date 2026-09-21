import { Bold, Italic, MessageSquarePlus, Redo2, Underline, Undo2 } from "lucide-react";
import { blockLabels } from "../core/model";
import type { BlockKind, TextMark } from "../core/model";

export interface FormatControlsProps {
  kind: BlockKind;
  dualDialogue: boolean;
  onKind: (kind: BlockKind, dual?: boolean) => void;
  onMark: (mark: TextMark) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onAnnotation?: () => void;
  annotationEnabled?: boolean;
}

/** The same formatting actions in the desktop toolbar and the always-visible mobile header. */
export function FormatControls({
  kind,
  dualDialogue,
  onKind,
  onMark,
  onUndo,
  onRedo,
  onAnnotation,
  annotationEnabled = false,
}: FormatControlsProps) {
  return (
    <div
      className="writing-control-group writing-format-group"
      role="group"
      aria-label="Text formatting"
    >
      <select
        className="writing-element"
        aria-label="Screenplay element"
        title="Screenplay element"
        value={dualDialogue ? "dual-dialogue" : kind}
        onChange={(event) => {
          const value = event.target.value;
          if (value === "dual-dialogue") onKind("character", true);
          else if (value === "single-dialogue") onKind(kind, false);
          else onKind(value as BlockKind, false);
        }}
      >
        {Object.entries(blockLabels).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
        <option value="dual-dialogue">Dual dialogue</option>
        {dualDialogue && <option value="single-dialogue">Single dialogue</option>}
      </select>
      <span className="writing-group-rule" aria-hidden="true" />
      {([["bold", Bold], ["italic", Italic], ["underline", Underline]] as const).map(([mark, Icon]) => (
        <button
          type="button"
          className="writing-tool"
          key={mark}
          aria-label={mark[0].toUpperCase() + mark.slice(1)}
          title={mark[0].toUpperCase() + mark.slice(1)}
          aria-keyshortcuts={`Control+${mark[0].toUpperCase()} Meta+${mark[0].toUpperCase()}`}
          onPointerDown={(event) => {
            if (event.button === 0) event.preventDefault();
          }}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onMark(mark)}
        >
          <Icon size={16} aria-hidden="true" />
        </button>
      ))}
      {onUndo && (
        <button
          type="button"
          className="writing-tool"
          aria-label="Undo"
          title="Undo"
          aria-keyshortcuts="Control+Z Meta+Z"
          onPointerDown={(event) => {
            if (event.button === 0) event.preventDefault();
          }}
          onMouseDown={(event) => event.preventDefault()}
          onClick={onUndo}
        >
          <Undo2 size={16} aria-hidden="true" />
        </button>
      )}
      {onRedo && (
        <button
          type="button"
          className="writing-tool"
          aria-label="Redo"
          title="Redo"
          aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z"
          onPointerDown={(event) => {
            if (event.button === 0) event.preventDefault();
          }}
          onMouseDown={(event) => event.preventDefault()}
          onClick={onRedo}
        >
          <Redo2 size={16} aria-hidden="true" />
        </button>
      )}
      {onAnnotation && (
        <button
          type="button"
          className="writing-tool"
          aria-label="Add annotation"
          title="Add annotation"
          disabled={!annotationEnabled}
          onPointerDown={(event) => {
            if (event.button === 0) event.preventDefault();
          }}
          onMouseDown={(event) => event.preventDefault()}
          onClick={onAnnotation}
        >
          <MessageSquarePlus size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
