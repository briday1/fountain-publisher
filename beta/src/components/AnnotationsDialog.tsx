import { Modal } from "./Modal";
import type { BeatRange, Screenplay, ScriptBlock } from "../core/model";
import "./CharacterDialog.css";

export function AnnotationsDialog({ doc, onJump, onClose }: {
  doc: Screenplay;
  onJump: (range: BeatRange) => void;
  onClose: () => void;
}) {
  const sections: { heading: string; notes: { note: ScriptBlock; anchor: ScriptBlock }[] }[] = [];
  let heading = "Before the first scene";
  let number = 0;
  let anchor: ScriptBlock | undefined;
  let section: typeof sections[number] | undefined;
  for (const block of doc.blocks) {
    if (block.kind === "scene") {
      heading = `Scene ${++number} · ${block.text}`;
      section = undefined;
    }
    if (block.kind !== "note") anchor = block;
    else {
      if (!section) {
        section = { heading, notes: [] };
        sections.push(section);
      }
      section.notes.push({ note: block, anchor: anchor?.text.trim() ? anchor : block });
    }
  }
  const count = sections.reduce((total, section) => total + section.notes.length, 0);
  return (
    <Modal title="Annotations" className="character-dialog" wide onClose={onClose}
      titleAside={<span className="character-metrics">{count} {count === 1 ? "annotation" : "annotations"}</span>}>
      {!count && <p className="muted">No annotations yet. Select some text and choose Add annotation.</p>}
      <div className="speech-list">
        {sections.map((section, index) => (
          <section className="character-dialogue-scene" key={index} aria-label={section.heading}>
            <h3 className="character-dialogue-scene-heading">{section.heading}</h3>
            {section.notes.map(({ note, anchor }) => (
              <div className="character-speech" key={note.id}>
                {anchor !== note && <small>{anchor.text}</small>}
                <button className="character-dialogue-line" aria-label={`Go to annotation: ${note.text}`}
                  onClick={() => onJump({ start: { blockId: anchor.id, offset: 0 }, end: { blockId: anchor.id, offset: anchor.text.length } })}>
                  {note.text || "Empty annotation"}
                </button>
              </div>
            ))}
          </section>
        ))}
      </div>
    </Modal>
  );
}
