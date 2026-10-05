import { useEffect, useMemo, useRef, useState } from "react";
import type { TextSpan } from "../core/model";
import { versionDiff } from "../core/versionDiff";
import "./version-comparison.css";
function FormattedText({ part }: { part: TextSpan }) {
  return (
    <span
      style={{
        fontWeight: part.marks?.includes("bold") ? "bold" : undefined,
        fontStyle: part.marks?.includes("italic") ? "italic" : undefined,
        textDecoration: part.marks?.includes("underline")
          ? "underline"
          : undefined,
      }}
    >
      {part.text}
    </span>
  );
}
export function VersionComparison({
  novel = false,
  reviewMode = false,
  choice,
  older,
  newer,
  olderLabel,
  newerLabel,
}: {
  novel?: boolean;
  reviewMode?: boolean;
  choice?: "older" | "current";
  older: string;
  newer: string;
  olderLabel: string;
  newerLabel: string;
}) {
  const blocks = useMemo(
    () => versionDiff(older, newer, novel),
    [older, newer, novel],
  );
  const changes = blocks.flatMap((b, i) => (b.changed ? [i] : []));
  const [active, setActive] = useState(-1);
  const nodes = useRef(new Map<number, HTMLParagraphElement>());
  useEffect(() => {
    if (reviewMode)
      nodes.current.get(changes[0])?.scrollIntoView?.({ block: "center" });
  }, [older, newer, reviewMode]);
  const move = (delta: number) => {
    const next = (active + delta + changes.length) % changes.length;
    setActive(next);
    const node = nodes.current.get(changes[next]);
    node?.focus({ preventScroll: true });
    node?.scrollIntoView({ block: "center", behavior: "smooth" });
  };
  return (
    <section
      className={`version-comparison${novel ? " novel-comparison" : ""}`}
      aria-label="Formatted screenplay comparison"
    >
      {!reviewMode && (
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
      )}
      {reviewMode && !changes.length && (
        <p className="muted">
          This change affects spacing or document details rather than visible
          text. Choose which version to keep.
        </p>
      )}
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
                <ins
                  key={j}
                  className={choice === "older" ? "not-kept" : undefined}
                >
                  <span className="sr-only">Added: </span>
                  <FormattedText part={part} />
                </ins>
              ) : part.change === "removed" ? (
                <del
                  key={j}
                  className={choice === "current" ? "not-kept" : undefined}
                >
                  <span className="sr-only">Removed: </span>
                  <FormattedText part={part} />
                </del>
              ) : (
                <span key={j}>
                  <FormattedText part={part} />
                </span>
              ),
            )}
          </p>
        ))}
      </div>
    </section>
  );
}
