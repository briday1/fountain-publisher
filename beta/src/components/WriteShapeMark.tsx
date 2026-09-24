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
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <rect width="64" height="64" rx="14" fill="#243A35" />
      <path
        d="M21 14h17l9 9v24a4 4 0 0 1-4 4H21a4 4 0 0 1-4-4V18a4 4 0 0 1 4-4Z"
        fill="#F8F3E8"
      />
      <path d="M38 14v6a3 3 0 0 0 3 3h6" fill="#A9C0B5" />
      <path
        d="M24 28h15M27 34h12"
        stroke="#243A35"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="m24 41 4 4 4-4 4 4 4-4"
        stroke="#243A35"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
