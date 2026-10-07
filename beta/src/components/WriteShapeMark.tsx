import { type SVGProps } from "react";
import { wordmarkPath } from "./writeShapeKeycaps";
import { keyboardGlyphs } from "./writeShapeKeyboard";
import { writeShapeThemes } from "../branding/writeShapeThemes";

const themeColors = {
  bg: "var(--logo-bg, #fff9fc)",
  face: "var(--raised, #fff9fc)",
  right: "var(--panel, #f0e6eb)",
  left: "var(--panel, #f0e6eb)",
  accent: "var(--accent, #80516f)",
  outline: "var(--logo-outline, #958d92)",
};
export type WriteShapeColors = typeof themeColors;
export const writeShapeRoseColors: WriteShapeColors = writeShapeThemes.find(
  (t) => t.id === "rose",
)!.colors;

function background(colors: WriteShapeColors) {
  if (!colors.bg.startsWith("#")) return colors.bg;
  const rgb = [1, 3, 5].map((i) => parseInt(colors.bg.slice(i, i + 2), 16));
  return Math.max(...rgb) < 100 ? colors.bg : colors.face;
}
function sideColor(colors: WriteShapeColors) {
  if (!colors.accent.startsWith("#"))
    return `color-mix(in srgb, ${colors.accent} 75%, black)`;
  return (
    "#" +
    [1, 3, 5]
      .map((i) =>
        Math.round(parseInt(colors.accent.slice(i, i + 2), 16) * 0.75)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
function cap(x: number, y: number) {
  const w = 344,
    h = 317,
    r = 58;
  return `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`;
}
function Keyboard({ colors, bg }: { colors: WriteShapeColors; bg: string }) {
  return (
    <>
      {[
        { letter: "W", x: 278, y: 138 },
        { letter: "S", x: 404, y: 485 },
      ].map(({ letter, x, y }) => {
        const glyph = keyboardGlyphs[letter as "W" | "S"];
        const [left, bottom, right, top] = glyph.bounds;
        // Equal visible heights, including the rounded outline, on the 900px
        // icon. Keep each legend's upper-left edge 35 units from its key.
        const scale = 163 / (1.1842105263157894 * (top - bottom + 28));
        const tx = x + 35 - (left - 14) * scale;
        const ty = y + 35 + (top + 14) * scale;
        return (
          <g key={letter} data-key={letter}>
            <path d={cap(x + 18, y + 22)} fill={sideColor(colors)} />
            <path d={cap(x, y)} fill={colors.accent} />
            <path
              d={glyph.path}
              transform={`translate(${tx} ${ty}) scale(${scale} ${-scale})`}
              fill={bg}
              stroke={bg}
              strokeWidth={28}
              strokeLinejoin="round"
              paintOrder="stroke"
            />
          </g>
        );
      })}
    </>
  );
}

/** The account control supplies its accessible name. The complete W/S silhouette is centered, including the right and bottom depth. */
export function WriteShapeMark({
  size = 36,
  colors = themeColors,
  maskable = false,
  opaque = false,
  ...props
}: SVGProps<SVGSVGElement> & {
  size?: number;
  colors?: WriteShapeColors;
  maskable?: boolean;
  opaque?: boolean;
}) {
  const bg = background(colors);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 900 900"
      fill="none"
      overflow="hidden"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {(opaque || maskable) && <path d="M0 0H900V900H0Z" fill={bg} />}
      <g>
        <g
          transform={
            maskable
              ? "translate(450 450) scale(.75) translate(-450 -450)"
              : undefined
          }
        >
          <g transform="translate(450 450) scale(1.1842105263157894) translate(-522 -481)">
            <Keyboard colors={colors} bg={bg} />
          </g>
        </g>
      </g>
    </svg>
  );
}

/** Uncropped W/S keycaps with the Courier Prime wordmark; transparent outside the keys. */
export function WriteShapeLogo({
  width = 180,
  colors = themeColors,
  ...props
}: SVGProps<SVGSVGElement> & { colors?: WriteShapeColors }) {
  const bg = background(colors);
  return (
    <svg
      width={width}
      height={typeof width === "number" ? width : undefined}
      viewBox="0 0 900 900"
      fill="none"
      role="img"
      aria-label="WriteShape"
      focusable="false"
      {...props}
    >
      <g transform="translate(450 380) scale(.84) translate(-522 -481)">
        <Keyboard colors={colors} bg={bg} />
      </g>
      <path
        d={wordmarkPath}
        transform="translate(170.91991786447642 841) scale(0.0459958932238193 -0.0459958932238193)"
        fill={colors.accent}
      />
    </svg>
  );
}
