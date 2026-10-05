import { withoutFootnotes } from "../core/footnotes";
import type {
  DocumentWorkspace,
  DocumentView,
} from "../core/documentWorkspace";
import { ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";
import "./section-focus.css";

export function SectionFocusBar({
  model,
  view,
}: {
  model: DocumentWorkspace;
  view: DocumentView;
}) {
  const id = view.controller.focusedSection;
  if (!id) return null;
  const blocks = view.controller.getBlocks();
  const heading = blocks.find((block) => block.id === id);
  if (!heading) return null;
  const sections = blocks.filter(
    (block) =>
      block.kind === heading.kind &&
      (block.kind !== "section" || (block.level || 1) === (heading.level || 1)),
  );
  const index = sections.findIndex((block) => block.id === id);
  const move = (next: number) => {
    const section = sections[next];
    if (!section) return;
    model.focusSection(view.id, section.id);
    view.controller.focus();
    view.controller.view.dispatch(
      view.controller.view.state.tr.scrollIntoView(),
    );
  };
  return (
    <nav className="section-focus-bar" aria-label="Focus mode">
      <div>
        <small>
          Focus mode · {index + 1} of {sections.length}
        </small>
        <strong>{withoutFootnotes(heading.text) || "Untitled section"}</strong>
      </div>
      <button
        aria-label="Previous section"
        disabled={index <= 0}
        onClick={() => move(index - 1)}
      >
        <ChevronLeft size={16} />
      </button>
      <button
        aria-label="Next section"
        disabled={index >= sections.length - 1}
        onClick={() => move(index + 1)}
      >
        <ChevronRight size={16} />
      </button>
      <button onClick={() => model.focusSection(view.id)}>
        <Maximize2 size={15} />
        Whole document
      </button>
    </nav>
  );
}
