import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("beat flow retains editing and shows cumulative pacing with a PNG export", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "showOpenFilePicker", {
      value: undefined,
      configurable: true,
    }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("textbox", { name: "Screenplay editor" }),
  ).toBeVisible();
  const sentence = "one two three four five six seven eight nine ten";
  const source = `INT. FIRST ROOM - DAY\n\n${sentence}\n\nINT. SECOND ROOM - DAY\n\n${sentence} ${sentence}\n\nEXT. FINAL ROOM - NIGHT\n\n${sentence} ${sentence} ${sentence}\n`;
  await page.getByRole("button", { name: "File", exact: true }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /^Open Fountain/ }).click();
  await (
    await chooser
  ).setFiles({
    name: "Pacing.fountain",
    mimeType: "text/plain",
    buffer: Buffer.from(source),
  });
  await expect(
    page
      .getByRole("textbox", { name: "Screenplay editor" })
      .locator('[data-kind="scene"]'),
  ).toHaveCount(3);
  await page.getByRole("tab", { name: "Beat Sheet" }).click();
  await page
    .getByRole("textbox", { name: "Premise", exact: true })
    .fill("A writer follows a voice through three rooms.");
  for (const [i, title] of ["The voice", "A choice", "The answer"].entries()) {
    await page.getByRole("button", { name: "Add beat", exact: true }).click();
    await page
      .getByRole("textbox", { name: `Beat ${i + 1} title` })
      .fill(title);
  }
  await page
    .getByRole("combobox", { name: "Beat 1 scene" })
    .selectOption({ label: "1. INT. FIRST ROOM - DAY" });
  await page
    .getByRole("combobox", { name: "Beat 3 scene" })
    .selectOption({ label: "3. EXT. FINAL ROOM - NIGHT" });
  await page
    .getByRole("button", { name: "Beat 2 details", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Beat 2 description" })
    .fill("She must decide whether to answer.");
  await page
    .getByRole("combobox", { name: "Beat 2 act" })
    .selectOption("Act II");
  await page
    .getByRole("button", { name: "Beat 2 details", exact: true })
    .click();
  await expect(page.locator(".beat-flow-row")).toHaveCount(3);
  await expect(page.locator(".beat-flow-number").first()).toHaveCSS(
    "border-radius",
    "50%",
  );
  await page.screenshot({
    path: "test-results/beat-sheet-presentation.png",
    fullPage: true,
  });

  await page
    .getByRole("button", { name: "View pacing graph", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Pacing Graph",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS("width", "1100px");
  await dialog
    .getByRole("button", {
      name: "Beat 2: A choice, 15 words, estimated",
      exact: true,
    })
    .click();
  await expect(dialog.getByRole("status").first()).toContainText(
    "15 words · Estimated position",
  );
  await dialog.getByText("View pacing data", { exact: true }).click();
  const rows = dialog.getByRole("table").getByRole("row");
  await expect(rows.nth(1)).toContainText("0");
  await expect(rows.nth(2)).toContainText("15");
  await expect(rows.nth(3)).toContainText("30");
  await page.screenshot({
    path: "test-results/beat-pacing-presentation.png",
    fullPage: true,
  });
  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Save PNG", exact: true }).click();
  const image = await download;
  expect(image.suggestedFilename()).toBe("beat-pacing.png");
  const bytes = await readFile((await image.path())!);
  expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(bytes.length).toBeGreaterThan(5000);
  await dialog
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();

  await page
    .getByRole("button", { name: "Reorder beat 1: The voice", exact: true })
    .focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("textbox", { name: "Beat 2 title" })).toHaveValue(
    "The voice",
  );
  await page
    .getByRole("button", { name: "Beat 1 details", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Beat 1 description" }),
  ).toHaveValue("She must decide whether to answer.");
  await expect(page.getByRole("combobox", { name: "Beat 1 act" })).toHaveValue(
    "Act II",
  );
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: "Beat Sheet" }).click();
  await expect(page.getByRole("textbox", { name: "Beat 2 title" })).toHaveValue(
    "The voice",
  );
});

test("beat rows and graph controls remain usable on a narrow screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("textbox", { name: "Screenplay editor" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Beat Sheet" }).click();
  await page.getByRole("button", { name: "Beat guide", exact: true }).click();
  await page
    .getByRole("button", { name: "Add story structure", exact: true })
    .click();
  await expect(page.locator(".beat-flow-row")).toHaveCount(15);
  await page
    .getByRole("textbox", { name: "Beat 1 title", exact: true })
    .fill("A new opening");
  await expect(page.locator(".beat-sheet-paper")).toBeInViewport();
  const paper = await page.locator(".beat-sheet-paper").boundingBox();
  expect(paper!.width).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "test-results/beat-sheet-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "View pacing graph", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Pacing Graph",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  const modal = await dialog.boundingBox();
  expect(modal!.width).toBeLessThanOrEqual(390);
  await expect(
    dialog.getByRole("button", { name: "Save PNG", exact: true }),
  ).toBeInViewport();
  await page.screenshot({
    path: "test-results/beat-pacing-mobile.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Beat 1 title", exact: true }),
  ).toHaveValue("A new opening");
});
