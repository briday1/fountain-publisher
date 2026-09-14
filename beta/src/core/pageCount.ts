const eighths = ["", "⅛", "¼", "⅜", "½", "⅝", "¾", "⅞"];

/** Format a generated page equivalent; the renderer supplies its eighth-page precision. */
export function formatPageCount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  const units = Math.round(value * 8);
  const whole = Math.floor(units / 8);
  const fraction = eighths[units % 8];
  return `${whole || !fraction ? whole : ""}${fraction}`;
}
