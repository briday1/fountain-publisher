import { Modal } from "./Modal";
import { analyzeScreenplay, characterName } from "../core/insights";
import type { Screenplay, ScriptBlock } from "../core/model";
export function CharacterDialog({
  name,
  doc,
  onChange,
  onScene,
  onAnalytics,
  onClose,
}: {
  name: string;
  doc: Screenplay;
  onChange: (doc: Screenplay) => void;
  onScene: (id: string) => void;
  onAnalytics?: () => void;
  onClose: () => void;
}) {
  const stats = analyzeScreenplay(doc);
  const person = stats.characters.find((c) => c.name === name);
  const speeches: { cue: ScriptBlock; lines: ScriptBlock[] }[] = [];
  let current: (typeof speeches)[number] | undefined;
  for (const block of doc.blocks) {
    if (block.kind === "character") {
      current =
        characterName(block.text) === name
          ? { cue: block, lines: [] }
          : undefined;
      if (current) speeches.push(current);
    } else if (["dialogue", "parenthetical", "lyrics"].includes(block.kind)) {
      current?.lines.push(block);
    } else if (block.kind !== "note") current = undefined;
  }
  const notes = (
    doc.metadata.characterNotes &&
    typeof doc.metadata.characterNotes === "object"
      ? doc.metadata.characterNotes
      : {}
  ) as Record<string, string>;
  return (
    <Modal title={name} eyebrow="CHARACTER ANALYTICS" onClose={onClose} wide>
      {onAnalytics && (
        <button className="character-analytics-back" onClick={onAnalytics}>
          All character analytics
        </button>
      )}
      <div className="character-metrics">
        <span>
          <strong>{person?.dialogueWords ?? 0}</strong>spoken words
        </span>
        <span>
          <strong>{person?.speeches ?? 0}</strong>speeches
        </span>
        <span>
          <strong>{person?.sceneCount ?? 0}</strong>scenes
        </span>
        <span>
          <strong>{Math.round((person?.estimatedMinutes ?? 0) * 60)}s</strong>
          speaking time
        </span>
      </div>
      <h3 className="detail-label">Presence across the story</h3>
      <div className="presence-chart">
        {stats.scenes.map((s) => (
          <button
            key={s.id}
            className={s.characters.includes(name) ? "present" : ""}
            aria-label={`Scene ${s.number}: ${s.heading}${s.characters.includes(name) ? ", speaks here" : ""}`}
            title={`${s.number}. ${s.heading}`}
            onClick={() => {
              onClose();
              onScene(s.id);
            }}
          >
            {s.number}
          </button>
        ))}
      </div>
      <label className="field detail-label">
        Character notes
        <textarea
          rows={3}
          value={notes[name] ?? ""}
          placeholder="What does this person want? What are they hiding?"
          onChange={(e) =>
            onChange({
              ...doc,
              metadata: {
                ...doc.metadata,
                characterNotes: { ...notes, [name]: e.target.value },
              },
            })
          }
        />
      </label>
      <h3 className="detail-label">Dialogue</h3>
      <div className="speech-list">
        {speeches.map((speech, i) => (
          <button
            key={speech.cue.id}
            onClick={() => {
              onClose();
              onScene(speech.cue.id);
            }}
          >
            <small>
              {i + 1} · {speech.cue.text}
            </small>
            {speech.lines.map((line) => (
              <p key={line.id}>{line.text}</p>
            ))}
          </button>
        ))}
      </div>
    </Modal>
  );
}
