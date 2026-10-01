import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Columns2,
  FileText,
  MoreHorizontal,
  Plus,
  X,
} from "lucide-react";
import type {
  DocumentWorkspace,
  DocumentBuffer,
  DocumentView,
} from "../core/documentWorkspace";
import { useDestinationSync } from "../hooks/useDestinationSync";
import {
  destinationReadOnly,
  destinationKey,
  destinationLabel,
} from "../storage/destinations";
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
  const destination = buffer.snapshot.destination;
  useLayoutEffect(() => {
    const readOnly = destinationReadOnly(destination, accountId, premium);
    for (const id of buffer.views)
      model.views.get(id)?.controller.setDestinationReadOnly(readOnly);
    if (readOnly && buffer.live) model.stopLive(buffer.session.current.id);
    if (destination?.live && !premium && accountId === destination.accountId) {
      buffer.session.setDestination({
        ...destination,
        live: false,
        pausedForPlan: true,
      });
      void buffer.session.flush().catch(() => {});
    }
  }, [destination, accountId, premium, model, buffer, model.views.size]);
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
      premium &&
      !destination.pausedForPlan &&
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
  }, [accountId, premium, buffer.snapshot.id]);
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
              disabled={buffer.joiningLive || !view.controller.writable}
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
type DropTarget = { pane: 0 | 1; slot?: number; edge?: "left" | "right" };
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
  const dragId = useRef<string | undefined>(undefined);
  const [drag, setDrag] = useState<string>();
  const [drop, setDrop] = useState<DropTarget>();
  const [resizing, setResizing] = useState(false);
  const [context, setContext] = useState<{
    id: string;
    x: number;
    y: number;
  }>();
  const selectedIds = model.panes.map((p) => p.selected).join(":");
  useLayoutEffect(() => {
    if (mobile) return;
    // Reveal selected tabs without scrolling the document or outer workspace.
    root.current
      ?.querySelectorAll<HTMLElement>(".document-tab.selected")
      .forEach((tab) => {
        const strip = tab.parentElement!;
        const bounds = tab.getBoundingClientRect(),
          viewport = strip.getBoundingClientRect();
        if (bounds.left < viewport.left)
          strip.scrollLeft -= viewport.left - bounds.left;
        else if (bounds.right > viewport.right)
          strip.scrollLeft += bounds.right - viewport.right;
      });
  }, [selectedIds, mobile, model.split]);
  const focusSelected = () => {
    requestAnimationFrame(() => {
      const id = model.activeView?.id;
      if (id) document.getElementById(`document-tab-${id}`)?.focus();
      else
        root.current
          ?.querySelector<HTMLButtonElement>(".empty-document-pane button")
          ?.focus();
    });
  };
  const closeTab = (id: string) => {
    model.close(id);
    focusSelected();
  };
  const activatePane = (pane: 0 | 1) => {
    const id = model.panes[pane].selected;
    if (id) model.activate(id);
    else {
      model.activePane = pane;
      changed();
    }
  };
  const finishDrag = () => {
    dragId.current = undefined;
    setDrag(undefined);
    setDrop(undefined);
  };
  const acceptDrop = (target: DropTarget) => {
    const id = dragId.current;
    if (!id) return;
    if (target.edge) model.splitWith(id, target.edge, true);
    else
      model.moveToSlot(
        id,
        target.pane,
        target.slot ?? model.panes[target.pane].tabs.length,
      );
    finishDrag();
    focusSelected();
  };
  // Rendering one active view preserves the complete desktop group layout.
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
      className={`document-workspace ${model.split ? "is-split" : ""} ${drag ? "dragging-tab" : ""} ${resizing ? "resizing-panes" : ""} active-pane-${model.activePane}`}
      ref={root}
      style={{ "--pane-ratio": `${model.ratio}%` } as React.CSSProperties}
      onKeyDown={(event) => {
        if (
          event.nativeEvent.isComposing ||
          !(event.metaKey || event.ctrlKey) ||
          event.altKey
        )
          return;
        if (event.key === "\\" && model.activeView) {
          event.preventDefault();
          model.splitWith(model.activeView.id);
          focusSelected();
        } else if (
          event.shiftKey &&
          ["PageUp", "PageDown"].includes(event.key)
        ) {
          event.preventDefault();
          const pane = model.panes[model.activePane];
          const step = event.key === "PageDown" ? 1 : -1;
          const index = pane.tabs.indexOf(pane.selected || "");
          if (pane.tabs.length)
            model.activate(
              pane.tabs[(index + step + pane.tabs.length) % pane.tabs.length],
            );
          focusSelected();
        }
      }}
    >
      <div className="document-pane-row">
        {model.panes.map((pane, paneIndex) => {
          if (paneIndex === 1 && !model.split) return null;
          const paneId = paneIndex as 0 | 1;
          const side = paneId === 0 ? "left" : "right";
          const selected = model.views.get(pane.selected || "");
          const target = drop?.pane === paneId ? drop : undefined;
          return (
            <section
              className={`document-pane pane-${paneId} ${model.activePane === paneId ? "active" : ""}`}
              key={paneId}
              aria-label={`${paneId === 0 ? "Left" : "Right"} document pane`}
              onDragOver={(event) => {
                if (!dragId.current) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                const bounds = event.currentTarget.getBoundingClientRect();
                const fraction = (event.clientX - bounds.left) / bounds.width;
                setDrop({
                  pane: paneId,
                  edge:
                    !model.split && fraction > 0.75
                      ? "right"
                      : !model.split && fraction < 0.25
                        ? "left"
                        : undefined,
                });
              }}
              onDragLeave={(event) => {
                const bounds = event.currentTarget.getBoundingClientRect();
                if (
                  event.clientX < bounds.left ||
                  event.clientX >= bounds.right ||
                  event.clientY < bounds.top ||
                  event.clientY >= bounds.bottom
                )
                  setDrop(undefined);
              }}
              onDrop={(event) => {
                if (dragId.current) {
                  event.preventDefault();
                  const bounds = event.currentTarget.getBoundingClientRect();
                  const fraction = (event.clientX - bounds.left) / bounds.width;
                  acceptDrop({
                    pane: paneId,
                    edge:
                      !model.split && fraction > 0.75
                        ? "right"
                        : !model.split && fraction < 0.25
                          ? "left"
                          : undefined,
                  });
                }
              }}
            >
              <div className="document-pane-header">
                <div
                  className="document-tabs"
                  role="tablist"
                  aria-label={`${paneId === 0 ? "Left" : "Right"} document tabs`}
                  onWheel={(event) => {
                    if (Math.abs(event.deltaY) > Math.abs(event.deltaX))
                      event.currentTarget.scrollLeft += event.deltaY;
                  }}
                  onDragOver={(event) => {
                    if (!dragId.current) return;
                    event.preventDefault();
                    event.stopPropagation();
                    event.dataTransfer.dropEffect = "move";
                    setDrop({ pane: paneId, slot: pane.tabs.length });
                    const bounds = event.currentTarget.getBoundingClientRect();
                    if (event.clientX > bounds.right - 35)
                      event.currentTarget.scrollLeft += 18;
                    if (event.clientX < bounds.left + 35)
                      event.currentTarget.scrollLeft -= 18;
                  }}
                  onDrop={(event) => {
                    if (dragId.current) {
                      event.preventDefault();
                      event.stopPropagation();
                      // Derive the final slot from the drop itself: browsers may
                      // dispatch a leave between the final hover and drop.
                      const tab = (
                        event.target as HTMLElement
                      ).closest<HTMLElement>(".document-tab");
                      const index = tab
                        ? [...event.currentTarget.children].indexOf(tab)
                        : -1;
                      const bounds = tab?.getBoundingClientRect();
                      acceptDrop({
                        pane: paneId,
                        slot:
                          index >= 0 && bounds
                            ? index +
                              (event.clientX >= bounds.left + bounds.width / 2
                                ? 1
                                : 0)
                            : pane.tabs.length,
                      });
                    }
                  }}
                >
                  {pane.tabs.map((id, index) => {
                    const view = model.views.get(id)!,
                      buffer = model.buffers.get(view.bufferId)!;
                    const heading = buffer.snapshot.screenplay.blocks.find(
                      (b) => b.id === view.sectionId,
                    );
                    const label = `${buffer.snapshot.name}${heading ? ` / ${heading.text || "Section"}` : ""}`;
                    const attention =
                      ["conflict", "error", "offline"].includes(
                        buffer.syncStatus?.phase || "",
                      ) || buffer.status === "error";
                    return (
                      <div
                        className={`document-tab ${pane.selected === id ? "selected" : ""} ${drag === id ? "drag-source" : ""} ${target?.slot === index ? "drop-before" : ""} ${index === pane.tabs.length - 1 && target?.slot === pane.tabs.length ? "drop-after" : ""}`}
                        key={id}
                        draggable
                        onDragStart={(event) => {
                          setContext(undefined);
                          dragId.current = id;
                          setDrag(id);
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData(
                            "application/x-writeshape-tab",
                            id,
                          );
                        }}
                        onDragEnd={finishDrag}
                        onDragOver={(event) => {
                          if (!dragId.current) return;
                          event.preventDefault();
                          event.stopPropagation();
                          event.dataTransfer.dropEffect = "move";
                          const bounds =
                            event.currentTarget.getBoundingClientRect();
                          setDrop({
                            pane: paneId,
                            slot:
                              index +
                              (event.clientX >= bounds.left + bounds.width / 2
                                ? 1
                                : 0),
                          });
                          const strip = event.currentTarget.parentElement!;
                          const stripBounds = strip.getBoundingClientRect();
                          if (event.clientX > stripBounds.right - 35)
                            strip.scrollLeft += 18;
                          if (event.clientX < stripBounds.left + 35)
                            strip.scrollLeft -= 18;
                        }}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          setContext({
                            id,
                            x: event.clientX,
                            y: event.clientY,
                          });
                        }}
                        onAuxClick={(event) => {
                          if (event.button === 1) {
                            event.preventDefault();
                            closeTab(id);
                          }
                        }}
                      >
                        <button
                          role="tab"
                          draggable
                          id={`document-tab-${id}`}
                          aria-controls={`document-panel-${id}`}
                          tabIndex={pane.selected === id ? 0 : -1}
                          aria-selected={pane.selected === id}
                          title={`${label} · ${destinationLabel(buffer.snapshot.destination)}`}
                          onClick={() => model.activate(id)}
                          onKeyDown={(event) => {
                            if (event.key === "Delete") {
                              event.preventDefault();
                              closeTab(id);
                              return;
                            }
                            if (
                              event.key === "ContextMenu" ||
                              (event.shiftKey && event.key === "F10")
                            ) {
                              event.preventDefault();
                              const bounds =
                                event.currentTarget.getBoundingClientRect();
                              setContext({
                                id,
                                x: bounds.left,
                                y: bounds.bottom,
                              });
                              return;
                            }
                            const next =
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
                            if (next >= 0) {
                              event.preventDefault();
                              model.activate(pane.tabs[next]);
                              focusSelected();
                            }
                          }}
                        >
                          <FileText
                            size={14}
                            aria-hidden="true"
                            className="document-tab-icon"
                          />
                          <span className="document-tab-name">
                            {buffer.snapshot.name}
                          </span>
                          {heading && (
                            <span className="document-tab-section">
                              {heading.text || "Section"}
                            </span>
                          )}
                          {(attention || buffer.status === "saving") && (
                            <span
                              className={`document-tab-status ${attention ? "attention" : ""}`}
                              role="status"
                              aria-label={
                                attention ? "Save needs attention" : "Saving"
                              }
                              title={
                                attention ? "Save needs attention" : "Saving"
                              }
                            >
                              {attention ? "!" : "•"}
                            </span>
                          )}
                        </button>
                        <Menu
                          anchored
                          label={`Actions for ${label}`}
                          triggerContent={
                            <MoreHorizontal size={14} aria-hidden="true" />
                          }
                          contextMenu={context?.id === id ? context : undefined}
                          onDismiss={() => setContext(undefined)}
                        >
                          <MenuItem onClick={() => model.splitWith(id)}>
                            {model.split ? "Open in other pane" : "Split right"}
                          </MenuItem>
                          {!model.split && (
                            <MenuItem
                              onClick={() => model.splitWith(id, "left")}
                            >
                              Split left
                            </MenuItem>
                          )}
                          <MenuItem
                            disabled={!model.split && pane.tabs.length < 2}
                            onClick={() => model.splitWith(id, "right", true)}
                          >
                            Move to other pane
                          </MenuItem>
                          <MenuItem
                            disabled={index === 0}
                            onClick={() => model.move(id, paneId, index - 1)}
                          >
                            Move tab left
                          </MenuItem>
                          <MenuItem
                            disabled={index === pane.tabs.length - 1}
                            onClick={() => model.move(id, paneId, index + 1)}
                          >
                            Move tab right
                          </MenuItem>
                          <hr />
                          <MenuItem onClick={() => closeTab(id)}>
                            Close tab
                          </MenuItem>
                          <MenuItem
                            disabled={pane.tabs.length < 2}
                            onClick={() => {
                              model.activate(id);
                              model.closeTabs(paneId, id);
                              focusSelected();
                            }}
                          >
                            Close other tabs
                          </MenuItem>
                          <MenuItem
                            disabled={index === pane.tabs.length - 1}
                            onClick={() => {
                              model.activate(id);
                              model.closeTabs(paneId, id, id);
                              focusSelected();
                            }}
                          >
                            Close tabs to the right
                          </MenuItem>
                          <MenuItem
                            onClick={() => {
                              model.closeTabs(paneId);
                              focusSelected();
                            }}
                          >
                            Close all tabs in pane
                          </MenuItem>
                        </Menu>
                        <button
                          className="document-tab-close"
                          aria-label={`Close ${label} view`}
                          title="Close tab"
                          onClick={() => closeTab(id)}
                        >
                          <X size={14} aria-hidden="true" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div
                  className="document-group-actions"
                  role="group"
                  aria-label={`${side} pane controls`}
                >
                  <Menu
                    anchored
                    label={`Open documents in ${side} pane`}
                    triggerContent={
                      <ChevronDown size={15} aria-hidden="true" />
                    }
                  >
                    {[...model.buffers.values()].map((buffer) => (
                      <MenuItem
                        key={buffer.snapshot.id}
                        onClick={() => {
                          const existing = pane.tabs.find(
                            (id) =>
                              model.views.get(id)?.bufferId ===
                              buffer.snapshot.id,
                          );
                          if (existing) model.activate(existing);
                          else model.addView(buffer.snapshot.id, paneId);
                        }}
                      >
                        {buffer.snapshot.name}
                      </MenuItem>
                    ))}
                  </Menu>
                  <button
                    className="document-group-button"
                    aria-label={`Open in ${side} pane`}
                    title="Open a document"
                    onClick={() => {
                      activatePane(paneId);
                      onOpen();
                    }}
                  >
                    <Plus size={15} aria-hidden="true" />
                  </button>
                  <button
                    className="document-group-button"
                    disabled={!selected}
                    aria-label={
                      model.split
                        ? `Open ${side} editor in other pane`
                        : "Split editor right"
                    }
                    title={
                      model.split
                        ? "Open editor in other pane"
                        : "Split editor right"
                    }
                    onClick={() => {
                      if (selected) model.splitWith(selected.id);
                    }}
                  >
                    <Columns2 size={15} aria-hidden="true" />
                  </button>
                  <Menu
                    anchored
                    label={`${paneId === 0 ? "Left" : "Right"} pane actions`}
                    triggerContent={
                      <MoreHorizontal size={15} aria-hidden="true" />
                    }
                  >
                    <MenuItem
                      disabled={!pane.tabs.length}
                      onClick={() => {
                        model.closeTabs(paneId);
                        focusSelected();
                      }}
                    >
                      Close all tabs in pane
                    </MenuItem>
                    <MenuItem
                      disabled={pane.tabs.length < 2}
                      onClick={() => {
                        activatePane(paneId);
                        model.closeTabs(paneId, pane.selected);
                        focusSelected();
                      }}
                    >
                      Close other tabs
                    </MenuItem>
                    {model.split && (
                      <>
                        <hr />
                        <MenuItem onClick={() => model.resizePanes(50)}>
                          Equalize pane widths
                        </MenuItem>
                        <MenuItem onClick={() => model.swapPanes()}>
                          Swap panes
                        </MenuItem>
                        <MenuItem
                          onClick={() => {
                            model.toggleSplit();
                            focusSelected();
                          }}
                        >
                          Join all tabs into one pane
                        </MenuItem>
                        <MenuItem
                          onClick={() => {
                            model.closePane((1 - paneId) as 0 | 1);
                            focusSelected();
                          }}
                        >
                          Close other pane
                        </MenuItem>
                      </>
                    )}
                  </Menu>
                  {model.split && (
                    <button
                      className="document-group-button document-pane-close"
                      aria-label={`Close ${side} pane`}
                      title="Close pane · documents remain saved"
                      onClick={() => {
                        model.closePane(paneId);
                        focusSelected();
                      }}
                    >
                      <X size={15} aria-hidden="true" />
                    </button>
                  )}
                </div>
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
                  <FileText size={28} aria-hidden="true" />
                  <p>No open documents</p>
                  <span>Your drafts are saved in Files.</span>
                  <button
                    onClick={() => {
                      activatePane(paneId);
                      onOpen();
                    }}
                  >
                    Open a document
                  </button>
                </div>
              )}
              {drag && target && target.slot === undefined && (
                <div
                  className={`document-drop-overlay ${target.edge ? `split-${target.edge}` : ""}`}
                  aria-hidden="true"
                >
                  <span>
                    {target.edge ? `Split ${target.edge}` : "Move to this pane"}
                  </span>
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
            aria-valuenow={Math.round(model.ratio)}
            aria-valuetext={`Left pane ${Math.round(model.ratio)} percent`}
            title="Drag to resize · double-click to equalize"
            onDoubleClick={() => model.resizePanes(50)}
            onKeyDown={(event) => {
              if (
                ["ArrowLeft", "ArrowRight", "Home", "End", "Enter"].includes(
                  event.key,
                )
              ) {
                event.preventDefault();
                model.resizePanes(
                  event.key === "Home"
                    ? 25
                    : event.key === "End"
                      ? 75
                      : event.key === "Enter"
                        ? 50
                        : model.ratio + (event.key === "ArrowRight" ? 2 : -2),
                );
              }
            }}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              setResizing(true);
            }}
            onPointerMove={(event) => {
              if (
                !event.currentTarget.hasPointerCapture(event.pointerId) ||
                !root.current
              )
                return;
              const bounds = root.current.getBoundingClientRect();
              model.resizePanes(
                ((event.clientX - bounds.left) / bounds.width) * 100,
              );
            }}
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId))
                event.currentTarget.releasePointerCapture(event.pointerId);
              setResizing(false);
            }}
            onLostPointerCapture={() => setResizing(false)}
            onPointerCancel={() => setResizing(false)}
          />
        )}
      </div>
    </div>
  );
}
