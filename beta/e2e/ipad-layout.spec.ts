import { expect, test } from "@playwright/test";

const iPadUserAgent =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

test("iPad uses desktop UI in landscape and mobile UI in portrait", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 1024, height: 768 },
    userAgent: iPadUserAgent,
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  });
  // iPadOS reports MacIntel; ProseMirror uses that platform signal to map Mod
  // shortcuts to the Command key.
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "platform", { value: "MacIntel" });
  });
  const page = await context.newPage();
  await page.goto("/");
  const editor = page.getByRole("textbox", { name: "Screenplay editor" });
  await expect(editor).toBeVisible();

  // Landscape exposes mouse/keyboard-oriented controls even though the device
  // still advertises a coarse primary touch pointer.
  await expect(page.locator(".mobile-file-trigger")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "File", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("toolbar", { name: "Writing controls" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Zen mode/ }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "View", exact: true }).click();
  await page.getByRole("menuitem", { name: "PDF pages", exact: true }).click();
  const pdf = page.getByRole("dialog", { name: "PDF pages", exact: true });
  await expect(
    pdf.getByRole("link", { name: "Download PDF", exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await expect(pdf.locator("iframe, canvas, object, embed")).toHaveCount(0);
  await pdf.getByRole("button", { name: "Close" }).click();
  await editor.fill("Magic Keyboard formatting");
  await editor.press("Meta+a");
  await editor.press("Meta+b");
  await expect(editor.locator("strong")).toHaveText(
    "Magic Keyboard formatting",
  );

  await page.setViewportSize({ width: 768, height: 1024 });
  await expect(page.locator(".mobile-file-trigger")).toBeVisible();
  await expect(
    page.getByRole("toolbar", { name: "Writing controls" }),
  ).toHaveCount(0);

  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(page.locator(".mobile-file-trigger")).toHaveCount(0);
  await expect(
    page.getByRole("toolbar", { name: "Writing controls" }),
  ).toBeVisible();
  await expect(editor.locator("strong")).toHaveText(
    "Magic Keyboard formatting",
  );
  await context.close();
});
