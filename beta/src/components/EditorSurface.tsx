import { memo, useEffect, useRef } from "react";
import { EditorController } from "../editor/EditorController";
import type { Screenplay, BlockKind } from "../core/model";
export const EditorSurface = memo(function EditorSurface({
  initial,
  onReady,
  onChange,
  onSelection,
}: {
  initial: Screenplay;
  onReady: (editor: EditorController | null) => void;
  onChange: (remote?: boolean) => void;
  onSelection: (kind: BlockKind) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const props = useRef({ initial, onReady, onChange, onSelection });
  useEffect(() => {
    const p = props.current;
    const editor = new EditorController(host.current!, p.initial, {
      onChange: p.onChange,
      onSelection: p.onSelection,
    });
    p.onReady(editor);
    return () => {
      p.onReady(null);
      editor.destroy();
    };
  }, []);
  return <div ref={host} className="editor-host" />;
});
