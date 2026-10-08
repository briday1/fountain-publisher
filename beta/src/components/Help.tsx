import { Modal } from "./Modal";
export function Help({
  onClose,
  onReport,
}: {
  onClose: () => void;
  onReport?: () => void;
}) {
  const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
  return (
    <Modal
      title={onReport ? "Help" : "Just write."}
      eyebrow={onReport ? "WRITESHAPE" : "FOUNTAIN PUBLISHER"}
      onClose={onClose}
    >
      {onReport && (
        <button
          className="primary"
          style={{ marginBottom: 24 }}
          onClick={onReport}
        >
          Report a problem or contact support
        </button>
      )}
      <p>
        Just Write. {onReport ? "WriteShape" : "Fountain Publisher"} will format
        as you go, but additional formatting and styles are provided in the menu
        bar.
      </p>
      {onReport && (
        <p>
          Book writing and exports are text only in Basic and Premium. Images,
          illustrations and embedded media are not supported.
        </p>
      )}
      <table className="shortcut-table">
        <tbody>
          {[
            [`${mod} S`, "Save Fountain file"],
            [`${mod} O`, "Open a file"],
            [`${mod} Z`, "Undo"],
            [`${mod} Shift Z`, "Redo"],
            [`${mod} B / I / U`, "Bold / italic / underline"],
            [`${mod} F`, "Find and replace"],
            ["Tab / Shift Tab", "Complete character / cycle element"],
            ["Ctrl Tab / Ctrl Shift Tab", "Next / previous document tab"],
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
        Open Fountain or Final Draft (.fdx) files from your device, Drive, or
        GitHub. Imported Final Draft files save as Fountain. File → Export
        highlighted PDF lets you select characters and color their names in the
        published script. The eye button opens PDF pages over your writing.
      </p>
      <p>
        Full screen fills your display. Zen mode keeps just the page and any
        active beat guide. Choose Exit Zen or press Escape to bring back your
        tools; your writing stays where you left it.
      </p>
      <nav className="policy-links" aria-label="About and policies">
        <a href="/about.html" target="_blank" rel="noopener noreferrer">
          About {onReport ? "WriteShape" : "Fountain Publisher"}
        </a>
        <a href="/privacy.html" target="_blank" rel="noopener noreferrer">
          Privacy
        </a>
        <a href="/terms.html" target="_blank" rel="noopener noreferrer">
          Terms
        </a>
      </nav>
      <footer className="dialog-actions">
        <button className="primary" onClick={onClose}>
          Back to writing
        </button>
      </footer>
    </Modal>
  );
}
