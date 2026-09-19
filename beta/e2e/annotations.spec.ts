import { test, expect } from "@playwright/test";

test("Edit menu annotations glow, edit, delete and clean up with their text", async ({
  page,
}) => {
  await page.goto("/");
  const editor = page.getByRole("textbox", { name: "Screenplay editor" });
  await editor.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText("The door opens.");
  expect(
    await editor
      .locator("p")
      .first()
      .evaluate((element) => {
        const event = new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
        });
        return element.dispatchEvent(event);
      }),
  ).toBe(true);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page
    .getByRole("button", { name: "Add annotation…", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Add Annotation" });
  await dialog
    .getByRole("textbox", { name: "Annotation" })
    .fill("Check the door.");
  await dialog.getByRole("button", { name: "Save annotation" }).click();
  const orb = editor.getByRole("button", {
    name: "Edit annotation: Check the door.",
  });
  await expect(orb).toBeVisible();
  await page.getByRole("button", { name: "View", exact: true }).click();
  await page.getByRole("button", { name: "Annotations…", exact: true }).click();
  const list = page.getByRole("dialog", { name: "Annotations", exact: true });
  await expect(list).toContainText("The door opens.");
  await list.getByRole("button", { name: "Go to annotation: Check the door." }).click();
  await expect(list).not.toBeVisible();
  await expect(editor).toBeFocused();
  await orb.click();
  const edit = page.getByRole("dialog", { name: "Edit Annotation" });
  await edit
    .getByRole("textbox", { name: "Annotation" })
    .fill("Keep it quiet.");
  await edit.getByRole("button", { name: "Save annotation" }).click();
  await expect(
    editor.getByRole("button", { name: "Edit annotation: Keep it quiet." }),
  ).toBeVisible();
  await editor.locator('p[data-kind="action"]').first().click();
  await editor.locator('p[data-kind="action"]').first().evaluate((paragraph) => {
    const text = [...paragraph.childNodes].find((node) => node.nodeType === Node.TEXT_NODE)!;
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.selectNodeContents(text);
    selection.removeAllRanges();
    selection.addRange(range);
  });
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe("The door opens.");
  await page.keyboard.press("Backspace");
  await expect(editor.locator('[data-kind="note"]')).toHaveCount(0);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(
    editor.getByRole("button", { name: "Edit annotation: Keep it quiet." }),
  ).toBeVisible();
  await editor
    .getByRole("button", { name: "Edit annotation: Keep it quiet." })
    .click();
  await edit.getByRole("button", { name: "Delete annotation" }).click();
  await expect(editor.locator(".annotation-orb")).toHaveCount(0);
});
