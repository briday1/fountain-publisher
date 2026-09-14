import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Download,
  ArrowUpRight,
  ChartNoAxesCombined,
  Link2,
} from "lucide-react";
import { newId } from "../core/model";
import type { Beat, BeatRange, Screenplay } from "../core/model";
import {
  beatRangeFromLines,
  resolveBeatRange,
  sceneBeatRange,
  screenplayLines,
} from "../core/beatRanges";
import { BeatPacing } from "./BeatPacing";
import "./beat-presentation.css";

function RangeFields({
  doc,
  beat,
  index,
  range,
  onApply,
  onClear,
}: {
  doc: Screenplay;
  beat: Beat;
  index: number;
  range?: BeatRange;
  onApply: (range: BeatRange) => void;
  onClear: () => void;
}) {
  const resolved = range ? resolveBeatRange(doc, range) : undefined;
  const [start, setStart] = useState(String(resolved?.startLine ?? ""));
  const [end, setEnd] = useState(String(resolved?.endLine ?? ""));
  const [error, setError] = useState("");
  const lastLine = screenplayLines(doc).at(-1)?.number ?? 1;
  useEffect(() => {
    setStart(String(resolved?.startLine ?? ""));
    setEnd(String(resolved?.endLine ?? ""));
    setError("");
  }, [resolved?.startLine, resolved?.endLine]);
  return (
    <form
      className="beat-range-fields"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const next =
          /^\d+$/.test(start) && /^\d+$/.test(end)
            ? beatRangeFromLines(doc, Number(start), Number(end))
            : undefined;
        if (!next) {
          setError(
            `Choose a range containing screenplay text, from line 1 through ${lastLine}, with the start no later than the end.`,
          );
          return;
        }
        onApply(next);
        setError("");
      }}
    >
      <div>
        <label>
          Start line
          <input
            type="number"
            min={1}
            max={lastLine}
            step={1}
            aria-label={`Beat ${index + 1} start line`}
            aria-invalid={!!error}
            aria-describedby={error ? `beat-range-error-${beat.id}` : undefined}
            value={start}
            onChange={(event) => setStart(event.target.value)}
          />
        </label>
        <label>
          End line
          <input
            type="number"
            min={1}
            max={lastLine}
            step={1}
            aria-label={`Beat ${index + 1} end line`}
            aria-invalid={!!error}
            aria-describedby={error ? `beat-range-error-${beat.id}` : undefined}
            value={end}
            onChange={(event) => setEnd(event.target.value)}
          />
        </label>
        <button type="submit" aria-label={`Apply beat ${index + 1} line range`}>
          Apply range
        </button>
        {(beat.range !== undefined || beat.sceneId) && (
          <button
            type="button"
            onClick={onClear}
            aria-label={`Clear beat ${index + 1} range`}
          >
            Clear range
          </button>
        )}
      </div>
      {error && (
        <p role="alert" id={`beat-range-error-${beat.id}`}>
          {error}
        </p>
      )}
    </form>
  );
}
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
  onAssign,
  onRange,
  onExport,
  onExportCsv,
}: {
  doc: Screenplay;
  onChange: (doc: Screenplay) => void;
  onAssign: (beatId: string) => void;
  onRange: (range: BeatRange) => void;
  onExport: () => void;
  onExportCsv: () => void;
}) {
  const [showPacing, setShowPacing] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dragged, setDragged] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const inputs = useRef(new Map<string, HTMLInputElement>());
  const pendingFocus = useRef<string | null>(null);
  const beats = doc.metadata.beats;
  const scenes = doc.blocks.filter((block) => block.kind === "scene");
  const assignments = new Map(
    beats.map((beat) => {
      const range =
        beat.range === undefined && beat.sceneId
          ? sceneBeatRange(doc, beat.sceneId)
          : beat.range;
      return [
        beat.id,
        { range, resolved: range ? resolveBeatRange(doc, range) : undefined },
      ];
    }),
  );
  const linked = [...assignments.values()].filter(
    (entry) => entry.resolved,
  ).length;
  useEffect(() => {
    if (pendingFocus.current) {
      inputs.current.get(pendingFocus.current)?.focus();
      pendingFocus.current = null;
    }
  }, [beats]);
  const update = (items: Beat[]) =>
    onChange({ ...doc, metadata: { ...doc.metadata, beats: items } });
  const edit = (id: string, patch: Partial<Beat>) =>
    update(
      beats.map((beat) => (beat.id === id ? { ...beat, ...patch } : beat)),
    );
  const moveTo = (from: number, to: number) => {
    if (
      from < 0 ||
      to < 0 ||
      from >= beats.length ||
      to >= beats.length ||
      from === to
    )
      return;
    const next = [...beats];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    update(next);
    setAnnouncement(`${moved.title || "Beat"} moved to position ${to + 1}.`);
  };
  const add = () => {
    const id = newId();
    pendingFocus.current = id;
    update([
      ...beats,
      {
        id,
        title: "",
        description: "",
        act: beats.at(-1)?.act || "Act I",
        color: "#75a8ed",
      },
    ]);
  };
  const toggleDetails = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className="beat-board beat-sheet-paper" aria-label="Beat sheet">
      {!beats.length && (
        <div className="beat-start-note">
          <strong>Map the story before—or while—you write.</strong>
          <p>
            Start with the premise, then add each story beat below. Assign
            each beat to the passage where it happens.
          </p>
        </div>
      )}
      <label className="beat-premise-field">
        <span>Premise</span>
        <textarea
          value={String(doc.metadata.premise ?? "")}
          onChange={(event) =>
            onChange({
              ...doc,
              metadata: { ...doc.metadata, premise: event.target.value },
            })
          }
          placeholder="What is this story really about?"
          rows={3}
        />
      </label>
      <div className="beat-flow-heading">
        <div>
          <small>STORY FLOW</small>
          <h1>Beats and assignments</h1>
        </div>
        <div className="beat-flow-tools">
          <button onClick={onExportCsv} aria-label="Export beat sheet CSV">
            CSV
          </button>
          <button onClick={onExport} aria-label="Export beat sheet PDF">
            <Download size={14} />
            <span>Export PDF</span>
          </button>
          <button onClick={() => setShowPacing(true)} aria-haspopup="dialog">
            <ChartNoAxesCombined size={14} />
            <span>View pacing graph</span>
          </button>
          <button className="primary" onClick={add}>
            <Plus size={14} />
            Add beat
          </button>
        </div>
      </div>
      <div className="beat-flow-summary">
        <span>
          {beats.length} beats · {linked} assigned
        </span>
        <button
          onClick={() => setShowGuide(!showGuide)}
          aria-expanded={showGuide}
        >
          Beat guide
        </button>
      </div>
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
      <ol className="beat-flow-list">
        {beats.map((beat, index) => {
          const assignment = assignments.get(beat.id)!;
          const isLinked = !!assignment.resolved;
          const open = expanded.has(beat.id);
          return (
            <li
              key={beat.id}
              className={`beat-flow-row ${isLinked ? "linked" : ""} ${dragged === beat.id ? "dragging" : ""}`}
              style={{ "--beat-color": beat.color } as CSSProperties}
              onDragOver={(event) => {
                if (dragged) {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (dragged)
                  moveTo(
                    beats.findIndex((item) => item.id === dragged),
                    index,
                  );
                setDragged(null);
              }}
            >
              <div className="beat-flow-node-lane">
                <button
                  className="beat-flow-number"
                  draggable
                  aria-label={`Reorder beat ${index + 1}: ${beat.title || "Untitled"}`}
                  title="Drag or use arrow keys to reorder"
                  aria-keyshortcuts="ArrowUp ArrowDown Home End"
                  onDragStart={(event) => {
                    setDragged(beat.id);
                    event.dataTransfer.setData("text/plain", beat.id);
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => setDragged(null)}
                  onKeyDown={(event) => {
                    const destination =
                      event.key === "ArrowUp"
                        ? index - 1
                        : event.key === "ArrowDown"
                          ? index + 1
                          : event.key === "Home"
                            ? 0
                            : event.key === "End"
                              ? beats.length - 1
                              : null;
                    if (destination !== null) {
                      event.preventDefault();
                      moveTo(index, destination);
                    }
                  }}
                >
                  {index + 1}
                </button>
                <div
                  className="beat-flow-move"
                  role="group"
                  aria-label={`Move beat ${index + 1}`}
                >
                  <button
                    aria-label={`Move beat ${index + 1} up`}
                    disabled={index === 0}
                    onClick={() => moveTo(index, index - 1)}
                  >
                    <ChevronUp size={13} />
                  </button>
                  <button
                    aria-label={`Move beat ${index + 1} down`}
                    disabled={index === beats.length - 1}
                    onClick={() => moveTo(index, index + 1)}
                  >
                    <ChevronDown size={13} />
                  </button>
                </div>
              </div>
              <div className="beat-flow-body">
                <div className="beat-flow-main">
                  <input
                    className="beat-flow-title"
                    aria-label={`Beat ${index + 1} title`}
                    placeholder="What happens in this beat?"
                    value={beat.title}
                    ref={(element) => {
                      if (element) inputs.current.set(beat.id, element);
                      else inputs.current.delete(beat.id);
                    }}
                    onChange={(event) =>
                      edit(beat.id, { title: event.target.value })
                    }
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        !event.nativeEvent.isComposing
                      ) {
                        event.preventDefault();
                        const next = beats[index + 1];
                        if (next) inputs.current.get(next.id)?.focus();
                        else add();
                      }
                    }}
                  />
                  <div className="beat-flow-assignment">
                    {assignment.resolved && assignment.range ? (
                      <button
                        className="beat-assigned-lines"
                        aria-label={`Show beat ${index + 1} lines ${assignment.resolved.startLine}–${assignment.resolved.endLine}`}
                        onClick={() => onRange(assignment.range!)}
                      >
                        Lines {assignment.resolved.startLine}–
                        {assignment.resolved.endLine}
                        <ArrowUpRight size={12} />
                      </button>
                    ) : beat.range !== undefined || beat.sceneId ? (
                      <span className="beat-range-unavailable">
                        Range unavailable
                      </span>
                    ) : null}
                    <button
                      className={
                        isLinked || beat.range !== undefined || beat.sceneId
                          ? "icon-button"
                          : "beat-assign-range"
                      }
                      aria-label={`Assign beat ${index + 1} to screenplay`}
                      title="Select this beat's passage in the screenplay"
                      onClick={() => onAssign(beat.id)}
                    >
                      <Link2 size={14} />
                      {!isLinked &&
                        beat.range === undefined &&
                        !beat.sceneId &&
                        "Assign range"}
                    </button>
                  </div>
                  <button
                    className="icon-button beat-flow-disclosure"
                    aria-label={`Beat ${index + 1} details`}
                    aria-expanded={open}
                    aria-controls={`beat-details-${beat.id}`}
                    onClick={() => toggleDetails(beat.id)}
                  >
                    <ChevronDown size={15} />
                  </button>
                  <button
                    className="icon-button beat-flow-delete"
                    aria-label={`Delete beat ${index + 1}`}
                    onClick={() => {
                      update(beats.filter((item) => item.id !== beat.id));
                      setAnnouncement(`Beat ${index + 1} deleted.`);
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                {open && (
                  <div
                    className="beat-flow-details"
                    id={`beat-details-${beat.id}`}
                  >
                    <RangeFields
                      doc={doc}
                      beat={beat}
                      index={index}
                      range={assignment.range}
                      onApply={(range) =>
                        edit(beat.id, { range, sceneId: undefined })
                      }
                      onClear={() =>
                        edit(beat.id, { range: undefined, sceneId: undefined })
                      }
                    />
                    <label className="beat-whole-scene">
                      Assign a whole scene
                      <select
                        aria-label={`Beat ${index + 1} scene`}
                        value=""
                        onChange={(event) => {
                          if (!event.target.value) return;
                          const range = sceneBeatRange(doc, event.target.value);
                          if (range)
                            edit(beat.id, { range, sceneId: undefined });
                        }}
                      >
                        <option value="">Choose a scene…</option>
                        {scenes.map((scene, sceneIndex) => (
                          <option key={scene.id} value={scene.id}>
                            {sceneIndex + 1}. {scene.text}
                          </option>
                        ))}
                      </select>
                    </label>
                    <textarea
                      aria-label={`Beat ${index + 1} description`}
                      value={beat.description}
                      onChange={(event) =>
                        edit(beat.id, { description: event.target.value })
                      }
                      placeholder="What changes in this moment?"
                      rows={2}
                    />
                    <div>
                      <label>
                        Act
                        <select
                          aria-label={`Beat ${index + 1} act`}
                          value={beat.act}
                          onChange={(event) =>
                            edit(beat.id, { act: event.target.value })
                          }
                        >
                          {[
                            ...new Set([
                              "Act I",
                              "Act II",
                              "Act III",
                              beat.act,
                            ]),
                          ]
                            .filter(Boolean)
                            .map((act) => (
                              <option key={act}>{act}</option>
                            ))}
                        </select>
                      </label>
                      <label>
                        Color
                        <input
                          type="color"
                          aria-label={`Beat ${index + 1} color`}
                          value={beat.color}
                          onChange={(event) =>
                            edit(beat.id, { color: event.target.value })
                          }
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {!beats.length && (
        <div className="beat-first">
          <button onClick={add}>
            <Plus size={15} />
            Your first beat
          </button>
        </div>
      )}
      <footer className="beat-flow-footer">
        Changes save automatically. Drag a number or use its arrow keys to
        reorder. Press Enter to move to the next beat.
      </footer>
      <span className="sr-only" role="status">
        {announcement}
      </span>
      {showPacing && (
        <BeatPacing
          doc={doc}
          onClose={() => setShowPacing(false)}
          onRange={onRange}
        />
      )}
    </section>
  );
}
