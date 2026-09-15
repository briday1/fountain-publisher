import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { ArrowLeft, Download, ExternalLink, X } from "lucide-react";
import { buildCharacterAnalytics } from "../core/characterAnalytics";
import type { CharacterGroup } from "../core/characterAnalytics";
import type { Screenplay } from "../core/model";
import "./CharacterAnalytics.css";
import { useModalScrollLock } from "./useModalScrollLock";

const lightColors = [
  "#0072b2",
  "#c65d00",
  "#00845f",
  "#b43c20",
  "#6653b8",
  "#a43f83",
  "#397b32",
  "#716400",
];
const darkColors = [
  "#56b4e9",
  "#e69f00",
  "#42c99a",
  "#f0785a",
  "#a99af5",
  "#d7c1da",
  "#8bcb65",
  "#d7c75b",
];
const chartFont = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const labelWidth = 150;
const sceneWidth = 92;

function ChartButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  const keyDown = (event: KeyboardEvent<SVGGElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  };
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={onClick}
      onKeyDown={keyDown}
      className="character-chart-button"
    >
      <title>{label}</title>
      {children}
    </g>
  );
}

async function saveChart(svg: SVGSVGElement, title: string) {
  const width = svg.width.baseVal.value;
  const height = svg.height.baseVal.value;
  // Stay within browser canvas limits even with a feature-length ensemble cast.
  const scale = Math.min(
    2,
    16000 / width,
    16000 / height,
    Math.sqrt(32_000_000 / (width * height)),
  );
  const copy = svg.cloneNode(true) as SVGSVGElement;
  copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const source = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(copy)], {
      type: "image/svg+xml;charset=utf-8",
    }),
  );
  try {
    const image = new Image();
    image.src = source;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("The browser could not create an image.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(new Error("The chart image could not be saved.")),
        "image/png",
      ),
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(title || "Screenplay").replace(/[^\p{L}\p{N}._ -]/gu, "_")}-character-analytics.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } finally {
    URL.revokeObjectURL(source);
  }
}

export function CharacterAnalytics({
  doc,
  onCharacter,
  onScene,
  onClose,
}: {
  doc: Screenplay;
  onCharacter: (name: string) => void;
  onScene: (id: string) => void;
  onClose: () => void;
}) {
  const data = useMemo(() => buildCharacterAnalytics(doc), [doc]);
  const [selection, setSelection] = useState<string | null>(() =>
    data.groups.length === 1 ? data.groups[0].id : null,
  );
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(910);
  const dialog = useRef<HTMLDialogElement>(null);
  useModalScrollLock(dialog);
  const viewport = useRef<HTMLDivElement>(null);
  const chart = useRef<SVGSVGElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const selected =
    selection === data.document.id
      ? data.document
      : [...data.groups, ...data.acts].find((group) => group.id === selection);
  const selectedTitle = selected
    ? `${selected.kind === "scene" ? `Scene ${selected.sceneNumber}` : selected.heading} Character Gantt`
    : "Character Analytics";
  const surface = getComputedStyle(document.documentElement);
  const dark = surface.colorScheme.includes("dark");
  const colors = {
    paper: surface.getPropertyValue("--raised").trim() || "#fff",
    ink: surface.getPropertyValue("--ink").trim() || "#202124",
    muted: surface.getPropertyValue("--muted").trim() || "#6b7280",
    border: surface.getPropertyValue("--border").trim() || "#d7d9dd",
    grid: dark ? "#52606d" : "#c5cdd5",
  };
  const palette = surface.colorScheme.includes("dark")
    ? darkColors
    : lightColors;
  const colorFor = (name: string) =>
    palette[Math.max(0, data.characters.indexOf(name)) % palette.length];
  const labelColor = (hex: string) => {
    const values = [1, 3, 5].map((index) =>
      parseInt(hex.slice(index, index + 2), 16),
    );
    return values.reduce(
      (sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index],
      0,
    ) /
      255 >
      0.58
      ? "#17191b"
      : "#fff";
  };
  const measuringContext = useMemo(
    () => document.createElement("canvas").getContext("2d"),
    [],
  );
  const fit = (text: string, width: number, size = 11, weight = 600) => {
    if (!measuringContext) return text;
    measuringContext.font = `${weight} ${size}px ${chartFont}`;
    if (measuringContext.measureText(text).width <= width) return text;
    let clipped = text;
    while (clipped && measuringContext.measureText(`${clipped}…`).width > width)
      clipped = clipped.slice(0, -1);
    return `${clipped}…`;
  };

  useEffect(() => {
    const element = dialog.current!;
    const previousFocus = document.activeElement;
    element.showModal();
    return () => {
      element.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    const element = viewport.current!;
    const observer = new ResizeObserver(([entry]) =>
      setViewportWidth(entry.contentRect.width),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    viewport.current?.scrollTo({ left: 0, top: 0 });
  }, [selection]);

  const openCharacter = (name: string) => {
    onClose();
    onCharacter(name);
  };
  const present = selected
    ? new Set(selected.segments.map((segment) => segment.character))
    : null;
  const characters = present
    ? data.characters.filter((name) => present.has(name))
    : data.characters;
  // Include endpoint labels in the SVG bounds, including the exported PNG.
  if (measuringContext) measuringContext.font = `400 9px ${chartFont}`;
  const padding = Math.max(
    24,
    Math.ceil(
      (measuringContext?.measureText(
        (selected?.totalWords ?? 0).toLocaleString(),
      ).width ?? 40) / 2,
    ) + 12,
  );
  const plotWidth = Math.max(760, viewportWidth - labelWidth - padding * 2);
  const width = selected
    ? labelWidth + plotWidth
    : labelWidth + data.groups.length * sceneWidth;
  const rowHeight = selected ? 38 : 34;
  const headerHeight = selected ? 58 : 82;
  const height = headerHeight + Math.max(characters.length, 1) * rowHeight;
  const actHeaders: {
    title: string;
    start: number;
    length: number;
    group: CharacterGroup;
  }[] = [];
  for (const [index, group] of data.groups.entries()) {
    const target =
      group.kind === "scene"
        ? (data.acts.find((act) => act.id === group.actId) ?? data.document)
        : data.document;
    const previous = actHeaders.at(-1);
    if (previous?.group.id === target.id && previous.title === group.act)
      previous.length++;
    else
      actHeaders.push({
        title: group.act,
        start: index,
        length: 1,
        group: target,
      });
  }

  return (
    <dialog
      ref={dialog}
      className="character-analytics"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="character-analytics-shell">
        <header className="character-analytics-header">
          <div>
            <small>INSIGHTS</small>
            <h2 id={titleId}>{selectedTitle}</h2>
          </div>
          <div className="character-analytics-header-actions">
            {selected && data.groups.length > 1 && (
              <button type="button" onClick={() => setSelection(null)}>
                <ArrowLeft size={13} /> Overview
              </button>
            )}
            <button
              type="button"
              className="icon-button"
              onClick={onClose}
              aria-label="Close character analytics"
            >
              <X size={20} />
            </button>
          </div>
        </header>
        <p id={descriptionId} className="character-analytics-description">
          {selected
            ? `${selected.heading} · Solid bars show dialogue word count and position within this ${selected.kind}.`
            : `Dialogue lines by character across ${data.groups[0]?.kind === "scene" ? "acts and scenes" : "the document structure"}. Select a ${data.groups[0]?.kind === "scene" ? "scene " : ""}header for word-position detail.`}
        </p>
        <div
          ref={viewport}
          className="character-analytics-viewport"
          tabIndex={0}
          role="region"
          aria-label="Scrollable character analytics chart"
        >
          <svg
            ref={chart}
            xmlns="http://www.w3.org/2000/svg"
            width={width + padding * 2}
            height={height + padding * 2}
            viewBox={`${-padding} ${-padding} ${width + padding * 2} ${height + padding * 2}`}
            fontFamily={chartFont}
            fontSize={11}
            fontWeight={600}
            fill={colors.ink}
            textAnchor="start"
            dominantBaseline="central"
            role="group"
            aria-label={
              selected
                ? `Character dialogue word-position Gantt for ${selected.heading}, with ${selected.totalWords} words`
                : `Character dialogue timeline with ${characters.length} characters across ${data.groups.length} ${data.groups[0]?.kind === "scene" ? "scenes" : "groups"}; usage ranges from ${data.minLines} to ${data.maxLines} dialogue lines`
            }
          >
            <rect
              x={-padding}
              y={-padding}
              width={width + padding * 2}
              height={height + padding * 2}
              fill={colors.paper}
            />
            {/* Paint bands first so they never obscure the grid. */}
            {characters.map(
              (name, row) =>
                row % 2 === 1 && (
                  <rect
                    key={name}
                    data-chart-row-band="true"
                    x={0}
                    y={headerHeight + row * rowHeight}
                    width={width}
                    height={rowHeight}
                    fill={colors.ink}
                    fillOpacity={dark ? 0.045 : 0.035}
                  />
                ),
            )}
            <rect
              width={selected ? width : labelWidth}
              height={headerHeight}
              fill={colors.paper}
            />
            {selected ? (
              <>
                <text x={12} y={20} fontSize={12}>
                  {fit(selected.heading, 130, 12)}
                </text>
                <text
                  x={12}
                  y={40}
                  fill={colors.muted}
                  fontSize={9}
                  fontWeight={400}
                >
                  {selected.totalWords.toLocaleString()} {selected.kind} words
                </text>
                {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
                  <g key={ratio}>
                    <line
                      x1={labelWidth + plotWidth * ratio}
                      x2={labelWidth + plotWidth * ratio}
                      y1={headerHeight}
                      y2={height}
                      stroke={colors.grid}
                      data-chart-grid="true"
                    />
                    <text
                      x={labelWidth + plotWidth * ratio}
                      y={42}
                      textAnchor="middle"
                      data-chart-tick="true"
                      fontSize={9}
                      fontWeight={400}
                      fill={colors.muted}
                    >
                      {Math.round(selected.totalWords * ratio).toLocaleString()}
                    </text>
                  </g>
                ))}
              </>
            ) : (
              <>
                <text x={12} y={55} fill={colors.muted}>
                  CHARACTER
                </text>
                {actHeaders.map((act) => (
                  <ChartButton
                    key={`${act.start}-${act.title}`}
                    label={`View ${act.group.heading} character Gantt`}
                    onClick={() => setSelection(act.group.id)}
                  >
                    <rect
                      x={labelWidth + act.start * sceneWidth + 0.5}
                      y={0.5}
                      width={act.length * sceneWidth}
                      height={28}
                      fill={colors.paper}
                      stroke={colors.border}
                    />
                    <text
                      x={labelWidth + (act.start + act.length / 2) * sceneWidth}
                      y={14}
                      textAnchor="middle"
                    >
                      {fit(act.title, act.length * sceneWidth - 12)}
                    </text>
                  </ChartButton>
                ))}
                {data.groups.map((group, index) => (
                  <ChartButton
                    key={group.id}
                    label={`View ${group.kind === "scene" ? `Scene ${group.sceneNumber}: ` : ""}${group.heading} character Gantt`}
                    onClick={() => setSelection(group.id)}
                  >
                    <rect
                      x={labelWidth + index * sceneWidth + 0.5}
                      y={28.5}
                      width={sceneWidth}
                      height={54}
                      fill={colors.paper}
                      stroke={colors.border}
                    />
                    <text
                      x={labelWidth + (index + 0.5) * sceneWidth}
                      y={44}
                      textAnchor="middle"
                    >
                      {group.label}
                    </text>
                    <text
                      x={labelWidth + (index + 0.5) * sceneWidth}
                      y={64}
                      textAnchor="middle"
                      fontSize={9}
                      fontWeight={400}
                      fill={colors.muted}
                    >
                      {fit(group.heading, sceneWidth - 10, 9, 400)}
                    </text>
                  </ChartButton>
                ))}
              </>
            )}
            {!selected &&
              Array.from({ length: data.groups.length + 1 }, (_, index) => (
                <line
                  key={index}
                  data-chart-grid="true"
                  x1={labelWidth + index * sceneWidth}
                  x2={labelWidth + index * sceneWidth}
                  y1={headerHeight}
                  y2={height}
                  stroke={colors.grid}
                />
              ))}
            {characters.map((name, row) => {
              const y = headerHeight + row * rowHeight;
              return (
                <g key={name}>
                  <ChartButton
                    label={`View all ${name} dialogue`}
                    onClick={() => openCharacter(name)}
                  >
                    <rect
                      x={0}
                      y={y}
                      width={labelWidth}
                      height={rowHeight}
                      fill="transparent"
                    />
                    <text x={12} y={y + rowHeight / 2}>
                      {fit(name, labelWidth - 20)}
                    </text>
                  </ChartButton>
                  {selected
                    ? selected.segments
                        .filter((segment) => segment.character === name)
                        .map((segment, index) => (
                          <g
                            key={`${segment.blockId}-${index}`}
                            role="img"
                            aria-label={`${name}: ${segment.words} dialogue words, starting at word ${segment.start}`}
                          >
                            <title>
                              {name}: {segment.words} dialogue words, starting
                              at word {segment.start}
                            </title>
                            <rect
                              x={
                                labelWidth +
                                (segment.start / (selected.totalWords || 1)) *
                                  plotWidth
                              }
                              y={y + 8}
                              width={Math.max(
                                2,
                                (segment.words / (selected.totalWords || 1)) *
                                  plotWidth,
                              )}
                              height={rowHeight - 16}
                              fill={colorFor(name)}
                            />
                          </g>
                        ))
                    : data.groups.map((group, index) => {
                        const count = group.lines[name] ?? 0;
                        if (!count) return null;
                        const opacity =
                          data.maxLines === data.minLines
                            ? 1
                            : 0.3 +
                              (0.7 * (count - data.minLines)) /
                                (data.maxLines - data.minLines);
                        return (
                          <g
                            key={group.id}
                            role="img"
                            aria-label={`${name}, ${group.heading}: ${count} ${count === 1 ? "line" : "lines"}`}
                          >
                            <title>
                              {name}, {group.heading}: {count}{" "}
                              {count === 1 ? "line" : "lines"}
                            </title>
                            <rect
                              x={labelWidth + index * sceneWidth + 4}
                              y={y + 7}
                              width={sceneWidth - 8}
                              height={rowHeight - 14}
                              fill={colorFor(name)}
                              opacity={opacity}
                            />
                            <text
                              x={labelWidth + (index + 0.5) * sceneWidth}
                              y={y + rowHeight / 2}
                              textAnchor="middle"
                              fill={
                                opacity >= 0.62
                                  ? labelColor(colorFor(name))
                                  : colors.ink
                              }
                            >
                              {count}
                            </text>
                          </g>
                        );
                      })}
                </g>
              );
            })}
            <rect
              x={0.5}
              y={selected ? headerHeight + 0.5 : 0.5}
              width={width - 1}
              height={height - (selected ? headerHeight : 0) - 1}
              fill="none"
              stroke={colors.grid}
              pointerEvents="none"
            />
            {!characters.length && (
              <text
                x={width / 2}
                y={headerHeight + rowHeight / 2}
                textAnchor="middle"
                fill={colors.muted}
                fontWeight={400}
              >
                No character dialogue in this {selected?.kind ?? "document"}.
              </text>
            )}
          </svg>
        </div>
        <footer className="character-analytics-actions">
          <span role="status">{status}</span>
          {selected && selected.kind !== "document" && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onScene(selected.id);
              }}
            >
              <ExternalLink size={14} /> Go to {selected.kind}
            </button>
          )}
          <button
            type="button"
            className="primary"
            disabled={saving}
            onClick={async () => {
              if (!chart.current) return;
              setSaving(true);
              setStatus("");
              try {
                await saveChart(chart.current, doc.titlePage.title);
                setStatus("Character analytics PNG saved.");
              } catch (error) {
                setStatus(
                  error instanceof Error
                    ? error.message
                    : "Could not save the chart.",
                );
              } finally {
                setSaving(false);
              }
            }}
          >
            <Download size={14} /> {saving ? "Saving…" : "Save PNG"}
          </button>
        </footer>
      </div>
    </dialog>
  );
}
