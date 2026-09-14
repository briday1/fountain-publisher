import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
export function Menu({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  return (
    <div
      className="menu"
      ref={ref}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setOpen(false);
          ref.current?.querySelector("button")?.focus();
        }
        if (open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
          e.preventDefault();
          const buttons = Array.from(
            ref.current!.querySelectorAll<HTMLButtonElement>(
              ".menu-popup button:not(:disabled)",
            ),
          );
          const i = buttons.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          buttons[
            (i + (e.key === "ArrowDown" ? 1 : buttons.length - 1)) %
              buttons.length
          ]?.focus();
        }
      }}
    >
      <button
        aria-expanded={open}
        aria-haspopup="true"
        className={open ? "menu-trigger active" : "menu-trigger"}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setTimeout(
              () =>
                ref.current
                  ?.querySelector<HTMLButtonElement>(".menu-popup button")
                  ?.focus(),
              0,
            );
          }
        }}
      >
        {label}
      </button>
      {open && (
        <div
          className="menu-popup"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("button")) setOpen(false);
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
export function MenuItem({
  children,
  onClick,
  shortcut,
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  shortcut?: string;
  disabled?: boolean;
}) {
  return (
    <button disabled={disabled} onClick={onClick}>
      {children}
      {shortcut && <kbd>{shortcut}</kbd>}
    </button>
  );
}
