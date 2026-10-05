import { useState } from "react";
import {
  writingFonts,
  readGeorgiaFiles,
  type WritingFont,
  type FontBytes,
} from "../core/writingFonts";
export function ExportFontOption({
  font,
  checked,
  onChange,
  pdf,
  busy,
  onFonts,
}: {
  font: WritingFont;
  checked: boolean;
  onChange: (value: boolean) => void;
  pdf: boolean;
  busy: boolean;
  onFonts?: (fonts: FontBytes | undefined) => void;
}) {
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="export-font-option">
      <label>
        <input
          type="checkbox"
          checked={checked}
          disabled={busy}
          onChange={(e) => onChange(e.target.checked)}
        />{" "}
        Keep selected font
      </label>
      <p className="muted">
        {writingFonts[font].name}
        {checked
          ? " will be used for this export."
          : " is used for writing. Standard export formatting is selected."}
      </p>
      {checked && pdf && font === "georgia" && (
        <label className="field">
          Georgia font files
          <input
            type="file"
            accept=".ttf,.otf,.woff"
            multiple
            disabled={busy}
            onChange={async (e) => {
              setError("");
              setLoaded(false);
              onFonts?.(undefined);
              try {
                const fonts = await readGeorgiaFiles(
                  Array.from(e.target.files || []),
                );
                onFonts?.(fonts);
                setLoaded(true);
              } catch (error) {
                setError(
                  error instanceof Error
                    ? error.message
                    : "Could not read these fonts.",
                );
              }
            }}
          />
          <small>
            {loaded
              ? "Georgia is ready to embed."
              : "Georgia comes from your device. Add its Regular, Bold, Italic and Bold Italic files to embed it in a PDF. These files stay on your device."}
          </small>
        </label>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
