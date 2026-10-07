import { useEffect, useState } from "react";
import { Check, Cloud, RefreshCw, Share2 } from "lucide-react";
import type {
  DocumentBuffer,
  DocumentWorkspace,
} from "../core/documentWorkspace";
import { destinationLabel } from "../storage/destinations";
import { Menu, MenuItem } from "./Menu";
import "./document-status-bar.css";

export function documentSaveLabel(buffer: DocumentBuffer) {
  const destination = buffer.snapshot.destination;
  const label = destinationLabel(destination);
  if (destination && !buffer.live && buffer.liveStatus?.phase === "paused")
    return `${label} sync needs attention`;
  if (buffer.joiningLive) return `Connecting to ${label}…`;
  if (buffer.live) {
    switch (buffer.liveStatus?.phase) {
      case "live":
        return `Saved to ${label}`;
      case "readonly":
        return `${label} · view only`;
      case "offline":
        return `${label} offline · edits kept on this device`;
      case "paused":
        return `${label} sync needs attention`;
      case "syncing":
        return `Saving to ${label}…`;
      default:
        return `Connecting to ${label}…`;
    }
  }
  if (!destination)
    return buffer.status === "saving"
      ? "Saving on this device…"
      : buffer.status === "error"
        ? "Device save needs attention"
        : "Saved on this device";
  switch (buffer.syncStatus?.phase) {
    case "saved":
      return `Saved to ${label}`;
    case "pending":
    case "saving":
      return `Saving to ${label}…`;
    case "offline":
      return `${label} offline · edits kept on this device`;
    case "conflict":
      return `${label} changed · review before saving`;
    case "error":
      return `${label} save needs attention`;
    case "readonly":
      return `${label} · view only`;
    default:
      return `Checking ${label}…`;
  }
}

/** One fixed-height bottom bar describes the active document and its writers. */
export function DocumentStatusBar({
  model,
  collaborationAvailable,
  onFiles,
  onShare,
  onReview,
}: {
  model: DocumentWorkspace;
  collaborationAvailable: boolean;
  onFiles: (mode: "open" | "save") => void;
  onShare?: () => void;
  onReview?: () => void;
}) {
  const [copiedFor, setCopiedFor] = useState<string | null>(null);
  const [copyError, setCopyError] = useState("");
  useEffect(() => {
    if (!copiedFor) return;
    const timer = window.setTimeout(() => setCopiedFor(null), 2500);
    return () => window.clearTimeout(timer);
  }, [copiedFor]);
  const view = model.activeView;
  const buffer = model.activeBuffer;
  if (!view || !buffer) return <span>No document open</span>;
  const destination = buffer.snapshot.destination;
  const focus = view.controller.focusedSection;
  const heading = buffer.snapshot.screenplay.blocks.find(
    (block) => block.id === focus,
  );
  const label = documentSaveLabel(buffer);
  const message = buffer.liveStatus?.message || buffer.syncStatus?.message;
  const attention =
    buffer.status === "error" ||
    ["error", "conflict", "offline", "paused"].includes(
      buffer.liveStatus?.phase || buffer.syncStatus?.phase || "",
    );
  const saveContent = (
    <>
      {attention ? (
        <Cloud size={13} />
      ) : buffer.status === "saving" ||
        buffer.liveStatus?.phase === "syncing" ||
        buffer.syncStatus?.phase === "saving" ? (
        <RefreshCw size={13} />
      ) : (
        <Check size={13} />
      )}
      <span className="document-save-label">{label}</span>
    </>
  );
  const retry = async () => {
    try {
      await model.startLive(buffer.snapshot.id, !!destination?.live);
    } catch (error) {
      buffer.liveStatus = {
        phase: "paused",
        members: [],
        canEdit: false,
        message:
          error instanceof Error ? error.message : "Sync could not finish.",
      };
      model.notifyChanged();
    }
  };
  const copyLink = async () => {
    if (!destination || destination.provider === "local") return;
    try {
      const url = new URL(location.origin);
      url.searchParams.set(
        "live",
        `${destination.provider === "drive" ? "drive" : "library"}_${destination.id}`,
      );
      await navigator.clipboard.writeText(url.toString());
      setCopyError("");
      setCopiedFor(buffer.snapshot.id);
    } catch (error) {
      setCopyError(
        error instanceof Error
          ? error.message
          : "The document link could not be copied.",
      );
    }
  };
  return (
    <>
      <div className="document-status-context">
        {focus ? (
          <button
            className="document-focus-label"
            onClick={() => model.focusSection(view.id)}
            title={`Show whole document · ${heading?.text || "Section"}`}
          >
            Focus: {heading?.text || "Section"}
          </button>
        ) : (
          <span className="document-focus-label" title="Whole document">
            Whole document
          </span>
        )}
        {attention ? (
          <div className="document-save-state failed">
            <Menu
              label={`${label} · Details`}
              triggerContent={saveContent}
              anchored
            >
              <div className="document-sync-details" role="status">
                {message || label}
                {buffer.status === "error" && destination && (
                  <p>Device recovery copy needs attention.</p>
                )}
              </div>
              {onReview && (
                <MenuItem onClick={onReview}>Review changes…</MenuItem>
              )}
              {!buffer.live && buffer.liveStatus?.phase === "paused" && (
                <MenuItem
                  disabled={buffer.joiningLive}
                  onClick={() => void retry()}
                >
                  Retry sync
                </MenuItem>
              )}
              <MenuItem onClick={() => onFiles("save")}>Save a copy…</MenuItem>
              <MenuItem onClick={() => onFiles("open")}>Files…</MenuItem>
            </Menu>
          </div>
        ) : (
          <button
            className="document-save-state"
            title={message || label}
            onClick={() => onFiles("open")}
          >
            {saveContent}
          </button>
        )}
      </div>
      {collaborationAvailable &&
        destination &&
        destination.provider !== "local" && (
          <div className="document-live-controls" aria-label="Document sharing">
            <Menu
              label={
                copiedFor === buffer.snapshot.id
                  ? "Link copied"
                  : "Share document"
              }
              triggerContent={
                copiedFor === buffer.snapshot.id ? (
                  <Check size={16} />
                ) : (
                  <Share2 size={16} />
                )
              }
              anchored
            >
              {buffer.liveStatus?.members.map((member) => (
                <MenuItem
                  key={member.clientId ?? member.id}
                  disabled={!member.editing || member.clientId === undefined}
                  onClick={() =>
                    view.controller.revealCollaborator(member.clientId!)
                  }
                >
                  {member.name} ·{" "}
                  {member.canEdit === false
                    ? "Viewing"
                    : "Show writing position"}
                </MenuItem>
              ))}
              <MenuItem onClick={() => void copyLink()}>
                Copy document link
              </MenuItem>
              {onShare && <MenuItem onClick={onShare}>Manage access…</MenuItem>}
              {copyError && (
                <div className="document-sync-details" role="alert">
                  {copyError}
                </div>
              )}
              <div className="document-sync-details">
                Only people with document access can open this link.
              </div>
            </Menu>
          </div>
        )}
    </>
  );
}
