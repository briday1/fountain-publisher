import { useState } from "react";
import { Modal } from "./Modal";
import type { Screenplay } from "../core/model";
type Profile = { id: string; name: string; description: string };
export function NovelCharacters({
  doc,
  onChange,
}: {
  doc: Screenplay;
  onChange: (doc: Screenplay) => void;
}) {
  const [open, setOpen] = useState(false);
  const profiles: Profile[] = Array.isArray(doc.metadata.proseCharacters)
    ? doc.metadata.proseCharacters.filter(
        (p): p is Profile =>
          !!p &&
          typeof p === "object" &&
          typeof p.id === "string" &&
          typeof p.name === "string",
      )
    : [];
  const update = (next: Profile[]) =>
    onChange({ ...doc, metadata: { ...doc.metadata, proseCharacters: next } });
  return (
    <section className="insight-section">
      <div className="section-label">
        <h3>Characters</h3>
        <span>{profiles.length}</span>
      </div>
      {profiles.map((p) => (
        <button
          className="novel-character"
          key={p.id}
          onClick={() => setOpen(true)}
        >
          <strong>{p.name || "Unnamed character"}</strong>
          <small>{p.description || "Add a short profile"}</small>
        </button>
      ))}
      <button
        className="character-analytics-button"
        onClick={() => setOpen(true)}
      >
        {profiles.length ? "Edit character profiles" : "Add character"}
      </button>
      {open && (
        <Modal title="Character profiles" onClose={() => setOpen(false)}>
          {profiles.map((p, i) => (
            <fieldset className="novel-character-fields" key={p.id}>
              <legend>Character {i + 1}</legend>
              <label>
                Name
                <input
                  value={p.name}
                  onChange={(e) =>
                    update(
                      profiles.map((item) =>
                        item.id === p.id
                          ? { ...item, name: e.target.value }
                          : item,
                      ),
                    )
                  }
                />
              </label>
              <label>
                Profile
                <textarea
                  rows={3}
                  value={p.description || ""}
                  onChange={(e) =>
                    update(
                      profiles.map((item) =>
                        item.id === p.id
                          ? { ...item, description: e.target.value }
                          : item,
                      ),
                    )
                  }
                />
              </label>
              <button
                onClick={() =>
                  update(profiles.filter((item) => item.id !== p.id))
                }
              >
                Remove profile
              </button>
            </fieldset>
          ))}
          <button
            onClick={() =>
              update([
                ...profiles,
                { id: crypto.randomUUID(), name: "", description: "" },
              ])
            }
          >
            Add character
          </button>
          <button onClick={() => setOpen(false)}>Done</button>
        </Modal>
      )}
    </section>
  );
}
