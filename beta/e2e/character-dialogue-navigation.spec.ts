import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

async function fixture(page: Page) {
  await page.addInitScript(() =>
    Object.defineProperty(window, "showOpenFilePicker", {
      value: undefined,
      configurable: true,
    }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("textbox", { name: "Screenplay editor" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "File", exact: true }).click();
  const picker = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /^Open screenplay/ }).click();
  const source =
    "INT. STATION - DAY\n\n" +
    Array.from(
      { length: 45 },
      (_, i) =>
        `!A waiting room stretches into the distance. It is a quiet moment ${i + 1}.\n\nMARA\nFirst sentence of speech ${i + 1}.\nExact dialogue line ${i + 1}.\n\n`,
    ).join("");
  await (
    await picker
  ).setFiles({
    name: "Dialogue navigation.fountain",
    mimeType: "text/plain",
    buffer: Buffer.from(source),
  });
  await expect(
    page.getByRole("textbox", { name: "Screenplay editor" }),
  ).toContainText("Exact dialogue line 45.");
  const insights = page.getByRole("complementary", {
    name: "Screenplay insights",
  });
  if (!(await insights.isVisible()))
    await page.getByRole("button", { name: "Insights", exact: true }).click();
  await insights.getByRole("button", { name: /^MARA / }).click();
  await expect(
    page.getByRole("dialog", { name: "MARA", exact: true }),
  ).toBeVisible();
}

for (const mobile of [false, true]) {
  test(`character dialogue targets its exact authored line and contains modal scrolling on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await fixture(page);
    const dialog = page.getByRole("dialog", { name: "MARA", exact: true });
    const speechList = dialog.locator(".speech-list");
    const snapshot = () =>
      page.evaluate(() => ({
        writing: document.querySelector(".writing-scroll")!.scrollTop,
        window: window.scrollY,
        body: document.body.scrollTop,
        root: document.documentElement.scrollTop,
      }));
    const background = await snapshot();
    await dialog.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await speechList.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    const bounds = await speechList.boundingBox();
    expect(bounds).not.toBeNull();
    await page.mouse.move(
      bounds!.x + bounds!.width / 2,
      Math.min(bounds!.y + bounds!.height - 8, mobile ? 770 : 925),
    );
    await page.mouse.wheel(0, 1800);
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    expect(await snapshot()).toEqual(background);
    await page.mouse.move(4, 4);
    await page.mouse.wheel(0, 1800);
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    expect(await snapshot()).toEqual(background);
    await dialog
      .getByRole("button", {
        name: "Go to dialogue: Exact dialogue line 30.",
        exact: true,
      })
      .click();
    await expect(dialog).not.toBeVisible();
    const editor = page.getByRole("textbox", { name: "Screenplay editor" });
    await expect(editor).toBeFocused();
    await expect
      .poll(() => page.evaluate(() => window.getSelection()?.toString()))
      .toBe("Exact dialogue line 30.");
    const selected = await page.evaluate(() => {
      const selection = window.getSelection()!;
      const range = selection.getRangeAt(0).getBoundingClientRect();
      const scroll = document
        .querySelector(".writing-scroll")!
        .getBoundingClientRect();
      return {
        top: range.top,
        bottom: range.bottom,
        viewportTop: scroll.top,
        viewportBottom: scroll.bottom,
        overflow: document.body.style.overflow,
        exposed: document
          .querySelector(".screenplay-editor")!
          .contains(
            document.elementFromPoint(
              Math.max(
                scroll.left + 1,
                Math.min(range.left + 2, scroll.right - 1),
              ),
              range.top + 2,
            ),
          ),
      };
    });
    expect(selected.top).toBeGreaterThanOrEqual(selected.viewportTop);
    expect(selected.bottom).toBeLessThanOrEqual(selected.viewportBottom);
    expect(selected.overflow).toBe("");
    expect(selected.exposed).toBe(true);
  });
}
