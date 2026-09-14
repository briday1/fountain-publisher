import { mobileSection } from "./mobile-menu-helper";
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

const finalSceneHeading =
  "INT. TRANSMITTER ROOM WITH WINDOWS OVERLOOKING THE ENTIRE SLEEPING CITY - NIGHT";

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
    "@MARA\nBefore the first scene begins.\n\n" +
    "INT. STATION - DAY\n\n" +
    Array.from(
      { length: 45 },
      (_, i) =>
        (i === 15
          ? "EXT. WATERFRONT - NIGHT\n\n@ELI\nOnly Eli speaks here.\n\nINT. STATION - DAY\n\n"
          : i === 30
            ? `${finalSceneHeading}\n\n`
            : "") +
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
  if (!(await insights.isVisible())) {
    if ((page.viewportSize()?.width ?? 1440) <= 950)
      await mobileSection(page, "Write");
    await page.getByRole("button", { name: "Insights", exact: true }).click();
  }
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
    await expect(
      dialog.getByRole("heading", { name: "Presence across the story" }),
    ).toHaveCount(0);
    await expect(dialog.locator(".presence-chart")).toHaveCount(0);
    const sections = speechList.getByRole("region");
    await expect(sections).toHaveCount(4);
    expect(
      await sections.evaluateAll((elements) =>
        elements.map((element) => element.getAttribute("aria-label")),
      ),
    ).toEqual([
      "Before the first scene",
      "Scene 1: INT. STATION - DAY",
      "Scene 3: INT. STATION - DAY",
      `Scene 4: ${finalSceneHeading}`,
    ]);
    await expect(sections.nth(0).getByRole("heading")).toHaveText(
      "Before the first scene",
    );
    await expect(sections.nth(1).getByRole("heading")).toHaveText(
      "Scene 1 INT. STATION - DAY",
    );
    await expect(sections.nth(2).getByRole("heading")).toHaveText(
      "Scene 3 INT. STATION - DAY",
    );
    await expect(sections.nth(1).locator(".character-speech")).toHaveCount(15);
    await expect(sections.nth(2).locator(".character-speech")).toHaveCount(15);
    expect(
      await speechList.locator(".character-dialogue-line").allTextContents(),
    ).toEqual([
      "Before the first scene begins.",
      ...Array.from({ length: 45 }, (_, i) => [
        `First sentence of speech ${i + 1}.`,
        `Exact dialogue line ${i + 1}.`,
      ]).flat(),
    ]);
    await expect(dialog.locator(".character-metrics")).toContainText(
      "46speeches",
    );
    await expect(dialog.locator(".character-metrics")).toContainText("3scenes");
    await dialog
      .getByRole("textbox", { name: "Character notes" })
      .fill("Mara needs to hear the entire message.");
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
    expect(
      await speechList.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
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
      .poll(() => page.evaluate(() => window.getSelection()?.isCollapsed))
      .toBe(true);
    await expect(editor.locator(".navigation-highlight")).toHaveText(
      "Exact dialogue line 30.",
    );
    const selected = await page.evaluate(() => {
      const range = document
        .querySelector(".navigation-highlight")!
        .getBoundingClientRect();
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
    await page.keyboard.insertText("Before it: ");
    await expect(editor).toContainText("Before it: Exact dialogue line 30.");
    const insights = page.getByRole("complementary", {
      name: "Screenplay insights",
    });
    if (!(await insights.isVisible()))
      await page.getByRole("button", { name: "Insights", exact: true }).click();
    await insights.getByRole("button", { name: /^MARA / }).click();
    await expect(
      dialog.getByRole("textbox", { name: "Character notes" }),
    ).toHaveValue("Mara needs to hear the entire message.");
  });
}
