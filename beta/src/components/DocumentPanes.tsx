import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type {
  DocumentWorkspace,
  DocumentBuffer,
  DocumentView,
} from "../core/documentWorkspace";
import { useDestinationSync } from "../hooks/useDestinationSync";
import { destinationKey, destinationLabel } from "../storage/destinations";
import type { Preferences } from "./Settings";
import { TitlePreview } from "./TitlePreview";
import { Menu, MenuItem } from "./Menu";
import "./document-panes.css";
export function BufferSync({
  buffer,
  model,
  accountId,
  premium,
  changed,
}: {
  buffer: DocumentBuffer;
  model: DocumentWorkspace;
  accountId?: string;
  premium: boolean;
  changed: () => void;
}) {
  const sync = useDestinationSync(
    buffer.session,
    buffer.snapshot.id,
    destinationKey(buffer.snapshot.destination),
    accountId,
    premium,
    !buffer.snapshot.destination?.live && !buffer.live,
  );
  useEffect(() => {
    const destination = buffer.session.current.destination;
    if (buffer.live && accountId !== destination?.accountId)
      model.stopLive(buffer.session.current.id);
    if (
      destination?.live &&
      accountId === destination.accountId &&
      !buffer.live &&
      !buffer.joiningLive
    )
      void model.startLive(buffer.session.current.id, true).catch((error) => {
        buffer.liveStatus = {
          phase: "paused",
          message: String(error),
          members: [],
          canEdit: false,
        };
        changed();
      });
  }, [accountId, buffer.snapshot.id]);
  useEffect(() => {
    buffer.sync.current = sync.engine.current;
    buffer.syncStatus = sync.status;
    changed();
    return () => {
      buffer.sync.current = undefined;
    };
  }, [sync.status, buffer.snapshot.destination, accountId, premium]);
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => {
      if (buffer.session.dirty) {
        void buffer.session.flush().catch(() => {});
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const hidden = () => {
      if (document.visibilityState === "hidden")
        void buffer.session.flush().catch(() => {});
    };
    window.addEventListener("beforeunload", before);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("beforeunload", before);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [buffer]);
  return null;
}
function DocumentCanvas({
  model,
  view,
  preferences,
  onTitle,
  collaborationAvailable = false,
  mobile = false,
}: {
  collaborationAvailable?: boolean;
  mobile?: boolean;
  model: DocumentWorkspace;
  view: DocumentView;
  preferences: Preferences;
  onTitle: () => void;
}) {
  const slot = useRef<HTMLDivElement>(null),
    scroll = useRef<HTMLDivElement>(null);
  const buffer = model.buffers.get(view.bufferId)!;
  useLayoutEffect(() => {
    slot.current!.append(view.host);
    if (scroll.current) scroll.current.scrollTop = view.scrollTop;
    return () => {
      view.host.remove();
    };
  }, [view]);
  useEffect(() => {
    view.controller.view.dom.setAttribute(
      "spellcheck",
      String(preferences.spellcheck),
    );
  }, [preferences.spellcheck, view]);
  const focus = view.controller.focusedSection;
  const heading = buffer.snapshot.screenplay.blocks.find((b) => b.id === focus);
  return (
    <>
      <div className="document-view-context">
        <span>
          {buffer.snapshot.name} ·{" "}
          {focus ? `Focus: ${heading?.text || "Section"}` : "Whole document"} ·{" "}
          {destinationLabel(buffer.snapshot.destination)}
        </span>
        {collaborationAvailable &&
          buffer.snapshot.destination &&
          buffer.snapshot.destination.provider !== "local" &&
          (buffer.live ? (
            <div
              className="live-status"
              role="status"
              aria-label="Live collaboration"
              title={buffer.liveStatus?.message}
            >
              <span>
                {buffer.liveStatus?.phase === "live"
                  ? "Live editing"
                  : buffer.liveStatus?.phase === "readonly"
                    ? "View only · live"
                    : buffer.liveStatus?.phase || "Connecting…"}
              </span>
              <button
                onClick={() => {
                  const url = new URL(location.origin);
                  url.searchParams.set("live", buffer.live!.fileId);
                  void navigator.clipboard
                    .writeText(url.toString())
                    .then(() => {
                      buffer.liveStatus = {
                        ...buffer.liveStatus!,
                        message:
                          "Link copied. The recipient must already have access to this file and WriteShape.",
                      };
                      model.notifyChanged();
                    })
                    .catch(() => {
                      buffer.liveStatus = {
                        ...buffer.liveStatus!,
                        message: "Copy this link: " + url,
                      };
                      model.notifyChanged();
                    });
                }}
              >
                Copy live link
              </button>
              {buffer.liveStatus?.members.map((member, index) => (
                <span key={member.id + index}>{member.name}</span>
              ))}
            </div>
          ) : (
            <button
              disabled={buffer.joiningLive}
              onClick={() =>
                void model
                  .startLive(
                    buffer.snapshot.id,
                    !!buffer.snapshot.destination?.live,
                  )
                  .catch((error) => {
                    buffer.message = String(error);
                    buffer.liveStatus = {
                      phase: "paused",
                      message: String(error),
                      members: [],
                      canEdit: false,
                    };
                    model.notifyChanged();
                  })
              }
            >
              {buffer.joiningLive ? "Joining…" : "Start live editing"}
            </button>
          ))}
        {buffer.liveStatus?.message && (
          <span role="status">{buffer.liveStatus.message}</span>
        )}
        {focus && (
          <button onClick={() => model.focusSection(view.id)}>
            Show whole document
          </button>
        )}
      </div>
      <div
        ref={scroll}
        className="writing-scroll"
        role={mobile ? "region" : "tabpanel"}
        aria-label={mobile ? "Current document" : undefined}
        id={`document-panel-${view.id}`}
        aria-labelledby={mobile ? undefined : `document-tab-${view.id}`}
        onScroll={(event) => {
          view.scrollTop = event.currentTarget.scrollTop;
          model.saveLayout();
        }}
        onPointerDown={() => {
          if (model.activeView?.id !== view.id) model.activate(view.id);
        }}
        onFocusCapture={() => {
          if (model.activeView?.id !== view.id) model.activate(view.id);
        }}
      >
        <div className="paper-wrap" style={{ zoom: preferences.zoom / 100 }}>
          <article
            className={`screenplay-paper ${preferences.colors ? "element-colors" : ""} ${preferences.boldSceneHeadings ? "bold-scenes" : ""} numbers-${preferences.sceneNumbers}`}
            data-number-format={preferences.sceneNumberFormat}
            aria-label={
              buffer.snapshot.screenplay.metadata.format === "markdown"
                ? "Manuscript page"
                : "Screenplay page"
            }
          >
            {!focus && (
              <TitlePreview
                value={buffer.snapshot.screenplay.titlePage}
                onEdit={() => {
                  model.activate(view.id);
                  onTitle();
                }}
              />
            )}
            <div ref={slot} />
          </article>
        </div>
      </div>
    </>
  );
}
export function DocumentPanes({
  model,
  preferences,
  onOpen,
  onTitle,
  changed,
  collaborationAvailable = false,
  mobile = false,
}: {
  collaborationAvailable?: boolean;
  mobile?: boolean;
  model: DocumentWorkspace;
  preferences: Preferences;
  onOpen: () => void;
  onTitle: () => void;
  changed: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<string>();
  // Rendering a single active view does not collapse, reorder or close the desktop workspace.
  if (mobile)
    return (
      <div className="document-workspace mobile-single-document">
        <section className="document-pane" aria-label="Document">
          {model.activeView ? (
            <DocumentCanvas
              key={model.activeView.id}
              model={model}
              view={model.activeView}
              collaborationAvailable={collaborationAvailable}
              preferences={preferences}
              onTitle={onTitle}
              mobile
            />
          ) : (
            <div className="empty-document-pane">
              <p>Open a document to start writing.</p>
              <button onClick={onOpen}>Open a document</button>
            </div>
          )}
        </section>
      </div>
    );
  return (
    <div
      className={`document-workspace ${model.split ? "is-split" : ""} active-pane-${model.activePane}`}
      ref={root}
      style={{ "--pane-ratio": `${model.ratio}%` } as React.CSSProperties}
    >
      <div className="document-workspace-tools">
        <span>Active pane: {model.activePane === 0 ? "Left" : "Right"}</span>
        <button onClick={() => model.toggleSplit()}>
          {model.split ? "Single pane" : "Split view"}
        </button>
        <Menu anchored label="Open documents">
          {[...model.buffers.values()].map((buffer) => (
            <MenuItem
              key={buffer.session.current.id}
              onClick={() => {
                const first = [...buffer.views][0];
                if (first) model.activate(first);
                else model.addView(buffer.session.current.id, model.activePane);
              }}
            >
              {buffer.snapshot.name} · {buffer.views.size}{" "}
              {buffer.views.size === 1 ? "view" : "views"}
            </MenuItem>
          ))}
        </Menu>
        {model.split && (
          <button onClick={() => model.swapPanes()}>Swap panes</button>
        )}
      </div>
      <div className="document-pane-row">
        {model.panes.map((pane, paneIndex) => {
          if (paneIndex === 1 && !model.split) return null;
          const selected = model.views.get(pane.selected || "");
          return (
            <section
              className={`document-pane pane-${paneIndex} ${model.activePane === paneIndex ? "active" : ""}`}
              key={paneIndex}
              aria-label={`${paneIndex === 0 ? "Left" : "Right"} document pane`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (drag) model.move(drag, paneIndex as 0 | 1);
                setDrag(undefined);
              }}
            >
              <div className="document-pane-header">
                <div
                  className="document-tabs"
                  role="tablist"
                  aria-label={`${paneIndex === 0 ? "Left" : "Right"} document tabs`}
                >
                  {pane.tabs.map((id, index) => {
                    const view = model.views.get(id)!,
                      buffer = model.buffers.get(view.bufferId)!;
                    const heading = buffer.snapshot.screenplay.blocks.find(
                      (b) => b.id === view.sectionId,
                    );
                    return (
                      <div
                        className="document-tab"
                        key={id}
                        draggable
                        onDragStart={() => setDrag(id)}
                        onDragEnd={() => setDrag(undefined)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (drag) model.move(drag, paneIndex as 0 | 1, index);
                          setDrag(undefined);
                        }}
                      >
                        <button
                          role="tab"
                          id={`document-tab-${id}`}
                          aria-controls={`document-panel-${id}`}
                          tabIndex={pane.selected === id ? 0 : -1}
                          onKeyDown={(event) => {
                            const target =
                              event.key === "ArrowRight"
                                ? (index + 1) % pane.tabs.length
                                : event.key === "ArrowLeft"
                                  ? (index - 1 + pane.tabs.length) %
                                    pane.tabs.length
                                  : event.key === "Home"
                                    ? 0
                                    : event.key === "End"
                                      ? pane.tabs.length - 1
                                      : -1;
                            if (target >= 0) {
                              event.preventDefault();
                              model.activate(pane.tabs[target]);
                              document
                                .getElementById(
                                  `document-tab-${pane.tabs[target]}`,
                                )
                                ?.focus();
                            }
                          }}
                          aria-selected={pane.selected === id}
                          title={buffer.snapshot.name}
                          onClick={() => model.activate(id)}
                        >
                          {buffer.snapshot.name}
                          {heading ? ` / ${heading.text || "Section"}` : ""}
                          {buffer.status === "saving" ? " •" : ""}
                          {["conflict", "error", "offline"].includes(
                            buffer.syncStatus?.phase || "",
                          )
                            ? " !"
                            : ""}
                        </button>
                        <Menu
                          anchored
                          label={`Actions for ${buffer.snapshot.name}${heading ? ` / ${heading.text || "Section"}` : ""}`}
                        >
                          <MenuItem
                            onClick={() => {
                              model.activate(id);
                              model.duplicate(
                                id,
                                true,
                                view.sectionId,
                                !!view.controller.focusedSection,
                              );
                            }}
                          >
                            Open in other pane
                          </MenuItem>
                          <MenuItem
                            onClick={() =>
                              model.move(id, (1 - paneIndex) as 0 | 1)
                            }
                          >
                            Move to other pane
                          </MenuItem>
                          <MenuItem
                            disabled={index === 0}
                            onClick={() =>
                              model.move(
                                id,
                                paneIndex as 0 | 1,
                                Math.max(0, index - 1),
                              )
                            }
                          >
                            Move tab left
                          </MenuItem>
                          <MenuItem
                            disabled={index === pane.tabs.length - 1}
                            onClick={() =>
                              model.move(
                                id,
                                paneIndex as 0 | 1,
                                Math.min(pane.tabs.length - 1, index + 1),
                              )
                            }
                          >
                            Move tab right
                          </MenuItem>
                          <MenuItem onClick={() => model.close(id)}>
                            Close tab
                          </MenuItem>
                        </Menu>
                        <button
                          aria-label={`Close ${buffer.snapshot.name}${heading ? ` / ${heading.text || "Section"}` : ""} view`}
                          onClick={() => model.close(id)}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                  <button
                    className="document-tab-open"
                    aria-label={`Open in ${paneIndex === 0 ? "left" : "right"} pane`}
                    onClick={() => {
                      model.activePane = paneIndex as 0 | 1;
                      if (pane.selected) model.activate(pane.selected);
                      changed();
                      onOpen();
                    }}
                  >
                    +
                  </button>
                </div>
                {model.split && (
                  <button
                    className="document-pane-close"
                    aria-label={`Close ${paneIndex === 0 ? "left" : "right"} pane`}
                    title="Close pane · documents remain saved"
                    onClick={() => model.closePane(paneIndex as 0 | 1)}
                  >
                    ×
                  </button>
                )}
              </div>
              {selected ? (
                <DocumentCanvas
                  key={selected.id}
                  model={model}
                  view={selected}
                  collaborationAvailable={collaborationAvailable}
                  preferences={preferences}
                  onTitle={onTitle}
                />
              ) : (
                <div className="empty-document-pane">
                  <p>No open views. Your drafts are saved.</p>
                  <button
                    onClick={() => {
                      model.activePane = paneIndex as 0 | 1;
                      changed();
                      onOpen();
                    }}
                  >
                    Open a document
                  </button>
                </div>
              )}
            </section>
          );
        })}
        {model.split && (
          <div
            className="document-pane-divider"
            role="separator"
            aria-label="Resize document panes"
            aria-orientation="vertical"
            tabIndex={0}
            aria-valuemin={25}
            aria-valuemax={75}
            aria-valuenow={model.ratio}
            onKeyDown={(e) => {
              if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
                e.preventDefault();
                model.ratio = Math.max(
                  25,
                  Math.min(75, model.ratio + (e.key === "ArrowRight" ? 2 : -2)),
                );
                changed();
              }
            }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (
                !e.currentTarget.hasPointerCapture(e.pointerId) ||
                !root.current
              )
                return;
              const bounds = root.current.getBoundingClientRect();
              model.ratio = Math.max(
                25,
                Math.min(75, ((e.clientX - bounds.left) / bounds.width) * 100),
              );
              changed();
            }}
            onPointerUp={(e) =>
              e.currentTarget.releasePointerCapture(e.pointerId)
            }
          />
        )}
      </div>
    </div>
  );
}
