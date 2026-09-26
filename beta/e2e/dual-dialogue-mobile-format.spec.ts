import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

test.use({ screenshot: "on" });

const modifier = process.platform === "darwin" ? "Meta" : "Control";
const source = `INT. STUDIO - DAY\n\nMARA\n${"The left speech wraps independently and remains editable. ".repeat(8)}\n(quietly)\nA final left sentence.\n\nELI\nRight begins.\n(shouting)\nA final right sentence.\n\n!After both speeches.`;
async function open(page: Page, text: string) {
  await page.addInitScript(() => {
    Object.defineProperty(window, "showOpenFilePicker", {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(window, "showSaveFilePicker", {
      value: undefined,
      configurable: true,
    });
  });
  await page.goto("/");
  await expect(page.getByRole("textbox", { name: "Screenplay editor" })).toBeVisible();
  await page.getByRole("button", { name: "File", exact: true }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /^Open screenplay/ }).click();
  await (await chooser).setFiles({ name: "Two voices.fountain", mimeType: "text/plain", buffer: Buffer.from(text) });
  await expect(page.getByRole("textbox", { name: "Screenplay editor" })).toContainText(text.includes("MARA") ? "MARA" : "Mobile formatting");
}
async function geometry(page: Page) {
  return page.locator(".screenplay-editor").evaluate((editor) => {
    const box = (selector: string) => {
      const element = editor.querySelector(selector)!;
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom };
    };
    return {
      leftCue: box('p[data-dual-column="left"][data-kind="character"]'),
      rightCue: box('p[data-dual-column="right"][data-kind="character"]'),
      leftSpeech: box('p[data-dual-column="left"][data-kind="dialogue"]'),
      rightSpeech: box('p[data-dual-column="right"][data-kind="dialogue"]'),
      after: box('p[data-kind="action"]'),
      bottom: Math.max(...Array.from(editor.querySelectorAll("[data-dual-column]")).map((node) => node.getBoundingClientRect().bottom)),
      width: editor.getBoundingClientRect().width,
    };
  });
}

test("dual dialogue applies from its speech, aligns real editable columns, and undoes without retyping", async ({ page }) => {
  await open(page, source);
  const editor = page.getByRole("textbox", { name: "Screenplay editor" });
  const original = await editor.elementHandle();
  const speech = editor.locator('p[data-kind="dialogue"]').filter({ hasText: "Right begins." });
  await speech.click();
  const element = page.getByRole("combobox", { name: "Screenplay element", exact: true });
  await element.selectOption("dual-dialogue");
  await expect(speech).toHaveAttribute("data-kind", "dialogue");
  await expect(speech).toHaveAttribute("data-dual-column", "right");
  await expect(element).toHaveValue("dual-dialogue");
  await expect.poll(async () => {
    const boxes = await geometry(page);
    return Math.abs(boxes.leftCue.y - boxes.rightCue.y) < 1 &&
      Math.abs(boxes.leftSpeech.y - boxes.rightSpeech.y) < 1 &&
      boxes.leftSpeech.right < boxes.rightSpeech.x && boxes.after.y >= boxes.bottom;
  }).toBe(true);
  await speech.click();
  await page.keyboard.press("End");
  await page.keyboard.insertText(" Added in the right column.");
  await expect(speech).toContainText("Added in the right column.");
  await expect(editor.locator('p[data-kind="character"]').nth(1)).toHaveText("ELI");
  await element.selectOption("single-dialogue");
  await expect(editor.locator("[data-dual-column]")).toHaveCount(0);
  await expect(speech).toHaveAttribute("data-kind", "dialogue");
  await page.keyboard.press(`${modifier}+z`);
  await expect(speech).toHaveAttribute("data-dual-column", "right");
  await expect(speech).toContainText("Added in the right column.");
  expect(await original!.evaluate((node) => node === document.querySelector(".screenplay-editor"))).toBe(true);
});

test("imported dual dialogue reflows unequal columns on resize without overlap", async ({ page }) => {
  await open(page, source.replace("\nELI\n", "\nELI ^\n"));
  const editor = page.getByRole("textbox", { name: "Screenplay editor" });
  await expect(editor).toHaveClass(/has-dual-dialogue/);
  for (const width of [1280, 640, 390, 320, 1100]) {
    await page.setViewportSize({ width, height: 844 });
    await expect.poll(async () => {
      const boxes = await geometry(page);
      return Math.abs(boxes.leftCue.y - boxes.rightCue.y) < 1 &&
        Math.abs(boxes.leftSpeech.y - boxes.rightSpeech.y) < 1 &&
        boxes.leftSpeech.right < boxes.rightSpeech.x && boxes.after.y >= boxes.bottom;
    }).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test.describe("always-visible mobile formatting", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("replaces the document title with element and emphasis controls without a menu", async ({ page }) => {
    await open(page, "!Mobile formatting");
    const editor = page.getByRole("textbox", { name: "Screenplay editor" });
    const original = await editor.elementHandle();
    const header = page.locator(".app-header");
    const format = header.locator(".mobile-header-format");
    await expect(header.locator(".document-name")).toHaveCount(0);
    await expect(format.getByRole("combobox", { name: "Screenplay element" })).toBeVisible();
    for (const [name, tag] of [["Bold", "strong"], ["Italic", "em"], ["Underline", "u"]]) {
      await editor.click();
      await page.keyboard.press(`${modifier}+a`);
      await format.getByRole("button", { name, exact: true }).tap();
      await expect(editor.locator(tag)).toContainText("Mobile formatting");
      await expect(page.locator("dialog[open]")).toHaveCount(0);
    }
    expect(await original!.evaluate((node) => node === document.querySelector(".screenplay-editor"))).toBe(true);
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      for (const control of await format.locator("button, .writing-element-hit").all()) {
        const box = (await control.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
        expect(box.height).toBeGreaterThanOrEqual(40);
      }
      expect(await header.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
    }
    await page.getByRole("button", { name: "File", exact: true }).tap();
    await page.getByRole("button", { name: "Rename screenplay…", exact: true }).tap();
    await expect(page.getByRole("dialog", { name: "Name your screenplay" })).toBeVisible();
  });

  test("pairs dialogue directly from the mobile header", async ({ page }) => {
    await open(page, source);
    const editor = page.getByRole("textbox", { name: "Screenplay editor" });
    const leftSpeech = editor.locator('p[data-kind="dialogue"]').first();
    await leftSpeech.tap();
    const element = page.locator(".mobile-header-format").getByRole("combobox", { name: "Screenplay element" });
    await element.selectOption("dual-dialogue");
    await expect(leftSpeech).toHaveAttribute("data-kind", "dialogue");
    await expect(leftSpeech).toHaveAttribute("data-dual-column", "left");
    await expect.poll(async () => {
      const boxes = await geometry(page);
      return Math.abs(boxes.leftCue.y - boxes.rightCue.y) < 1 && boxes.after.y >= boxes.bottom;
    }).toBe(true);
  });
});
