import { useRef, useState } from "react";
import { Modal } from "./Modal";
import type { TitlePage } from "../core/model";
import { titlePageExtra, withTitlePageExtra } from "../core/titlePage";
export function TitleDialog({
  value,
  onSave,
  onClose,
  readOnly = false,
  novel = false,
}: {
  value: TitlePage;
  onSave: (v: TitlePage, original: TitlePage) => void;
  onClose: () => void;
  readOnly?: boolean;
  novel?: boolean;
}) {
  const original = useRef(value).current;
  const [draft, setDraft] = useState(value);
  return (
    <Modal
      title="Title page"
      eyebrow={novel ? "YOUR BOOK" : "YOUR SCREENPLAY"}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (readOnly) return;
          onSave(draft, original);
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
          )
            .filter(([key]) => !novel || ["title", "author"].includes(key))
            .map(([key, label]) => (
              <label key={key}>
                {label}
                <textarea
                  readOnly={readOnly}
                  value={draft[key]}
                  onChange={(e) =>
                    setDraft({ ...draft, [key]: e.target.value })
                  }
                  autoFocus={key === "title"}
                  rows={key === "title" || key === "source" ? 2 : 1}
                />
              </label>
            ))}
          {!novel && (
            <label>
              Contact
              <textarea
                readOnly={readOnly}
                rows={3}
                value={draft.contact}
                onChange={(e) =>
                  setDraft({ ...draft, contact: e.target.value })
                }
              />
            </label>
          )}
          {novel && (
            <label>
              Dedication <small>(optional)</small>
              <textarea
                readOnly={readOnly}
                rows={3}
                value={titlePageExtra(draft, "Dedication")}
                onChange={(e) =>
                  setDraft(
                    withTitlePageExtra(draft, "Dedication", e.target.value),
                  )
                }
              />
            </label>
          )}
          <label>
            Copyright
            <input
              readOnly={readOnly}
              value={titlePageExtra(draft, "Copyright")}
              onChange={(e) =>
                setDraft(withTitlePageExtra(draft, "Copyright", e.target.value))
              }
            />
          </label>
        </div>
        <footer className="dialog-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" type="submit" disabled={readOnly}>
            Save title page
          </button>
        </footer>
      </form>
    </Modal>
  );
}
