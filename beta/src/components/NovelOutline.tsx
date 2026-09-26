import { type ReactNode, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import type { Screenplay } from "../core/model";
export function NovelOutline({
  doc,
  onJump,
  onAdd,
  onBeats,
  viewActions,
}: {
  viewActions?: (id: string) => ReactNode;
  doc: Screenplay;
  onJump: (id: string) => void;
  onAdd: () => void;
  onBeats: () => void;
}) {
  const [folded, setFolded] = useState(new Set<string>());
  const headings = doc.blocks.filter((b) => b.kind === "section");
  const ancestors: { id: string; level: number }[] = [];
  return (
    <>
      <div className="outline-section">
        <small>BOOK STRUCTURE</small>
        <span>{headings.length}</span>
      </div>
      <ol className="novel-outline">
        {headings.map((heading) => {
          const level = heading.level || 2;
          while (ancestors.length && ancestors.at(-1)!.level >= level)
            ancestors.pop();
          const hidden = ancestors.some((a) => folded.has(a.id));
          const depth = ancestors.length;
          ancestors.push({ id: heading.id, level });
          const next = headings[headings.indexOf(heading) + 1];
          const children = next && (next.level || 2) > level;
          const beats = doc.metadata.beats.filter(
            (b) => b.groupSceneId === heading.id,
          );
          return hidden ? null : (
            <li key={heading.id} style={{ paddingLeft: depth * 12 }}>
              <div>
                {children ? (
                  <button
                    className="icon-button"
                    aria-label={`${folded.has(heading.id) ? "Expand" : "Collapse"} ${heading.text}`}
                    aria-expanded={!folded.has(heading.id)}
                    onClick={() =>
                      setFolded((current) => {
                        const next = new Set(current);
                        if (next.has(heading.id)) next.delete(heading.id);
                        else next.add(heading.id);
                        return next;
                      })
                    }
                  >
                    <ChevronDown size={13} />
                  </button>
                ) : (
                  <span className="novel-outline-spacer" />
                )}
                <button
                  className="novel-outline-jump"
                  onClick={() => onJump(heading.id)}
                >
                  {heading.text || "Untitled heading"}
                  <small>Level {level}</small>
                </button>
                {viewActions?.(heading.id)}
              </div>
              {!!beats.length && (
                <button className="novel-outline-beats" onClick={onBeats}>
                  {beats.length} related {beats.length === 1 ? "beat" : "beats"}
                </button>
              )}
            </li>
          );
        })}
      </ol>
      {!headings.length && (
        <p className="panel-empty">
          Book, chapter and section headings appear here as you write.
        </p>
      )}
      <button className="subtle-button add-scene" onClick={onAdd}>
        <Plus size={15} />
        Add chapter
      </button>
    </>
  );
}
