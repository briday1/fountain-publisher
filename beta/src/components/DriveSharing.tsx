import { useState } from "react";
import { Modal } from "./Modal";
export function DriveSharing({
  id,
  name,
  onClose,
}: {
  id: string;
  name: string;
  onClose: () => void;
}) {
  const [notice, setNotice] = useState("");
  const url = new URL("/", location.origin);
  url.searchParams.set("live", "drive_" + id);
  return (
    <Modal title="Share Google Drive document" onClose={onClose}>
      <h3>{name}</h3>
      <p>
        Use Share in Google Drive to give your co-writers access to this file.
        Each writer needs WriteShape Premium and a connected Drive account with
        access to the same file.
      </p>
      <p>
        <a
          className="primary"
          href={`https://drive.google.com/file/d/${encodeURIComponent(id)}/view`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Manage sharing in Google Drive
        </a>
      </p>
      <p>
        Then send them the WriteShape link. When you open the same Drive
        document, collaboration connects automatically.
      </p>
      <button
        onClick={() =>
          void navigator.clipboard
            .writeText(url.href)
            .then(() =>
              setNotice(
                "WriteShape link copied. Google Drive controls who can access the file.",
              ),
            )
            .catch(() => setNotice(url.href))
        }
      >
        Copy WriteShape link
      </button>
      {notice && <p role="status">{notice}</p>}
    </Modal>
  );
}
