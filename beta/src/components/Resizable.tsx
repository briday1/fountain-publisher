export function Resizable({
  label,
  value,
  onChange,
  reverse = false,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  reverse?: boolean;
}) {
  const clamp = (v: number) => Math.max(190, Math.min(440, v));
  return (
    <div
      className="panel-resizer"
      role="separator"
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemin={190}
      aria-valuemax={440}
      aria-valuenow={value}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          onChange(
            clamp(
              value +
                (e.key === "ArrowRight" ? 1 : -1) * (reverse ? -1 : 1) * 10,
            ),
          );
        }
      }}
      onPointerDown={(e) => {
        e.preventDefault();
        const start = e.clientX;
        const original = value;
        const target = e.currentTarget;
        target.setPointerCapture(e.pointerId);
        const move = (event: PointerEvent) =>
          onChange(
            clamp(original + (event.clientX - start) * (reverse ? -1 : 1)),
          );
        const end = () => {
          target.removeEventListener("pointermove", move);
          target.removeEventListener("pointerup", end);
          target.removeEventListener("pointercancel", end);
        };
        target.addEventListener("pointermove", move);
        target.addEventListener("pointerup", end);
        target.addEventListener("pointercancel", end);
      }}
    />
  );
}
