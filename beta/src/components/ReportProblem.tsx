import { useState } from "react";
import { Modal } from "./Modal";
import { diagnosticSnapshot, supportAddress } from "../support/diagnostics";
import { downloadFile } from "../storage/files";
import "./report-problem.css";
export function ReportProblem({
  context,
  onClose,
}: {
  context: Parameters<typeof diagnosticSnapshot>[0];
  onClose: () => void;
}) {
  const [description, setDescription] = useState("");
  const [include, setInclude] = useState(true);
  const [notice, setNotice] = useState("");
  const [diagnostics] = useState(() => diagnosticSnapshot(context));
  const [reference] = useState(() => crypto.randomUUID());
  const text = () =>
    `WriteShape report ${reference}\n\n${description}\n\n${include ? JSON.stringify(diagnostics, null, 2) : "Technical details not included."}`;
  return (
    <Modal
      title="Report a problem"
      eyebrow="WRITESHAPE SUPPORT"
      onClose={onClose}
    >
      <form
        className="report-problem"
        onSubmit={(e) => {
          e.preventDefault();
          location.href = `mailto:${supportAddress}?subject=${encodeURIComponent(`WriteShape problem ${reference}`)}&body=${encodeURIComponent(text())}`;
          setNotice(
            "Your email app opens with the report. Send it there to contact support. If it does not open, download the report and email it to the address below.",
          );
        }}
      >
        <label>
          What happened?
          <textarea
            required
            maxLength={3000}
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What were you trying to do, what happened, and what did you expect?"
          />
        </label>
        <p>
          Please leave out private writing, passwords and payment details. You
          can attach an optional screenshot in your email after reviewing it.
        </p>
        <label className="report-check">
          <input
            type="checkbox"
            checked={include}
            onChange={(e) => setInclude(e.target.checked)}
          />
          Include technical details
        </label>
        <p>
          Includes app version, browser, screen size, connection and sync
          status, and recent error references. No document text, filenames,
          account address or browsing history.
        </p>
        {include && (
          <details>
            <summary>Review technical details</summary>
            <pre>{JSON.stringify(diagnostics, null, 2)}</pre>
          </details>
        )}
        <div className="dialog-actions">
          <button className="primary" type="submit">
            Email report
          </button>
          <button
            type="button"
            onClick={() =>
              downloadFile(text(), `writeshape-report-${reference}.txt`)
            }
          >
            Download report
          </button>
        </div>
        {notice && <p role="status">{notice}</p>}
        <p>
          Support inbox:{" "}
          <a href={`mailto:${supportAddress}`}>{supportAddress}</a>
        </p>
      </form>
    </Modal>
  );
}
