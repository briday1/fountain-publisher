import { expect, test } from "@playwright/test";

test.use({
  viewport: { width: 1024, height: 768 },
  hasTouch: true,
  serviceWorkers: "block",
});

test.beforeEach(async ({ page }) => {
  await page.route("**/src/product.ts*", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: "export const isWriteShape = true;",
    }),
  );
  await page.route("**/api/account", (route) =>
    route.fulfill({
      json: {
        account: {
          id: "ipad-writer",
          email: "writer@example.test",
          privateTester: true,
        },
        premium: true,
        privateMode: true,
        collaborationAvailable: true,
      },
    }),
  );
  await page.route("**/api/shared", (route) =>
    route.fulfill({ json: { shares: [], canReadShared: true } }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("textbox", { name: "Screenplay editor" }),
  ).toBeVisible();
});

test("desktop planning tools follow zoom and beat numbers center on their title boxes", async ({
  page,
}, testInfo) => {
  const zoom = await page
    .getByRole("group", { name: "Page zoom controls" })
    .boundingBox();
  const sheetButton = page.getByRole("button", {
    name: "Beat sheet",
    exact: true,
  });
  const sheetBounds = await sheetButton.boundingBox();
  const guide = await page
    .getByRole("button", { name: "Beat guide", exact: true })
    .boundingBox();
  const outline = await page
    .getByRole("button", { name: "Toggle outline", exact: true })
    .boundingBox();
  expect(sheetBounds!.x).toBeGreaterThanOrEqual(zoom!.x + zoom!.width);
  expect(guide!.x).toBeGreaterThan(sheetBounds!.x);
  expect(outline!.x).toBeGreaterThan(guide!.x);
  await sheetButton.click();
  const sheet = page.getByRole("dialog", { name: "Beat sheet", exact: true });
  await sheet.getByRole("button", { name: "Add beat", exact: true }).click();
  await sheet
    .getByRole("textbox", { name: "Beat 1 title", exact: true })
    .fill("An unexpected arrival");
  for (const width of [1024, 1366, 768, 390]) {
    await page.setViewportSize({ width, height: 768 });
    const badge = await sheet
      .locator(".beat-flow-number")
      .first()
      .boundingBox();
    const title = await sheet
      .getByRole("textbox", { name: "Beat 1 title", exact: true })
      .boundingBox();
    expect(
      Math.abs(badge!.y + badge!.height / 2 - title!.y - title!.height / 2),
    ).toBeLessThanOrEqual(1);
  }
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.screenshot({
    path: testInfo.outputPath("writeshape-ipad-beats.png"),
  });
});

test("storage stays within the iPad dialog, keeps its position and creates an independent file", async ({
  page,
}, testInfo) => {
  const files = Array.from({ length: 24 }, (_, i) => ({
    id: `file-${i}`,
    parent: "",
    name: `Script ${i + 1}.fountain`,
    kind: "file",
    revision: 1,
    bytes: 15,
  }));
  let created: Record<string, unknown> | undefined;
  await page.route("**/api/library**", async (route) => {
    const url = new URL(route.request().url());
    const json = url.pathname.endsWith("/shared")
      ? { shares: [], canReadShared: true }
      : route.request().method() === "POST"
        ? (created = {
            ...route.request().postDataJSON(),
            id: "fresh-file",
            revision: 1,
          })
        : url.pathname.endsWith("/fresh-file")
          ? created
          : {
              items: files,
              breadcrumbs: [],
              canWrite: true,
              usage: {
                usedBytes: 1500,
                currentBytes: 1200,
                historyBytes: 300,
                quotaBytes: 10000000,
                fileCount: 24,
                folderCount: 0,
                versionCount: 5,
                historyLimit: null,
              },
            };
    await route.fulfill({ json });
  });
  await page
    .getByRole("textbox", { name: "Screenplay editor" })
    .fill("Keep my existing draft.");
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("button", { name: "Files…", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Files", exact: true });
  await dialog.getByRole("tab", { name: "WriteShape", exact: true }).click();
  const sidebar = dialog.getByRole("complementary", {
    name: "Library locations and storage",
  });
  await expect(
    sidebar.getByRole("button", { name: "My Storage", exact: true }),
  ).toBeVisible();
  for (const height of [768, 640]) {
    await page.setViewportSize({ width: 1024, height });
    const storage = sidebar.getByLabel("Storage usage");
    const before = await storage.boundingBox();
    await sidebar
      .getByRole("button", { name: "Shared with me", exact: true })
      .click();
    await expect(
      dialog.getByRole("region", { name: "Shared with me", exact: true }),
    ).toBeVisible();
    const after = await storage.boundingBox();
    expect(Math.abs(before!.y - after!.y)).toBeLessThanOrEqual(1);
    await sidebar
      .getByRole("button", { name: "My Storage", exact: true })
      .click();
    await expect(
      dialog.getByRole("button", { name: "Open file", exact: true }),
    ).toBeInViewport();
    expect(
      await dialog.evaluate(
        (node) => node.scrollHeight <= node.clientHeight + 1,
      ),
    ).toBe(true);
    const frame = await dialog.boundingBox();
    expect(frame!.y).toBeGreaterThanOrEqual(0);
    expect(frame!.y + frame!.height).toBeLessThanOrEqual(height);
  }
  await dialog.getByRole("button", { name: "New", exact: true }).click();
  await dialog
    .getByRole("textbox", { name: "New file name", exact: true })
    .fill("Fresh story");
  await page.screenshot({
    path: testInfo.outputPath("writeshape-ipad-storage.png"),
  });
  await dialog
    .getByRole("button", { name: "Create file", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  expect(created?.content).not.toContain("Keep my existing draft.");
  expect(created?.name).toBe("Fresh story.fountain");
  await expect(page.getByRole("contentinfo")).toContainText(
    "Saved to WriteShape",
  );
  await expect(page.getByRole("contentinfo")).not.toContainText(
    "Saved on this device",
  );
  await expect(page.locator(".document-view-context")).toHaveCount(0);
  await page.getByRole("tab").first().click();
  await expect(
    page.getByRole("textbox", { name: "Screenplay editor" }),
  ).toContainText("Keep my existing draft.");
});

test("split scene numbers stay inside the page while resizing and zooming", async ({
  page,
}, testInfo) => {
  const editor = page.getByRole("textbox", { name: "Screenplay editor" });
  await editor.fill(
    "INT. A VERY LONG SCENE HEADING " + "ROOM".repeat(35) + " - DAY",
  );
  await page
    .getByRole("combobox", { name: "Screenplay element", exact: true })
    .selectOption("scene");
  await page
    .getByRole("button", { name: "Split editor right", exact: true })
    .click();
  await page
    .getByRole("separator", { name: "Resize document panes" })
    .press("End");
  for (const zoom of [60, 100, 200]) {
    await page
      .getByRole("combobox", { name: "Page zoom", exact: true })
      .selectOption(String(zoom));
    const scene = page
      .locator('.pane-1 .screenplay-editor p[data-kind="scene"]')
      .first();
    expect(
      await scene.evaluate(
        (node) => getComputedStyle(node, "::before").position,
      ),
    ).toBe("static");
    const paragraph = await scene.boundingBox();
    const paper = await page.locator(".pane-1 .screenplay-paper").boundingBox();
    expect(paragraph!.x).toBeGreaterThanOrEqual(paper!.x);
    expect(paragraph!.x + paragraph!.width).toBeLessThanOrEqual(
      paper!.x + paper!.width + 1,
    );
    expect(
      await scene.evaluate((node) => node.scrollWidth <= node.clientWidth + 1),
    ).toBe(true);
  }
  await page.screenshot({
    path: testInfo.outputPath("writeshape-ipad-split.png"),
  });
});

test("desktop Annotate preserves the selected writing and opens the annotation editor", async ({
  page,
}) => {
  const editor = page.getByRole("textbox", { name: "Screenplay editor" });
  await expect(page.locator(".app-header .save-button")).toHaveCount(0);
  await editor.fill("A thought worth annotating.");
  await editor.press("Home");
  await editor.press("Shift+End");
  const annotate = page
    .getByRole("toolbar", { name: "Writing controls" })
    .getByRole("button", { name: "Add annotation", exact: true });
  await expect(annotate).toBeEnabled();
  await annotate.click();
  const dialog = page.getByRole("dialog", { name: "Annotation", exact: true });
  await dialog
    .getByRole("textbox", { name: "Annotation", exact: true })
    .fill("Keep this detail.");
  await dialog
    .getByRole("button", { name: "Save annotation", exact: true })
    .click();
  await expect(editor).toContainText("A thought worth annotating.");
  await expect(
    editor.getByRole("button", {
      name: "Edit annotation: Keep this detail.",
      exact: true,
    }),
  ).toBeVisible();
});

test("Zen focuses the active pane and restores tabs, split widths and writing on exit", async ({
  page,
}, testInfo) => {
  await page
    .getByRole("textbox", { name: "Screenplay editor" })
    .fill("Keep my focused writing.");
  await page
    .getByRole("button", { name: "Split editor right", exact: true })
    .click();
  const divider = page.getByRole("separator", {
    name: "Resize document panes",
  });
  await divider.press("End");
  const original = await page
    .locator(".pane-1 .screenplay-editor")
    .elementHandle();
  await page
    .getByRole("button", { name: "Enter Zen mode", exact: true })
    .click();
  await expect(page.locator(".document-pane-header").first()).not.toBeVisible();
  await expect(divider).not.toBeVisible();
  await expect(page.locator(".document-pane:visible")).toHaveCount(1);
  await expect(page.locator(".pane-1")).toBeVisible();
  const pane = await page.locator(".pane-1").boundingBox();
  expect(pane!.width).toBeGreaterThanOrEqual(1000);
  await expect(page.locator(".pane-1 .screenplay-editor")).toContainText(
    "Keep my focused writing.",
  );
  await page.screenshot({
    path: testInfo.outputPath("writeshape-ipad-zen.png"),
  });
  await page.getByRole("button", { name: "Exit Zen", exact: true }).click();
  await expect(page.locator(".document-pane:visible")).toHaveCount(2);
  await expect(divider).toHaveAttribute("aria-valuenow", "75");
  expect(
    await original!.evaluate(
      (node) => node === document.querySelector(".pane-1 .screenplay-editor"),
    ),
  ).toBe(true);
});
