import { test, expect } from "@playwright/test";
import { mobileSection } from "./mobile-menu-helper";

test("mobile offers every desktop menu action except Zen through one File entry", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect(
    page.getByRole("textbox", { name: "Screenplay editor" }),
  ).toBeVisible();
  const commands: string[] = [];
  for (const name of ["File", "Edit", "View", "Insert"]) {
    await page.getByRole("button", { name, exact: true }).click();
    commands.push(
      ...(await page.locator(".menu-popup button").evaluateAll((buttons) =>
        buttons.map((button) => {
          const clone = button.cloneNode(true) as HTMLElement;
          clone.querySelectorAll("kbd").forEach((kbd) => kbd.remove());
          return clone.textContent?.trim() || "";
        }),
      )),
    );
    await page.keyboard.press("Escape");
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".app-header button:visible")).toHaveCount(8); // F, B/I/U, undo/redo, annotation and hamburger.
  await expect(page.locator(".app-header > .document-name")).toHaveCount(0);
  const logo = (await page.locator(".app-header > .brand").boundingBox())!;
  const format = (await page.locator(".app-header > .mobile-header-format").boundingBox())!;
  const history = (await page.locator(".app-header > .header-history").boundingBox())!;
  const hamburger = (await page.locator(".mobile-file-trigger").boundingBox())!;
  expect(logo.x + logo.width).toBeLessThanOrEqual(format.x);
  expect(format.x + format.width).toBeLessThanOrEqual(history.x);
  expect(history.x + history.width).toBeLessThanOrEqual(hamburger.x);
  expect(hamburger.x + hamburger.width).toBeGreaterThan(360);
  await expect(page.locator(".mobile-file-trigger")).toHaveText("");
  await expect(page.locator(".app-header .brand-mark")).toHaveText("F");
  await expect(
    page.getByRole("toolbar", { name: "Writing controls" }),
  ).toHaveCount(0);
  const found: string[] = [];
  await mobileSection(page, "File");
  for (const name of ["File", "Write", "View", "Share"] as const) {
    await page
      .getByRole("group", { name: "Command categories" })
      .getByRole("button", { name, exact: true })
      .click();
    found.push(
      ...(await page
        .locator(".mobile-command-grid button")
        .evaluateAll((buttons) =>
          buttons.map((button) => {
            const clone = button.cloneNode(true) as HTMLElement;
            clone.querySelectorAll("kbd").forEach((kbd) => kbd.remove());
            return clone.textContent?.trim() || "";
          }),
        )),
    );
    await expect(
      page.getByRole("button", { name: /Zen mode/ }),
    ).not.toBeVisible();
    expect(
      await page
        .locator(".mobile-command-panel")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`mobile-${name}.png`),
      fullPage: true,
    });
  }
  const normalize = (text: string) =>
    text
      .replace(/…/g, "")
      .replace(/^(Hide|Show) /, "Toggle ")
      .trim();
  const available = found.map(normalize);
  for (const command of commands.filter(
    (command) => !command.includes("Zen mode"),
  ))
    expect(available).toContain(normalize(command));
  await page.keyboard.press("Escape");
  await expect(page.locator(".mobile-command-panel")).toHaveCount(0);
  await expect(page.locator(".mobile-file-trigger")).toBeFocused();
});

test("mobile formatting preserves the editor, selection and undo", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const editor = page.getByRole("textbox", { name: "Screenplay editor" });
  await expect(editor).toBeVisible();
  await editor.fill("Keep this sentence.");
  const original = await editor.elementHandle();
  await page.keyboard.press("ControlOrMeta+a");
  await page.locator(".mobile-header-format").getByRole("button", { name: "Bold", exact: true }).click();
  await expect(editor.locator("strong")).toHaveText("Keep this sentence.");
  expect(
    await original!.evaluate(
      (el) => el === document.querySelector(".screenplay-editor"),
    ),
  ).toBe(true);
  await mobileSection(page, "Write");
  await page.locator(".mobile-command-grid").getByRole("button", { name: "Undo", exact: true }).click();
  await expect(editor.locator("strong")).toHaveCount(0);
  await expect(editor).toHaveText("Keep this sentence.");
});

test.describe("mobile header history", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("undo and redo work beside formatting without opening a menu", async ({ page }, info) => {
    await page.goto("/");
    const editor = page.getByRole("textbox", { name: "Screenplay editor" });
    await expect(editor).toBeVisible();
    const header = page.locator(".app-header");
    const history = header.locator(".header-history");
    for (const width of [390, 320, 640]) {
      await page.setViewportSize({ width, height: 844 });
      const bounds = (await header.boundingBox())!;
      for (const control of await header.locator(".mobile-header-format button, .mobile-header-format .writing-element-hit, .header-history button, .mobile-file-trigger").all()) {
        await expect(control).toBeVisible();
        const box = (await control.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(bounds.x);
        expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width);
        expect(box.y).toBeGreaterThanOrEqual(bounds.y);
        expect(box.y + box.height).toBeLessThanOrEqual(bounds.y + bounds.height);
        expect(box.height).toBeGreaterThanOrEqual(40);
      }
      expect(await header.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.setViewportSize({ width: 320, height: 844 });
    await editor.fill("Keep this sentence.");
    const original = await editor.elementHandle();
    for (const [name, tag] of [["Bold", "strong"], ["Italic", "em"], ["Underline", "u"]]) {
      await editor.click();
      await page.keyboard.press("ControlOrMeta+a");
      await header.getByRole("button", { name, exact: true }).tap();
      await expect(editor.locator(tag)).toHaveText("Keep this sentence.");
      await history.getByRole("button", { name: "Undo", exact: true }).tap();
      await expect(editor.locator(tag)).toHaveCount(0);
      await expect(editor).toHaveText("Keep this sentence.");
      await history.getByRole("button", { name: "Redo", exact: true }).tap();
      await expect(editor.locator(tag)).toHaveText("Keep this sentence.");
      await expect(page.locator("dialog[open]")).toHaveCount(0);
    }
    await editor.tap();
    const annotation = history.getByRole("button", {
      name: "Add annotation",
      exact: true,
    });
    await expect(annotation).toBeEnabled();
    await annotation.tap();
    const annotationDialog = page.getByRole("dialog", {
      name: "Add Annotation",
      exact: true,
    });
    await expect(annotationDialog).toBeVisible();
    await annotationDialog
      .getByRole("button", { name: "Close dialog", exact: true })
      .tap();
    expect(await original!.evaluate((node) => node === document.querySelector(".screenplay-editor"))).toBe(true);
    await page.screenshot({ path: info.outputPath("mobile-header-with-history-annotation.png"), fullPage: true });
  });
});
