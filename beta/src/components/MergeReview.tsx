import { useState } from "react";
import { Modal } from "./Modal";
import type { MergeChoice, MergeConflict } from "../core/merge";
import "./version-comparison.css";
export function MergeReview({
  conflicts,
  currentLabel = "Current writing",
  incomingLabel = "Changes from this device",
  onSave,
  onClose,
}: {
  conflicts: MergeConflict[];
  currentLabel?: string;
  incomingLabel?: string;
  onSave(choices: Record<string, MergeChoice>): Promise<void>;
  onClose(): void;
}) {
  const [choices, setChoices] = useState<Record<string, MergeChoice>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Modal
      title="Review overlapping changes"
      wide
      className="version-review-dialog"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p>
        Changes that fit together are already combined. Choose what to keep
        where the writing overlaps.
      </p>
      <div className="merge-review-list">
        {conflicts.map((conflict, index) => (
          <section
            key={conflict.id}
            className="merge-review-change"
            aria-label={`Overlapping change ${index + 1}`}
          >
            <h3>{conflict.label}</h3>
            <div className="merge-review-options">
              {(["current", "incoming"] as const).map((side) => (
                <button
                  key={side}
                  disabled={busy}
                  aria-pressed={choices[conflict.id] === side}
                  onClick={() =>
                    setChoices({ ...choices, [conflict.id]: side })
                  }
                >
                  <strong>
                    {side === "current" ? currentLabel : incomingLabel}
                  </strong>
                  <span>{conflict[side] || "Remove this passage"}</span>
                  <small>
                    {choices[conflict.id] === side ? "✓ Kept" : "Keep this"}
                  </small>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
      <footer className="dialog-actions">
        <span role="status">
          {Object.keys(choices).length} of {conflicts.length} reviewed
        </span>
        <button disabled={busy} onClick={onClose}>
          Back
        </button>
        <button
          className="primary"
          disabled={busy || Object.keys(choices).length !== conflicts.length}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await onSave(choices);
              onClose();
            } catch (e) {
              setError(
                e instanceof Error
                  ? e.message
                  : "The review could not be saved. Your choices are kept.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Saving…" : "Save reviewed changes"}
        </button>
      </footer>
    </Modal>
  );
}
