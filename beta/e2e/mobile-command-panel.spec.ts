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
  const logo = (await page.locator(".app-header > .brand").boundingBox())!;
  const inline = page.getByRole("toolbar", {
    name: "Quick formatting",
    exact: true,
  });
  const inlineBounds = (await inline.boundingBox())!;
  const hamburger = (await page.locator(".mobile-file-trigger").boundingBox())!;
  expect(logo.x + logo.width).toBeLessThanOrEqual(inlineBounds.x);
  expect(inlineBounds.x + inlineBounds.width).toBeLessThanOrEqual(hamburger.x);
  expect(hamburger.x + hamburger.width).toBeGreaterThan(360);
  await expect(page.locator(".app-header > .document-name")).not.toBeVisible();
  await expect(inline.getByRole("combobox", { name: "Screenplay element" })).toBeVisible();
  for (const name of ["Bold", "Italic", "Underline", "Undo", "Redo", "Add annotation"])
    await expect(inline.getByRole("button", { name, exact: true })).toBeVisible();
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

test("mobile header formatting, history and annotation preserve the editor", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const editor = page.getByRole("textbox", { name: "Screenplay editor" });
  const controls = page.getByRole("toolbar", {
    name: "Quick formatting",
    exact: true,
  });
  await expect(editor).toBeVisible();
  await editor.fill("Keep this sentence.");
  const original = await editor.elementHandle();
  await page.keyboard.press("ControlOrMeta+a");

  await controls.getByRole("button", { name: "Bold", exact: true }).click();
  await expect(editor.locator("strong")).toHaveText("Keep this sentence.");
  await controls.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(editor.locator("strong")).toHaveCount(0);
  await controls.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(editor.locator("strong")).toHaveText("Keep this sentence.");
  await expect(controls.getByRole("button", { name: "Italic" })).toBeVisible();
  await expect(controls.getByRole("button", { name: "Underline" })).toBeVisible();

  expect(
    await original!.evaluate(
      (el) => el === document.querySelector(".screenplay-editor"),
    ),
  ).toBe(true);

  await editor.click();
  const annotation = controls.getByRole("button", {
    name: "Add annotation",
    exact: true,
  });
  await expect(annotation).toBeEnabled();
  await annotation.click();
  await expect(
    page.getByRole("dialog", { name: "Add Annotation", exact: true }),
  ).toBeVisible();
});
