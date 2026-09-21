import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

const source = `INT. STUDIO - DAY\n\nMARA\n${"A longer first speech wraps independently. ".repeat(8)}\n(beat)\nOne last thought.\n\nELI\nHello.\n(quietly)\nA second thought.\n\n!After the simultaneous conversation.`;
async function openScript(page: Page, text = source) {
  await page.goto("/");
  await expect(page.getByRole("textbox", { name: "Screenplay editor" })).toBeVisible();
  await page.getByRole("button", { name: "File", exact: true }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /^Open screenplay/ }).click();
  await (await chooser).setFiles({ name: "Two voices.fountain", mimeType: "text/plain", buffer: Buffer.from(text) });
  await expect(page.locator('.screenplay-editor p[data-kind="character"]')).toHaveCount(2);
}
async function assertColumns(page: Page) {
  const editor = page.getByRole("textbox", { name: "Screenplay editor" });
  await expect(editor).toHaveClass(/screenplay-has-dual/);
  await expect.poll(() => editor.evaluate((root) => {
    const boxes = (side: string) => Array.from(root.querySelectorAll<HTMLElement>(`[data-dual-side="${side}"]`))
      .filter((element) => getComputedStyle(element).display !== "none")
      .map((element) => element.getBoundingClientRect());
    const left = boxes("left"), right = boxes("right");
    const after = root.querySelector<HTMLElement>('p[data-kind="action"]')!.getBoundingClientRect();
    const ordered = (rows: DOMRect[]) => rows.every((row, index) => !index || row.top >= rows[index - 1].bottom - 1);
    return {
      aligned: Math.abs(left[0].top - right[0].top) <= 1,
      separate: Math.max(...left.map((r) => r.right)) <= Math.min(...right.map((r) => r.left)) - 1,
      leftFlows: ordered(left),
      rightFlows: ordered(right),
      followingClears: after.top >= Math.max(left.at(-1)!.bottom, right.at(-1)!.bottom) - 1,
      noOverflow: root.scrollWidth <= root.clientWidth + 1,
    };
  })).toEqual({ aligned: true, separate: true, leftFlows: true, rightFlows: true, followingClears: true, noOverflow: true });
}

test("dual dialogue formats both editable speeches from a dialogue line and survives reflow", async ({ page }, info) => {
  await openScript(page);
  const editor = page.getByRole("textbox", { name: "Screenplay editor" });
  const original = await editor.elementHandle();
  const before = await editor.locator("p").evaluateAll((paragraphs) => paragraphs.map((p) => [p.getAttribute("data-kind"), p.textContent]));
  await editor.locator('p[data-kind="dialogue"]').filter({ hasText: /^Hello\.$/ }).click();
  const element = page.getByRole("combobox", { name: "Screenplay element", exact: true });
  await element.selectOption("dual-dialogue");
  await expect(element).toHaveValue("dual-dialogue");
  expect(await editor.locator("p").evaluateAll((paragraphs) => paragraphs.map((p) => [p.getAttribute("data-kind"), p.textContent]))).toEqual(before);
  await assertColumns(page);
  for (const text of ["One last thought.", "A second thought."]) {
    const paragraph = editor.locator('p[data-kind="dialogue"]').filter({ hasText: text });
    await paragraph.click();
    await page.keyboard.press("End");
    await expect(element).toHaveValue("dual-dialogue");
    await page.keyboard.type("EDIT");
    await expect(paragraph).toContainText("EDIT");
    await page.keyboard.press("ControlOrMeta+z");
    await expect(paragraph).toHaveText(text);
  }
  await page.getByRole("combobox", { name: "Page zoom", exact: true }).selectOption("125");
  await assertColumns(page);
  await page.screenshot({ path: info.outputPath("dual-dialogue-desktop.png"), fullPage: true });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await assertColumns(page);
  }
  await page.screenshot({ path: info.outputPath("dual-dialogue-mobile.png"), fullPage: true });
  expect(await original!.evaluate((node) => node === document.querySelector(".screenplay-editor"))).toBe(true);
  await element.selectOption("single-dialogue");
  await expect(editor.locator("[data-dual-side]")).toHaveCount(0);
  expect(await editor.locator("p").evaluateAll((paragraphs) => paragraphs.map((p) => [p.getAttribute("data-kind"), p.textContent]))).toEqual(before);
});

test("imported Fountain pairs are immediately editable and retain their layout after reload", async ({ page }) => {
  await openScript(page, source.replace("ELI\n", "ELI ^\n"));
  await assertColumns(page);
  await expect(page.locator(".save-status")).toContainText("Saved on this device");
  await page.reload();
  await assertColumns(page);
  await page.locator('[data-dual-side="left"][data-kind="character"]').click();
  await expect(page.getByRole("combobox", { name: "Screenplay element", exact: true })).toHaveValue("dual-dialogue");
});

test.describe("persistent mobile header", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test("element and B/I/U plus undo/redo stay visible and operate on the same selection", async ({ page }, info) => {
    await page.goto("/");
    const editor = page.getByRole("textbox", { name: "Screenplay editor" });
    await expect(editor).toBeVisible();
    const header = page.locator(".mobile-writing-controls");
    await expect(header).toBeVisible();
    await expect(page.locator(".app-header > .document-name")).not.toBeVisible();
    await expect(header.getByRole("combobox", { name: "Screenplay element" })).toBeVisible();
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      for (const name of ["Bold", "Italic", "Underline", "Undo", "Redo"]) {
        const button = header.getByRole("button", { name, exact: true });
        await expect(button).toBeVisible();
        const bounds = (await button.boundingBox())!;
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
        expect(bounds.height).toBeGreaterThanOrEqual(40);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await editor.fill("Keep this sentence.");
    const original = await editor.elementHandle();
    await page.keyboard.press("ControlOrMeta+a");
    for (const name of ["Bold", "Italic", "Underline"]) await header.getByRole("button", { name, exact: true }).tap();
    for (const tag of ["strong", "em", "u"]) await expect(editor.locator(tag)).toHaveText("Keep this sentence.");
    for (let i = 0; i < 3; i++) await header.getByRole("button", { name: "Undo", exact: true }).tap();
    await expect(editor.locator("strong, em, u")).toHaveCount(0);
    await expect(editor).toHaveText("Keep this sentence.");
    for (let i = 0; i < 3; i++) await header.getByRole("button", { name: "Redo", exact: true }).tap();
    for (const tag of ["strong", "em", "u"]) await expect(editor.locator(tag)).toHaveText("Keep this sentence.");
    expect(await original!.evaluate((node) => node === document.querySelector(".screenplay-editor"))).toBe(true);
    await header.getByRole("combobox", { name: "Screenplay element" }).selectOption("scene");
    await expect(editor.locator('p[data-kind="scene"]')).toHaveText("Keep this sentence.");
    await expect(page.locator(".mobile-command-panel")).toHaveCount(0);
    await page.screenshot({ path: info.outputPath("mobile-header-tools.png"), fullPage: true });
  });
});
