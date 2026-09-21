import { expect, test } from "@playwright/test";
import { mobileSection } from "./mobile-menu-helper";

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  userAgent:
    "Mozilla/5.0 (Linux; Android 16; Pixel 9 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
});

test("mobile Downloads selection loads and can reopen the same screenplay filename", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "showOpenFilePicker", {
      configurable: true,
      value: async () => {
        (window as unknown as { nativePickerCalls: number }).nativePickerCalls++;
        throw new Error("Mobile should use the stable file input picker");
      },
    });
    (window as unknown as { nativePickerCalls: number }).nativePickerCalls = 0;
  });
  await page.goto("/");
  const editor = page.getByRole("textbox", { name: "Screenplay editor" });
  await expect(editor).toBeVisible();

  await mobileSection(page, "File");
  const firstChooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /^Open screenplay/ }).click();
  await (
    await firstChooser
  ).setFiles({
    name: "Downloads Draft.fountain",
    mimeType: "text/plain",
    buffer: Buffer.from(
      "INT. DOWNLOADS - DAY\n\n!FIRST DOWNLOAD LOAD.",
    ),
  });
  await expect(editor).toContainText("FIRST DOWNLOAD LOAD.");

  const picker = page.locator('[data-fp-local-file-picker="true"]');
  await expect(picker).toHaveCount(1);
  const originalPicker = await picker.elementHandle();

  await mobileSection(page, "File");
  const secondChooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /^Open screenplay/ }).click();
  await (
    await secondChooser
  ).setFiles({
    name: "Downloads Draft.fountain",
    mimeType: "text/plain",
    buffer: Buffer.from(
      "INT. DOWNLOADS - NIGHT\n\n!SECOND DOWNLOAD LOAD.",
    ),
  });
  await expect(editor).toContainText("SECOND DOWNLOAD LOAD.");
  await expect(editor).not.toContainText("FIRST DOWNLOAD LOAD.");

  expect(
    await originalPicker!.evaluate(
      (node) =>
        node ===
        document.querySelector('[data-fp-local-file-picker="true"]'),
    ),
  ).toBe(true);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { nativePickerCalls: number })
          .nativePickerCalls,
    ),
  ).toBe(0);
});
