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
  await editor.locator('[data-kind="action"]').evaluate((node) => {
    const text = node.firstChild!;
    const selection = window.getSelection()!;
    selection.setBaseAndExtent(text, 11, text, 18);
    (node.closest("[contenteditable]") as HTMLElement).focus();
  });
  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.toString()))
    .toBe("ree fou");
  await page.evaluate(() => {
    const original = window.requestAnimationFrame;
    const callbacks: (() => void)[] = [];
    window.requestAnimationFrame = (callback) =>
      original((time) => callbacks.push(() => callback(time)));
    (
      window as unknown as { finishAssignmentFrames: () => Promise<void> }
    ).finishAssignmentFrames = () =>
      new Promise((resolve) =>
        original(() => {
          window.requestAnimationFrame = original;
          callbacks.splice(0).forEach((callback) => callback());
          resolve();
        }),
      );
  });
  await page.getByRole("button", { name: "Assign beat", exact: true }).click();
  const beatTitle = page.getByRole("textbox", { name: "New beat title" });
  await beatTitle.focus();
  // Even a delayed canvas focus callback must not pull typing out of this field.
  await page.evaluate(() =>
    (
      window as unknown as { finishAssignmentFrames: () => Promise<void> }
    ).finishAssignmentFrames(),
  );
  await expect(beatTitle).toBeFocused();
  await beatTitle.fill("The turn");
  await expect(editor).toContainText("Three four.");
  await page
    .getByRole("button", { name: "Assign selected lines", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Assign screenplay lines to a beat" }),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: "Beat Sheet" }).click();
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
  await page.getByRole("tab", { name: "Beat Sheet" }).click();
  await expect(
    page.getByRole("button", { name: "Show beat 1 lines 5–5" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Show beat 1 lines 5–5" }).click();
  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.toString()))
    .toBe("Three four.");
  await page.getByRole("button", { name: "Undo", exact: true }).first().click();
  await page.getByRole("tab", { name: "Beat Sheet" }).click();
  await expect(
    page.getByRole("button", { name: "Show beat 1 lines 4–4" }),
  ).toBeVisible();
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: "Beat Sheet" }).click();
  await page.getByRole("button", { name: "Show beat 1 lines 4–4" }).click();
  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.toString()))
    .toBe("Three four.");
  await page.screenshot({ path: testInfo.outputPath("assigned-lines.png") });
});
