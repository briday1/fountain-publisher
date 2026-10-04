import { memo, useEffect, useRef, useState } from "react";
import { EditorController } from "../editor/EditorController";
import { AnnotationDialog } from "./AnnotationDialog";
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
  return (
    <>
      <div ref={host} className="editor-host" />
      {annotation && (
        <AnnotationDialog
          target={annotation}
          onSave={(value) =>
            controller.current?.saveAnnotation(annotation, value)
          }
          onClose={close}
        />
      )}
    </>
  );
});
