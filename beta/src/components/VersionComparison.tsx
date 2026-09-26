import { useMemo, useRef, useState } from "react";
import { versionDiff } from "../core/versionDiff";
import "./version-comparison.css";
export function VersionComparison({
  older,
  newer,
  olderLabel,
  newerLabel,
}: {
  older: string;
  newer: string;
  olderLabel: string;
  newerLabel: string;
}) {
  const blocks = useMemo(() => versionDiff(older, newer), [older, newer]);
  const changes = blocks.flatMap((b, i) => (b.changed ? [i] : []));
  const [active, setActive] = useState(-1);
  const nodes = useRef(new Map<number, HTMLParagraphElement>());
  const move = (delta: number) => {
    const next = (active + delta + changes.length) % changes.length;
    setActive(next);
    const node = nodes.current.get(changes[next]);
    node?.focus({ preventScroll: true });
    node?.scrollIntoView({ block: "center", behavior: "smooth" });
  };
  return (
    <section
      className="version-comparison"
      aria-label="Formatted screenplay comparison"
    >
      <div className="version-diff-toolbar">
        <strong>
          {olderLabel} → {newerLabel}
        </strong>
        <div className="version-diff-legend">
          <span>
            <ins>+ Added</ins>
          </span>
          <span>
            <del>− Removed</del>
          </span>
        </div>
        <div>
          <button disabled={!changes.length} onClick={() => move(-1)}>
            Previous change
          </button>
          <button disabled={!changes.length} onClick={() => move(1)}>
            Next change
          </button>
        </div>
        <small role="status">
          {changes.length
            ? `${changes.length} changed passages${active >= 0 ? ` · ${active + 1} selected` : ""}`
            : "No visible screenplay text changes. Notes, formatting and file metadata may differ."}
        </small>
      </div>
      <div className="version-diff-paper" aria-label="Read-only screenplay">
        {blocks.map((block, i) => (
          <p
            key={i}
            ref={(node) => {
              if (node) nodes.current.set(i, node);
              else nodes.current.delete(i);
            }}
            tabIndex={block.changed ? -1 : undefined}
            className={`diff-block diff-${block.kind}${block.changed ? " diff-changed" : ""}`}
          >
            {block.parts.map((part, j) =>
              part.change === "added" ? (
                <ins key={j}>
                  <span className="sr-only">Added: </span>
                  {part.text}
                </ins>
              ) : part.change === "removed" ? (
                <del key={j}>
                  <span className="sr-only">Removed: </span>
                  {part.text}
                </del>
              ) : (
                <span key={j}>{part.text}</span>
              ),
            )}
          </p>
        ))}
      </div>
    </section>
  );
}
