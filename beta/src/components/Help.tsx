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
            ["Escape", "Close a dialog or leave focus mode"],
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
        PDF shows the exact exported pages. Return to Screenplay to continue
        writing. Page and runtime estimates in Insights are labeled until an
        export is compiled.
      </p>
      <footer className="dialog-actions">
        <button className="primary" onClick={onClose}>
          Back to writing
        </button>
      </footer>
    </Modal>
  );
}
