import { expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import {
  WriteShapeAccount,
  emptyAccount,
} from "../src/components/WriteShapeAccount";
it("unconfigured signup and checkout remain disabled with approved sandbox pricing", () => {
  const node = document.createElement("div");
  node.innerHTML = renderToStaticMarkup(
    <WriteShapeAccount
      state={emptyAccount}
      error=""
      refresh={async () => {}}
      beforeNavigate={async () => {}}
      onClose={() => {}}
    />,
  );
  for (const label of [
    "Continue with Google",
    "Try Premium checkout (test)",
    "Manage subscription",
  ])
    expect(
      [...node.querySelectorAll("button")].find((b) => b.textContent === label)
        ?.disabled,
    ).toBe(true);
  expect(node.textContent).toContain("Sandbox checkout is not connected yet");
  expect(node.textContent).toContain("USD $8/month");
  expect(node.textContent).toContain("USD $80/year");
  expect(node.querySelector("fieldset")?.disabled).toBe(true);
  expect(node.textContent).toContain("current draft stays on this device");
});
it("server account state enables only configured actions and exposes cancellation recovery", () => {
  const node = document.createElement("div");
  node.innerHTML = renderToStaticMarkup(
    <WriteShapeAccount
      state={{
        ...emptyAccount,
        googleAvailable: true,
        billingAvailable: true,
        portalAvailable: true,
        account: {
          id: "account",
          email: "writer@example.test",
          displayName: "Writer",
          privateTester: false,
          googleLinked: true,
          billingStatus: "canceled",
          cancelAtPeriodEnd: false,
          premiumUntil: 0,
        },
      }}
      error=""
      refresh={async () => {}}
      beforeNavigate={async () => {}}
      onClose={() => {}}
    />,
  );
  expect(node.textContent).toContain("Billing status: canceled");
  expect(node.textContent).toContain("open existing cloud files");
  expect(
    [...node.querySelectorAll("button")].find(
      (b) => b.textContent === "Manage subscription",
    )?.disabled,
  ).toBe(false);
  expect(node.textContent).toContain("test billing only");
});

it("private tester can use configured test Checkout while retaining included Premium", () => {
  const node = document.createElement("div");
  node.innerHTML = renderToStaticMarkup(
    <WriteShapeAccount
      state={{
        ...emptyAccount,
        premium: true,
        billingAvailable: true,
        account: {
          id: "owner",
          email: "owner@example.test",
          displayName: "",
          privateTester: true,
          googleLinked: false,
          billingStatus: "none",
          cancelAtPeriodEnd: false,
          premiumUntil: 0,
        },
      }}
      error=""
      refresh={async () => {}}
      beforeNavigate={async () => {}}
      onClose={() => {}}
    />,
  );
  expect(
    [...node.querySelectorAll("button")].find(
      (b) => b.textContent === "Try Premium checkout (test)",
    )?.disabled,
  ).toBe(false);
});

it("yearly choice sends only the plan after safeguarding the draft, without trusting client price IDs", async () => {
  const node = document.createElement("div");
  document.body.appendChild(node);
  const root = createRoot(node);
  const originalShowModal = HTMLDialogElement.prototype.showModal;
  const originalClose = HTMLDialogElement.prototype.close;
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  const sequence: string[] = [];
  const fetchFixture = vi.fn(async () => {
    sequence.push("request");
    return new Response(
      JSON.stringify({ url: "https://unexpected.example.test" }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  });
  vi.stubGlobal("fetch", fetchFixture);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  try {
    await act(async () =>
      root.render(
        <WriteShapeAccount
          state={{
            ...emptyAccount,
            billingAvailable: true,
            account: {
              id: "owner",
              email: "owner@example.test",
              displayName: "",
              privateTester: true,
              googleLinked: false,
              billingStatus: "none",
              cancelAtPeriodEnd: false,
              premiumUntil: 0,
            },
          }}
          error=""
          refresh={async () => {}}
          beforeNavigate={async () => {
            sequence.push("draft");
          }}
          onClose={() => {}}
        />,
      ),
    );
    await act(async () =>
      (node.querySelector('input[value="yearly"]') as HTMLInputElement).click(),
    );
    await act(async () =>
      [...node.querySelectorAll("button")]
        .find((b) => b.textContent === "Try Premium checkout (test)")!
        .click(),
    );
    expect(sequence).toEqual(["draft", "request"]);
    expect(fetchFixture).toHaveBeenCalledWith(
      "/api/billing/checkout",
      expect.objectContaining({
        body: JSON.stringify({ plan: "yearly" }),
        credentials: "same-origin",
      }),
    );
    expect(node.textContent).toContain("unexpected destination");
  } finally {
    await act(async () => root.unmount());
    node.remove();
    HTMLDialogElement.prototype.showModal = originalShowModal;
    HTMLDialogElement.prototype.close = originalClose;
    vi.unstubAllGlobals();
  }
});
