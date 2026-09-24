import { PremiumSample } from "./PremiumSample";
import type { PremiumFeature } from "./PremiumSample";
export function PremiumPreview({
  title,
  onUpgrade,
}: {
  title: PremiumFeature;
  onUpgrade: () => void;
}) {
  return (
    <section
      className="premium-preview"
      aria-label={`${title} premium preview`}
    >
      <div className="premium-sample" inert aria-hidden="true">
        <PremiumSample feature={title} />
      </div>
      <div className="premium-offer">
        <h3>{title} is Premium</h3>
        <p>Explore tools to develop your screenplay.</p>
        <button className="primary" onClick={onUpgrade}>
          Explore Premium
        </button>
        <small>Fictional sample content · The Last Light</small>
      </div>
    </section>
  );
}
