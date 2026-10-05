import { useState } from "react";
import {
  BookmarkPlus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Pencil,
} from "lucide-react";
import { bookmarks, type Bookmark } from "../core/bookmarks";
import { newId, type Screenplay, type TextAnchor } from "../core/model";
import { Modal } from "./Modal";
const colors = [
  "#3974c2",
  "#7b5eb5",
  "#b34870",
  "#b37529",
  "#54824d",
  "#298581",
];
export function Bookmarks({
  doc,
  onChange,
  onCapture,
  onJump,
  readOnly = false,
}: {
  doc: Screenplay;
  onChange: (next: Screenplay, previous?: Screenplay) => void;
  onCapture: () => TextAnchor | undefined;
  onJump: (anchor: TextAnchor) => void;
  readOnly?: boolean;
}) {
  const items = bookmarks(doc);
  const [expanded, setExpanded] = useState(true);
  const [draft, setDraft] = useState<Bookmark>();
  const [active, setActive] = useState<string>();
  const [notice, setNotice] = useState("");
  const usable = items.filter(
    (b) => b.anchor && doc.blocks.some((p) => p.id === b.anchor!.blockId),
  );
  const jump = (b: Bookmark) => {
    if (b.anchor) {
      setActive(b.id);
      onJump(b.anchor);
    }
  };
  const move = (step: number) => {
    const cursor = onCapture();
    const i = usable.findIndex(
      (b) =>
        b.id === active ||
        (!active &&
          b.anchor?.blockId === cursor?.blockId &&
          b.anchor?.offset === cursor?.offset),
    );
    const b =
      usable[
        i < 0
          ? step > 0
            ? 0
            : usable.length - 1
          : (i + step + usable.length) % usable.length
      ];
    if (b) jump(b);
  };
  return (
    <section className="outline-bookmarks" aria-label="Bookmarks">
      <button
        className="outline-section bookmark-heading"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
      >
        <ChevronDown size={14} className={expanded ? "" : "collapsed"} />
        <small>BOOKMARKS</small>
        <span>{items.length}</span>
      </button>
      <div hidden={!expanded}>
        {items.length ? (
          <ul>
            {items.map((b) => (
              <li key={b.id}>
                <button
                  className="bookmark-jump"
                  disabled={!usable.includes(b)}
                  onClick={() => jump(b)}
                  aria-current={active === b.id ? "location" : undefined}
                >
                  <i style={{ background: b.color }} />
                  <span>
                    {b.name}
                    {!usable.includes(b) && <small>Text removed</small>}
                  </span>
                </button>
                {!readOnly && (
                  <button
                    className="icon-button"
                    aria-label={`Edit bookmark ${b.name}`}
                    onClick={() => setDraft({ ...b })}
                  >
                    <Pencil size={13} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="panel-empty">Keep a place to return to.</p>
        )}
        <div className="bookmark-actions">
          <button
            className="subtle-button"
            disabled={readOnly}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              const anchor = onCapture();
              if (anchor) {
                setNotice("");
                setDraft({ id: newId(), name: "", color: colors[0], anchor });
              } else setNotice("Place the cursor in your document first.");
            }}
          >
            <BookmarkPlus size={15} /> Add bookmark
          </button>
          <button
            className="icon-button"
            aria-label="Previous bookmark"
            disabled={!usable.length}
            onClick={() => move(-1)}
          >
            <ChevronLeft size={15} />
          </button>
          <button
            className="icon-button"
            aria-label="Next bookmark"
            disabled={!usable.length}
            onClick={() => move(1)}
          >
            <ChevronRight size={15} />
          </button>
        </div>
        {notice && <p role="status">{notice}</p>}
      </div>
      {draft && (
        <Modal
          title={
            items.some((b) => b.id === draft.id)
              ? "Edit bookmark"
              : "New bookmark"
          }
          onClose={() => setDraft(undefined)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!draft.name.trim()) return;
              onChange({
                ...doc,
                metadata: {
                  ...doc.metadata,
                  bookmarks: items.some((b) => b.id === draft.id)
                    ? items.map((b) =>
                        b.id === draft.id
                          ? {
                              ...b,
                              name: draft.name.trim(),
                              color: draft.color,
                            }
                          : b,
                      )
                    : [...items, { ...draft, name: draft.name.trim() }],
                },
              });
              setDraft(undefined);
            }}
          >
            <label className="bookmark-name">
              Name
              <input
                autoFocus
                required
                maxLength={120}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <fieldset className="bookmark-colors">
              <legend>Color</legend>
              {colors.map((color, i) => (
                <label key={color} style={{ color }}>
                  <input
                    type="radio"
                    name="bookmark-color"
                    aria-label={
                      ["Blue", "Purple", "Rose", "Amber", "Green", "Teal"][i]
                    }
                    checked={draft.color === color}
                    onChange={() => setDraft({ ...draft, color })}
                  />
                  <i style={{ background: color }} />
                </label>
              ))}
            </fieldset>
            <footer className="dialog-actions">
              {items.some((b) => b.id === draft.id) && (
                <button
                  type="button"
                  onClick={() => {
                    onChange({
                      ...doc,
                      metadata: {
                        ...doc.metadata,
                        bookmarks: items.filter((b) => b.id !== draft.id),
                      },
                    });
                    setDraft(undefined);
                  }}
                >
                  Delete bookmark
                </button>
              )}
              <button type="button" onClick={() => setDraft(undefined)}>
                Back
              </button>
              <button className="primary" type="submit">
                Save bookmark
              </button>
            </footer>
          </form>
        </Modal>
      )}
    </section>
  );
}
