import { SampleBeatSheet, SampleCharacterGantt } from "./PremiumStoryExamples";
import { BeatGuide } from "./BeatGuide";
import { premiumSample, sampleInsights as insights } from "./premiumSampleData";
import "./premium-showcase.css";
import { EditorSurface } from "./EditorSurface";
import type { Screenplay } from "../core/model";
import { InsightsContent } from "./InsightsContent";
export type PremiumFeature = "Insights" | "Beat Sheet" | "Beat Guide";
const noop = () => {};
function SampleInsights() {
  return (
    <div className="sample-insights insights-panel">
      <div className="panel-heading">
        <div>
          <small>DOCUMENT</small>
          <h2>Insights</h2>
        </div>
      </div>
      <InsightsContent
        doc={premiumSample}
        insights={insights}
        documentId="premium-example"
        pages={insights.estimatedPages}
        onChange={noop}
        onCharacter={noop}
        onAnalytics={noop}
        readOnly
      />
    </div>
  );
}

export function SampleScript({
  highlight = false,
  mobile = false,
  doc = premiumSample,
}: {
  highlight?: boolean;
  mobile?: boolean;
  doc?: Screenplay;
}) {
  if (highlight || mobile)
    return <SamplePdf highlight={highlight} mobile={mobile} />;
  return (
    <div
      className={`sample-document${doc.metadata.format === "markdown" ? " novel-mode" : ""}`}
    >
      <article className="screenplay-paper">
        <EditorSurface
          key={`${doc.metadata.format || "fountain"}-${doc.blocks[0]?.id}`}
          initial={{ ...doc, blocks: doc.blocks.slice(0, 8) }}
          onReady={(editor) => editor?.setDestinationReadOnly(true)}
          onChange={noop}
          onSelection={noop}
        />
      </article>
    </div>
  );
}
function SamplePdf({
  highlight,
  mobile,
}: {
  highlight: boolean;
  mobile: boolean;
}) {
  return (
    <div className={`sample-pdf${mobile ? " sample-pdf-mobile" : ""}`}>
      <img
        src={`${import.meta.env.BASE_URL}examples/screenplay-${mobile ? "mobile" : "highlighted"}.png`}
        alt={
          mobile
            ? "First page of the actual mobile PDF export"
            : highlight
              ? "First page of the actual PDF export with Mara's character cues highlighted"
              : "First page of the actual PDF export"
        }
        loading="lazy"
      />
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
        <>
          <SampleInsights />
          <SampleCharacterGantt />
        </>
      ) : feature === "Beat Sheet" ? (
        <SampleBeatSheet />
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
