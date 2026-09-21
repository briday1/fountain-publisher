import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { mobileSection } from "./mobile-menu-helper";

const modifier = process.platform === "darwin" ? "Meta" : "Control";
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

async function newScript(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("textbox", { name: "Screenplay editor" })).toBeVisible();
  await mobileSection(page, "File");
  await page.getByRole("button", { name: "New screenplay", exact: true }).tap();
}

for (const width of [320, 390, 640, 900]) {
  test(`all mobile writing and history controls share the header at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    const header = page.locator(".app-header");
    await expect(header.locator(".mobile-header-format")).toBeVisible();
    await expect(header.locator(".header-history")).toBeVisible();
    await expect(header.locator(".document-name")).toHaveCount(0);
    const row = (await header.boundingBox())!;
    const controls = [header.getByRole("combobox", { name: "Screenplay element", exact: true })];
    for (const name of ["Bold", "Italic", "Underline", "Undo", "Redo"])
      controls.push(header.getByRole("button", { name, exact: true }));
    let right = row.x;
    for (const control of controls) {
      await expect(control).toBeVisible();
      const box = (await control.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(right - 1);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.y).toBeGreaterThanOrEqual(row.y);
      expect(box.y + box.height).toBeLessThanOrEqual(row.y + row.height);
      expect(box.height).toBeGreaterThanOrEqual(40);
      right = box.x + box.width;
    }
    expect(await header.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("mobile Undo and Redo preserve selected emphasis and the mounted editor without a menu", async ({ page }) => {
  await newScript(page);
  const editor = page.getByRole("textbox", { name: "Screenplay editor" });
  const original = await editor.elementHandle();
  await editor.fill("Keep this sentence.");
  const header = page.locator(".app-header");
  for (const [name, tag] of [["Bold", "strong"], ["Italic", "em"], ["Underline", "u"]]) {
    await editor.tap();
    await page.keyboard.press(`${modifier}+a`);
    await header.getByRole("button", { name, exact: true }).tap();
    await expect(editor.locator(tag)).toHaveText("Keep this sentence.");
    await header.getByRole("button", { name: "Undo", exact: true }).tap();
    await expect(editor.locator(tag)).toHaveCount(0);
    await expect(editor).toHaveText("Keep this sentence.");
    await header.getByRole("button", { name: "Redo", exact: true }).tap();
    await expect(editor.locator(tag)).toHaveText("Keep this sentence.");
    await expect(page.locator("dialog[open]")).toHaveCount(0);
  }
  expect(await original!.evaluate((node) => node === document.querySelector(".screenplay-editor"))).toBe(true);
});

test("mobile history undoes and redoes whole-speech dual dialogue without changing the text", async ({ page }) => {
  await newScript(page);
  const editor = page.getByRole("textbox", { name: "Screenplay editor" });
  await editor.tap();
  await page.keyboard.type("MARA");
  await page.keyboard.press("Enter");
  await page.keyboard.type("First speech.");
  await page.keyboard.press("Enter");
  await page.keyboard.type("ELI");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Second speech.");
  const before = await editor.textContent();
  const header = page.locator(".app-header");
  const element = header.getByRole("combobox", { name: "Screenplay element", exact: true });
  await element.selectOption("dual-dialogue");
  await expect(editor.locator('[data-dual-column="left"]')).toHaveCount(2);
  await expect(editor.locator('[data-dual-column="right"]')).toHaveCount(2);
  await expect(element).toHaveValue("dual-dialogue");
  await header.getByRole("button", { name: "Undo", exact: true }).tap();
  await expect(editor.locator("[data-dual-column]")).toHaveCount(0);
  expect(await editor.textContent()).toBe(before);
  await header.getByRole("button", { name: "Redo", exact: true }).tap();
  await expect(editor.locator("[data-dual-column]")).toHaveCount(4);
  expect(await editor.textContent()).toBe(before);
  await expect.poll(async () => editor.evaluate((node) => {
    const left = node.querySelector('[data-dual-column="left"][data-kind="character"]')!.getBoundingClientRect();
    const right = node.querySelector('[data-dual-column="right"][data-kind="character"]')!.getBoundingClientRect();
    return Math.abs(left.y - right.y) < 1 && left.right < right.x;
  })).toBe(true);
  await element.selectOption("single-dialogue");
  await expect(editor.locator("[data-dual-column]")).toHaveCount(0);
  await header.getByRole("button", { name: "Undo", exact: true }).tap();
  await expect(editor.locator("[data-dual-column]")).toHaveCount(4);
  expect(await editor.textContent()).toBe(before);
});
