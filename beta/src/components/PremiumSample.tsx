import { BeatBoard } from "./BeatBoard";
import { BeatGuide } from "./BeatGuide";
import { premiumSample, sampleInsights as insights } from "./premiumSampleData";
import "./premium-showcase.css";
export type PremiumFeature = "Insights" | "Beat Sheet" | "Beat Guide";
const noop = () => {};
const colors = ["#76add9", "#c29ad0", "#91b378"];

function SampleInsights() {
  return (
    <div className="sample-insights">
      <div className="metrics">
        <div>
          <strong>{insights.estimatedPages}</strong>
          <span>estimated pages</span>
        </div>
        <div>
          <strong>{insights.sceneCount}</strong>
          <span>scenes</span>
        </div>
        <div>
          <strong>{insights.wordCount}</strong>
          <span>words</span>
        </div>
      </div>
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
        {insights.characters.map((c, i) => (
          <button className="character-row" key={c.name} tabIndex={-1}>
            <div>
              <span
                className="character-dot"
                style={{ background: colors[i] }}
              />
              <strong>{c.name}</strong>
              <span>{c.dialogueWords} words</span>
            </div>
            <div className="character-bar">
              <span style={{ width: `${c.share}%`, background: colors[i] }} />
            </div>
            <small>
              {c.speeches} speeches · {c.sceneCount} scenes ·{" "}
              {c.estimatedMinutes.toFixed(1)} min
            </small>
          </button>
        ))}
        <button className="pacing-link" tabIndex={-1}>
          Character analytics →
        </button>
      </section>
      <section className="insight-section notes-section">
        <div className="section-label">
          <h3>Story notes</h3>
        </div>
        <textarea
          aria-label="Sample story notes"
          readOnly
          value={premiumSample.metadata.notes}
          rows={3}
        />
        <small>Saved with your screenplay</small>
      </section>
    </div>
  );
}

export function SampleScript({
  highlight = false,
  mobile = false,
}: {
  highlight?: boolean;
  mobile?: boolean;
}) {
  return (
    <div className={`sample-script${mobile ? " sample-script-mobile" : ""}`}>
      {premiumSample.blocks.slice(0, 8).map((block) => (
        <p key={block.id} className={`sample-line-${block.kind}`}>
          {highlight && block.kind === "character" && block.text === "MARA" ? (
            <mark>{block.text}</mark>
          ) : (
            block.text
          )}
        </p>
      ))}
    </div>
  );
}

/** Inert real components: their buttons cannot receive clicks, keyboard focus, or AT focus. */
export function PremiumSample({ feature }: { feature: PremiumFeature }) {
  return (
    <div
      className="premium-example"
      inert
      aria-hidden="true"
      data-sample-feature={feature}
    >
      {feature === "Insights" ? (
        <SampleInsights />
      ) : feature === "Beat Sheet" ? (
        <BeatBoard
          doc={premiumSample}
          onChange={noop}
          onAssign={noop}
          onRange={noop}
          onExport={noop}
          onExportCsv={noop}
        />
      ) : (
        <div className="sample-guide">
          <BeatGuide
            doc={premiumSample}
            editor={null}
            onAssign={() => false}
            onRange={noop}
            onEdit={noop}
            onClose={noop}
          />
          <SampleScript />
        </div>
      )}
    </div>
  );
}
