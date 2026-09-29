import { proseLabels } from "../core/markdown";
import { Bold, Italic, Underline, ChevronsUpDown } from "lucide-react";
import { Menu } from "./Menu";
import { blockLabels } from "../core/model";
import type { BlockKind, TextMark } from "../core/model";

export interface FormatControlsProps {
  novel?: boolean;
  appMenu?: boolean;
  onHeading?: (level: number) => void;
  kind: BlockKind;
  dualDialogue: boolean;
  onKind: (kind: BlockKind, dual?: boolean) => void;
  onMark: (mark: TextMark) => void;
}

/** The same formatting actions in the desktop toolbar and the always-visible mobile header. */
export function FormatControls({
  novel = false,
  appMenu = false,
  onHeading,
  kind,
  dualDialogue,
  onKind,
  onMark,
}: FormatControlsProps) {
  const selected = dualDialogue ? "dual-dialogue" : kind;
  const label = novel ? "Prose element" : "Screenplay element";
  const options = [
    ...Object.entries(novel ? proseLabels : blockLabels),
    ...(novel
      ? [1, 2, 3, 4, 5, 6].map((level) => [
          `heading-${level}`,
          level === 1
            ? "Book / part heading"
            : level === 2
              ? "Chapter heading (level 2)"
              : `Section heading (level ${level})`,
        ])
      : [["dual-dialogue", "Dual dialogue"]]),
    ...(dualDialogue ? [["single-dialogue", "Single dialogue"]] : []),
  ];
  const choose = (value: string) => {
    if (value.startsWith("heading-")) onHeading?.(Number(value.slice(8)));
    else if (value === "dual-dialogue") onKind("character", true);
    else if (value === "single-dialogue") onKind(kind, false);
    else onKind(value as BlockKind, false);
  };
  return (
    <div
      className="writing-control-group writing-format-group"
      role="group"
      aria-label="Text formatting"
    >
      {appMenu ? (
        <div
          className="writing-element-hit writing-element-menu"
          onPointerDown={(event) => {
            // Keep the editor selection and software keyboard while choosing a part.
            if (event.button === 0) event.preventDefault();
          }}
        >
          <Menu
            label={label}
            anchored
            restoreFocusOnSelect={false}
            triggerContent={
              <>
                <span>
                  {options.find(([value]) => value === selected)?.[1] ??
                    "Action"}
                </span>
                <ChevronsUpDown size={14} aria-hidden="true" />
              </>
            }
          >
            {options.map(([value, text]) => (
              <button
                key={value}
                aria-pressed={selected === value}
                onClick={() => choose(value)}
              >
                {text}
              </button>
            ))}
          </Menu>
        </div>
      ) : (
        <label className="writing-element-hit">
          <select
            className="writing-element"
            aria-label={label}
            title={label}
            value={selected}
            onChange={(event) => choose(event.target.value)}
          >
            {options.map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
        </label>
      )}
      <span className="writing-group-rule" aria-hidden="true" />
      {(
        [
          ["bold", Bold],
          ["italic", Italic],
          ["underline", Underline],
        ] as const
      ).map(([mark, Icon]) => (
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
