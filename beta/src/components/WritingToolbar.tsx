import {
  BarChart3,
  Bold,
  Columns3,
  Italic,
  Leaf,
  ListChecks,
  Maximize,
  Minimize,
  Minus,
  PanelLeft,
  Plus,
  Search,
  Settings2,
  Underline,
} from "lucide-react";
import type { KeyboardEvent } from "react";
import { blockLabels } from "../core/model";
import type { BlockKind, TextMark } from "../core/model";
import type { Preferences } from "./Settings";
import "./WritingToolbar.css";

export interface WritingToolbarProps {
  kind: BlockKind;
  onKind: (kind: BlockKind) => void;
  onMark: (mark: TextMark) => void;
  preferences: Preferences;
  onPreferences: (preferences: Preferences) => void;
  beatGuide: boolean;
  onBeatGuide: () => void;
  onBeatSheet: () => void;
  searchOpen: boolean;
  onSearch: () => void;
  onSettings: () => void;
  zen: boolean;
  onZen: () => void;
  fullscreen: boolean;
  onFullscreen: () => void;
}

/** Compact controls around one persistent editor. It never observes document input. */
export function WritingToolbar({
  kind,
  onKind,
  onMark,
  preferences,
  onPreferences,
  beatGuide,
  onBeatGuide,
  onBeatSheet,
  searchOpen,
  onSearch,
  onSettings,
  zen,
  onZen,
  fullscreen,
  onFullscreen,
}: WritingToolbarProps) {
  const patch = (changes: Partial<Preferences>) =>
    onPreferences({ ...preferences, ...changes });
  const steps = [
    ...new Set([
      60,
      70,
      80,
      90,
      100,
      110,
      120,
      125,
      130,
      140,
      150,
      175,
      200,
      preferences.zoom,
    ]),
  ].sort((a, b) => a - b);
  const navigate = (event: KeyboardEvent<HTMLDivElement>) => {
    // Native selects keep their own arrow-key operation.
    if (
      !(event.target instanceof HTMLButtonElement) ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
    )
      return;
    const controls = [
      ...event.currentTarget.querySelectorAll<
        HTMLButtonElement | HTMLSelectElement
      >("button:not(:disabled), select:not(:disabled)"),
    ];
    const current = controls.indexOf(event.target);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? controls.length - 1
          : (current +
              (event.key === "ArrowRight" ? 1 : -1) +
              controls.length) %
            controls.length;
    event.preventDefault();
    controls[next]?.focus({ preventScroll: true });
    controls[next]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };
  return (
    <div className="writing-toolbar-shell">
      <div
        role="toolbar"
        aria-label="Writing controls"
        className="writing-toolbar"
        onKeyDown={navigate}
      >
        <div
          className="writing-control-group writing-format-group"
          role="group"
          aria-label="Text formatting"
        >
          <select
            className="writing-element"
            aria-label="Screenplay element"
            title="Screenplay element"
            value={kind}
            onChange={(event) => onKind(event.target.value as BlockKind)}
          >
            {Object.entries(blockLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
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
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onMark(mark)}
            >
              <Icon size={15} aria-hidden="true" />
            </button>
          ))}
        </div>
        <div
          className="writing-control-group writing-story-group"
          role="group"
          aria-label="Story planning"
        >
          <button
            type="button"
            className="writing-tool writing-labeled-tool writing-beat-sheet"
            aria-label="Beat sheet"
            title="Open beat sheet"
            onClick={onBeatSheet}
          >
            <Columns3 size={15} aria-hidden="true" />
            <span>Beat sheet</span>
          </button>
          <button
            type="button"
            className="writing-tool writing-labeled-tool"
            aria-label="Beat guide"
            title={beatGuide ? "Hide beat guide" : "Show beat guide"}
            aria-pressed={beatGuide}
            onClick={onBeatGuide}
          >
            <ListChecks size={15} aria-hidden="true" />
            <span>Beat guide</span>
          </button>
        </div>
        <span className="writing-toolbar-space" aria-hidden="true" />
        <div
          className="writing-control-group writing-zoom-group"
          role="group"
          aria-label="Page zoom controls"
        >
          <button
            type="button"
            className="writing-tool"
            aria-label="Zoom out"
            title="Zoom out"
            disabled={preferences.zoom <= 60}
            onClick={() => patch({ zoom: Math.max(60, preferences.zoom - 10) })}
          >
            <Minus size={14} aria-hidden="true" />
          </button>
          <select
            aria-label="Page zoom"
            title="Page zoom"
            value={preferences.zoom}
            onChange={(event) => patch({ zoom: Number(event.target.value) })}
          >
            {steps.map((zoom) => (
              <option key={zoom} value={zoom}>
                {zoom}%
              </option>
            ))}
          </select>
          <button
            type="button"
            className="writing-tool"
            aria-label="Zoom in"
            title="Zoom in"
            disabled={preferences.zoom >= 200}
            onClick={() =>
              patch({ zoom: Math.min(200, preferences.zoom + 10) })
            }
          >
            <Plus size={14} aria-hidden="true" />
          </button>
        </div>
        <div
          className="writing-control-group writing-panels-group"
          role="group"
          aria-label="Writing panels"
        >
          <button
            type="button"
            className="writing-tool"
            aria-label="Toggle outline"
            title="Toggle outline"
            aria-pressed={preferences.outline}
            onClick={() =>
              patch({
                outline: !preferences.outline,
                ...(matchMedia("(max-width: 950px)").matches
                  ? { insights: false }
                  : {}),
              })
            }
          >
            <PanelLeft size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="writing-tool writing-labeled-tool writing-insights-tool"
            aria-label="Insights"
            title="Insights"
            aria-pressed={preferences.insights}
            onClick={() =>
              patch({
                insights: !preferences.insights,
                ...(matchMedia("(max-width: 950px)").matches
                  ? { outline: false }
                  : {}),
              })
            }
          >
            <BarChart3 size={16} aria-hidden="true" />
            <span>Insights</span>
          </button>
        </div>
        <div
          className="writing-control-group writing-utilities-group"
          role="group"
          aria-label="Writing tools"
        >
          <button
            type="button"
            className="writing-tool"
            aria-label="Find and replace"
            title="Find and replace"
            aria-pressed={searchOpen}
            onClick={onSearch}
          >
            <Search size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="writing-tool"
            aria-label="Appearance settings"
            title="Appearance settings"
            onClick={onSettings}
          >
            <Settings2 size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="writing-tool"
            aria-label={zen ? "Exit Zen mode" : "Enter Zen mode"}
            title={zen ? "Exit Zen mode" : "Enter Zen mode"}
            aria-pressed={zen}
            onClick={onZen}
          >
            <Leaf size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="writing-tool"
            aria-label={fullscreen ? "Exit full screen" : "Full screen"}
            title={fullscreen ? "Exit full screen" : "Full screen"}
            aria-pressed={fullscreen}
            onMouseDown={(event) => event.preventDefault()}
            onClick={onFullscreen}
          >
            {fullscreen ? (
              <Minimize size={15} aria-hidden="true" />
            ) : (
              <Maximize size={15} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
