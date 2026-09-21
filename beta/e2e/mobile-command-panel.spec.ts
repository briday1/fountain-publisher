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
  // F logo, five formatting/history buttons and hamburger; the element select is separate.
  await expect(page.locator(".app-header button:visible")).toHaveCount(7);
  await expect(page.locator(".app-header > .document-name")).not.toBeVisible();
  const logo = (await page.locator(".app-header > .brand").boundingBox())!;
  const writing = (await page.getByRole("toolbar", { name: "Mobile writing controls", exact: true }).boundingBox())!;
  const hamburger = (await page.locator(".mobile-file-trigger").boundingBox())!;
  expect(logo.x + logo.width).toBeLessThanOrEqual(writing.x);
  expect(writing.x + writing.width).toBeLessThanOrEqual(hamburger.x);
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
  await mobileSection(page, "Write");
  await page.getByRole("button", { name: "Bold", exact: true }).click();
  await page.getByRole("button", { name: "Back to writing" }).click();
  await expect(editor.locator("strong")).toHaveText("Keep this sentence.");
  expect(
    await original!.evaluate(
      (el) => el === document.querySelector(".screenplay-editor"),
    ),
  ).toBe(true);
  await mobileSection(page, "Write");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(editor.locator("strong")).toHaveCount(0);
  await expect(editor).toHaveText("Keep this sentence.");
});
