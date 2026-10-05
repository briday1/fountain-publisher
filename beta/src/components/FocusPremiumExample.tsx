import { ArrowRight, ArrowDown, Focus } from "lucide-react";
import "./section-focus.css";

export function FocusPremiumExample({ mode }: { mode: "book" | "screenplay" }) {
  const book = mode === "book";
  const units = book
    ? [
        "Chapter 1 — The dark",
        "Chapter 2 — The promise",
        "Chapter 3 — The light",
      ]
    : [
        "EXT. LIGHTHOUSE — DUSK",
        "INT. LANTERN ROOM — NIGHT",
        "EXT. HARBOUR — DAWN",
      ];
  return (
    <section className="showcase-feature">
      <small className="showcase-kicker">Focus mode · Premium</small>
      <h3>
        {book
          ? "A whole book. One chapter at a time."
          : "A whole story. One scene at a time."}
      </h3>
      <p>
        {book
          ? "Give the chapter in front of you room to breathe. Pull one chapter into its own writing view, develop the moment, then move to the next when you’re ready."
          : "Stay with the scene. Pull it out of an act into its own writing view, work through the dialogue and action, then follow the story into the next scene."}{" "}
        Your edits stay connected to the full document, so you can keep creating
        without copying pieces back together.
      </p>
      <figure>
        <div
          className="focus-diagram"
          role="img"
          aria-label={
            book
              ? "Diagram: Chapter 2 is isolated from Book 1 into a focused writing view. Edits remain in the same book."
              : "Diagram: the lantern room scene is isolated from Act II into a focused writing view. Edits remain in the same screenplay."
          }
        >
          <div className="focus-diagram-source">
            <small>The Last Light</small>
            <h4>{book ? "Book 1 · The Coast" : "Act II · The Promise"}</h4>
            {units.map((unit, i) => (
              <div key={unit} className={i === 1 ? "selected" : ""}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                {unit}
              </div>
            ))}
          </div>
          <ArrowRight className="focus-diagram-arrow" aria-hidden="true" />
          <ArrowDown className="focus-diagram-down" aria-hidden="true" />
          <div className="focus-diagram-page">
            <small>
              <Focus size={14} /> Focus mode · 2 of 3
            </small>
            <article className={book ? "book-example" : "script-example"}>
              <h4>{units[1]}</h4>
              {book ? (
                <p>
                  She had spent years refusing his help. Tonight, with a boat
                  lost in the channel, she could no longer afford to.
                </p>
              ) : (
                <>
                  <p>Mara grips the crank. Eli waits beside the dark lens.</p>
                  <p className="focus-example-cue">MARA</p>
                  <p className="focus-example-dialogue">
                    Then we turn it together.
                  </p>
                </>
              )}
            </article>
            <footer>Same document. Every edit stays connected.</footer>
          </div>
        </div>
        <figcaption>
          Choose Focus this section in Outline. Move between sections or return
          to the whole document whenever you like. Open a focused tab beside the
          full draft on larger screens.
        </figcaption>
      </figure>
    </section>
  );
}
