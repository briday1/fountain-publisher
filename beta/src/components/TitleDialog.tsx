import { useState } from "react";
import { Modal } from "./Modal";
import type { TitlePage } from "../core/model";
export function TitleDialog({
  value,
  onSave,
  onClose,
}: {
  value: TitlePage;
  onSave: (v: TitlePage) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <Modal title="Title page" eyebrow="YOUR SCREENPLAY" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(draft);
          onClose();
        }}
      >
        <div className="form-grid">
          {(
            [
              ["title", "Title"],
              ["credit", "Credit"],
              ["author", "Author"],
              ["source", "Based on"],
              ["draftDate", "Draft date"],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                value={draft[key]}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                autoFocus={key === "title"}
              />
            </label>
          ))}
          <label>
            Contact
            <textarea
              rows={3}
              value={draft.contact}
              onChange={(e) => setDraft({ ...draft, contact: e.target.value })}
            />
          </label>
        </div>
        <footer className="dialog-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" type="submit">
            Save title page
          </button>
        </footer>
      </form>
    </Modal>
  );
}
