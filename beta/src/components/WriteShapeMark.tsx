import type { SVGProps } from "react";
import { keycapViewBox, writeShapeKeycaps } from "./writeShapeKeycaps";

const themeColors = {
  face: "var(--raised, #fff9fc)",
  right: "color-mix(in srgb, var(--panel, #f0e6eb) 91%, black)",
  left: "color-mix(in srgb, var(--panel, #f0e6eb) 98%, black)",
  accent: "var(--accent, #80516f)",
  outline: "var(--logo-outline, #958d92)",
};

/** Fixed Rose palette for installed/downloaded icons; the editor follows its theme. */
export const writeShapeRoseColors: typeof themeColors = {
  face: "#fff9fc",
  right: "#dad1d6",
  left: "#ebe1e6",
  accent: "#80516f",
  outline: "#958d92",
};

/** Decorative when beside the WriteShape name; the containing control supplies its label. */
export function WriteShapeMark({
  size = 28,
  colors = themeColors,
  ...props
}: SVGProps<SVGSVGElement> & { size?: number; colors?: typeof themeColors }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={keycapViewBox}
      fill="none"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {writeShapeKeycaps.map((key) => (
        <g key={key.letter} opacity={key.outline ? 0.55 : undefined}>
          {key.walls.map((points, side) => (
            <polygon
              key={side}
              points={points}
              fill={
                key.outline ? "none" : side === 0 ? colors.right : colors.left
              }
              stroke={colors.outline}
              strokeWidth=".012"
              strokeLinejoin="round"
            />
          ))}
          <g transform={key.face}>
            <rect
              x="-.5"
              y="-.5"
              width="1"
              height="1"
              rx=".12"
              fill={key.outline ? "none" : colors.face}
              stroke={key.outline ? colors.outline : colors.accent}
              strokeWidth=".023"
            />
          </g>
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
    </svg>
  );
}
