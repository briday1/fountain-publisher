import { VersionComparison } from "./VersionComparison";
import { useMemo, useState } from "react";
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
    const metadata = data.metadata || {};
    return (
      [
        metadata.notes && `Story notes: ${metadata.notes}`,
        metadata.premise && `Premise: ${metadata.premise}`,
        ...(metadata.beats || []).map(
          (beat: { title: string; description: string }) =>
            `${beat.title}: ${beat.description}`,
        ),
      ]
        .filter(Boolean)
        .join("\n\n") || "No story notes or beats."
    );
  } catch {
    return "Document details updated.";
  }
}
export function VersionReview({
  novel = false,
  older,
  current,
  olderLabel,
  onSave,
  onClose,
}: {
  novel?: boolean;
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
  const resolved = Object.keys(choices).length;
  const selected = changes[active];
  function move(index: number) {
    const next = (index + changes.length) % changes.length;
    setActive(next);
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
          version. The preview highlights the selected change in context.
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
          className={`review-change${choices[selected?.id] ? " reviewed" : ""}`}
        >
          {selected?.details ? (
            <div className="review-details">
              <h3>Story notes and document details</h3>
              <p>
                These details are kept together with their version’s beat links
                and annotations.
              </p>
              <h4>Saved version</h4>
              <del>{detailText(selected.older)}</del>
              <h4>Current version</h4>
              <ins>{detailText(selected.current)}</ins>
            </div>
          ) : (
            <VersionComparison
              novel={novel}
              reviewMode
              choice={selected && choices[selected.id]}
              older={
                selected
                  ? resolveReview(
                      review,
                      Object.fromEntries(
                        changes.map((p) => [
                          p.id,
                          p.id === selected.id
                            ? "older"
                            : choices[p.id] || "current",
                        ]),
                      ),
                    )
                  : older
              }
              newer={
                selected
                  ? resolveReview(
                      review,
                      Object.fromEntries(
                        changes.map((p) => [
                          p.id,
                          p.id === selected.id
                            ? "current"
                            : choices[p.id] || "current",
                        ]),
                      ),
                    )
                  : current
              }
              olderLabel={olderLabel}
              newerLabel="Current version"
            />
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
