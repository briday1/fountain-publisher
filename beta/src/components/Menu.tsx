import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
export function Menu({
  label,
  children,
  anchored = false,
}: {
  label: string;
  children: ReactNode;
  anchored?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  useLayoutEffect(() => {
    if (!open || !anchored) return;
    const trigger = ref.current?.querySelector("button");
    const popup = popupRef.current;
    if (!trigger || !popup) return;
    const place = () => {
      const anchor = trigger.getBoundingClientRect();
      const bounds = popup.getBoundingClientRect();
      const margin = 8;
      const below = anchor.bottom + 4;
      const above = anchor.top - bounds.height - 4;
      setPosition({
        left: Math.max(
          margin,
          Math.min(anchor.left, window.innerWidth - bounds.width - margin),
        ),
        top: Math.max(
          margin,
          Math.min(
            below + bounds.height <= window.innerHeight - margin
              ? below
              : above,
            window.innerHeight - bounds.height - margin,
          ),
        ),
      });
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(trigger);
    observer.observe(popup);
    const scroll = (event: Event) => {
      if (!popup.contains(event.target as Node)) place();
    };
    window.addEventListener("resize", place);
    document.addEventListener("scroll", scroll, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
      document.removeEventListener("scroll", scroll, true);
    };
  }, [open, anchored]);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (
        !ref.current?.contains(e.target as Node) &&
        !popupRef.current?.contains(e.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  const popup = open && (
    <div
      ref={popupRef}
      className={`menu-popup${anchored ? " anchored-menu-popup" : ""}`}
      style={
        anchored
          ? {
              position: "fixed",
              ...position,
              maxWidth: "calc(100vw - 16px)",
              maxHeight: "calc(100dvh - 16px)",
              zIndex: 100,
            }
          : undefined
      }
      onClick={(e) => {
        const button = (e.target as HTMLElement).closest("button");
        if (button && !button.disabled) {
          setOpen(false);
          ref.current?.querySelector("button")?.focus();
        }
      }}
    >
      {children}
    </div>
  );
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
            popupRef.current!.querySelectorAll<HTMLButtonElement>(
              "button:not(:disabled)",
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
                popupRef.current
                  ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
                  ?.focus(),
              0,
            );
          }
        }}
      >
        {label}
      </button>
      {anchored && popup ? createPortal(popup, document.body) : popup}
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
