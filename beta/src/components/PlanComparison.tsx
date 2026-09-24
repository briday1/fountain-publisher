import { Modal } from "./Modal";
import { PremiumSample, SampleScript } from "./PremiumSample";
import type { PremiumFeature } from "./PremiumSample";
const features: { title: PremiumFeature; benefit: string; caption: string }[] =
  [
    {
      title: "Insights",
      benefit: "See who carries the conversation.",
      caption:
        "Compare dialogue with action and see each character’s share, speeches, and scene appearances. In this sample, Mara leads the conversation; Eli and June bring different voices to the story.",
    },
    {
      title: "Beat Sheet",
      benefit: "Give the story a shape you can revise.",
      caption:
        "Organize a premise into beats, group them by act, and link each beat to the passage where it happens. The Last Light moves from a failed beacon to a choice to trust, then a shared rescue.",
    },
    {
      title: "Beat Guide",
      benefit: "Keep the next beat beside your writing.",
      caption:
        "A compact prompt keeps your next story moment in view. Select a passage, assign it to a beat, and advance. Here, the next beat asks Mara to trust Eli’s solution.",
    },
  ];
export function PlanComparison({
  onClose,
  onAccount,
}: {
  onClose: () => void;
  onAccount?: () => void;
}) {
  return (
    <Modal
      title="Explore WriteShape Premium"
      onClose={onClose}
      wide
      className="writeshape-plans"
    >
      <p className="showcase-intro">
        Write freely. See your story from a new angle.
      </p>
      <p>
        Writing, local saves, and standard PDF exports stay free without an
        account. Explore the tools planned for Premium below.
      </p>
      <p className="sample-label">
        All illustrations use fictional sample content: The Last Light. Your
        screenplay is never used in these previews.
      </p>
      <div className="premium-showcase">
        {features.map((feature) => (
          <section className="showcase-feature" key={feature.title}>
            <small className="showcase-kicker">{feature.title}</small>
            <h3>{feature.benefit}</h3>
            <p>{feature.caption}</p>
            <figure>
              <PremiumSample feature={feature.title} />
              <figcaption>
                {feature.title} · Sample content · Static illustration
              </figcaption>
            </figure>
          </section>
        ))}
        <section className="showcase-feature">
          <small className="showcase-kicker">Mobile PDF</small>
          <h3>A screenplay that travels with you.</h3>
          <p>
            Export a layout formatted for a phone, with text arranged for a
            smaller page. Read a scene on the go while keeping the familiar
            screenplay structure.
          </p>
          <figure className="sample-phone">
            <div inert aria-hidden="true">
              <SampleScript mobile />
            </div>
            <figcaption>Mobile PDF · Sample layout illustration</figcaption>
          </figure>
        </section>
        <section className="showcase-feature">
          <small className="showcase-kicker">Character highlighting</small>
          <h3>Find your character at a glance.</h3>
          <p>
            Choose characters to highlight their names throughout the exported
            PDF. Follow Mara’s cues in this sample, useful for a table read or a
            focused character pass.
          </p>
          <figure>
            <div inert aria-hidden="true">
              <SampleScript highlight />
            </div>
            <figcaption>Mara highlighted · Sample PDF illustration</figcaption>
          </figure>
        </section>
      </div>
      <h3>Compare the plans</h3>
      <table className="plan-comparison">
        <thead>
          <tr>
            <th scope="col">Feature</th>
            <th scope="col">Free</th>
            <th scope="col">Premium (planned)</th>
          </tr>
        </thead>
        <tbody>
          {[
            "Writing without signing in",
            "Local saves",
            "Standard PDF export",
            "Mobile PDF formatting",
            "Character highlighting",
            "Insights",
            "Beat Sheet",
            "Beat Guide",
            "Cloud library",
          ].map((feature, i) => (
            <tr key={feature}>
              <th scope="row">{feature}</th>
              <td>{i < 3 ? "Included" : "—"}</td>
              <td>Included</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Premium purchases are not available yet. Pricing will be announced
        before purchase. Your local writing remains available.
      </p>
      {onAccount && (
        <button onClick={onAccount}>Account and subscription status</button>
      )}
      <button onClick={onClose}>Keep writing</button>
    </Modal>
  );
}
