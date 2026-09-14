import { expect, test, type ElementHandle, type Page } from "@playwright/test";

const modifier = process.platform === "darwin" ? "Meta" : "Control";
const fullscreen = (page: Page) =>
  page.evaluate(() => document.fullscreenElement !== null);

async function sameEditor(page: Page, original: ElementHandle) {
  await expect(
    page.getByRole("textbox", { name: "Screenplay editor" }),
  ).toBeVisible();
  expect(
    await original.evaluate(
      (element) =>
        element.isConnected &&
        element === document.querySelector(".screenplay-editor"),
    ),
  ).toBe(true);
}

async function expectZen(page: Page) {
  await expect(
    page.getByRole("button", { name: "Exit Zen", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".app-header")).toBeHidden();
  await expect(page.locator(".statusbar")).toBeHidden();
  await expect(
    page.getByRole("toolbar", { name: "Writing controls", exact: true }),
  ).toBeHidden();
  await expect(
    page.getByRole("complementary", { name: "Scene outline" }),
  ).toBeHidden();
  await expect(
    page.getByRole("complementary", { name: "Screenplay insights" }),
  ).toBeHidden();
}

async function expectWorkspace(page: Page) {
  await expect(page.locator(".app-header")).toBeVisible();
  await expect(page.locator(".statusbar")).toBeVisible();
  await expect(
    page.getByRole("toolbar", { name: "Writing controls", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("complementary", { name: "Scene outline" }),
  ).toBeVisible();
  await expect(
    page.getByRole("complementary", { name: "Screenplay insights" }),
  ).toBeVisible();
}

test("native fullscreen enters and exits without replacing the editor or its writing", async ({
  page,
}) => {
  await page.goto("/");
  const editor = page.getByRole("textbox", { name: "Screenplay editor" });
  await expect(editor).toBeVisible();
  await expectWorkspace(page);
  const original = (await editor.elementHandle())!;
  await editor.click();
  await page.keyboard.press(`${modifier}+a`);
  await page.keyboard.insertText("A window becomes a writing room.");
  await expect(editor).toHaveText("A window becomes a writing room.");
  expect(await fullscreen(page)).toBe(false);

  await page.getByRole("button", { name: "Full screen", exact: true }).click();
  await expect.poll(() => fullscreen(page)).toBe(true);
  await expect(
    page.getByRole("button", { name: "Exit full screen", exact: true }),
  ).toBeVisible();
  await sameEditor(page, original);
  await expect(editor).toBeFocused();
  await page.keyboard.insertText(" The story stays here.");
  await expect(editor).toContainText("The story stays here.");

  await page
    .getByRole("button", { name: "Exit full screen", exact: true })
    .click();
  await expect.poll(() => fullscreen(page)).toBe(false);
  await expectWorkspace(page);
  await sameEditor(page, original);
  await expect(editor).toHaveText(
    "A window becomes a writing room. The story stays here.",
  );
  await expect(editor).toBeFocused();
});

test("Zen keeps the same usable editor and Escape closes overlays before leaving Zen", async ({
  page,
}) => {
  await page.goto("/");
  const editor = page.getByRole("textbox", { name: "Screenplay editor" });
  await expect(editor).toBeVisible();
  const original = (await editor.elementHandle())!;
  await page.getByRole("button", { name: "Insert", exact: true }).click();
  await page.getByRole("button", { name: "Title page…", exact: true }).click();
  const titleDialog = page.getByRole("dialog", {
    name: "Title page",
    exact: true,
  });
  await titleDialog
    .getByRole("textbox", { name: "Title", exact: true })
    .fill("A Quiet Writing Room");
  await titleDialog.getByRole("button", { name: "Save title page" }).click();

  await page
    .getByRole("button", { name: "Enter Zen mode", exact: true })
    .click();
  await expectZen(page);
  await sameEditor(page, original);
  await editor.click();
  await page.keyboard.press(`${modifier}+End`);
  await page.keyboard.insertText(" A sentence written in Zen.");
  await expect(editor).toContainText("A sentence written in Zen.");

  const title = page.getByRole("region", { name: "Title page preview" });
  await title.locator('[data-title-field="title"]').dblclick();
  await expect(titleDialog).toBeVisible();
  const draftTitle = titleDialog.getByRole("textbox", {
    name: "Title",
    exact: true,
  });
  await draftTitle.fill("An unsaved title stays here");
  await page.keyboard.press(`${modifier}+f`);
  await expect(titleDialog).toBeVisible();
  await expect(draftTitle).toHaveValue("An unsaved title stays here");
  const find = page.getByRole("textbox", {
    name: "Find in screenplay",
    exact: true,
  });
  await expect(find).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(titleDialog).toBeHidden();
  await expectZen(page);
  await sameEditor(page, original);

  await page.keyboard.press(`${modifier}+f`);
  await expect(find).toBeVisible();
  await find.fill("sentence");
  await find.press("Enter");
  await expect(page.locator(".match-count")).toHaveText("1 of 1");
  await expect
    .poll(() =>
      page.evaluate(() => window.getSelection()?.toString().toLowerCase()),
    )
    .toBe("sentence");
  await page.keyboard.press("Escape");
  await expect(find).toBeHidden();
  await expectZen(page);
  await expect(editor).toBeFocused();
  await sameEditor(page, original);

  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Exit Zen", exact: true }),
  ).toBeHidden();
  await expectWorkspace(page);
  await sameEditor(page, original);
  await expect(editor).toContainText("A sentence written in Zen.");
  await expect(editor).toBeFocused();
  await page.keyboard.insertText("thought");
  await expect(editor).toContainText("A thought written in Zen.");
});

test("leaving Zen restores the workspace while native fullscreen remains active", async ({
  page,
}) => {
  await page.goto("/");
  const editor = page.getByRole("textbox", { name: "Screenplay editor" });
  await expect(editor).toBeVisible();
  const original = (await editor.elementHandle())!;
  const writing = await editor.textContent();
  await page.getByRole("button", { name: "Full screen", exact: true }).click();
  await expect.poll(() => fullscreen(page)).toBe(true);
  await page
    .getByRole("button", { name: "Enter Zen mode", exact: true })
    .click();
  await expectZen(page);
  await sameEditor(page, original);

  await page.getByRole("button", { name: "Exit Zen", exact: true }).click();
  await expectWorkspace(page);
  expect(await fullscreen(page)).toBe(true);
  await sameEditor(page, original);
  expect(await editor.textContent()).toBe(writing);

  await page
    .getByRole("button", { name: "Exit full screen", exact: true })
    .click();
  await expect.poll(() => fullscreen(page)).toBe(false);
  await sameEditor(page, original);
});
