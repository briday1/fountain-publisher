import { memo, useEffect, useRef, useState } from "react";
import { EditorController } from "../editor/EditorController";
import { Modal } from "./Modal";
import type { AnnotationTarget } from "../editor/annotations";
import type { Screenplay, BlockKind } from "../core/model";
export const EditorSurface = memo(function EditorSurface({
  initial,
  onReady,
  onChange,
  onSelection,
  onAnnotationState,
  onWritingActivity,
}: {
  initial: Screenplay;
  onReady: (editor: EditorController | null) => void;
  onChange: (remote?: boolean) => void;
  onWritingActivity?: (words: number, pasted?: boolean) => void;
  onSelection: (kind: BlockKind, dual: boolean) => void;
  onAnnotationState?: (state: "add" | "edit" | "unavailable") => void;
}) {
  const controller = useRef<EditorController | null>(null);
  const [annotation, setAnnotation] = useState<AnnotationTarget | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const host = useRef<HTMLDivElement>(null);
  const props = useRef({
    initial,
    onReady,
    onChange,
    onSelection,
    onAnnotationState,
    onWritingActivity,
  });
  useEffect(() => {
    const p = props.current;
    const editor = new EditorController(host.current!, p.initial, {
      onChange: p.onChange,
      onWritingActivity: p.onWritingActivity,
      onSelection: p.onSelection,
      onAnnotationState: p.onAnnotationState,
      onAnnotation: (target) => {
        setAnnotation(target);
        setText(target.text);
        setError("");
      },
    });
    controller.current = editor;
    p.onReady(editor);
    return () => {
      p.onReady(null);
      controller.current = null;
      editor.destroy();
    };
  }, []);
  const close = () => {
    setAnnotation(null);
    controller.current?.focus();
  };
  const save = (value: string | null) => {
    try {
      if (!annotation || !controller.current) return;
      controller.current.saveAnnotation(annotation, value);
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save annotation.");
    }
  };
  return (
    <>
      <div ref={host} className="editor-host" />
      {annotation && (
        <Modal
          title={annotation.noteId ? "Edit Annotation" : "Add Annotation"}
          onClose={close}
        >
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              save(text);
            }}
          >
            <label>
              Annotation
              <textarea
                autoFocus
                rows={5}
                value={text}
                readOnly={!annotation.canEdit}
                onChange={(event) => setText(event.target.value)}
              />
            </label>
            {error && <p role="alert">{error}</p>}
            {annotation.canEdit && (
              <div className="annotation-actions">
                {annotation.noteId && (
                  <button type="button" onClick={() => save(null)}>
                    Delete annotation
                  </button>
                )}
                <button
                  className="primary"
                  type="submit"
                  disabled={!text.trim()}
                >
                  Save annotation
                </button>
              </div>
            )}
          </form>
        </Modal>
      )}
    </>
  );
});
