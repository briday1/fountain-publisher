import { Check, Cloud, RefreshCw } from "lucide-react";
import type {
  DocumentBuffer,
  DocumentWorkspace,
} from "../core/documentWorkspace";
import { destinationLabel } from "../storage/destinations";
import "./document-status-bar.css";

export function documentSaveLabel(buffer: DocumentBuffer) {
  const destination = buffer.snapshot.destination;
  const label = destinationLabel(destination);
  if (buffer.live) {
    const phase = buffer.liveStatus?.phase;
    const state =
      phase === "live"
        ? "Live editing"
        : phase === "readonly"
          ? "View only · live"
          : phase === "offline"
            ? "Offline · edits kept on this device"
            : phase === "paused"
              ? "Live sync paused"
              : phase === "syncing"
                ? "Syncing live edits…"
                : "Connecting live editing…";
    return `${label} · ${state}`;
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
      return `${label} · read only`;
    default:
      return `Checking ${label}…`;
  }
}

/** One bottom bar describes the active pane; the tab identifies its document. */
export function DocumentStatusBar({
  model,
  collaborationAvailable,
  onFiles,
}: {
  model: DocumentWorkspace;
  collaborationAvailable: boolean;
  onFiles: (mode: "open" | "save") => void;
}) {
  const view = model.activeView;
  const buffer = model.activeBuffer;
  if (!view || !buffer) return <span>No document open</span>;
  const destination = buffer.snapshot.destination;
  const focus = view.controller.focusedSection;
  const heading = buffer.snapshot.screenplay.blocks.find(
    (block) => block.id === focus,
  );
  const message = buffer.liveStatus?.message || buffer.syncStatus?.message;
  const attention =
    buffer.status === "error" ||
    ["error", "conflict", "offline", "paused"].includes(
      buffer.liveStatus?.phase || buffer.syncStatus?.phase || "",
    );
  const act = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (error) {
      buffer.liveStatus = {
        phase: buffer.liveStatus?.phase || "paused",
        members: buffer.liveStatus?.members || [],
        canEdit: buffer.liveStatus?.canEdit || false,
        message:
          error instanceof Error
            ? error.message
            : "Live editing could not finish.",
      };
      model.notifyChanged();
    }
  };
  return (
    <>
      <div className="document-status-context">
        {focus ? (
          <button
            onClick={() => model.focusSection(view.id)}
            title="Show whole document"
          >
            Focus: {heading?.text || "Section"}
          </button>
        ) : (
          <span>Whole document</span>
        )}
        <button
          className={`document-save-state${attention ? " failed" : ""}`}
          title={message || "Open files and save locations"}
          onClick={() =>
            onFiles(buffer.syncStatus?.phase === "conflict" ? "save" : "open")
          }
        >
          {attention ? (
            <Cloud size={13} />
          ) : buffer.status === "saving" ||
            buffer.syncStatus?.phase === "saving" ? (
            <RefreshCw size={13} />
          ) : (
            <Check size={13} />
          )}
          <span>{documentSaveLabel(buffer)}</span>
        </button>
        {buffer.status === "error" && destination && (
          <span className="document-status-warning">
            Device recovery copy needs attention
          </span>
        )}
      </div>
      {collaborationAvailable &&
        destination &&
        destination.provider !== "local" && (
          <div
            className="document-live-controls"
            aria-label="Live editing controls"
          >
            {buffer.live ? (
              <>
                {buffer.liveStatus?.members.length ? (
                  <span
                    title={buffer.liveStatus.members
                      .map((member) => member.name)
                      .join(", ")}
                  >
                    {buffer.liveStatus.members.length} other{" "}
                    {buffer.liveStatus.members.length === 1
                      ? "writer"
                      : "writers"}
                  </span>
                ) : null}
                <button
                  disabled={buffer.endingLive}
                  onClick={() =>
                    void act(async () => {
                      const url = new URL(location.origin);
                      url.searchParams.set("live", buffer.live!.fileId);
                      await navigator.clipboard.writeText(url.toString());
                      buffer.liveStatus = {
                        ...buffer.liveStatus!,
                        message:
                          "Link copied. Only people with file access can join.",
                      };
                      model.notifyChanged();
                    })
                  }
                >
                  Copy live link
                </button>
                <button
                  disabled={buffer.endingLive}
                  onClick={() =>
                    void act(() => model.endLive(buffer.snapshot.id))
                  }
                >
                  {buffer.endingLive
                    ? "Ending live editing…"
                    : "End live editing"}
                </button>
              </>
            ) : (
              <button
                disabled={buffer.joiningLive || !view.controller.writable}
                onClick={() =>
                  void act(() =>
                    model.startLive(buffer.snapshot.id, !!destination.live),
                  )
                }
              >
                {buffer.joiningLive ? "Joining…" : "Start live editing"}
              </button>
            )}
          </div>
        )}
      {buffer.liveStatus?.message && (
        <span className="document-status-message" role="status">
          {buffer.liveStatus.message}
        </span>
      )}
    </>
  );
}
