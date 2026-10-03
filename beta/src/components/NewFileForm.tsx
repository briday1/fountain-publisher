import { useState } from "react";
import { emptyScreenplay } from "../core/model";
import { createNovel } from "../core/markdown";
import { serializeDocument } from "../core/documentFormat";

export interface NewFileInput {
  name: string;
  content: string;
  format: "screenplay" | "novel";
}

export function NewFileForm({
  busy,
  onCreate,
  onCancel,
}: {
  busy: boolean;
  onCreate: (file: NewFileInput) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [format, setFormat] = useState<"screenplay" | "novel">("screenplay");
  return (
    <form
      className="library-new-file"
      aria-label="Create a new file"
      onSubmit={(event) => {
        event.preventDefault();
        const stem = name.trim().replace(/\.(fountain|txt|md|markdown)$/i, "");
        if (!stem || busy) return;
        onCreate({
          name: stem + (format === "novel" ? ".md" : ".fountain"),
          format,
          content: serializeDocument(
            format === "novel" ? createNovel() : emptyScreenplay(),
          ),
        });
      }}
    >
      <label>
        Name
        <input
          autoFocus
          aria-label="New file name"
          value={name}
          required
          maxLength={140}
          pattern="[^/\\\\]+"
          placeholder="Untitled"
          disabled={busy}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label>
        Type
        <select
          aria-label="New file type"
          value={format}
          disabled={busy}
          onChange={(event) =>
            setFormat(event.target.value as "screenplay" | "novel")
          }
        >
          <option value="screenplay">Screenplay (.fountain)</option>
          <option value="novel">Book (.md)</option>
        </select>
      </label>
      <button className="primary" disabled={busy || !name.trim()}>
        {busy ? "Creating…" : "Create file"}
      </button>
      <button type="button" disabled={busy} onClick={onCancel}>
        Cancel
      </button>
    </form>
  );
}
