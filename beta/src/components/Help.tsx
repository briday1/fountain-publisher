import { Modal } from "./Modal";
export function Help({ onClose }: { onClose: () => void }) {
  const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
  return (
    <Modal title="Just write." eyebrow="FOUNTAIN PUBLISHER" onClose={onClose}>
      <p>
        Click the page and start typing. Scene headings such as INT. or EXT.
        format themselves. Enter moves naturally through character cues and
        dialogue; an empty line returns to action.
      </p>
      <p>
        Choose an element in the toolbar whenever you want to be explicit. Tab
        cycles screenplay elements. Native selection, clipboard, spellcheck, and
        undo work across the whole document.
      </p>
      <table className="shortcut-table">
        <tbody>
          {[
            [`${mod} S`, "Save Fountain file"],
            [`${mod} O`, "Open a file"],
            [`${mod} Z`, "Undo"],
            [`${mod} Shift Z`, "Redo"],
            [`${mod} B / I / U`, "Bold / italic / underline"],
            [`${mod} F`, "Find and replace"],
            ["Tab / Shift Tab", "Next / previous element"],
            ["Escape", "Close a dialog or exit Zen mode"],
          ].map(([key, label]) => (
            <tr key={key}>
              <td>{label}</td>
              <td>
                <kbd>{key}</kbd>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Your workspace is saved on this device. Download a Fountain file or save
        to your connected account for a copy elsewhere. Beat cards and notes are
        embedded as standard Fountain comments.
      </p>
      <p>
        Open the beat sheet over your page, or turn on the beat guide to assign
        screenplay lines as you write. Insights measures page usage from the
        generated PDF, rounded up to an eighth of a page. View → PDF pages shows
        the full export.
      </p>
      <p>
        Full screen fills your display. Zen mode keeps just the page and any
        active beat guide. Choose Exit Zen or press Escape to bring back your
        tools; your writing stays where you left it.
      </p>
      <footer className="dialog-actions">
        <button className="primary" onClick={onClose}>
          Back to writing
        </button>
      </footer>
    </Modal>
  );
}
