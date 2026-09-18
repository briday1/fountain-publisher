import { test, expect } from "@playwright/test";

const source =
  ".THE CABIN #12#\n\n!A **bold** arrival.\nStill raining.\n\n@McKay\n(quietly)\nStay *here*.\n\n>FADE OUT.";
for (const withHtml of [false, true]) {
  test(`pasted Fountain formats immediately${withHtml ? " with HTML on the clipboard" : ""}`, async ({
    page,
  }) => {
    await page.goto("/");
    const editor = page.getByRole("textbox", { name: "Screenplay editor" });
    await expect(editor).toBeVisible();
    await editor.click();
    await page.keyboard.press("ControlOrMeta+a");
    await editor.evaluate(
      (element, { source, withHtml }) => {
        const clipboardData = new DataTransfer();
        clipboardData.setData("text/plain", source);
        if (withHtml)
          clipboardData.setData("text/html", `<pre>${source}</pre>`);
        element.dispatchEvent(
          new ClipboardEvent("paste", {
            clipboardData,
            bubbles: true,
            cancelable: true,
          }),
        );
      },
      { source, withHtml },
    );
    await expect(editor.locator('[data-kind="scene"]')).toHaveText("THE CABIN");
    await expect(editor.locator('[data-kind="scene"]')).toHaveAttribute(
      "data-scene-number",
      "12",
    );
    await expect(editor.locator('[data-kind="character"]')).toHaveText("McKay");
    await expect(editor.locator('[data-kind="parenthetical"]')).toHaveText(
      "(quietly)",
    );
    await expect(editor.locator('[data-kind="dialogue"]')).toHaveText(
      "Stay here.",
    );
    await expect(editor.locator("strong")).toHaveText("bold");
    await expect(editor.locator("em")).toHaveText("here");
    await page.keyboard.press("ControlOrMeta+z");
    await expect(editor).not.toContainText("THE CABIN");
    await page.keyboard.press("ControlOrMeta+Shift+z");
    await expect(editor.locator('[data-kind="scene"]')).toHaveText("THE CABIN");
    await expect(
      page.getByText("Saved on this device", { exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(editor.locator('[data-kind="scene"]')).toHaveText("THE CABIN");
    await expect(editor.locator("strong")).toHaveText("bold");
  });
}
