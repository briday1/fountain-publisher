import { useMemo, useState } from "react";
import { characterHighlights } from "../core/characterHighlights";
import { Modal } from "./Modal";

export type ExportSelection = {
  format: "pdf" | "fdx";
  mobile: boolean;
  characters: string[];
};

export function ExportDialog({
  freeOnly = false,
  onUpgrade,
  names,
  busy,
  onExport,
  onClose,
}: {
  freeOnly?: boolean;
  onUpgrade?: () => void;
  names: string[];
  busy: boolean;
  onExport: (selection: ExportSelection) => void;
  onClose: () => void;
}) {
  const [format, setFormat] = useState<"pdf" | "fdx">("pdf");
  const [mobile, setMobile] = useState(false);
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
    <Modal title="Export" onClose={onClose}>
      <label className="field">
        Export format
        <select
          value={format}
          disabled={busy}
          onChange={(event) => setFormat(event.target.value as "pdf" | "fdx")}
        >
          <option value="pdf">PDF</option>
          {!freeOnly && <option value="fdx">Final Draft (.fdx)</option>}
        </select>
      </label>
      {freeOnly && <p>Standard PDF is included. <button onClick={onUpgrade}>Explore Premium mobile PDFs and highlighting</button></p>}
      {format === "pdf" && !freeOnly && (
        <>
          <label>
            <input
              type="checkbox"
              checked={mobile}
              disabled={busy}
              onChange={(event) => setMobile(event.target.checked)}
            />
            Mobile PDF
          </label>
          <p>
            Choose characters to highlight their names throughout the script.
            Each gets a different color. Leave all unchecked for an
            unhighlighted PDF.
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
                    name
                      .toLocaleLowerCase()
                      .includes(query.toLocaleLowerCase()),
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
                            ? {
                                background: highlights.get(name),
                                color: "#18212b",
                              }
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
        </>
      )}
      <div className="dialog-actions">
        <button onClick={onClose}>Cancel</button>
        <button
          className="primary"
          disabled={busy}
          onClick={() =>
            onExport({
              format,
              mobile: format === "pdf" && mobile,
              characters: format === "pdf" ? selected : [],
            })
          }
        >
          {busy ? "Exporting…" : "Export"}
        </button>
      </div>
    </Modal>
  );
}
