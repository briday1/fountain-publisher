import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import {
  WriteShapeAccount,
  type AccountState,
  type BillingSummary,
} from "../src/components/WriteShapeAccount";
const state: AccountState = {
  account: {
    id: "qa",
    email: "qa@example.test",
    displayName: "QA Writer",
    privateTester: true,
    googleLinked: true,
    billingStatus: "none",
    cancelAtPeriodEnd: false,
    premiumUntil: 0,
  },
  premium: true,
  googleAvailable: true,
  billingAvailable: true,
  portalAvailable: true,
  privateMode: true,
};
const empty: BillingSummary = {
  status: "none",
  plan: null,
  periodEnd: 0,
  cancelAtPeriodEnd: false,
  cancelAt: 0,
  invoiceStatus: null,
  hasSubscription: false,
  canChange: false,
  canCancel: false,
  changeReason: "",
};
beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
afterEach(() => vi.unstubAllGlobals());
async function mount(
  summary = empty,
  beforeNavigate = vi.fn(async () => {}),
  initialPlan: "monthly" | "yearly" = "yearly",
) {
  const requests: { path: string; body: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string, init: RequestInit) => {
      requests.push({
        path,
        body: init.body ? JSON.parse(String(init.body)) : undefined,
      });
      return new Response(
        JSON.stringify(
          path.endsWith("status")
            ? summary
            : { error: "Synthetic redirect stopped" },
        ),
        {
          status: path.endsWith("status") ? 200 : 409,
          headers: { "Content-Type": "application/json" },
        },
      );
    }),
  );
  const node = document.createElement("div");
  document.body.append(node);
  const root = createRoot(node);
  await act(async () =>
    root.render(
      <WriteShapeAccount
        state={state}
        error=""
        refresh={async () => {}}
        beforeNavigate={beforeNavigate}
        onClose={() => {}}
        initialPlan={initialPlan}
      />,
    ),
  );
  const click = async (label: string) => {
    const b = [...node.querySelectorAll("button")].find(
      (b) => b.textContent === label,
    );
    expect(b).toBeDefined();
    await act(async () => b!.click());
  };
  return {
    node,
    requests,
    click,
    close: async () => {
      await act(async () => root.unmount());
      node.remove();
    },
  };
}
it("carries yearly intent to checkout without confusing private-tester access with a paid subscription", async () => {
  const saved = vi.fn(async () => {});
  const h = await mount(empty, saved);
  try {
    expect(
      h.node.querySelector<HTMLInputElement>('input[value="yearly"]')!.checked,
    ).toBe(true);
    expect(h.node.textContent).toContain("Premium is included for you");
    expect(h.node.textContent).toContain("No subscription");
    await h.click("Continue to yearly test checkout");
    expect(saved).toHaveBeenCalledOnce();
    expect(h.requests.at(-1)).toEqual({
      path: "/api/billing/checkout",
      body: { plan: "yearly" },
    });
    expect(h.node.textContent).toContain("Synthetic redirect stopped");
  } finally {
    await h.close();
  }
});
it("shows actual monthly subscription despite yearly prospective intent, with no duplicate checkout", async () => {
  const h = await mount({
    ...empty,
    hasSubscription: true,
    status: "active",
    plan: "monthly",
    periodEnd: 2000000000,
    invoiceStatus: "paid",
    canChange: true,
    canCancel: true,
  });
  try {
    expect(h.node.textContent).toContain("Monthly · $5.99 USD / month");
    expect(h.node.querySelector('input[type="radio"]')).toBeNull();
    expect(h.node.textContent).not.toContain(
      "Continue to yearly test checkout",
    );
    await h.click("Change plan");
    expect(h.requests.at(-1)).toEqual({
      path: "/api/billing/portal",
      body: { intent: "change" },
    });
    await h.click("Cancel Premium");
    expect(h.node.textContent).toContain("Care to tell us why you’re leaving?");
    await h.click("Confirm Cancellation");
    expect(h.requests.at(-1)).toMatchObject({
      path: "/api/billing/cancel",
      body: { reason: "", requestId: expect.any(String) },
    });
  } finally {
    await h.close();
  }
});
it.each(["Continue to yearly test checkout", "Sign out"])(
  "a failed draft flush blocks %s and preserves the error",
  async (action) => {
    const h = await mount(
      empty,
      vi.fn(async () => {
        throw Error("Draft could not save");
      }),
    );
    try {
      await h.click(action);
      expect(
        h.requests.some(
          (r) => r.path.endsWith("checkout") || r.path.endsWith("logout"),
        ),
      ).toBe(false);
      expect(h.node.textContent).toContain("Draft could not save");
    } finally {
      await h.close();
    }
  },
);
it("pending cancellation exposes its date and never offers a second checkout or cancellation", async () => {
  const h = await mount({
    ...empty,
    hasSubscription: true,
    status: "active",
    plan: "yearly",
    cancelAtPeriodEnd: true,
    cancelAt: 2000000000,
    canChange: false,
    changeReason: "Cancellation is scheduled.",
  });
  try {
    expect(h.node.textContent).toContain("Subscription ends");
    expect(h.node.textContent).toContain("cancellation scheduled");
    expect(
      [...h.node.querySelectorAll("button")].some(
        (b) => b.textContent === "Cancel subscription",
      ),
    ).toBe(false);
    expect(h.node.textContent).not.toContain(
      "Continue to yearly test checkout",
    );
  } finally {
    await h.close();
  }
});
