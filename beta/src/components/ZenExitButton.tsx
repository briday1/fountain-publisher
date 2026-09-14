import { ChevronLeft } from "lucide-react";

export function ZenExitButton({ onExit }: { onExit: () => void }) {
  return (
    <button
      className="zen-exit"
      aria-label="Exit Zen"
      title="Exit Zen mode (Esc)"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onExit}
    >
      <ChevronLeft size={14} aria-hidden="true" />
      <span>Exit Zen</span>
      <kbd aria-hidden="true">Esc</kbd>
    </button>
  );
}
