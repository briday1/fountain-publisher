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

test("private build opens its editor without iPhone focus zoom", async ({ page }) => {
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
