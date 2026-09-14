import { useEffect } from "react";
import type { RefObject } from "react";
import "./modal-scrolling.css";

let activeLocks = 0;
let restorePage: (() => void) | undefined;

/** Native dialogs make the page inert; keep wheel/touch scroll inside them too. */
export function useModalScrollLock(ref: RefObject<HTMLDialogElement | null>) {
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (activeLocks++ === 0) {
      const elements = [document.documentElement, document.body];
      const previous = elements.map((element) => ({
        element,
        overflow: element.style.overflow,
        overscroll: element.style.overscrollBehavior,
      }));
      for (const element of elements) {
        element.style.overflow = "hidden";
        element.style.overscrollBehavior = "none";
      }
      restorePage = () => {
        for (const { element, overflow, overscroll } of previous) {
          element.style.overflow = overflow;
          element.style.overscrollBehavior = overscroll;
        }
      };
    }
    return () => {
      if (--activeLocks === 0) {
        restorePage?.();
        restorePage = undefined;
      }
    };
  }, [ref]);
}
