import { useLayoutEffect, useRef, useState } from "react";
import { Modal } from "./Modal";
import type { Screenplay } from "../core/model";
import "./CharacterDialog.css";

type Profile = {
  id: string;
  name: string;
  description: string;
  role?: string;
  background?: string;
  motivation?: string;
  personality?: string;
  relationships?: string;
  notes?: string;
};
const details = [
  ["background", "Background", "The experiences that shaped this person."],
  [
    "motivation",
    "Motivation & conflict",
    "What do they want, and what stands in their way?",
  ],
  [
    "personality",
    "Personality",
    "Their strengths, flaws, habits, and contradictions.",
  ],
  [
    "relationships",
    "Relationships",
    "Who matters to them, and how do those connections change?",
  ],
] as const;

export function NovelCharacters({
  doc,
  onChange,
}: {
  doc: Screenplay;
  onChange: (doc: Screenplay) => void;
}) {
  const [selected, setSelected] = useState<string>();
  const nameInput = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    if (selected) nameInput.current?.focus();
  }, [selected]);
  const profiles: Profile[] = Array.isArray(doc.metadata.proseCharacters)
    ? doc.metadata.proseCharacters.filter(
        (p): p is Profile =>
          !!p &&
          typeof p === "object" &&
          typeof p.id === "string" &&
          typeof p.name === "string",
      )
    : [];
  const profile = selected
    ? (profiles.find((p) => p.id === selected) ?? {
        id: selected,
        name: "",
        description: "",
      })
    : undefined;
  const update = (next: Profile[]) =>
    onChange({ ...doc, metadata: { ...doc.metadata, proseCharacters: next } });
  const patch = (field: keyof Omit<Profile, "id">, value: string) => {
    if (!profile) return;
    const next = { ...profile, [field]: value };
    update(
      profiles.some((p) => p.id === profile.id)
        ? profiles.map((p) => (p.id === profile.id ? next : p))
        : [...profiles, next],
    );
  };
  const text = (value: unknown) => (typeof value === "string" ? value : "");
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
          onClick={() => setSelected(p.id)}
        >
          <strong>{p.name || "Unnamed character"}</strong>
          <small>
            {text(p.description) || text(p.role) || "Open character profile"}
          </small>
        </button>
      ))}
      <button
        className="character-analytics-button"
        onClick={() => setSelected(crypto.randomUUID())}
      >
        Add character
      </button>
      {profile && (
        <Modal
          title={profile.name.trim() || "New character"}
          eyebrow="CHARACTER PROFILE"
          className="character-dialog book-character-dialog"
          wide
          onClose={() => setSelected(undefined)}
        >
          <div className="book-character-profile">
            <label className="field detail-label">
              Name
              <input
                ref={nameInput}
                value={profile.name}
                placeholder="Character name"
                onChange={(e) => patch("name", e.target.value)}
              />
            </label>
            <label className="field detail-label">
              Role in the story
              <input
                value={text(profile.role)}
                placeholder="Protagonist, rival, confidant…"
                onChange={(e) => patch("role", e.target.value)}
              />
            </label>
            <label className="field detail-label book-character-full">
              Short profile
              <textarea
                rows={3}
                value={text(profile.description)}
                placeholder="A few lines that capture who they are."
                onChange={(e) => patch("description", e.target.value)}
              />
            </label>
            {details.map(([field, label, placeholder]) => (
              <label className="field detail-label" key={field}>
                {label}
                <textarea
                  rows={4}
                  value={text(profile[field])}
                  placeholder={placeholder}
                  onChange={(e) => patch(field, e.target.value)}
                />
              </label>
            ))}
            <label className="field detail-label book-character-full">
              Character notes
              <textarea
                rows={4}
                value={text(profile.notes)}
                placeholder="What does this person want? What are they hiding?"
                onChange={(e) => patch("notes", e.target.value)}
              />
            </label>
          </div>
          <footer className="book-character-footer">
            <span>
              {profiles.some((p) => p.id === profile.id)
                ? "Changes save with your document"
                : "Start with a name or a few notes."}
            </span>
            {profiles.some((p) => p.id === profile.id) && (
              <button
                onClick={() => {
                  update(profiles.filter((p) => p.id !== profile.id));
                  setSelected(undefined);
                }}
              >
                Remove character
              </button>
            )}
            <button onClick={() => setSelected(undefined)}>Done</button>
          </footer>
        </Modal>
      )}
    </section>
  );
}
