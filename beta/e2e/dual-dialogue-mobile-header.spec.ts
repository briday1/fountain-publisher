import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { mobileSection } from "./mobile-menu-helper";

async function openScript(page: Page, source: string) {
  // Exercise the portable file-input path, as the other import browser tests do.
  // Chrome's OS-native File System Access picker does not emit filechooser.
  await page.addInitScript(() => {
    Object.defineProperty(window, "showOpenFilePicker", { value: undefined, configurable: true });
    Object.defineProperty(window, "showSaveFilePicker", { value: undefined, configurable: true });
  });
  await page.goto("/");
  await expect(page.getByRole("textbox", { name: "Screenplay editor" })).toBeVisible();
  await page.getByRole("button", { name: "File", exact: true }).click();
  const picker = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /^Open screenplay/ }).click();
  await (await picker).setFiles({ name: "Two voices.fountain", mimeType: "text/plain", buffer: Buffer.from(source) });
}

async function expectColumns(page: Page) {
  const editor = page.getByRole("textbox", { name: "Screenplay editor" });
  await expect(editor.locator('[data-dual-side="1"][data-kind="character"]')).toHaveCount(1);
  await expect(editor.locator('[data-dual-side="2"][data-kind="character"]')).toHaveCount(1);
  await expect.poll(async () => editor.evaluate((root) => {
    const rects = (side: string) => [...root.querySelectorAll<HTMLElement>(`p[data-dual-side="${side}"]`)]
      .filter((p) => getComputedStyle(p).display !== "none")
      .map((p) => p.getBoundingClientRect());
    const left = rects("1");
    const right = rects("2");
    const after = root.querySelector<HTMLElement>('p[data-kind="action"]')!.getBoundingClientRect();
    return Math.abs(left[0].y - right[0].y) < 1 &&
      Math.max(...left.map((r) => r.right)) < Math.min(...right.map((r) => r.left)) &&
      [...left, ...right].every((r) => r.bottom <= after.top + 1) &&
      [left, right].every((column) => column.every((r, i) => !i || r.top >= column[i - 1].bottom - 1));
  })).toBe(true);
}

test("dual dialogue formats whole editable speeches, reflows and unpairs without changing text", async ({ page }, info) => {
  const source = `INT. ROOM - DAY\n\nMARA\n(quietly)\nA short first sentence.\n(then louder)\nAnother left sentence.\n\nELI\n${"The other voice continues for several lines. ".repeat(16)}\n\n!They both stop.`;
  await openScript(page, source);
  const editor = page.getByRole("textbox", { name: "Screenplay editor" });
  await expect(editor).toContainText("They both stop.");
  const original = await editor.elementHandle();
  const before = await editor.locator("p").evaluateAll((ps) => ps.map((p) => [p.getAttribute("data-kind"), p.textContent]));
  const right = editor.locator('p[data-kind="dialogue"]').last();
  await right.click();
  const picker = page.getByRole("combobox", { name: "Screenplay element", exact: true });
  await picker.selectOption("dual-dialogue");
  await expect(picker).toHaveValue("dual-dialogue");
  expect(await editor.locator("p").evaluateAll((ps) => ps.map((p) => [p.getAttribute("data-kind"), p.textContent]))).toEqual(before);
  await expectColumns(page);
  // No parenthetical on the right: its dialogue starts immediately after its cue,
  // rather than waiting for the left column's parenthetical or longer paragraphs.
  const rightCue = await editor.locator('[data-dual-side="2"][data-kind="character"]').boundingBox();
  const rightBox = await right.boundingBox();
  expect(Math.abs(rightBox!.y - rightCue!.y - rightCue!.height)).toBeLessThan(1);
  await page.screenshot({ path: info.outputPath("dual-dialogue-desktop.png"), fullPage: true });

  await right.click();
  await page.keyboard.press("End");
  await page.keyboard.insertText(" Added in the right column.");
  await expect(right).toContainText("Added in the right column.");
  await expectColumns(page);
  await editor.locator('[data-dual-side="1"][data-kind="dialogue"]').first().click();
  await expect(picker).toHaveValue("dual-dialogue");
  await page.keyboard.insertText("Added on the left. ");
  await expectColumns(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await expectColumns(page);
  const header = page.getByRole("toolbar", { name: "Mobile formatting", exact: true });
  await expect(header.getByRole("combobox")).toHaveValue("dual-dialogue");
  await page.screenshot({ path: info.outputPath("dual-dialogue-mobile.png"), fullPage: true });
  const current = await editor.textContent();
  await header.getByRole("combobox").selectOption("single-dialogue");
  await expect(editor.locator("[data-dual-side]")).toHaveCount(0);
  expect(await editor.textContent()).toBe(current);
  await header.getByRole("button", { name: "Undo", exact: true }).click();
  await expectColumns(page);
  await header.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(editor.locator("[data-dual-side]")).toHaveCount(0);
  expect(await original!.evaluate((node) => node === document.querySelector(".screenplay-editor"))).toBe(true);
});

test("imported dual dialogue is side by side immediately, not just after a toolbar command", async ({ page }) => {
  await openScript(page, "MARA\nLeft.\n\nELI ^\nRight.\n\n!They both stop.");
  await expectColumns(page);
});

test("revealing and collapsing a note reflows only its own column", async ({ page }) => {
  await openScript(page, `MARA\nLeft.\n[[A note with enough words to wrap over several lines in the left column.]]\n(continuing)\nMore left dialogue.\n\nELI ^\n${"A longer right speech. ".repeat(40)}\n\n!They both stop.`);
  const editor = page.getByRole("textbox", { name: "Screenplay editor" });
  const note = editor.locator('p[data-kind="note"]');
  await expect(note).toHaveClass(/annotation-collapsed/);
  await expectColumns(page);
  await editor.locator('p[data-kind="dialogue"]').first().click();
  // Native keyboard navigation can reach the hidden note; model the resulting
  // text selection rather than making an otherwise hidden paragraph clickable.
  await note.evaluate((node) => {
    const text = node.firstChild!;
    const selection = window.getSelection()!;
    selection.collapse(text, 0);
    document.dispatchEvent(new Event("selectionchange"));
  });
  await expect(note).not.toHaveClass(/annotation-collapsed/);
  await expectColumns(page);
  await editor.locator('[data-dual-side="2"][data-kind="dialogue"]').click();
  await expect(note).toHaveClass(/annotation-collapsed/);
  await expectColumns(page);
});

for (const width of [320, 390, 640, 900]) {
  test(`mobile header exposes all requested controls without scrolling at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    const header = page.getByRole("toolbar", { name: "Mobile formatting", exact: true });
    await expect(header).toBeVisible();
    await expect(page.locator(".app-header > .document-name")).not.toBeVisible();
    await expect(header.getByRole("combobox", { name: "Screenplay element" })).toBeVisible();
    for (const name of ["Bold", "Italic", "Underline", "Undo", "Redo"])
      await expect(header.getByRole("button", { name, exact: true })).toBeVisible();
    const bounds = await page.locator(".app-header").boundingBox();
    for (const control of await header.locator("button, select").all()) {
      const box = await control.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(bounds!.x);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      expect(box!.y).toBeGreaterThanOrEqual(bounds!.y);
      expect(box!.y + box!.height).toBeLessThanOrEqual(bounds!.y + bounds!.height);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`mobile-writing-${width}.png`), fullPage: true });
  });
}

test("mobile header formats the selection and undo/redo work without opening a menu", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await mobileSection(page, "File");
  await page.getByRole("button", { name: "New screenplay", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "Screenplay editor" });
  const original = await editor.elementHandle();
  await editor.fill("Keep this sentence.");
  await page.keyboard.press("ControlOrMeta+a");
  const header = page.getByRole("toolbar", { name: "Mobile formatting", exact: true });
  for (const [name, tag] of [["Bold", "strong"], ["Italic", "em"], ["Underline", "u"]]) {
    await header.getByRole("button", { name, exact: true }).click();
    await expect(editor.locator(tag)).toHaveText("Keep this sentence.");
  }
  await header.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(editor.locator("u")).toHaveCount(0);
  await expect(editor.locator("strong")).toHaveText("Keep this sentence.");
  await header.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(editor.locator("u")).toHaveText("Keep this sentence.");
  await expect(page.locator(".mobile-command-panel")).toHaveCount(0);
  expect(await original!.evaluate((node) => node === document.querySelector(".screenplay-editor"))).toBe(true);
});
