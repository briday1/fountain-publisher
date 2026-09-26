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
        <section className="showcase-feature">
          <small className="showcase-kicker">Writing goals</small>
          <h3>A little progress, made visible.</h3>
          <p>
            Set your own word and writing-time targets by day, week or month.
            New writing still counts when you revise or delete it. Start an
            activity-aware timer when you are ready to write.
          </p>
          <figure>
            <div
              className="writing-goals"
              aria-label="Fictional writing goal illustration"
            >
              <div className="writing-goal">
                <div>
                  <span>500 words / day</span>
                  <small>320 / 500</small>
                </div>
                <progress
                  max={500}
                  value={320}
                  aria-label="Sample daily word goal"
                />
              </div>
              <div className="writing-goal">
                <div>
                  <span>3 hours / week</span>
                  <small>1.5 / 3</small>
                </div>
                <progress
                  max={3}
                  value={1.5}
                  aria-label="Sample weekly writing time goal"
                />
              </div>
            </div>
            <figcaption>Writing goals · Fictional sample progress</figcaption>
          </figure>
        </section>
        <section className="showcase-feature showcase-collaboration">
          <small className="showcase-kicker">
            Live collaboration · Planned
          </small>
          <h3>Two perspectives. One screenplay.</h3>
          <p>
            A shared writing room is planned for WriteShape: see a
            collaborator’s presence and work on the same screenplay together.
            Today, autosave and saved-file sync keep your own WriteShape
            instances up to date; live co-editing is not available yet.
          </p>
          <figure>
            <div
              className="collaboration-concept"
              aria-label="Concept illustration of two fictional collaborators, not a live session"
            >
              <div className="collaboration-presence">
                <span className="collaborator-avatar">M</span>
                <span className="collaborator-avatar second">E</span>
                <span>
                  Mara & Eli <small>Concept · Planned</small>
                </span>
              </div>
              <div className="collaboration-page" inert aria-hidden="true">
                <SampleScript />
                <span className="concept-cursor first">Mara</span>
                <span className="concept-cursor second">Eli</span>
              </div>
            </div>
            <figcaption>
              Live collaboration · Planned concept · Fictional sample, not a
              working session
            </figcaption>
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
            "Writing goals",
            "Live collaboration (planned)",
          ].map((feature, i) => (
            <tr key={feature}>
              <th scope="row">{feature}</th>
              <td>{i < 3 ? "Included" : "—"}</td>
              <td>
                {feature === "Live collaboration (planned)"
                  ? "Planned"
                  : "Included"}
              </td>
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
