import { BarChart3, BookOpen } from "lucide-react";
import type { Screenplay } from "../core/model";
import type { analyzeScreenplay } from "../core/insights";
import { NovelCharacters } from "./NovelCharacters";

/** Shared by the live sidebar and fictional Premium examples. */
export function InsightsContent({
  doc,
  insights,
  documentId,
  pages,
  exact = true,
  pdfError = "",
  readOnly = false,
  onChange,
  onCharacter,
  onAnalytics,
}: {
  doc: Screenplay;
  insights: ReturnType<typeof analyzeScreenplay>;
  documentId: string;
  pages: string | number;
  exact?: boolean;
  pdfError?: string;
  readOnly?: boolean;
  onChange: (doc: Screenplay) => void;
  onCharacter: (name: string) => void;
  onAnalytics: () => void;
}) {
  const novel = doc.metadata.format === "markdown";
  return (
    <>
      <div className="metrics">
        <div
          aria-label="PDF page count"
          aria-busy={!exact && !pdfError}
          title={
            pdfError ||
            (exact
              ? "Screenplay pages from the generated PDF, rounded up to an eighth; excludes title pages"
              : "Generating the PDF to count its pages")
          }
        >
          <strong>{pages}</strong>
          <span>{pdfError && !exact ? "PDF unavailable" : "PDF pages"}</span>
        </div>
        <div>
          <strong>
            {novel
              ? doc.blocks.filter((b) => b.kind === "section").length
              : insights.sceneCount}
          </strong>
          <span>{novel ? "headings" : "scenes"}</span>
        </div>
        <div>
          <strong>{insights.wordCount.toLocaleString()}</strong>
          <span>words</span>
        </div>
      </div>
      {novel ? (
        <NovelCharacters key={documentId} doc={doc} onChange={onChange} />
      ) : (
        <>
          <section className="insight-section">
            <div className="section-label">
              <h3>On the page</h3>
              <span>{Math.round(insights.dialoguePercent)}% dialogue</span>
            </div>
            <div className="balance-bar">
              <span style={{ width: `${insights.dialoguePercent}%` }} />
            </div>
            <div className="chart-key">
              <span>
                <i />
                Dialogue
              </span>
              <span>
                <i />
                Action
              </span>
            </div>
          </section>
          <section className="insight-section">
            <div className="section-label">
              <h3>Characters</h3>
              <span>{insights.characterCount}</span>
            </div>
            {!insights.characters.length && (
              <p className="muted">
                Your characters will find their voices here.
              </p>
            )}
            {insights.characters.map((c, i) => (
              <button
                className="character-row"
                key={c.name}
                onClick={() => onCharacter(c.name)}
              >
                <div>
                  <span
                    className="character-dot"
                    style={{
                      background: [
                        "#76add9",
                        "#c29ad0",
                        "#91b378",
                        "#d8b175",
                        "#7cbdb4",
                      ][i % 5],
                    }}
                  />
                  <strong>{c.name}</strong>
                  <span>{c.dialogueWords} words</span>
                </div>
                <div className="character-bar">
                  <span
                    style={{
                      width: `${c.share}%`,
                      background: [
                        "#76add9",
                        "#c29ad0",
                        "#91b378",
                        "#d8b175",
                        "#7cbdb4",
                      ][i % 5],
                    }}
                  />
                </div>
                <small>
                  {c.speeches} speeches · {c.sceneCount} scenes ·{" "}
                  {c.estimatedMinutes.toFixed(1)} min
                </small>
              </button>
            ))}
            <button className="pacing-link" onClick={() => onAnalytics()}>
              <BarChart3 size={15} />
              Character analytics<span aria-hidden="true">→</span>
            </button>
          </section>
        </>
      )}
      <section className="insight-section notes-section">
        <div className="section-label">
          <h3>Story notes</h3>
          <BookOpen size={14} />
        </div>
        <textarea
          aria-label="Story notes"
          readOnly={readOnly}
          placeholder="A thought to come back to…"
          value={doc.metadata.notes}
          rows={5}
          onChange={(e) =>
            onChange({
              ...doc,
              metadata: { ...doc.metadata, notes: e.target.value },
            })
          }
        />
        <small>Saved with your document</small>
      </section>
    </>
  );
}
