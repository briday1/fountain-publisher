import { Modal } from "./Modal";
export interface Preferences {
  theme: string;
  zoom: number;
  spellcheck: boolean;
  colors: boolean;
  boldSceneHeadings: boolean;
  sceneNumbers: "margin" | "inline" | "off";
  sceneNumberFormat: "sequential" | "act";
  pageSize: "letter" | "a4";
  background: "dots" | "plain" | "grid";
  typewriter: boolean;
  outline: boolean;
  insights: boolean;
  leftWidth: number;
  rightWidth: number;
}
export const defaults: Preferences = {
  theme: "system",
  zoom: 100,
  spellcheck: true,
  colors: false,
  boldSceneHeadings: true,
  sceneNumbers: "margin",
  sceneNumberFormat: "sequential",
  pageSize: "letter",
  background: "dots",
  typewriter: false,
  outline: true,
  insights: true,
  leftWidth: 230,
  rightWidth: 300,
};
export function readPreferences(): Preferences {
  try {
    return {
      ...defaults,
      ...JSON.parse(localStorage.getItem("fp2.preferences") || "{}"),
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
  return (
    <Modal title="Make yourself at home" eyebrow="SETTINGS" onClose={onClose}>
      <div className="settings-form">
        <label>
          Theme
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
            ].map(([v, l]) => (
              <option value={v} key={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
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
        <label className="workspace-background-setting">
          Workspace background
          <select
            value={value.background}
            onChange={(e) =>
              patch({ background: e.target.value as Preferences["background"] })
            }
          >
            <option value="dots">Dots</option>
            <option value="plain">Plain</option>
            <option value="grid">Grid</option>
          </select>
        </label>
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
          Appearance preferences stay on this device. Story notes and beats
          travel with your Fountain file.
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
