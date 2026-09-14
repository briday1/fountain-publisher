import { test, expect } from "@playwright/test";

for (const width of [390, 820]) {
  test(`cloud accounts open directly from the mobile menu at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.route("**/api/status", (route) =>
      route.fulfill({
        json: {
          csrfToken: "test-csrf",
          github: { configured: true, connected: false },
          google: { configured: true, connected: false },
        },
      }),
    );
    await page.goto("/");
    await expect(
      page.getByRole("textbox", { name: "Screenplay editor" }),
    ).toBeVisible();
    for (const provider of ["GitHub", "Google Drive"]) {
      await expect(
        page.getByRole("complementary", { name: "Scene outline" }),
      ).not.toBeVisible();
      await page.locator(".mobile-file-trigger").click();
      const shortcut = page
        .getByRole("group", { name: "Connected storage" })
        .getByRole("button", { name: provider, exact: true });
      await expect(shortcut).toBeInViewport();
      await shortcut.click();
      await expect(page.locator(".mobile-command-panel")).toHaveCount(0);
      const dialog = page.getByRole("dialog", { name: provider, exact: true });
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByRole("button", { name: "Connect account" }),
      ).toBeEnabled();
      await dialog.getByRole("button", { name: "Close dialog" }).click();
    }
  });
}
