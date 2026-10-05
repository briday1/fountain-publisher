import React from "react";
import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PremiumPreview } from "../src/components/PremiumPreview";
import { PlanComparison } from "../src/components/PlanComparison";
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
it("places all six sample showcases before comparison and describes unavailable purchases", () => {
  const el = document.createElement("div");
  el.innerHTML = renderToStaticMarkup(<PlanComparison onClose={() => {}} />);
  expect(el.querySelectorAll(".showcase-feature")).toHaveLength(6);
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
  expect(el.querySelectorAll(".beat-flow-row")).toHaveLength(3);
  expect(el.textContent).not.toContain("Mobile PDF formatting");
  expect(el.textContent).toContain("Character profiles");
});
