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
  await page.getByRole("button", { name: /^Open screenplay/ }).click();
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
  const exitZen = guide.getByRole("button", { name: "Exit Zen", exact: true });
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(exitZen).toBeInViewport();
    await expect(
      guide.getByRole("button", { name: "Assign + Next", exact: true }),
    ).toBeInViewport();
    await expect(page.locator(".zen-controls")).toHaveCount(0);
    const bounds = (await guide.boundingBox())!;
    const exitBounds = (await exitZen.boundingBox())!;
    const writingBounds = (await page
      .locator(".writing-scroll")
      .boundingBox())!;
    expect(bounds.height).toBeLessThanOrEqual(42);
    expect(bounds.width).toBeLessThanOrEqual(width);
    expect(exitBounds.y).toBeGreaterThanOrEqual(bounds.y);
    expect(exitBounds.y + exitBounds.height).toBeLessThanOrEqual(
      bounds.y + bounds.height,
    );
    expect(writingBounds.y).toBeCloseTo(bounds.y + bounds.height, 0);
    expect(
      await guide.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    expect(
      (await guide.locator(".writing-beat-prompt > span").boundingBox())!.width,
    ).toBeGreaterThan(45);
  }
  await page.screenshot({
    path: testInfo.outputPath("writing-beat-guide-zen-mobile.png"),
    fullPage: true,
  });
  await exitZen.click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await guide
    .getByRole("button", { name: "Previous guide beat", exact: true })
    .click();
  await expect(guide).toContainText("Find the voice");
  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.isCollapsed))
    .toBe(true);
  await expect(editor.locator(".navigation-highlight")).toHaveText(
    "A voice breaks through. A new sound.",
  );
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

test("hiding the guide in Zen retains an easy exit and the writing caret", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/");
  const editor = page.getByRole("textbox", { name: "Screenplay editor" });
  await expect(editor).toBeVisible();
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page
    .getByRole("button", { name: "New screenplay", exact: true })
    .click();
  await editor.click();
  await page.keyboard.insertText("A quiet room.");
  const original = (await editor.elementHandle())!;
  await page.getByRole("button", { name: "Beat guide", exact: true }).click();
  await page
    .getByRole("button", { name: "Enter Zen mode", exact: true })
    .click();
  const guide = page.getByRole("region", { name: "Writing beat guide" });
  await expect(
    guide.getByRole("button", { name: "Exit Zen", exact: true }),
  ).toBeInViewport();
  expect((await guide.boundingBox())!.height).toBeLessThanOrEqual(42);
  expect(
    await guide.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  await guide.getByRole("button", { name: "Hide writing beat guide" }).click();
  await expect(guide).toBeHidden();
  const exitZen = page.getByRole("button", { name: "Exit Zen", exact: true });
  await expect(exitZen).toBeInViewport();
  await expect(editor).toBeFocused();
  await page.keyboard.insertText(" Still writing.");
  await expect(editor).toHaveText("A quiet room. Still writing.");
  await exitZen.click();
  await expect(exitZen).toBeHidden();
  await expect(editor).toBeFocused();
  await page.keyboard.insertText(" Back here.");
  await expect(editor).toHaveText("A quiet room. Still writing. Back here.");
  expect(
    await original.evaluate(
      (element) =>
        element.isConnected &&
        element === document.querySelector(".screenplay-editor"),
    ),
  ).toBe(true);
});
