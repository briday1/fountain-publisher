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
          ? ".beat-sheet-paper"
          : ".writing-beat-guide";
    expect(el.querySelector(selector)).not.toBeNull();
  });
}
it("places all five sample showcases before comparison and describes unavailable purchases", () => {
  const el = document.createElement("div");
  el.innerHTML = renderToStaticMarkup(<PlanComparison onClose={() => {}} />);
  expect(el.querySelectorAll(".showcase-feature")).toHaveLength(5);
  expect(
    el
      .querySelector(".premium-showcase")!
      .compareDocumentPosition(el.querySelector("table")!) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(el.textContent).toContain("fictional sample content");
  expect(el.textContent).toContain("not available yet");
  expect(el.querySelector("mark")?.textContent).toBe("MARA");
});
