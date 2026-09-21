import { test, expect } from "@playwright/test";
import { mobileSection } from "./mobile-menu-helper";

const modifier = process.platform === "darwin" ? "Meta" : "Control";

test("one writing toolbar preserves selection, editor identity and undo through the beat sheet overlay", async ({
  page,
}) => {
  await page.goto("/");
  const toolbar = page.getByRole("toolbar", {
    name: "Writing controls",
    exact: true,
  });
  const editor = page.getByRole("textbox", { name: "Screenplay editor" });
  await expect(toolbar).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(0);
  await expect(page.locator(".workspace-toolbar, .format-toolbar")).toHaveCount(
    0,
  );
  await expect(
    toolbar.getByRole("button", { name: "Assign beat", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText(/Tab to change element/)).toHaveCount(0);
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page
    .getByRole("button", { name: "New screenplay", exact: true })
    .click();
  await editor.click();
  await page.keyboard.type("The room is quiet.");
  const original = await editor.elementHandle();
  await page.keyboard.press(`${modifier}+a`);
  await toolbar.getByRole("button", { name: "Bold", exact: true }).click();
  await expect(editor.locator("strong")).toHaveText("The room is quiet.");
  await toolbar
    .getByRole("button", { name: "Beat sheet", exact: true })
    .click();
  const sheet = page.getByRole("dialog", { name: "Beat sheet", exact: true });
  await expect(sheet).toBeVisible();
  await sheet
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await expect(sheet).not.toBeVisible();
  expect(
    await original!.evaluate(
      (element) => element === document.querySelector(".screenplay-editor"),
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Undo", exact: true }).first().click();
  await expect(editor.locator("strong")).toHaveCount(0);
  await expect(editor).toHaveText("The room is quiet.");
  await toolbar
    .getByRole("combobox", { name: "Page zoom", exact: true })
    .selectOption("125");
  await expect(
    toolbar.getByRole("combobox", { name: "Page zoom", exact: true }),
  ).toHaveValue("125");
  expect(
    await original!.evaluate(
      (element) => element === document.querySelector(".screenplay-editor"),
    ),
  ).toBe(true);
  await toolbar.getByRole("button", { name: "Bold", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    toolbar.getByRole("button", { name: "Italic", exact: true }),
  ).toBeFocused();
});

test("element picker stays themed and exposes dual dialogue", async ({ page }) => {
  await page.goto("/");
  const toolbar = page.getByRole("toolbar", {
    name: "Writing controls",
    exact: true,
  });
  const element = toolbar.getByRole("combobox", {
    name: "Screenplay element",
    exact: true,
  });
  const editor = page.getByRole("textbox", { name: "Screenplay editor" });
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page
    .getByRole("button", { name: "New screenplay", exact: true })
    .click();
  await editor.click();
  await page.keyboard.type("MARA");

  await page.evaluate(() => {
    document.documentElement.dataset.theme = "solarized-dark";
  });
  const colors = await element
    .locator('option[value="dual-dialogue"]')
    .evaluate((option) => {
      const probe = document.createElement("div");
      probe.style.backgroundColor = "var(--raised)";
      probe.style.color = "var(--ink)";
      document.body.append(probe);
      const result = {
        optionBackground: getComputedStyle(option).backgroundColor,
        optionColor: getComputedStyle(option).color,
        themeBackground: getComputedStyle(probe).backgroundColor,
        themeColor: getComputedStyle(probe).color,
      };
      probe.remove();
      return result;
    });
  expect(colors.optionBackground).toBe(colors.themeBackground);
  expect(colors.optionColor).toBe(colors.themeColor);

  await element.selectOption("dual-dialogue");
  await expect(element).toHaveValue("dual-dialogue");
  await expect(
    editor.locator('p[data-kind="character"][data-dual="true"]'),
  ).toHaveText("MARA");
  await expect(page.locator(".statusbar")).toContainText("Dual dialogue");

  await element.selectOption("character");
  await expect(element).toHaveValue("character");
  await expect(editor.locator('p[data-dual="true"]')).toHaveCount(0);
});

test("writing controls stay in one compact row, respond to panel width, and remain reachable on mobile", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const toolbar = page.getByRole("toolbar", {
    name: "Writing controls",
    exact: true,
  });
  await expect(toolbar).toBeVisible();
  const desktop = await toolbar.boundingBox();
  expect(desktop!.height).toBeLessThanOrEqual(46);
  await page.screenshot({
    path: testInfo.outputPath("writing-toolbar-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1100, height: 900 });
  await expect(toolbar.locator(".writing-insights-tool span")).toHaveCSS(
    "display",
    "none",
  );
  expect((await toolbar.boundingBox())!.height).toBeLessThanOrEqual(46);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(toolbar).toHaveCount(0);
  await mobileSection(page, "Write");
  await expect(
    toolbar.getByRole("button", { name: "Beat sheet", exact: true }),
  ).toBeVisible();
  await expect(
    toolbar.getByRole("button", { name: "Beat guide", exact: true }),
  ).toBeVisible();

  expect(
    await toolbar.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  const controls = toolbar.locator("button:visible, select:visible");
  for (const control of await controls.all()) {
    await control.scrollIntoViewIfNeeded();
    const bounds = await control.boundingBox();
    const row = await toolbar.boundingBox();
    expect(bounds!.y).toBeGreaterThanOrEqual(row!.y);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(
      row!.y + row!.height,
    );
    expect(bounds!.x).toBeGreaterThanOrEqual(row!.x - 1);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
      row!.x + row!.width + 1,
    );
    expect(
      await control.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return element.contains(
          document.elementFromPoint(
            rect.x + rect.width / 2,
            rect.y + rect.height / 2,
          ),
        );
      }),
    ).toBe(true);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await toolbar.evaluate((element) => {
    element.scrollLeft = 0;
  });
  await page.screenshot({
    path: testInfo.outputPath("writing-toolbar-mobile.png"),
    fullPage: true,
  });
  await expect(
    toolbar.getByRole("button", { name: "Appearance settings" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "View", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Make yourself at home", exact: true }),
  ).toBeVisible();
});
