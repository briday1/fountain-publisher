import { analyzeScreenplay } from "../core/insights";
import { useState } from "react";
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Download,
  ArrowUpRight,
} from "lucide-react";
import { newId } from "../core/model";
import type { Beat, Screenplay } from "../core/model";
const guide = [
  ["Opening image", "The world before everything changes.", "Act I"],
  ["Theme stated", "The question your story asks.", "Act I"],
  ["Set-up", "Meet the people and the lives at stake.", "Act I"],
  ["Catalyst", "The event that breaks the routine.", "Act I"],
  ["Debate", "A reason to hesitate. A reason to go.", "Act I"],
  ["Break into two", "An irreversible choice.", "Act II"],
  ["B story", "A relationship that tests the theme.", "Act II"],
  [
    "Promise of the premise",
    "Explore the possibilities of this new world.",
    "Act II",
  ],
  ["Midpoint", "A victory or defeat changes the stakes.", "Act II"],
  ["Pressure builds", "Options narrow. The cost rises.", "Act II"],
  ["All is lost", "The old approach fails.", "Act II"],
  ["Dark night", "What must change within?", "Act II"],
  ["Break into three", "A new understanding becomes action.", "Act III"],
  ["Finale", "Put that change to the test.", "Act III"],
  ["Final image", "Show how the world has changed.", "Act III"],
];
export function BeatBoard({
  doc,
  onChange,
  onScene,
  onExport,
  onExportCsv,
}: {
  doc: Screenplay;
  onChange: (doc: Screenplay) => void;
  onScene: (id: string) => void;
  onExport: () => void;
  onExportCsv: () => void;
}) {
  const [showPacing, setShowPacing] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const beats = doc.metadata.beats;
  const pacing = analyzeScreenplay(doc).scenes;
  const scenes = doc.blocks.filter((b) => b.kind === "scene");
  const update = (items: Beat[]) =>
    onChange({ ...doc, metadata: { ...doc.metadata, beats: items } });
  const edit = (id: string, patch: Partial<Beat>) =>
    update(beats.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const move = (i: number, delta: number) => {
    const arr = [...beats];
    [arr[i], arr[i + delta]] = [arr[i + delta], arr[i]];
    update(arr);
  };
  const add = () =>
    update([
      ...beats,
      {
        id: newId(),
        title: "",
        description: "",
        act: "Act I",
        color: "#75a8ed",
      },
    ]);
  return (
    <section className="beat-board" aria-label="Beat sheet">
      <div className="board-heading">
        <div>
          <small>THE SHAPE OF YOUR STORY</small>
          <h1>Beat sheet</h1>
          <p>A little structure. Room for the unexpected.</p>
        </div>
        <div className="board-export">
          <button onClick={onExportCsv}>CSV</button>
          <button onClick={onExport}>
            <Download size={15} />
            PDF
          </button>
        </div>
      </div>
      <label className="premise">
        Premise
        <textarea
          value={String(doc.metadata.premise ?? "")}
          onChange={(e) =>
            onChange({
              ...doc,
              metadata: { ...doc.metadata, premise: e.target.value },
            })
          }
          placeholder="A person wants something. Something stands in their way."
          rows={2}
        />
      </label>
      <div className="board-tools">
        <span>
          {beats.length} beats · {beats.filter((b) => b.sceneId).length} linked
          to scenes
        </span>
        <div>
          <button
            aria-pressed={showPacing}
            onClick={() => setShowPacing(!showPacing)}
          >
            Pacing
          </button>
          <button
            aria-pressed={showGuide}
            onClick={() => setShowGuide(!showGuide)}
          >
            Beat guide
          </button>
          <button className="primary" onClick={add}>
            <Plus size={15} />
            Add beat
          </button>
        </div>
      </div>
      {showPacing && (
        <section className="pacing-chart" aria-label="Scene pacing">
          <h3>Words per scene</h3>
          <div>
            {pacing.map((scene) => (
              <button
                key={scene.id}
                style={{
                  height: `${Math.max(12, (scene.wordCount / Math.max(1, ...pacing.map((s) => s.wordCount))) * 100)}%`,
                }}
                title={`${scene.heading}: ${scene.wordCount} words`}
                aria-label={`Scene ${scene.number}, ${scene.wordCount} words`}
                onClick={() => onScene(scene.id)}
              >
                <span>{scene.number}</span>
              </button>
            ))}
          </div>
          <p>Each bar is one scene. Select it to return to the screenplay.</p>
        </section>
      )}
      {showGuide && (
        <div className="beat-guide">
          <p>
            Use this familiar 15-beat structure as a starting point. Each beat
            is yours to change.
          </p>
          <button
            onClick={() => {
              update([
                ...beats,
                ...guide.map(([title, description, act]) => ({
                  id: newId(),
                  title,
                  description,
                  act,
                  color:
                    act === "Act I"
                      ? "#75a8ed"
                      : act === "Act II"
                        ? "#bc93ce"
                        : "#73b999",
                })),
              ]);
              setShowGuide(false);
            }}
          >
            Add story structure
          </button>
        </div>
      )}
      {!beats.length && (
        <div className="board-empty">
          <span className="empty-mark">✦</span>
          <h2>Every story starts with a possibility.</h2>
          <p>Add a beat, or open the guide for a starting structure.</p>
          <button onClick={add}>
            <Plus size={16} />
            Your first beat
          </button>
        </div>
      )}
      <ol className="beat-list">
        {beats.map((beat, i) => (
          <li
            className="beat-card"
            key={beat.id}
            style={{ borderLeftColor: beat.color }}
          >
            <div className="beat-index">{String(i + 1).padStart(2, "0")}</div>
            <div className="beat-fields">
              <div className="beat-top">
                <input
                  aria-label={`Beat ${i + 1} title`}
                  placeholder="Name this moment"
                  value={beat.title}
                  onChange={(e) => edit(beat.id, { title: e.target.value })}
                />
                <select
                  aria-label={`Beat ${i + 1} act`}
                  value={beat.act}
                  onChange={(e) => edit(beat.id, { act: e.target.value })}
                >
                  {["Act I", "Act II", "Act III"].map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
                <input
                  type="color"
                  aria-label={`Beat ${i + 1} color`}
                  value={beat.color}
                  onChange={(e) => edit(beat.id, { color: e.target.value })}
                />
              </div>
              <textarea
                aria-label={`Beat ${i + 1} description`}
                placeholder="What changes in this moment?"
                value={beat.description}
                onChange={(e) => edit(beat.id, { description: e.target.value })}
                rows={2}
              />
              <div className="beat-bottom">
                <select
                  aria-label={`Beat ${i + 1} scene`}
                  value={beat.sceneId ?? ""}
                  onChange={(e) =>
                    edit(beat.id, { sceneId: e.target.value || undefined })
                  }
                >
                  <option value="">Link a scene…</option>
                  {scenes.map((s, j) => (
                    <option key={s.id} value={s.id}>
                      {j + 1}. {s.text}
                    </option>
                  ))}
                </select>
                {beat.sceneId && (
                  <button
                    className="icon-button"
                    aria-label="Go to linked scene"
                    onClick={() => onScene(beat.sceneId!)}
                  >
                    <ArrowUpRight size={15} />
                  </button>
                )}
                <div className="spacer" />
                <button
                  className="icon-button"
                  disabled={i === 0}
                  aria-label="Move beat up"
                  onClick={() => move(i, -1)}
                >
                  <ChevronUp size={15} />
                </button>
                <button
                  className="icon-button"
                  disabled={i === beats.length - 1}
                  aria-label="Move beat down"
                  onClick={() => move(i, 1)}
                >
                  <ChevronDown size={15} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`Delete beat ${i + 1}`}
                  onClick={() => update(beats.filter((b) => b.id !== beat.id))}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
