import { useEffect, useRef, useId } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { useModalScrollLock } from "./useModalScrollLock";
export function Modal({
  title,
  eyebrow,
  children,
  onClose,
  wide = false,
  className = "",
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useModalScrollLock(ref);
  useEffect(() => {
    const el = ref.current!;
    el.showModal();
    return () => el.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""} ${className}`}
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-content">
        <header className="modal-header">
          <div>
            {eyebrow && <small>{eyebrow}</small>}
            <h2 id={id}>{title}</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
