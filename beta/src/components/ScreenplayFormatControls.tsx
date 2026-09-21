import { Bold, Italic, Underline } from "lucide-react";
import { useEffect, useState } from "react";
import { blockLabels } from "../core/model";
import type { BlockKind, TextMark } from "../core/model";

export interface ScreenplayFormatProps {
  kind: BlockKind;
  dualDialogue: boolean;
  onKind: (kind: BlockKind, dual?: boolean) => boolean | void;
  onMark: (mark: TextMark) => void;
  compact?: boolean;
}

export function ScreenplayFormatControls({
  kind, dualDialogue, onKind, onMark, compact = false,
}: ScreenplayFormatProps) {
  const [message, setMessage] = useState("");
  useEffect(() => setMessage(""), [kind, dualDialogue]);
  const speech = ["character", "dialogue", "parenthetical", "lyrics"].includes(kind);
  return (
    <div
      className={compact ? "mobile-format-controls" : "writing-control-group writing-format-group"}
      role="group"
      aria-label="Text formatting"
    >
      <select
        className="writing-element"
        aria-label="Screenplay element"
        title="Screenplay element; dual dialogue pairs adjacent speeches"
        value={dualDialogue ? "dual-dialogue" : kind}
        onChange={(event) => {
          const value = event.target.value;
          const result = value === "dual-dialogue"
            ? onKind(kind, true)
            : onKind(value === "single-dialogue" ? kind : value as BlockKind, false);
          setMessage(result === false
            ? "Choose a character or its dialogue next to another speech. Dual dialogue cannot cross action or a scene heading."
            : "");
        }}
      >
        {Object.entries(blockLabels).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
        <option value="dual-dialogue" disabled={!speech && !dualDialogue}>Dual dialogue</option>
        {dualDialogue && <option value="single-dialogue">Remove dual dialogue</option>}
      </select>
      {!compact && <span className="writing-group-rule" aria-hidden="true" />}
      {([
        ["bold", Bold], ["italic", Italic], ["underline", Underline],
      ] as const).map(([mark, Icon]) => (
        <button
          type="button"
          className="writing-tool"
          key={mark}
          aria-label={mark[0].toUpperCase() + mark.slice(1)}
          title={mark[0].toUpperCase() + mark.slice(1)}
          aria-keyshortcuts={`Control+${mark[0].toUpperCase()} Meta+${mark[0].toUpperCase()}`}
          onPointerDown={(event) => event.preventDefault()}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onMark(mark)}
        >
          <Icon size={compact ? 17 : 15} aria-hidden="true" />
        </button>
      ))}
      {message && <span className="formatting-message" role="status">{message}</span>}
    </div>
  );
}
