import { premiumSample } from "./premiumSampleData";
import { beatPacing } from "./beat-pacing";
import { buildCharacterAnalytics } from "../core/characterAnalytics";
const palette = [
  "var(--accent)",
  "var(--accent-secondary)",
  "var(--accent-tertiary)",
];
export function SampleBeatSheet() {
  const { positions, total } = beatPacing(premiumSample);
  const x = (i: number) => 60 + ((i + 1) * 560) / (positions.length + 1);
  const y = (words: number) => 185 - (words / Math.max(1, total)) * 155;
  return (
    <div className="sample-beat-sheet">
      <p className="sample-premise">{String(premiumSample.metadata.premise)}</p>
      <div className="sample-beat-grid">
        {premiumSample.metadata.beats.map((beat, i) => (
          <article
            key={beat.id}
            style={{ borderTopColor: palette[i % palette.length] }}
          >
            <small>
              {beat.act} · Beat {i + 1}
            </small>
            <h4>{beat.title}</h4>
            <p>{beat.description}</p>
          </article>
        ))}
      </div>
      <h4>Beat pacing</h4>
      <p className="muted">Cumulative screenplay words at each beat</p>
      <svg
        viewBox="0 0 650 225"
        role="img"
        aria-label="Beat graph for The Last Light"
      >
        {[0, Math.round(total / 2), total].map((t) => (
          <g key={t}>
            <line x1="60" x2="620" y1={y(t)} y2={y(t)} stroke="var(--border)" />
            <text x="48" y={y(t) + 4} textAnchor="end">
              {t}
            </text>
          </g>
        ))}
        <path
          d={`M60,185 ${positions.map((p, i) => `L${x(i)},${y(p.words)}`).join(" ")} L620,30`}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="3"
        />
        {positions.map((p, i) => (
          <g key={p.beat.id}>
            <circle
              cx={x(i)}
              cy={y(p.words)}
              r="6"
              fill={palette[i % palette.length]}
            />
            <text x={x(i)} y="211" textAnchor="middle">
              Beat {i + 1}
            </text>
          </g>
        ))}
      </svg>
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
