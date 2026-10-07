import { CollaborationExample } from "./CollaborationExample";
import { FocusPremiumExample } from "./FocusPremiumExample";
import { BookPremiumExamples } from "./BookPremiumExamples";
import { WritingGoals } from "./WritingGoals";
import { localDay } from "../core/writingGoals";
import { useState } from "react";
import { BillingPlanChoice, type BillingPlan } from "./BillingPlanChoice";
import { Modal } from "./Modal";
import { PremiumSample, SampleScript } from "./PremiumSample";
import type { PremiumFeature } from "./PremiumSample";
import { SampleOutline } from "./PremiumStoryExamples";
import { Cloud, FileText, Laptop, Smartphone, Tablet } from "lucide-react";
const features: { title: PremiumFeature; benefit: string; caption: string }[] =
  [
    {
      title: "Insights",
      benefit: "Dialogue and character statistics",
      caption:
        "Compare dialogue and action. The scene Gantt chart shows where each character speaks and how much dialogue they have within a scene.",
    },
    {
      title: "Beat Sheet",
      benefit: "Develop the moments within each act",
      caption:
        "Link beats to their passages. This example shows one scene with four beats, followed by the matching pacing graph.",
    },
  ];
export function PlanComparison({
  onClose,
  onAccount,
  collaborationAvailable = false,
  billingMode = "test",
  privateMode = true,
  initialMode = "screenplay",
}: {
  onClose: () => void;
  onAccount?: (plan?: BillingPlan) => void;
  collaborationAvailable?: boolean;
  billingMode?: "test" | "live";
  privateMode?: boolean;
  initialMode?: "screenplay" | "book";
}) {
  const [mode, setMode] = useState(initialMode);
  const [plan, setPlan] = useState<BillingPlan>("monthly");
  return (
    <Modal
      title="WriteShape Premium"
      onClose={onClose}
      wide
      className="writeshape-plans"
    >
      <p className="showcase-intro">Books and screenplays. One Premium plan.</p>
      <p>
        Writing, local saves, standard exports, Outline, multiple tabs, and
        split panes are included in Basic. Premium adds scene and chapter Focus
        mode, cloud saving, and planning tools for both books and screenplays.
      </p>
      <p>
        Both formats are included. Choose an example below, then take a closer
        look at individual features.
      </p>
      <div
        className="premium-mode-tabs"
        role="tablist"
        aria-label="Explore examples by writing format"
      >
        {(["screenplay", "book"] as const).map((item, index) => (
          <button
            key={item}
            role="tab"
            id={`premium-${item}-tab`}
            aria-selected={mode === item}
            aria-controls="premium-mode-panel"
            tabIndex={mode === item ? 0 : -1}
            onClick={() => setMode(item)}
            onKeyDown={(event) => {
              if (
                ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              ) {
                event.preventDefault();
                const next =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? 1
                      : 1 - index;
                setMode(next === 0 ? "screenplay" : "book");
                (
                  event.currentTarget.parentElement?.children[
                    next
                  ] as HTMLElement
                )?.focus();
              }
            }}
          >
            {item === "book" ? "Book" : "Screenplay"}
          </button>
        ))}
      </div>
      <label className="premium-feature-picker">
        Take a closer look
        <select
          value=""
          aria-label="Explore a feature"
          onChange={(event) => {
            if (!event.target.value) return;
            document
              .getElementById("premium-mode-panel")
              ?.querySelectorAll<HTMLElement>(".showcase-feature")
              [Number(event.target.value) - 1]?.scrollIntoView({
                block: "start",
                behavior: "smooth",
              });
          }}
        >
          <option value="">Choose a feature…</option>
          {(mode === "book"
            ? [
                "Focus mode",
                "Book outline & title page · Basic",
                "Character profiles",
                "Beat Sheet",
                "Writing goals",
                "Cloud storage · All your devices",
                "Live collaboration",
              ]
            : [
                "Focus mode",
                "Scene outline · Basic",
                "Insights",
                "Beat Sheet",
                "Character highlighting",
                "Mobile PDF",
                "Writing goals",
                "Cloud storage · All your devices",
                "Live collaboration",
              ]
          ).map((label, index) => (
            <option key={label} value={index + 1}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <div
        id="premium-mode-panel"
        role="tabpanel"
        aria-labelledby={`premium-${mode}-tab`}
        className="premium-showcase"
      >
        <FocusPremiumExample mode={mode} />
        {mode === "book" ? (
          <BookPremiumExamples />
        ) : (
          <>
            <section className="showcase-feature">
              <small className="showcase-kicker">Outline · Basic</small>
              <h3>Find your way through the scenes</h3>
              <p>
                Your scene headings form the Outline as you write. Jump to a
                scene or the title page, add scenes, and bookmark places to
                revisit.
              </p>
              <figure>
                <SampleOutline />
                <figcaption>Scene outline</figcaption>
              </figure>
            </section>
            {features.map((feature) => (
              <section className="showcase-feature" key={feature.title}>
                <small className="showcase-kicker">{feature.title}</small>
                <h3>{feature.benefit}</h3>
                <p>{feature.caption}</p>
                <figure>
                  <PremiumSample feature={feature.title} />
                  <figcaption>{feature.title} example</figcaption>
                </figure>
              </section>
            ))}
            <section className="showcase-feature">
              <small className="showcase-kicker">Character highlighting</small>
              <h3>Highlight character cues</h3>
              <p>
                Choose characters and colors for the exported PDF. Their cues
                are highlighted throughout the script, making parts easier to
                find during a read-through.
              </p>
              <figure>
                <div inert aria-hidden="true">
                  <SampleScript highlight />
                </div>
                <figcaption>Mara's cues highlighted</figcaption>
              </figure>
            </section>
            <section className="showcase-feature">
              <small className="showcase-kicker">Mobile PDF</small>
              <h3>PDFs for phone screens</h3>
              <p>
                Export a screenplay PDF with narrower pages for reading on a
                phone. Each mobile page contains the same text as its
                corresponding standard PDF page.
              </p>
              <figure className="sample-phone">
                <div inert aria-hidden="true">
                  <SampleScript mobile />
                </div>
                <figcaption>Mobile PDF example</figcaption>
              </figure>
            </section>
          </>
        )}
        <section className="showcase-feature">
          <small className="showcase-kicker">Writing goals</small>
          <h3>Word and time targets</h3>
          <p>
            Set daily, weekly, or monthly targets for words and writing time.
            Words you add still count if you later delete them. The timer pauses
            when you stop writing. Goals and progress stay on this device.
          </p>
          <figure>
            <div
              className="premium-example sample-insights insights-panel"
              inert
              aria-hidden="true"
            >
              <WritingGoals
                premium
                onUpgrade={() => {}}
                state={{
                  goals: [
                    {
                      id: "sample-words",
                      metric: "words",
                      target: 500,
                      period: "day",
                    },
                    {
                      id: "sample-time",
                      metric: "hours",
                      target: 3,
                      period: "week",
                    },
                  ],
                  days: [
                    {
                      day: localDay(new Date()),
                      words: 320,
                      milliseconds: 5400000,
                    },
                  ],
                  running: false,
                  error: "",
                  save: () => {},
                  toggleTimer: () => {},
                  onActivity: () => {},
                }}
              />
            </div>
            <figcaption>Example word and time goals</figcaption>
          </figure>
        </section>
        <section className="showcase-feature showcase-cloud">
          <small className="showcase-kicker">Cloud storage · Premium</small>
          <h3>Pick up your draft on any device</h3>
          <p>
            Save your books and screenplays to My Storage in WriteShape. Sign in
            with the same account on your phone, tablet, or computer to open
            your saved draft and keep writing. Changes become available on your
            other devices after they are saved to the cloud.
          </p>
          <p>
            Premium includes 1 GB for your cloud files and version history. Keep
            your current draft plus the newest 50 previous versions per
            document. Older versions expire as you save; download a copy of
            anything you want to keep longer. Local files do not use this
            allowance.
          </p>
          <figure>
            <div className="sample-cloud" inert aria-hidden="true">
              <div className="sample-cloud-library">
                <h4>
                  <Cloud size={18} /> My Storage
                </h4>
                <div>
                  <FileText size={20} />
                  <span>
                    The Last Light
                    <small>
                      {mode === "book" ? "Book" : "Screenplay"} · Saved to
                      WriteShape
                    </small>
                  </span>
                </div>
              </div>
              <div className="sample-cloud-devices">
                {[
                  [Smartphone, "Phone"],
                  [Tablet, "Tablet"],
                  [Laptop, "Computer"],
                ].map(([Icon, label]) => {
                  const Device = Icon as typeof Smartphone;
                  return (
                    <div key={String(label)}>
                      <Device size={28} />
                      <span>{String(label)}</span>
                      <small>Same saved draft</small>
                    </div>
                  );
                })}
              </div>
            </div>
            <figcaption>
              One cloud library, available across your devices
            </figcaption>
          </figure>
        </section>
        <section className="showcase-feature showcase-collaboration">
          <small className="showcase-kicker">
            Live collaboration ·{" "}
            {collaborationAvailable ? "Available" : "Not enabled"}
          </small>
          <h3>Write together</h3>
          <p>
            {collaborationAvailable
              ? "Save a screenplay or book to WriteShape or Google Drive, then choose Start live editing. People with access can edit together and see each other's cursors. Everyone needs access to both the document and WriteShape. Live editing is available for cloud and Drive files."
              : "Live collaboration is not enabled for this deployment. Your own devices receive saved changes after they reach cloud storage."}
          </p>
          <figure>
            <CollaborationExample mode={mode} />
            <figcaption>Shared editing with text-anchored cursors</figcaption>
          </figure>
        </section>
      </div>
      <h3>Compare the plans</h3>
      <p>
        Both plans support books and screenplays. This table shows the{" "}
        {mode === "book" ? "book" : "screenplay"} features; Premium includes
        both.
      </p>
      <table className="plan-comparison">
        <thead>
          <tr>
            <th scope="col">Feature</th>
            <th scope="col">Basic (Free)</th>
            <th scope="col">Premium</th>
          </tr>
        </thead>
        <tbody>
          {(mode === "book"
            ? [
                "Local saves",
                "PDF, Word, EPUB and RTF exports",
                "Book outline & title page",
                "Multiple tabs",
                "Split panes",
                "Zen mode",
                "Character profiles",
                "Beat Sheet",
                "Beat Guide",
                "Focus mode",
                "Cloud library",
                "Writing goals",
                "Live collaboration",
              ]
            : [
                "Local saves",
                "Standard PDF export",
                "Scene outline & title page",
                "Multiple tabs",
                "Split panes",
                "Zen mode",
                "Character highlighting",
                "Mobile PDF formatting",
                "Insights",
                "Beat Sheet",
                "Beat Guide",
                "Focus mode",
                "Cloud library",
                "Writing goals",
                "Live collaboration",
              ]
          ).map((feature, i) => (
            <tr key={feature}>
              <th scope="row">{feature}</th>
              <td>{i < 6 ? "Included" : "—"}</td>
              <td>
                {feature === "Live collaboration"
                  ? collaborationAvailable
                    ? "Included"
                    : "Not enabled"
                  : "Included"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        When Premium access ends, you have 30 days to back up your cloud files
        and version history. They remain read-only and downloadable during that
        window, then are automatically deleted. The deadline is 11:59:59 p.m.
        Eastern Time on the final day. Your local files and Google Drive files
        are preserved.{" "}
        <a href="/backup.html" target="_blank" rel="noopener noreferrer">
          Backup instructions
        </a>
        .
      </p>
      {billingMode !== "live" && (
        <p>
          Payments are being tested. You will not be charged.
          {privateMode
            ? " Premium is included for approved private testers."
            : ""}
        </p>
      )}
      {onAccount && (
        <section
          className="showcase-billing"
          aria-label="Premium billing options"
        >
          <BillingPlanChoice value={plan} onChange={setPlan} />
          <button className="primary" onClick={() => onAccount(plan)}>
            Review {plan} plan in Account
          </button>
          <button onClick={() => onAccount()}>
            Manage existing subscription
          </button>
        </section>
      )}
      <button onClick={onClose}>Keep writing</button>
    </Modal>
  );
}
