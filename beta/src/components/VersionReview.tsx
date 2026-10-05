import { useMemo, useRef, useState } from "react";
import { Modal } from "./Modal";
import {
  reviewDiff,
  resolveReview,
  type ReviewChoice,
} from "../core/versionReview";
import "./version-comparison.css";

function detailText(source: string) {
  const match =
    /(?:FOUNTAIN-PUBLISHER v1|WriteShape metadata)\n([^]*?)\n(?:\*\/|-->)/.exec(
      source,
    );
  try {
    const data = JSON.parse(match?.[1] || "{}");
    return JSON.stringify(data.metadata || {}, null, 2);
  } catch {
    return source;
  }
}
export function VersionReview({
  older,
  current,
  olderLabel,
  onSave,
  onClose,
}: {
  older: string;
  current: string;
  olderLabel: string;
  onSave: (content: string) => Promise<void>;
  onClose: () => void;
}) {
  const review = useMemo(() => reviewDiff(older, current), [older, current]);
  const changes = review.parts.filter((p) => "id" in p);
  const [choices, setChoices] = useState<Record<number, ReviewChoice>>({});
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const refs = useRef(new Map<number, HTMLSpanElement>());
  const resolved = Object.keys(choices).length;
  const selected = changes[active];
  function move(index: number) {
    const next = (index + changes.length) % changes.length;
    setActive(next);
    const node = refs.current.get(changes[next]?.id);
    node?.focus({ preventScroll: true });
    node?.scrollIntoView({ block: "center", behavior: "smooth" });
  }
  function close() {
    if (
      !busy &&
      (!resolved ||
        window.confirm(
          "Discard these review choices? Your document and saved versions will stay unchanged.",
        ))
    )
      onClose();
  }
  return (
    <Modal
      title="See changes"
      eyebrow={`${olderLabel} → CURRENT VERSION`}
      onClose={close}
      wide
      className="version-review-dialog"
    >
      <section
        className="version-comparison"
        aria-label="Choose changes to keep"
      >
        <p>
          This review is not autosaved. Choose what to keep, then save a new
          version.
        </p>
        <div className="version-diff-toolbar">
          <div className="version-diff-legend">
            <ins>+ Added in current</ins>
            <del>− Removed from current</del>
          </div>
          <div>
            <button
              disabled={!review.count || busy}
              onClick={() => move(active - 1)}
            >
              Previous change
            </button>
            <button
              disabled={!review.count || busy}
              onClick={() => move(active + 1)}
            >
              Next change
            </button>
          </div>
          <span role="status">
            {review.count
              ? `Change ${active + 1} of ${review.count} · ${resolved} of ${review.count} reviewed`
              : "These versions are identical."}
          </span>
          {selected && (
            <div
              className="review-choices"
              role="group"
              aria-label={`Decision for change ${active + 1}`}
            >
              <button
                disabled={busy}
                aria-pressed={choices[selected.id] === "current"}
                onClick={() =>
                  setChoices({ ...choices, [selected.id]: "current" })
                }
              >
                Keep current
              </button>
              <button
                disabled={busy}
                aria-pressed={choices[selected.id] === "older"}
                onClick={() =>
                  setChoices({ ...choices, [selected.id]: "older" })
                }
              >
                Use saved version
              </button>
            </div>
          )}
        </div>
        <div
          className="version-diff-paper review-source"
          aria-label="Document changes"
        >
          {review.parts.map((part, i) =>
            "text" in part ? (
              <span key={i}>{part.text}</span>
            ) : (
              <span
                key={i}
                ref={(node) => {
                  if (node) refs.current.set(part.id, node);
                  else refs.current.delete(part.id);
                }}
                tabIndex={0}
                role="button"
                aria-label={`Change ${part.id + 1}${choices[part.id] ? `, ${choices[part.id] === "current" ? "keeping current" : "using saved version"}` : ", needs review"}`}
                aria-pressed={active === part.id}
                onClick={() => setActive(part.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setActive(part.id);
                  }
                }}
                className={`review-change${active === part.id ? " selected" : ""}${choices[part.id] ? " reviewed" : ""}`}
              >
                {part.details ? (
                  <span className="review-details">
                    Notes and document details:
                    <br />
                    <del>{detailText(part.older)}</del>
                    <br />
                    <ins>{detailText(part.current)}</ins>
                  </span>
                ) : (
                  <>
                    {part.older && (
                      <del
                        className={
                          choices[part.id] === "current" ? "not-kept" : ""
                        }
                      >
                        {part.older}
                      </del>
                    )}
                    {part.current && (
                      <ins
                        className={
                          choices[part.id] === "older" ? "not-kept" : ""
                        }
                      >
                        {part.current}
                      </ins>
                    )}
                  </>
                )}
              </span>
            ),
          )}
        </div>
        {error && (
          <p role="alert" className="library-error">
            {error}
          </p>
        )}
        <footer className="dialog-actions">
          <button disabled={busy} onClick={close}>
            Back
          </button>
          <button
            disabled={busy || !review.count}
            onClick={() =>
              setChoices(
                Object.fromEntries(changes.map((p) => [p.id, "current"])),
              )
            }
          >
            Keep all current
          </button>
          <button
            className="primary"
            disabled={busy || resolved !== review.count || !review.count}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await onSave(resolveReview(review, choices));
                onClose();
              } catch (reason) {
                setError(
                  reason instanceof Error
                    ? reason.message
                    : "The new version could not be saved. Your choices are still here.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Saving…" : "Save new version"}
          </button>
        </footer>
      </section>
    </Modal>
  );
}
