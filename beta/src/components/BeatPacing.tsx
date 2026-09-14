import { useId, useMemo, useState } from "react";
import { ArrowUpRight, Download } from "lucide-react";
import type { BeatRange, Screenplay } from "../core/model";
import { downloadFile } from "../storage/files";
import { Modal } from "./Modal";
import { beatPacing } from "./beat-pacing";

const chart = {
  width: 900,
  height: 260,
  left: 68,
  right: 24,
  top: 22,
  bottom: 40,
};

export function BeatPacing({
  doc,
  onClose,
  onRange,
}: {
  doc: Screenplay;
  onClose: () => void;
  onRange: (range: BeatRange) => void;
}) {
  const { total, positions } = useMemo(() => beatPacing(doc), [doc]);
  const [selected, setSelected] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const chartId = useId();
  const x = (index: number) =>
    chart.left +
    ((chart.width - chart.left - chart.right) * (index + 1)) /
      (positions.length + 1);
  const y = (words: number) =>
    chart.height -
    chart.bottom -
    ((chart.height - chart.top - chart.bottom) * words) / Math.max(1, total);
  const ticks = [...new Set([0, Math.round(total / 2), total])];
  const route = [
    { x: chart.left, y: y(0) },
    ...positions.map((point, i) => ({ x: x(i), y: y(point.words) })),
    { x: chart.width - chart.right, y: y(total) },
  ];
  const numberStep = Math.max(1, Math.ceil(positions.length / 30));
  const active = selected === null ? undefined : positions[selected];

  const savePng = async () => {
    setSaving(true);
    setNotice("");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = (chart.width + 48) * 2;
      canvas.height = (chart.height + 128) * 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Image export is unavailable in this browser.");
      const style = getComputedStyle(document.documentElement);
      const palette = {
        paper: style.getPropertyValue("--raised").trim() || "#ffffff",
        ink: style.getPropertyValue("--ink").trim() || "#24272a",
        muted: style.getPropertyValue("--muted").trim() || "#656a70",
        accent: style.getPropertyValue("--accent").trim() || "#3974c2",
        border: style.getPropertyValue("--border").trim() || "#e0e3e5",
      };
      ctx.scale(2, 2);
      ctx.fillStyle = palette.paper;
      ctx.fillRect(0, 0, canvas.width / 2, canvas.height / 2);
      ctx.fillStyle = palette.ink;
      ctx.font = "600 22px system-ui, sans-serif";
      ctx.fillText("Beat pacing", 28, 37);
      ctx.font = "12px system-ui, sans-serif";
      ctx.fillStyle = palette.muted;
      ctx.fillText("Cumulative screenplay words at each beat", 28, 60);
      ctx.save();
      ctx.translate(24, 84);
      ctx.font = "11px ui-monospace, monospace";
      for (const tick of ticks) {
        ctx.strokeStyle = palette.border;
        ctx.beginPath();
        ctx.moveTo(chart.left, y(tick));
        ctx.lineTo(chart.width - chart.right, y(tick));
        ctx.stroke();
        ctx.textAlign = "right";
        ctx.fillText(tick.toLocaleString(), chart.left - 12, y(tick) + 4);
      }
      ctx.setLineDash([5, 6]);
      ctx.strokeStyle = palette.muted;
      ctx.beginPath();
      ctx.moveTo(chart.left, y(0));
      ctx.lineTo(chart.width - chart.right, y(total));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      route.forEach((point, i) =>
        i ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y),
      );
      ctx.stroke();
      positions.forEach((point, i) => {
        ctx.beginPath();
        ctx.arc(x(i), y(point.words), 5, 0, 2 * Math.PI);
        ctx.fillStyle = point.assigned ? palette.accent : palette.paper;
        ctx.strokeStyle = point.assigned ? palette.paper : "#92979f";
        ctx.fill();
        ctx.stroke();
        if (i % numberStep === 0 || i === positions.length - 1) {
          ctx.textAlign = "center";
          ctx.fillStyle = palette.muted;
          ctx.fillText(String(i + 1), x(i), chart.height - 14);
        }
      });
      ctx.restore();
      ctx.font = "11px system-ui, sans-serif";
      ctx.fillStyle = palette.muted;
      ctx.textAlign = "left";
      ctx.fillText(
        "Filled dots: assigned ranges     Open dots: estimates     Dashed line: evenly spaced beats",
        28,
        chart.height + 111,
      );
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (result) =>
            result
              ? resolve(result)
              : reject(new Error("The pacing image could not be created.")),
          "image/png",
        ),
      );
      downloadFile(blob, "beat-pacing.png");
      setNotice("Pacing graph saved.");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "The pacing image could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Pacing Graph" eyebrow="STORY MAP" onClose={onClose} wide>
      <div className="beat-pacing">
        <p>
          Cumulative screenplay words at each beat. Grey circles estimate the
          position of beats not yet assigned to the screenplay.
        </p>
        {positions.length ? (
          <>
            <section
              className="beat-pacing-plot"
              aria-label="Beat pacing by cumulative screenplay words"
            >
              <header>
                <strong>Pacing</strong>
                <span>
                  {total.toLocaleString()} words · {positions.length} beats
                </span>
                <div className="beat-pacing-legend">
                  <span>
                    <i className="assigned" /> Assigned
                  </span>
                  <span>
                    <i /> Estimate
                  </span>
                </div>
              </header>
              <div
                className="beat-pacing-scroll"
                tabIndex={0}
                aria-label="Scroll pacing graph horizontally"
              >
                <svg
                  viewBox={`0 0 ${chart.width} ${chart.height}`}
                  role="group"
                  aria-labelledby={`${chartId}-title ${chartId}-description`}
                >
                  <title id={`${chartId}-title`}>Beat pacing graph</title>
                  <desc id={`${chartId}-description`}>
                    Beat number runs left to right. Words accumulate from the
                    bottom to the top. Select a point to inspect its position. A
                    data table follows the graph.
                  </desc>
                  {ticks.map((tick) => (
                    <g key={tick} aria-hidden="true">
                      <line
                        x1={chart.left}
                        x2={chart.width - chart.right}
                        y1={y(tick)}
                        y2={y(tick)}
                        className="pacing-grid"
                      />
                      <text
                        x={chart.left - 12}
                        y={y(tick) + 4}
                        textAnchor="end"
                      >
                        {tick.toLocaleString()}
                      </text>
                    </g>
                  ))}
                  <line
                    x1={chart.left}
                    y1={y(0)}
                    x2={chart.width - chart.right}
                    y2={y(total)}
                    className="pacing-diagonal"
                    aria-hidden="true"
                  />
                  <polyline
                    points={route
                      .map((point) => `${point.x},${point.y}`)
                      .join(" ")}
                    className="pacing-route"
                    aria-hidden="true"
                  />
                  {positions.map((point, i) => (
                    <g key={point.beat.id}>
                      <g
                        role="button"
                        tabIndex={0}
                        aria-label={`Beat ${i + 1}: ${point.beat.title || "Untitled"}, ${point.words.toLocaleString()} words, ${point.assigned ? `lines ${point.startLine}–${point.endLine}` : "estimated"}`}
                        aria-pressed={selected === i}
                        className={`pacing-point ${point.assigned ? "assigned" : "estimated"} ${selected === i ? "selected" : ""}`}
                        onFocus={() => setSelected(i)}
                        onClick={() => setSelected(i)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelected(i);
                          }
                          if (
                            event.key === "ArrowRight" ||
                            event.key === "ArrowLeft"
                          ) {
                            event.preventDefault();
                            const step = event.key === "ArrowRight" ? 1 : -1;
                            const nodes =
                              event.currentTarget.ownerSVGElement?.querySelectorAll<SVGGElement>(
                                ".pacing-point",
                              );
                            nodes?.[
                              Math.max(
                                0,
                                Math.min(positions.length - 1, i + step),
                              )
                            ]?.focus();
                          }
                        }}
                      >
                        <circle
                          className="pacing-hit-area"
                          cx={x(i)}
                          cy={y(point.words)}
                          r={14}
                        />
                        <circle
                          className="pacing-dot"
                          cx={x(i)}
                          cy={y(point.words)}
                          r={5}
                        />
                      </g>
                      {(i % numberStep === 0 || i === positions.length - 1) && (
                        <text
                          x={x(i)}
                          y={chart.height - 14}
                          textAnchor="middle"
                          aria-hidden="true"
                        >
                          {i + 1}
                        </text>
                      )}
                    </g>
                  ))}
                </svg>
              </div>
            </section>
            <p className="beat-pacing-scroll-hint">
              Swipe the graph to see every beat.
            </p>
            <div className="beat-pacing-detail" role="status">
              {active ? (
                <>
                  <div>
                    <strong>
                      {selected! + 1}. {active.beat.title || "Untitled beat"}
                    </strong>
                    <span>
                      {active.words.toLocaleString()} words ·{" "}
                      {active.assigned
                        ? `Lines ${active.startLine}–${active.endLine}`
                        : "Estimated position"}
                    </span>
                  </div>
                  {active.assigned && (
                    <button
                      onClick={() => {
                        onClose();
                        onRange(active.range!);
                      }}
                    >
                      <ArrowUpRight size={14} /> Show assigned lines
                    </button>
                  )}
                </>
              ) : (
                <span>
                  Select a point to inspect a beat. The dashed line shows evenly
                  spaced beats.
                </span>
              )}
            </div>
            <details className="beat-pacing-data">
              <summary>View pacing data</summary>
              <div>
                <table>
                  <caption>Cumulative screenplay words at each beat</caption>
                  <thead>
                    <tr>
                      <th scope="col">Beat</th>
                      <th scope="col">Words</th>
                      <th scope="col">Position</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map((point, i) => (
                      <tr key={point.beat.id}>
                        <th scope="row">
                          {i + 1}. {point.beat.title || "Untitled beat"}
                        </th>
                        <td>{point.words.toLocaleString()}</td>
                        <td>
                          {point.assigned
                            ? `Lines ${point.startLine}–${point.endLine}`
                            : "Estimate"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        ) : (
          <div className="beat-pacing-empty">
            Add a beat to see the shape of your story here.
          </div>
        )}
        <footer>
          <span role="status">{notice}</span>
          <button
            className="primary"
            onClick={savePng}
            disabled={!positions.length || saving}
          >
            <Download size={15} /> {saving ? "Saving…" : "Save PNG"}
          </button>
        </footer>
      </div>
    </Modal>
  );
}
