import {
  writingFonts,
  screenplayFonts,
  bookFonts,
  type WritingFont,
} from "../core/writingFonts";
import { Modal } from "./Modal";
import {
  readBackgroundPreferences,
  type BackgroundPreferences,
  type BackgroundOptions,
  type WorkspacePattern,
} from "./backgroundPreferences";
export interface Preferences {
  theme: string;
  screenplayFont: WritingFont;
  bookFont: WritingFont;
  zoom: number;
  spellcheck: boolean;
  colors: boolean;
  boldSceneHeadings: boolean;
  sceneNumbers: "margin" | "inline" | "off";
  sceneNumberFormat: "sequential" | "act";
  pageSize: "letter" | "a4";
  background: WorkspacePattern;
  backgroundOptions: BackgroundPreferences;
  typewriter: boolean;
  outline: boolean;
  insights: boolean;
  leftWidth: number;
  rightWidth: number;
}
export const defaults: Preferences = {
  theme: "system",
  screenplayFont: "courier",
  bookFont: "georgia",
  zoom: 100,
  spellcheck: true,
  colors: false,
  boldSceneHeadings: true,
  sceneNumbers: "margin",
  sceneNumberFormat: "sequential",
  pageSize: "letter",
  background: "dots",
  backgroundOptions: readBackgroundPreferences(undefined),
  typewriter: false,
  outline: true,
  insights: true,
  leftWidth: 230,
  rightWidth: 300,
};
export function readPreferences(): Preferences {
  try {
    const saved = JSON.parse(localStorage.getItem("fp2.preferences") || "{}");
    return {
      ...defaults,
      ...saved,
      screenplayFont: screenplayFonts.includes(saved?.screenplayFont)
        ? saved.screenplayFont
        : defaults.screenplayFont,
      bookFont: bookFonts.includes(saved?.bookFont)
        ? saved.bookFont
        : defaults.bookFont,
      backgroundOptions: readBackgroundPreferences(saved?.backgroundOptions),
      background: ["dots", "topographic", "hyperspace", "plain"].includes(
        saved?.background,
      )
        ? saved.background
        : saved?.background === "grid"
          ? "plain"
          : defaults.background,
    };
  } catch {
    return defaults;
  }
}
export function Settings({
  value,
  onChange,
  onClose,
}: {
  value: Preferences;
  onChange: (p: Preferences) => void;
  onClose: () => void;
}) {
  const patch = (p: Partial<Preferences>) => onChange({ ...value, ...p });
  const options =
    value.background === "plain"
      ? null
      : value.backgroundOptions[value.background];
  const patchBackground = (change: Partial<BackgroundOptions>) => {
    if (value.background === "plain" || !options) return;
    patch({
      backgroundOptions: {
        ...value.backgroundOptions,
        [value.background]: { ...options, ...change },
      },
    });
  };
  return (
    <Modal title="Settings" className="settings-dialog" onClose={onClose}>
      <div className="settings-form">
        <h3 className="settings-section-title">Appearance</h3>
        <div className="settings-field settings-theme-field">
          <label>
            <span>Theme</span>
            <select
              value={value.theme}
              onChange={(e) => patch({ theme: e.target.value })}
            >
              {[
                ["system", "Match system"],
                ["light", "Light"],
                ["dark", "Dark"],
                ["solarized-light", "Solarized light"],
                ["solarized-dark", "Solarized dark"],
                ["sepia", "Sepia"],
                ["sage", "Sage"],
                ["rose", "Rose"],
                ["dusk", "Dusk"],
                ["ocean", "Ocean"],
              ].map(([v, l]) => (
                <option value={v} key={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <div className="theme-palette" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
        <label className="workspace-background-setting">
          Workspace background
          <select
            value={value.background}
            onChange={(e) =>
              patch({ background: e.target.value as Preferences["background"] })
            }
          >
            <option value="dots">Dots</option>
            <option value="topographic">Topographic</option>
            <option value="hyperspace">Hyperspace</option>
            <option value="plain">None</option>
          </select>
        </label>
        {options && (
          <fieldset className="workspace-background-setting background-controls">
            <legend>Background appearance</legend>
            <label>
              Animate background
              <input
                type="checkbox"
                role="switch"
                checked={options.animated}
                aria-describedby="background-motion-note"
                onChange={(e) =>
                  patchBackground({ animated: e.target.checked })
                }
              />
            </label>
            {options.animated && (
              <label>
                Animation speed
                <select
                  value={options.speed}
                  onChange={(e) =>
                    patchBackground({
                      speed: e.target.value as BackgroundOptions["speed"],
                    })
                  }
                >
                  <option value="slow">Slow</option>
                  <option value="normal">Normal</option>
                  <option value="fast">Fast</option>
                </select>
              </label>
            )}
            <label>
              {value.background === "dots"
                ? "Dot density"
                : value.background === "hyperspace"
                  ? "Star density"
                  : "Contour density"}
              <select
                value={options.density}
                onChange={(e) =>
                  patchBackground({
                    density: e.target.value as BackgroundOptions["density"],
                  })
                }
              >
                <option value="sparse">Sparse</option>
                <option value="normal">Normal</option>
                <option value="dense">Dense</option>
              </select>
            </label>
            <p className="muted" id="background-motion-note">
              Turn animation off for a still background. Your system’s
              reduced-motion setting always keeps backgrounds still.
            </p>
          </fieldset>
        )}
        <h3 className="settings-section-title">Screenplay</h3>
        <label>
          Paper size
          <select
            value={value.pageSize}
            onChange={(e) =>
              patch({ pageSize: e.target.value as Preferences["pageSize"] })
            }
          >
            <option value="letter">US Letter</option>
            <option value="a4">A4</option>
          </select>
        </label>
        <label>
          Scene numbers
          <select
            value={value.sceneNumbers}
            onChange={(e) =>
              patch({
                sceneNumbers: e.target.value as Preferences["sceneNumbers"],
              })
            }
          >
            <option value="margin">In the margin</option>
            <option value="inline">Inline</option>
            <option value="off">Off</option>
          </select>
        </label>
        <label>
          Scene numbering
          <select
            value={value.sceneNumberFormat}
            onChange={(e) =>
              patch({
                sceneNumberFormat: e.target
                  .value as Preferences["sceneNumberFormat"],
              })
            }
          >
            <option value="sequential">Sequential · 1, 2, 3</option>
            <option value="act">By act · A1S1, A1S2</option>
          </select>
        </label>
        <label>
          Bold scene headings
          <input
            type="checkbox"
            role="switch"
            checked={value.boldSceneHeadings}
            onChange={(e) => patch({ boldSceneHeadings: e.target.checked })}
          />
        </label>
        <label>
          Color screenplay elements
          <input
            type="checkbox"
            role="switch"
            checked={value.colors}
            onChange={(e) => patch({ colors: e.target.checked })}
          />
        </label>
        <h3 className="settings-section-title">Writing</h3>
        {(
          [
            ["screenplayFont", "Screenplay font", screenplayFonts],
            ["bookFont", "Book font", bookFonts],
          ] as const
        ).map(([key, label, choices]) => (
          <div key={key} className="settings-field">
            <label>
              <span>{label}</span>
              <select
                value={value[key]}
                onChange={(e) =>
                  patch({ [key]: e.target.value as WritingFont })
                }
              >
                {choices.map((id) => (
                  <option key={id} value={id}>
                    {writingFonts[id].name}
                    {id === defaults[key] ? " (default)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <p
              className="writing-font-sample"
              style={{ fontFamily: writingFonts[value[key]].css }}
            >
              {key === "bookFont"
                ? "Every story begins with a single line."
                : "FADE IN: A new story begins."}
            </p>
          </div>
        ))}
        <p className="muted">
          Writing fonts change your view. Exports use standard fonts unless you
          choose “Keep selected font” when exporting.
        </p>
        <label>
          Spellcheck
          <input
            type="checkbox"
            role="switch"
            checked={value.spellcheck}
            onChange={(e) => patch({ spellcheck: e.target.checked })}
          />
        </label>
        <label>
          Typewriter scrolling
          <input
            type="checkbox"
            role="switch"
            checked={value.typewriter}
            onChange={(e) => patch({ typewriter: e.target.checked })}
          />
        </label>
        <p className="muted">
          Settings apply to this device and save as you change them.
        </p>
      </div>
      <footer className="dialog-actions">
        <button className="primary" onClick={onClose}>
          Done
        </button>
      </footer>
    </Modal>
  );
}
