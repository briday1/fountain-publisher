import { useState, type ReactNode } from "react";
import type { Screenplay } from "../core/model";
import { ChevronDown, Plus } from "lucide-react";
import type { analyzeScreenplay } from "../core/insights";
export function SceneOutline({
  doc,
  onAddAct,
  insights,
  onJump,
  onAdd,
  viewActions,
}: {
  doc: Screenplay;
  onAddAct: () => void;
  insights: ReturnType<typeof analyzeScreenplay>;
  onJump: (id: string) => void;
  onAdd: () => void;
  viewActions?: (id: string) => ReactNode;
}) {
  const [folded, setFolded] = useState(new Set<string>());
  let currentAct: string | undefined;
  return (
    <>
      <div className="outline-section">
        <small>ACTS &amp; SCENES</small>
        <span>{insights.sceneCount}</span>
      </div>
      <ol className="scene-list">
        {doc.blocks
          .filter(
            (block) =>
              block.kind === "scene" ||
              (block.kind === "section" && (block.level || 1) === 1),
          )
          .map((block) => {
            if (block.kind === "section") {
              currentAct = block.id;
              return (
                <li key={block.id} className="outline-act">
                  <button
                    className="icon-button act-toggle"
                    aria-label={`${folded.has(block.id) ? "Expand" : "Collapse"} ${block.text}`}
                    aria-expanded={!folded.has(block.id)}
                    onClick={() =>
                      setFolded((value) => {
                        const next = new Set(value);
                        if (next.has(block.id)) next.delete(block.id);
                        else next.add(block.id);
                        return next;
                      })
                    }
                  >
                    <ChevronDown
                      size={14}
                      style={{
                        transform: folded.has(block.id)
                          ? "rotate(-90deg)"
                          : undefined,
                      }}
                    />
                  </button>
                  <button onClick={() => onJump(block.id)}>
                    {block.text || "Untitled act"}
                  </button>
                  {viewActions?.(block.id)}
                </li>
              );
            }
            if (currentAct && folded.has(currentAct)) return null;
            const i = insights.scenes.findIndex(
              (scene) => scene.id === block.id,
            );
            const s = insights.scenes[i];
            if (!s) return null;
            return (
              <li key={s.id}>
                {viewActions?.(s.id)}
                <button onClick={() => onJump(s.id)}>
                  <span className="scene-index">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>
                    {s.heading}
                    <small>
                      {s.synopsis ||
                        `${s.wordCount} words · ${s.timeOfDay || "Scene"}`}
                    </small>
                  </span>
                </button>
              </li>
            );
          })}
      </ol>
      {!insights.sceneCount && (
        <p className="panel-empty">
          Your scenes will appear here as you write.
        </p>
      )}
      <button className="subtle-button add-scene" onClick={onAdd}>
        <Plus size={15} />
        Add scene
      </button>
      <button className="subtle-button add-scene" onClick={onAddAct}>
        <Plus size={15} /> Add act
      </button>
    </>
  );
}
