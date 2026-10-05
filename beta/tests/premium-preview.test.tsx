import React from "react";
import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PremiumPreview } from "../src/components/PremiumPreview";
import { PlanComparison } from "../src/components/PlanComparison";
import { premiumSample } from "../src/components/premiumSampleData";
import { sampleBook } from "../src/components/BookPremiumExamples";
import { resolveBeatRange } from "../src/core/beatRanges";
it("links every sample beat to a distinct passage in both formats", () => {
  for (const doc of [premiumSample, sampleBook]) {
    const ranges = doc.metadata.beats.map((beat) =>
      resolveBeatRange(doc, beat.range!),
    );
    expect(ranges.every(Boolean)).toBe(true);
    expect(new Set(ranges.map((range) => range!.words)).size).toBe(9);
  }
});
for (const title of ["Insights", "Beat Sheet", "Beat Guide"] as const) {
  it(`${title} renders a distinct inert sample below its upgrade overlay`, () => {
    const el = document.createElement("div");
    el.innerHTML = renderToStaticMarkup(
      <PremiumPreview title={title} onUpgrade={() => {}} />,
    );
    expect(
      el.querySelector(".premium-sample[inert][aria-hidden='true']"),
    ).not.toBeNull();
    expect(
      el.querySelector(`[data-sample-feature="${title}"][inert]`),
    ).not.toBeNull();
    expect(el.querySelector(".premium-offer button")?.textContent).toBe(
      "Explore Premium",
    );
    const selector =
      title === "Insights"
        ? ".balance-bar"
        : title === "Beat Sheet"
          ? ".beat-board .beat-flow-list"
          : ".writing-beat-guide";
    expect(el.querySelector(selector)).not.toBeNull();
  });
}
it("places separate outline and planning showcases before comparison and describes unavailable purchases", () => {
  const el = document.createElement("div");
  el.innerHTML = renderToStaticMarkup(<PlanComparison onClose={() => {}} />);
  expect(el.querySelectorAll(".showcase-feature")).toHaveLength(8);
  expect(
    el.querySelector(".sample-beat-sheet .sample-story-outline"),
  ).toBeNull();
  expect(
    el.querySelector('[data-sample-feature="Outline"] .scene-list'),
  ).not.toBeNull();
  for (const act of el.querySelectorAll(".sample-beat-sheet .beat-act"))
    expect(act.querySelectorAll(".beat-flow-row")).toHaveLength(3);
  expect(
    el
      .querySelector(".premium-showcase")!
      .compareDocumentPosition(el.querySelector("table")!) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(el.textContent).toContain("fictional sample content");
  expect(el.textContent).toContain("Not enabled");
  expect(el.textContent).toContain(
    "Live collaboration is not enabled for this deployment",
  );
  expect(el.querySelector(".collaboration-concept")).not.toBeNull();
  expect(
    el.querySelector('.focus-diagram[role="img"]')?.getAttribute("aria-label"),
  ).toContain("scene is isolated from Act II");
  expect(el.querySelector("mark")?.textContent).toBe("MARA");
});

it("describes live writing only when the deployment enables it", () => {
  const html = renderToStaticMarkup(
    <PlanComparison collaborationAvailable onClose={() => {}} />,
  );
  expect(html).toContain("Live collaboration");
  expect(html).toContain("Start live editing");
  expect(html).not.toContain("Not enabled");
});

it("shows a dedicated Book tab with real book components and relevant features", () => {
  const el = document.createElement("div");
  el.innerHTML = renderToStaticMarkup(
    <PlanComparison initialMode="book" onClose={() => {}} />,
  );
  expect(
    el.querySelector('[role="tab"][aria-selected="true"]')?.textContent,
  ).toBe("Book");
  expect(el.querySelector(".book-front-matter h1")?.textContent).toBe(
    "The Last Light",
  );
  expect(el.querySelectorAll(".novel-outline li")).toHaveLength(4);
  expect(el.querySelectorAll(".beat-flow-row")).toHaveLength(9);
  expect(el.textContent).not.toContain("Mobile PDF formatting");
  expect(el.textContent).toContain("Character profiles");
  expect(
    el.querySelector('.focus-diagram[role="img"]')?.getAttribute("aria-label"),
  ).toContain("Chapter 2 is isolated from Book 1");
});
