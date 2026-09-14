import { expect, test } from "@playwright/test";

test("native selected lines bind beats, follow earlier writing, undo, and reload", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "showOpenFilePicker", {
      value: undefined,
      configurable: true,
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "File", exact: true }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /^Open Fountain/ }).click();
  await (
    await chooser
  ).setFiles({
    name: "Lines.fountain",
    mimeType: "text/plain",
    buffer: Buffer.from(
      "INT. ROOM - DAY\n\nOne two.\nThree four.\nFive six.\n",
    ),
  });
  const editor = page.getByRole("textbox", { name: "Screenplay editor" });
  await expect(editor.locator('[data-kind="action"]')).toHaveCount(1);
  await expect(editor.locator('[data-kind="action"]')).toHaveText(
    "One two.\nThree four.\nFive six.",
  );
  await page.getByRole("button", { name: "Beat sheet", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Beat sheet", exact: true });
  await sheet.getByRole("button", { name: "Add beat", exact: true }).click();
  await sheet
    .getByRole("textbox", { name: "Beat 1 title", exact: true })
    .fill("The turn");
  await sheet
    .getByRole("button", { name: "Assign beat 1 to screenplay", exact: true })
    .click();
  await expect(sheet).not.toBeVisible();
  const guide = page.getByRole("region", {
    name: "Writing beat guide",
    exact: true,
  });
  await expect(guide).toContainText("The turn");
  await editor.locator('[data-kind="action"]').evaluate((node) => {
    const text = node.firstChild!;
    const selection = window.getSelection()!;
    selection.setBaseAndExtent(text, 11, text, 18);
    (node.closest("[contenteditable]") as HTMLElement).focus();
  });
  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.toString()))
    .toBe("ree fou");
  // Opening and closing the sheet preserves the native editor selection.
  await guide
    .getByRole("button", { name: "Edit beat sheet", exact: true })
    .click();
  await sheet
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await guide
    .getByRole("button", { name: "Assign + Next", exact: true })
    .click();
  await expect(editor).toContainText("Three four.");
  await page.getByRole("button", { name: "Beat sheet", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Show beat 1 lines 4–4" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Show beat 1 lines 4–4" }).click();
  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.toString()))
    .toBe("Three four.");
  await editor.locator('[data-kind="action"]').evaluate((node) => {
    (node.closest("[contenteditable]") as HTMLElement).focus();
    window.getSelection()!.collapse(node.firstChild!, 0);
  });
  await page.keyboard.insertText("Earlier words. ");
  // Insert a new authored line before the assigned passage; its content remains bound.
  await page.keyboard.press("Shift+Enter");
  await page.getByRole("button", { name: "Beat sheet", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Show beat 1 lines 5–5" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Show beat 1 lines 5–5" }).click();
  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.toString()))
    .toBe("Three four.");
  await page.getByRole("button", { name: "Undo", exact: true }).first().click();
  await page.getByRole("button", { name: "Beat sheet", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Show beat 1 lines 4–4" }),
  ).toBeVisible();
  await sheet
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Beat sheet", exact: true }).click();
  await page.getByRole("button", { name: "Show beat 1 lines 4–4" }).click();
  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.toString()))
    .toBe("Three four.");
  await page.screenshot({ path: testInfo.outputPath("assigned-lines.png") });
});
