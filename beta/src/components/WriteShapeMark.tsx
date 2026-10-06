import { useId, type SVGProps } from "react";
import { wordmarkPath } from "./writeShapeKeycaps";
import { keyboardGlyphs, keyboardRows } from "./writeShapeKeyboard";
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
function muted(colors: WriteShapeColors, bg: string) {
  if (!bg.startsWith("#"))
    return `color-mix(in srgb, ${colors.outline} 20%, ${bg})`;
  return (
    "#" +
    [1, 3, 5]
      .map((i) =>
        Math.round(
          parseInt(bg.slice(i, i + 2), 16) * 0.8 +
            parseInt(colors.outline.slice(i, i + 2), 16) * 0.2,
        )
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
  const off = muted(colors, bg);
  return (
    <>
      {keyboardRows.flatMap((row) =>
        [...row.letters].map((letter, column) => {
          const x = row.x + (column - 1) * 360,
            y = row.y;
          const active = letter === "W" || letter === "S";
          const glyph = keyboardGlyphs[letter as keyof typeof keyboardGlyphs];
          const [left, bottom, right, top] = glyph.bounds;
          const scale = 0.106;
          const tx = x + 172 - ((left + right) * scale) / 2;
          const ty = y + 158.5 + ((bottom + top) * scale) / 2;
          const ink = active ? bg : off;
          return (
            <g key={letter} data-key={letter}>
              <path
                d={cap(x, y)}
                fill={active ? colors.accent : "none"}
                stroke={active ? "none" : off}
                strokeWidth={12}
              />
              <path
                d={glyph.path}
                transform={`translate(${tx} ${ty}) scale(${scale} ${-scale})`}
                fill={ink}
                stroke={ink}
                strokeWidth={28}
                strokeLinejoin="round"
                paintOrder="stroke"
              />
            </g>
          );
        }),
      )}
    </>
  );
}

/** The account control supplies its accessible name. This is a borderless zoomed crop. */
export function WriteShapeMark({
  size = 36,
  colors = themeColors,
  maskable = false,
  opaque: _opaque = false,
  ...props
}: SVGProps<SVGSVGElement> & {
  size?: number;
  colors?: WriteShapeColors;
  maskable?: boolean;
  opaque?: boolean;
}) {
  const bg = background(colors);
  const clipId = `writeshape-${useId()}`;
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
      <defs>
        <clipPath id={clipId}>
          <path d="M0 0H900V900H0Z" />
        </clipPath>
      </defs>
      <path d="M0 0H900V900H0Z" fill={bg} />
      <g clipPath={`url(#${clipId})`}>
        <g
          transform={
            maskable
              ? "translate(450 450) scale(.90) translate(-450 -450)"
              : undefined
          }
        >
          <Keyboard colors={colors} bg={bg} />
        </g>
      </g>
    </svg>
  );
}

/** Uncropped keyboard neighborhood with the Courier Prime wordmark; transparent outside the keys. */
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
      <g transform="translate(142 20) scale(.56) translate(88 200)">
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
