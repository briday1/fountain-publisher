import { expect, test } from "@playwright/test";
import { mobileSection } from "./mobile-menu-helper";
import { readFile } from "node:fs/promises";

test("beat flow retains editing and shows cumulative pacing with a PNG export", async ({
  page,
}, testInfo) => {
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
  await page.getByRole("button", { name: /^Open screenplay/ }).click();
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
  if ((page.viewportSize()?.width ?? 1440) <= 950)
    await mobileSection(page, "View");
  await page.getByRole("button", { name: "Beat sheet", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Beat sheet", exact: true });
  await expect(sheet).toBeVisible();
  await expect(sheet).toHaveCSS("width", "816px");
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
    .getByRole("button", { name: "Beat 1 details", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Beat 1 scene" })
    .selectOption({ label: "1. INT. FIRST ROOM - DAY" });
  await page
    .getByRole("button", { name: "Beat 1 details", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Beat 3 details", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Beat 3 scene" })
    .selectOption({ label: "3. EXT. FINAL ROOM - NIGHT" });
  await page
    .getByRole("button", { name: "Beat 3 details", exact: true })
    .click();
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
    path: testInfo.outputPath("beat-sheet-presentation.png"),
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
    path: testInfo.outputPath("beat-pacing-presentation.png"),
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
  await page
    .getByRole("dialog", { name: "Beat sheet", exact: true })
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Beat sheet", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Beat 2 title" })).toHaveValue(
    "The voice",
  );
});

test("precise ranges distinguish two beats within one scene and reject invalid edits", async ({
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
    name: "Precise ranges.fountain",
    mimeType: "text/plain",
    buffer: Buffer.from(
      "INT. ROOM - DAY\n\none two three\nfour five six seven\neight nine ten\n",
    ),
  });
  await expect(editor.locator('[data-kind="scene"]')).toHaveCount(1);
  await page.getByRole("button", { name: "Beat sheet", exact: true }).click();
  for (const [index, line] of [3, 5].entries()) {
    await page.getByRole("button", { name: "Add beat", exact: true }).click();
    await page
      .getByRole("textbox", { name: `Beat ${index + 1} title`, exact: true })
      .fill(index ? "A later moment" : "The opening moment");
    await page
      .getByRole("button", { name: `Beat ${index + 1} details`, exact: true })
      .click();
    await page
      .getByRole("spinbutton", {
        name: `Beat ${index + 1} start line`,
        exact: true,
      })
      .fill(String(line));
    await page
      .getByRole("spinbutton", {
        name: `Beat ${index + 1} end line`,
        exact: true,
      })
      .fill(String(line));
    await page
      .getByRole("button", {
        name: `Apply beat ${index + 1} line range`,
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("button", {
        name: `Show beat ${index + 1} lines ${line}–${line}`,
        exact: true,
      }),
    ).toBeVisible();
  }
  await page
    .getByRole("spinbutton", { name: "Beat 2 start line", exact: true })
    .fill("6");
  await page
    .getByRole("button", { name: "Apply beat 2 line range", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Choose a range containing screenplay text",
  );
  await expect(
    page.getByRole("button", { name: "Show beat 2 lines 5–5", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("spinbutton", { name: "Beat 2 start line", exact: true })
    .fill("5");
  await page
    .getByRole("button", { name: "Apply beat 2 line range", exact: true })
    .click();
  await expect(page.getByRole("alert")).not.toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("beat-range-fields.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "View pacing graph", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Pacing Graph",
    exact: true,
  });
  await expect(
    dialog.getByRole("button", {
      name: "Beat 1: The opening moment, 0 words, lines 3–3",
      exact: true,
    }),
  ).toBeVisible();
  await dialog
    .getByRole("button", {
      name: "Beat 2: A later moment, 7 words, lines 5–5",
      exact: true,
    })
    .click();
  await expect(dialog.getByRole("status").first()).toContainText(
    "7 words · Lines 5–5",
  );
  await page.screenshot({
    path: testInfo.outputPath("beat-range-pacing.png"),
    fullPage: true,
  });
  await dialog
    .getByRole("button", { name: "Show assigned lines", exact: true })
    .click();
  await expect(editor).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.isCollapsed))
    .toBe(true);
  await expect(editor.locator(".navigation-highlight")).toHaveText(
    "eight nine ten",
  );
  await page.getByRole("button", { name: "Beat sheet", exact: true }).click();
  await page
    .getByRole("button", { name: "Beat 2 details", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Clear beat 2 range", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Show beat 2 lines 5–5", exact: true }),
  ).not.toBeVisible();
  await page
    .getByRole("dialog", { name: "Beat sheet", exact: true })
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Beat sheet", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Show beat 1 lines 3–3", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Show beat 2 lines 5–5", exact: true }),
  ).not.toBeVisible();
});

test("beat rows and graph controls remain usable on a narrow screen", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("textbox", { name: "Screenplay editor" }),
  ).toBeVisible();
  await mobileSection(page, "View");
  await page.getByRole("button", { name: "Beat sheet", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Beat sheet", exact: true });
  for (let index = 1; index <= 8; index++) {
    await sheet.getByRole("button", { name: "Add beat", exact: true }).click();
    await sheet
      .getByRole("textbox", { name: `Beat ${index} title`, exact: true })
      .fill(`Story change ${index}`);
  }
  await expect(page.locator(".beat-flow-row")).toHaveCount(8);
  await expect(sheet).toHaveCSS("overflow", "hidden");
  await expect(page.locator(".beat-sheet-dialog-scroll")).toHaveCSS(
    "overscroll-behavior",
    "contain",
  );
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  await page
    .getByRole("textbox", { name: "Beat 1 title", exact: true })
    .fill("A new opening");
  await expect(page.locator(".beat-sheet-paper")).toBeInViewport();
  const paper = await page.locator(".beat-sheet-paper").boundingBox();
  expect(paper!.width).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: testInfo.outputPath("beat-sheet-mobile.png"),
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
    path: testInfo.outputPath("beat-pacing-mobile.png"),
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(sheet).toBeVisible();
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  await expect(
    page.getByRole("textbox", { name: "Beat 1 title", exact: true }),
  ).toHaveValue("A new opening");
  await page.keyboard.press("Escape");
  await expect(sheet).not.toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Screenplay editor" }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
});
