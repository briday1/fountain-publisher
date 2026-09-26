import type { SVGProps } from "react";

/** Decorative when beside the WriteShape name; the containing control supplies its label. */
export function WriteShapeMark({
  size = 28,
  ...props
}: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="12 9 40 46"
      fill="none"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path
        d="M21 14h17l9 9v24a4 4 0 0 1-4 4H21a4 4 0 0 1-4-4V18a4 4 0 0 1 4-4Z"
        fill="var(--ink, currentColor)"
      />
      <path d="M38 14v6a3 3 0 0 0 3 3h6" fill="var(--surface, white)" opacity="0.6" />
      <path
        d="M24 28h15M27 34h12"
        stroke="var(--surface, white)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="m24 41 4 4 4-4 4 4 4-4"
        stroke="var(--surface, white)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
