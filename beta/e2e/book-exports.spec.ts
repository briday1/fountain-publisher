import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { strFromU8, unzipSync } from "fflate";
import { parseMarkdown, serializeMarkdown } from "../src/core/markdown";

test.use({ serviceWorkers: "block" });
async function setup(page: Page) {
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
          id: "book-export",
          email: "writer@example.test",
          privateTester: true,
        },
        premium: true,
        billingAvailable: false,
      },
    }),
  );
  await page.route("**/api/library**", (route) =>
    route.fulfill({
      json: {
        items: [],
        breadcrumbs: [],
        canWrite: true,
        usage: {
          usedBytes: 0,
          currentBytes: 0,
          historyBytes: 0,
          quotaBytes: 1073741824,
          historyLimit: null,
          fileCount: 0,
          folderCount: 0,
          versionCount: 0,
        },
      },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("button", { name: /^Open…/ }).click();
  await page.getByRole("tab", { name: "Local", exact: true }).click();
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Open a local file", exact: true })
    .click();
  const doc = parseMarkdown(
    "## Chapter 1\n\nThe coast held **bold secrets** and *quiet hopes*.[^source]\n\n" +
      "The light reached the coast before the village woke. ".repeat(35) +
      "\n\nAnother paragraph, with café and a final word.\n\n---\n\nAfter the scene break.\n\n## Chapter 2\n\nThe story continues here.\n\n[^source]: Coastal records, 1924.",
  );
  doc.titlePage.title = "The Coast";
  doc.titlePage.author = "Alex Morgan";
  doc.titlePage.extra = { Dedication: "For the keepers." };
  await (
    await chooser
  ).setFiles({
    name: "The Coast.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(serializeMarkdown(doc)),
  });
  await expect(
    page.getByRole("textbox", { name: "Book editor" }),
  ).toContainText("The story continues here.");
}
async function exportDialog(page: Page) {
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("button", { name: "Export…", exact: true }).click();
  return page.getByRole("dialog", { name: "Export book", exact: true });
}

test("Book exports download real paperback/manuscript PDFs, EPUB and RTF from the selected controls", async ({
  page,
}, testInfo) => {
  await setup(page);
  for (const [name, style, size, width, height] of [
    ["book", "book", "6x9", 432, 648],
    ["compact", "book", "5x8", 360, 576],
    ["manuscript", "manuscript", "a4", 595.28, 841.89],
  ] as const) {
    const dialog = await exportDialog(page);
    await dialog
      .getByRole("combobox", { name: "PDF style", exact: true })
      .selectOption(style);
    await dialog
      .getByRole("combobox", { name: "Page size", exact: true })
      .selectOption(size);
    if (name === "book")
      await dialog.screenshot({
        path: testInfo.outputPath("book-export-options.png"),
      });
    const event = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "Export", exact: true }).click();
    const download = await event;
    expect(download.suggestedFilename()).toBe("The Coast.pdf");
    const file = testInfo.outputPath(`${name}.pdf`);
    await download.saveAs(file);
    const pdf = await PDFDocument.load(await readFile(file));
    expect(pdf.getPageCount()).toBeGreaterThan(2);
    expect(pdf.getPage(0).getWidth()).toBeCloseTo(width);
    expect(pdf.getPage(0).getHeight()).toBeCloseTo(height);
    await expect(dialog).toBeHidden();
  }
  for (const format of ["epub", "rtf"] as const) {
    const dialog = await exportDialog(page);
    await dialog
      .getByRole("combobox", { name: "Export format", exact: true })
      .selectOption(format);
    await expect(
      dialog.getByRole("combobox", { name: "Page size", exact: true }),
    ).toHaveCount(0);
    const event = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "Export", exact: true }).click();
    const download = await event,
      file = testInfo.outputPath(`book.${format}`);
    await download.saveAs(file);
    expect(download.suggestedFilename()).toBe(`The Coast.${format}`);
    const bytes = await readFile(file);
    const text =
      format === "epub"
        ? strFromU8(unzipSync(bytes)["EPUB/book.xhtml"])
        : bytes.toString();
    expect(text).toContain("The story continues here.");
    expect(text).toContain("Coastal records, 1924.");
  }
});

test("mobile Book footnotes insert at the cursor, edit by marker, and export with compact options", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  const editor = page.getByRole("textbox", { name: "Book editor" });
  const last = editor.locator("p").last();
  await last.click();
  await page.keyboard.press("End");
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("button", { name: "Footnote…", exact: true }).click();
  const note = page.getByRole("dialog", { name: "Add footnote", exact: true });
  await note
    .getByRole("textbox", { name: "Footnote", exact: true })
    .fill("Added from mobile.");
  await note
    .getByRole("button", { name: "Save footnote", exact: true })
    .click();
  const marker = editor.getByRole("button", {
    name: "Footnote 2: Added from mobile.",
    exact: true,
  });
  await expect(marker).toBeVisible();
  await expect(last).toContainText("The story continues here.");
  await expect(last.locator(".book-footnote-marker")).toHaveCount(1);
  await marker.click();
  const edit = page.getByRole("dialog", { name: "Edit footnote", exact: true });
  await edit
    .getByRole("textbox", { name: "Footnote", exact: true })
    .fill("Revised on mobile.");
  await edit
    .getByRole("button", { name: "Save footnote", exact: true })
    .click();
  await expect(
    editor.getByRole("button", {
      name: "Footnote 2: Revised on mobile.",
      exact: true,
    }),
  ).toBeVisible();
  const dialog = await exportDialog(page);
  await dialog
    .getByRole("combobox", { name: "PDF style", exact: true })
    .selectOption("manuscript");
  await expect(
    dialog.getByRole("combobox", { name: "Page size", exact: true }),
  ).toHaveValue("letter");
  await dialog.screenshot({
    path: testInfo.outputPath("mobile-book-export.png"),
  });
  const event = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Export", exact: true }).click();
  const download = await event;
  await download.saveAs(testInfo.outputPath("mobile-manuscript.pdf"));
  await expect(dialog).toBeHidden();
});
