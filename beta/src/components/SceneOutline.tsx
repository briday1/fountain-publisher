import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import type { analyzeScreenplay } from "../core/insights";
export function SceneOutline({
  insights,
  onJump,
  onAdd,
  viewActions,
}: {
  insights: ReturnType<typeof analyzeScreenplay>;
  onJump: (id: string) => void;
  onAdd: () => void;
  viewActions?: (id: string) => ReactNode;
}) {
  return (
    <>
      <div className="outline-section">
        <small>SCENES</small>
        <span>{insights.sceneCount}</span>
      </div>
      <ol className="scene-list">
        {insights.scenes.map((s, i) => (
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
        ))}
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
    </>
  );
}
