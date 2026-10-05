import { useState } from "react";
import type { AnnotationTarget } from "../editor/annotations";
import { Modal } from "./Modal";
import "./annotation-dialog.css";

export function AnnotationDialog({
  target,
  title = target.noteId ? "Edit Annotation" : "Add Annotation",
  onSave,
  onClose,
}: {
  target: AnnotationTarget;
  title?: string;
  onSave: (value: string | null) => void;
  onClose: () => void;
}) {
  const noun = target.footnote ? "footnote" : "annotation";
  const [text, setText] = useState(target.text);
  const [error, setError] = useState("");
  const save = (value: string | null) => {
    try {
      onSave(value);
      onClose();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not save annotation.",
      );
    }
  };
  return (
    <Modal
      title={
        target.footnote
          ? target.noteId
            ? "Edit footnote"
            : "Add footnote"
          : title
      }
      className="annotation-dialog"
      onClose={onClose}
    >
      <form
        className="form-grid annotation-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (target.canEdit && text.trim()) save(text);
        }}
      >
        <textarea
          aria-label={target.footnote ? "Footnote" : "Annotation"}
          autoFocus
          rows={5}
          placeholder={target.canEdit ? "Write a note…" : undefined}
          value={text}
          readOnly={!target.canEdit}
          onChange={(event) => setText(event.target.value)}
        />
        {error && (
          <p className="annotation-error" role="alert">
            {error}
          </p>
        )}
        <div className="annotation-actions">
          {target.canEdit && target.noteId && (
            <button
              className="annotation-delete"
              type="button"
              onClick={() => save(null)}
            >
              Delete {noun}
            </button>
          )}
          <button type="button" onClick={onClose}>
            {target.canEdit ? "Cancel" : "Close"}
          </button>
          {target.canEdit && (
            <button className="primary" type="submit" disabled={!text.trim()}>
              Save {noun}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
