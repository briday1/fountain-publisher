import { Bold, Italic, Underline } from "lucide-react";
import { blockLabels } from "../core/model";
import type { BlockKind, TextMark } from "../core/model";

export interface FormatControlsProps {
  kind: BlockKind;
  dualDialogue: boolean;
  onKind: (kind: BlockKind, dual?: boolean) => void;
  onMark: (mark: TextMark) => void;
}

/** The same formatting actions in the desktop toolbar and the always-visible mobile header. */
export function FormatControls({ kind, dualDialogue, onKind, onMark }: FormatControlsProps) {
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
    </div>
  );
}
