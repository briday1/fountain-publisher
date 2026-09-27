import { test, expect } from "@playwright/test";

// Exercise the WriteShape workspace through the existing Vite browser server.
// Product selection and account HTTP are fixtures; editors/persistence and drag events are real.
test.beforeEach(async ({ page }) => {
  await page.route("**/src/product.ts*", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: "export const isWriteShape = true;",
    }),
  );
  await page.route("**/api/**", (route) =>
    route.fulfill({ status: 503, json: { error: "Offline test account" } }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Split editor right", exact: true }),
  ).toBeVisible();
});

test("native editor tab drag reorders, splits at the edge and collapses an empty group", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Split editor right", exact: true })
    .click();
  await expect(page.getByRole("tab")).toHaveCount(2);
  const firstId = await page.getByRole("tab").first().getAttribute("id");
  await page
    .locator('.pane-0 [role="tab"]')
    .dragTo(page.locator(".pane-1 .writing-scroll"));
  await expect(page.locator(".document-pane")).toHaveCount(1);
  await expect(page.getByRole("tab").last()).toHaveAttribute("id", firstId!);
  await page
    .getByRole("tab")
    .last()
    .dragTo(page.getByRole("tab").first(), { targetPosition: { x: 3, y: 12 } });
  await expect(page.getByRole("tab").first()).toHaveAttribute("id", firstId!);
  const surface = page.locator(".writing-scroll");
  const bounds = (await surface.boundingBox())!;
  await page
    .getByRole("tab")
    .first()
    .dragTo(surface, { targetPosition: { x: bounds.width - 15, y: 80 } });
  await expect(page.locator(".document-pane")).toHaveCount(2);
  await expect(page.locator('.pane-1 [role="tab"]')).toHaveAttribute(
    "id",
    firstId!,
  );
  await page
    .getByRole("separator", { name: "Resize document panes" })
    .press("End");
  await page
    .getByRole("textbox", { name: "Screenplay editor" })
    .last()
    .fill("Retained split draft.");
  await expect(
    page.getByRole("textbox", { name: "Screenplay editor" }).first(),
  ).toContainText("Retained split draft.");
  await expect(page.getByRole("contentinfo")).toContainText(
    "Saved on this device",
  );
  await page.reload();
  // Restored views intentionally get new DOM IDs; assert the saved user state.
  await expect(page.locator(".document-pane")).toHaveCount(2);
  await expect(page.locator('.pane-1 [role="tab"]')).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.locator(".pane-1")).toHaveClass(/active/);
  await expect(
    page.getByRole("separator", { name: "Resize document panes" }),
  ).toHaveAttribute("aria-valuenow", "75");
  for (const editor of await page
    .getByRole("textbox", { name: "Screenplay editor" })
    .all())
    await expect(editor).toContainText("Retained split draft.");
});

test("context menu, keyboard resizing and mobile transitions retain the workspace", async ({
  page,
}) => {
  await page.getByRole("tab").click({ button: "right" });
  await expect(
    page.getByRole("button", { name: "Split right", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Split right", exact: true }).click();
  const divider = page.getByRole("separator", {
    name: "Resize document panes",
  });
  await divider.press("End");
  await expect(divider).toHaveAttribute("aria-valuenow", "75");
  await divider.press("Enter");
  await expect(divider).toHaveAttribute("aria-valuenow", "50");
  const ids = await page
    .getByRole("tab")
    .evaluateAll((tabs) => tabs.map((t) => t.id));
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("tab")).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "Screenplay editor" }),
  ).toHaveCount(1);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.getByRole("tab")).toHaveCount(2);
  expect(
    await page.getByRole("tab").evaluateAll((tabs) => tabs.map((t) => t.id)),
  ).toEqual(ids);
  await page
    .getByRole("button", { name: "Close left pane", exact: true })
    .click();
  await expect(page.locator(".document-pane")).toHaveCount(1);
  await expect(page.getByRole("tab")).toHaveAttribute("id", ids[1]);
});
