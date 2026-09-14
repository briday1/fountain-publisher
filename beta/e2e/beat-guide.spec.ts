import { expect, test } from "@playwright/test";

const modifier = process.platform === "darwin" ? "Meta" : "Control";

test("writing guide keeps the next beat visible and assigns without replacing the passage", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "showOpenFilePicker", {
      value: undefined,
      configurable: true,
    }),
  );
  await page.goto("/");
  const editor = page.getByRole("textbox", { name: "Screenplay editor" });
  await expect(editor).toBeVisible();
  await page.getByRole("button", { name: "File", exact: true }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /^Open Fountain/ }).click();
  await (
    await chooser
  ).setFiles({
    name: "Writing guide.fountain",
    mimeType: "text/plain",
    buffer: Buffer.from(
      "INT. STUDIO - NIGHT\n\nA writer waits by the radio.\nThe signal is faint.\nA voice breaks through.\n",
    ),
  });
  await expect(editor.locator('[data-kind="scene"]')).toHaveCount(1);
  const original = await editor.elementHandle();
  await page.getByRole("button", { name: "Beat sheet", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Beat sheet", exact: true });
  for (const [index, title] of [
    "Find the voice",
    "Choose to follow",
  ].entries()) {
    await page.getByRole("button", { name: "Add beat", exact: true }).click();
    await page
      .getByRole("textbox", { name: `Beat ${index + 1} title`, exact: true })
      .fill(title);
  }
  await sheet
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await page.getByRole("button", { name: "Beat guide", exact: true }).click();
  const guide = page.getByRole("region", {
    name: "Writing beat guide",
    exact: true,
  });
  await expect(guide).toContainText("Next:");
  await expect(guide).toContainText("Find the voice");
  await editor.click();
  await page.keyboard.press(`${modifier}+End`);
  await page.keyboard.insertText(" A new sound.");
  await expect(guide).toContainText("Find the voice");
  await expect(editor).toContainText("A voice breaks through. A new sound.");
  await guide
    .getByRole("button", { name: "Assign + Next", exact: true })
    .click();
  await expect(guide).toContainText("Choose to follow");
  // No extra click: assigning restores the writing caret after the selected passage.
  await page.keyboard.type(" Still listening.");
  await expect(editor).toContainText(
    "A voice breaks through. A new sound. Still listening.",
  );
  expect(
    await original!.evaluate(
      (element) => element === document.querySelector(".screenplay-editor"),
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("writing-beat-guide-desktop.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Enter Zen mode", exact: true })
    .click();
  await expect(guide).toBeVisible();
  await expect(guide).toContainText("Choose to follow");
  await page.getByRole("button", { name: "Exit Zen", exact: true }).click();
  await guide
    .getByRole("button", { name: "Previous guide beat", exact: true })
    .click();
  await expect(guide).toContainText("Find the voice");
  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.toString()))
    .toBe("A voice breaks through. A new sound.");
  await guide
    .getByRole("button", { name: "Next guide beat", exact: true })
    .click();
  await expect(guide).toContainText("Choose to follow");
  await guide
    .getByRole("button", { name: "Edit beat sheet", exact: true })
    .click();
  await expect(sheet).toBeVisible();
  await sheet
    .getByRole("button", { name: "Assign beat 1 to screenplay", exact: true })
    .click();
  await expect(sheet).not.toBeVisible();
  await expect(guide).toContainText("Find the voice");
  await guide
    .getByRole("button", { name: "Next guide beat", exact: true })
    .click();
  await expect(guide).toContainText("Choose to follow");
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(guide).toBeVisible();
  await expect(guide).toContainText("Choose to follow");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    guide.getByRole("button", { name: "Assign + Next", exact: true }),
  ).toBeInViewport();
  expect((await guide.boundingBox())!.width).toBeLessThanOrEqual(390);
  expect((await guide.boundingBox())!.height).toBeLessThanOrEqual(42);
  await page.screenshot({
    path: testInfo.outputPath("writing-beat-guide-mobile.png"),
    fullPage: true,
  });
  await guide
    .getByRole("button", { name: "Hide writing beat guide", exact: true })
    .click();
  await expect(guide).not.toBeVisible();
  await expect(editor).toBeVisible();
});
