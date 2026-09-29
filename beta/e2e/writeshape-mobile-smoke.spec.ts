import { expect, test } from "@playwright/test";

test.skip(
  process.env.WRITESHAPE_BUILD_SMOKE !== "1",
  "Runs against the isolated WriteShape production build",
);

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 26_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1",
});

test("private build keeps mobile editor text at 16px on focus", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/WriteShape/);
  const editor = page.getByRole("textbox", { name: "Screenplay editor" });
  await expect(editor).toBeVisible();
  await expect(editor).toHaveCSS("font-size", "16px");
  await editor.click();
  await expect(editor).toBeFocused();
  await expect(editor).toHaveCSS("font-size", "16px");
  await page.screenshot({ path: "test-results/writeshape-mobile.png" });
});

for (const signedIn of [false, true]) {
  test(`mobile menu keeps ${signedIn ? "Account" : "Sign in"} directly accessible and preserves the draft`, async ({
    page,
  }) => {
    const label = signedIn ? "Account" : "Sign in";
    await page.route("**/api/account", (route) =>
      route.fulfill({
        json: {
          account: signedIn
            ? {
                id: "menu-test",
                email: "writer@example.test",
                displayName: "Writer",
                privateTester: true,
                googleLinked: true,
                billingStatus: "none",
                cancelAtPeriodEnd: false,
                premiumUntil: 0,
              }
            : null,
          premium: signedIn,
          privateMode: true,
          googleAvailable: true,
          billingAvailable: false,
          portalAvailable: false,
        },
      }),
    );
    await page.goto("/");
    const editor = page.getByRole("textbox", { name: "Screenplay editor" });
    await expect(editor).toBeVisible();
    await editor.fill("Keep this draft while checking my account.");
    await expect(
      page
        .locator(".app-header")
        .getByText(/private test|sandbox|premium|free plan/i),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "File", exact: true }).click();
    const menu = page.locator(".mobile-command-panel");
    await expect(menu.locator(".mobile-command-group h3")).toHaveText([
      "Tools",
      "Files",
      "View",
      "Preferences",
    ]);
    const tools = menu.locator(".mobile-command-group").filter({
      has: page.getByRole("heading", { name: "Tools", exact: true }),
    });
    await tools
      .getByRole("combobox", { name: "Zoom", exact: true })
      .selectOption("125");
    const beatGuide = tools.getByRole("switch", { name: "Beat guide" });
    await expect(beatGuide).not.toBeChecked();
    await beatGuide.click();
    await expect(beatGuide).toBeChecked();
    await beatGuide.click();
    await expect(beatGuide).not.toBeChecked();
    const files = menu.locator(".mobile-command-group").filter({
      has: page.getByRole("heading", { name: "Files", exact: true }),
    });
    await expect(files.getByRole("button")).toHaveText([
      "New",
      /^Open…/,
      /^Save[^A-Za-z]*/,
      /^Save As…/,
      "Version history…",
      "Export…",
    ]);
    const accountButton = menu.getByRole("button", {
      name: label,
      exact: true,
    });
    await expect(accountButton).toHaveCount(1);
    await expect(
      menu.locator("details").getByRole("button", { name: label, exact: true }),
    ).toHaveCount(0);
    await expect(menu).toHaveCSS("opacity", "1");
    expect(
      await menu.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      animations: "disabled",
      path: `test-results/writeshape-menu-${signedIn ? "account" : "sign-in"}.png`,
    });
    await accountButton.click();
    await expect(menu).toHaveCount(0);
    await expect(
      page.getByRole("dialog", { name: label, exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Close dialog" }).click();
    await expect(editor).toHaveText(
      "Keep this draft while checking my account.",
    );

    await page.setViewportSize({ width: 1440, height: 1000 });
    await expect(
      page
        .locator(".app-header")
        .getByRole("button", { name: label, exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "File", exact: true }).click();
    await expect(
      page.getByRole("button", { name: new RegExp(`^${label}…?$`) }),
    ).toHaveCount(1);
  });
}
