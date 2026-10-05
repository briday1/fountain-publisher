import { useLayoutEffect, useRef } from "react";

/** Side panels begin at the page, below the actual (possibly resized) tab strip. */
export function usePanelBounds() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const measure = () => {
      const top = root.getBoundingClientRect().top;
      for (const [name, selector] of [
        ["outline", ".outline-panel"],
        ["insights", ".insights-panel"],
      ]) {
        const panel = root.querySelector(selector);
        root.style.setProperty(
          `--${name}-space`,
          panel ? `${panel.getBoundingClientRect().width + 4}px` : "0px",
        );
      }
      const headers = [...root.querySelectorAll(".document-pane-header")];
      const bottom = Math.max(
        top,
        ...headers.map((el) => el.getBoundingClientRect().bottom),
      );
      root.style.setProperty("--panel-top", `${Math.max(0, bottom - top)}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    root
      .querySelectorAll(
        ".document-pane-header, .search-panel, .writing-beat-guide, .outline-panel, .insights-panel",
      )
      .forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  });
  return ref;
}
