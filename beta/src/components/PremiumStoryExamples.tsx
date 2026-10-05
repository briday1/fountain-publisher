import { SceneOutline } from "./SceneOutline";
import { sampleInsights } from "./premiumSampleData";
import { premiumSample } from "./premiumSampleData";
import { BeatBoard } from "./BeatBoard";
import { BeatPacing } from "./BeatPacing";
import { buildCharacterAnalytics } from "../core/characterAnalytics";
import { FileText } from "lucide-react";
const palette = [
  "var(--accent)",
  "var(--accent-secondary)",
  "var(--accent-tertiary)",
];
const noop = () => {};
export function SampleOutline() {
  return (
    <div
      className="premium-example"
      inert
      aria-hidden="true"
      data-sample-feature="Outline"
    >
      <div className="sample-story-outline">
        <div className="panel-heading">
          <div>
            <small>YOUR STORY</small>
            <h2>Outline</h2>
          </div>
        </div>
        <button className="outline-title" onClick={noop}>
          <FileText size={17} />
          <span>
            Title page<small>Edit details</small>
          </span>
        </button>
        <SceneOutline
          doc={premiumSample}
          onAddAct={noop}
          insights={sampleInsights}
          onJump={noop}
          onAdd={noop}
        />
      </div>
    </div>
  );
}
export function SampleBeatSheet() {
  return (
    <div className="sample-beat-sheet">
      <BeatBoard
        doc={premiumSample}
        onChange={noop}
        onAssign={noop}
        onRange={noop}
        onExport={noop}
        onExportCsv={noop}
      />
      <BeatPacing doc={premiumSample} onClose={noop} onRange={noop} inline />
    </div>
  );
}
export function SampleCharacterGantt() {
  const data = buildCharacterAnalytics(premiumSample),
    width = 520;
  return (
    <div className="sample-gantt">
      <h4>Character dialogue across the screenplay</h4>
      <svg
        viewBox={`0 0 660 ${75 + data.characters.length * 46}`}
        role="img"
        aria-label="Character analytics Gantt chart for The Last Light"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line
              x1={115 + t * width}
              x2={115 + t * width}
              y1="30"
              y2={44 + data.characters.length * 46}
              stroke="var(--border)"
            />
            <text x={115 + t * width} y="19" textAnchor="middle">
              {Math.round(t * data.document.totalWords)}
            </text>
          </g>
        ))}
        {data.characters.map((name, i) => (
          <g key={name}>
            <text x="8" y={60 + i * 46}>
              {name}
            </text>
            {data.document.segments
              .filter((s) => s.character === name)
              .map((s, j) => (
                <rect
                  key={j}
                  x={115 + (s.start / data.document.totalWords) * width}
                  y={43 + i * 46}
                  width={Math.max(
                    2,
                    (s.words / data.document.totalWords) * width,
                  )}
                  height="24"
                  rx="3"
                  fill={palette[i % palette.length]}
                />
              ))}
          </g>
        ))}
      </svg>
      <p className="muted">
        Bars show each character’s dialogue; the horizontal scale follows story
        words.
      </p>
    </div>
  );
}
