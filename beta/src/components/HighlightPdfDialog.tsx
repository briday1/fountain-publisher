import { useMemo, useState } from "react";
import { characterHighlights } from "../core/characterHighlights";
import { Modal } from "./Modal";

export function HighlightPdfDialog({
  names,
  busy,
  onExport,
  onClose,
}: {
  names: string[];
  busy: boolean;
  onExport: (names: string[]) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const highlights = useMemo(
    () =>
      new Map(
        characterHighlights(selected).map((entry) => [entry.name, entry.color]),
      ),
    [selected],
  );
  return (
    <Modal title="Export highlighted PDF" onClose={onClose}>
      <p>
        Choose characters to highlight their names throughout the script. Each
        gets a different color.
      </p>
      {names.length ? (
        <>
          <label className="field">
            Find a character
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className="highlight-selection-actions">
            <button disabled={busy} onClick={() => setSelected([...names])}>
              Select all
            </button>
            <button
              disabled={busy || !selected.length}
              onClick={() => setSelected([])}
            >
              Clear
            </button>
            <span role="status">{selected.length} selected</span>
          </div>
          <div
            className="highlight-character-list"
            role="group"
            aria-label="Characters to highlight"
          >
            {names
              .filter((name) =>
                name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
              )
              .map((name) => (
                <label key={name}>
                  <input
                    type="checkbox"
                    checked={selected.includes(name)}
                    disabled={busy}
                    onChange={(e) =>
                      setSelected((value) =>
                        e.target.checked
                          ? [...value, name]
                          : value.filter((entry) => entry !== name),
                      )
                    }
                  />
                  <span
                    style={
                      highlights.has(name)
                        ? { background: highlights.get(name), color: "#18212b" }
                        : undefined
                    }
                  >
                    {name}
                  </span>
                </label>
              ))}
          </div>
        </>
      ) : (
        <p>No character cues in this screenplay yet.</p>
      )}
      <div className="dialog-actions">
        <button onClick={onClose}>Cancel</button>
        <button
          className="primary"
          disabled={busy || !selected.length}
          onClick={() => onExport(selected)}
        >
          {busy ? "Preparing PDF…" : "Export highlighted PDF"}
        </button>
      </div>
    </Modal>
  );
}
