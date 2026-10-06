import { useId, type SVGProps } from "react";
import {
  keycapIconTransform,
  keycapFullTransform,
  wordmarkPath,
  wordmarkTransform,
  wordmarkViewBox,
  writeShapeKeycaps,
} from "./writeShapeKeycaps";
import { writeShapeThemes } from "../branding/writeShapeThemes";

const themeColors = {
  bg: "var(--bg, #e4d7dc)",
  face: "var(--raised, #fff9fc)",
  right: "color-mix(in srgb, var(--panel, #f0e6eb) 91%, black)",
  left: "color-mix(in srgb, var(--panel, #f0e6eb) 98%, black)",
  accent: "var(--accent, #80516f)",
  outline: "var(--logo-outline, #958d92)",
};
export type WriteShapeColors = typeof themeColors;
/** Installed icons always use Rose; in-app branding follows the active theme. */
export const writeShapeRoseColors: WriteShapeColors = writeShapeThemes.find(
  (t) => t.id === "rose",
)!.colors;

function Keycaps({ colors }: { colors: WriteShapeColors }) {
  return (
    <>
      {writeShapeKeycaps.map((key) => (
        <g key={key.letter} opacity={key.outline ? 0.55 : undefined}>
          <polygon
            points={key.body}
            fill={key.outline ? "none" : colors.left}
            stroke={colors.outline}
            strokeWidth=".018"
            strokeLinejoin="round"
          />
          {key.right && <polygon points={key.right} fill={colors.right} />}
          <path
            d={key.seam}
            stroke={colors.outline}
            strokeWidth=".018"
            strokeLinecap="round"
          />
          <polygon
            points={key.face}
            fill={key.outline ? "none" : colors.face}
            stroke={key.outline ? colors.outline : colors.accent}
            strokeWidth=".018"
            strokeLinejoin="round"
          />
          <path
            d={key.glyph}
            transform={key.glyphTransform}
            fill={key.outline ? "none" : colors.accent}
            stroke={key.outline ? colors.outline : undefined}
            strokeWidth={key.outline ? 50 : undefined}
            strokeLinejoin={key.outline ? "round" : undefined}
          />
        </g>
      ))}
    </>
  );
}

/** Decorative beside the app name; the containing account control supplies its label. */
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
  const clipId = `writeshape-${useId()}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 900 900"
      fill="none"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x="12" y="12" width="876" height="876" rx="185" />
        </clipPath>
      </defs>
      <rect
        width="900"
        height="900"
        rx={maskable || opaque ? undefined : 197}
        fill={colors.accent}
      />
      <rect x="12" y="12" width="876" height="876" rx="185" fill={colors.bg} />
      <g clipPath={`url(#${clipId})`}>
        <g
          transform={
            maskable
              ? "translate(450 450) scale(.90) translate(-450 -450)"
              : undefined
          }
        >
          <g transform={keycapIconTransform}>
            <Keycaps colors={colors} />
          </g>
        </g>
      </g>
    </svg>
  );
}

/** Uncropped four-key logo with outlined wordmark paths, no tile, frame or backdrop. */
export function WriteShapeLogo({
  width = 180,
  colors = themeColors,
  ...props
}: SVGProps<SVGSVGElement> & { colors?: WriteShapeColors }) {
  const height = typeof width === "number"
    ? (width * Number(wordmarkViewBox.split(" ")[3])) / 900
    : undefined;
  return (
    <svg
      width={width}
      height={height}
      viewBox={wordmarkViewBox}
      fill="none"
      role="img"
      aria-label="WriteShape"
      focusable="false"
      {...props}
    >
      <g transform={keycapFullTransform}>
        <Keycaps colors={colors} />
      </g>
      <path
        d={wordmarkPath}
        transform={wordmarkTransform}
        fill={colors.accent}
      />
    </svg>
  );
}
