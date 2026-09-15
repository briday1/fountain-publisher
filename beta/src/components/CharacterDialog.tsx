import { useMemo } from "react";
import { Modal } from "./Modal";
import {
  analyzeScreenplay,
  characterName,
  type SceneInsight,
} from "../core/insights";
import type { BeatRange, Screenplay, ScriptBlock } from "../core/model";
import "./CharacterDialog.css";
export function CharacterDialog({
  name,
  doc,
  onChange,
  onDialogue,
  onClose,
}: {
  name: string;
  doc: Screenplay;
  onChange: (doc: Screenplay) => void;
  onDialogue: (range: BeatRange) => void;
  onClose: () => void;
}) {
  const stats = useMemo(() => analyzeScreenplay(doc), [doc.blocks]);
  const person = stats.characters.find((c) => c.name === name);
  const dialogueSections = useMemo(() => {
    type Speech = { cue: ScriptBlock; lines: ScriptBlock[]; number: number };
    type Section = { scene?: SceneInsight; speeches: Speech[] };
    const sections: Section[] = [];
    const scenes = new Map(stats.scenes.map((scene) => [scene.id, scene]));
    let scene: SceneInsight | undefined;
    let section: Section | undefined;
    let current: Speech | undefined;
    let speechNumber = 0;
    for (const block of doc.blocks) {
      if (block.kind === "scene") {
        scene = scenes.get(block.id);
        section = undefined;
        current = undefined;
      } else if (block.kind === "character") {
        current =
          characterName(block.text) === name
            ? { cue: block, lines: [], number: ++speechNumber }
            : undefined;
        if (current) {
          if (!section) {
            section = { scene, speeches: [] };
            sections.push(section);
          }
          section.speeches.push(current);
        }
      } else if (["dialogue", "parenthetical", "lyrics"].includes(block.kind)) {
        current?.lines.push(block);
      } else if (!["note", "boneyard"].includes(block.kind))
        current = undefined;
    }
    return sections;
  }, [doc.blocks, name, stats.scenes]);
  const notes = (
    doc.metadata.characterNotes &&
    typeof doc.metadata.characterNotes === "object"
      ? doc.metadata.characterNotes
      : {}
  ) as Record<string, string>;
  return (
    <Modal
      title={name}
      className="character-dialog"
      onClose={onClose}
      wide
      titleAside={
        <span className="character-metrics">
          <span>{person?.dialogueWords ?? 0} words</span>
          <span aria-hidden="true"> · </span>
          <span>{person?.speeches ?? 0} speeches</span>
          <span aria-hidden="true"> · </span>
          <span>{person?.sceneCount ?? 0} scenes</span>
        </span>
      }
    >
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
        {dialogueSections.map(({ scene, speeches }) => (
          <section
            className="character-dialogue-scene"
            key={scene?.id ?? "before-scenes"}
            aria-label={
              scene
                ? `Scene ${scene.number}: ${scene.heading}`
                : "Before the first scene"
            }
          >
            <h4 className="character-dialogue-scene-heading">
              {scene ? (
                <>
                  <span>Scene {scene.number}</span> {scene.heading}
                </>
              ) : (
                "Before the first scene"
              )}
            </h4>
            {speeches.map((speech) => (
              <div className="character-speech" key={speech.cue.id}>
                <small>
                  {speech.number} · {speech.cue.text}
                </small>
                {speech.lines.flatMap((block) => {
                  let offset = 0;
                  return block.text.split("\n").map((text) => {
                    const start = offset;
                    offset += text.length + 1;
                    const range = {
                      start: { blockId: block.id, offset: start },
                      end: { blockId: block.id, offset: start + text.length },
                    };
                    return (
                      <button
                        className="character-dialogue-line"
                        key={`${block.id}-${start}`}
                        aria-label={`Go to dialogue: ${text || "Blank line"}`}
                        onClick={() => {
                          onClose();
                          onDialogue(range);
                        }}
                      >
                        {text || "\u00a0"}
                      </button>
                    );
                  });
                })}
              </div>
            ))}
          </section>
        ))}
      </div>
    </Modal>
  );
}
