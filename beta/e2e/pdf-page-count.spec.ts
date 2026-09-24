import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";

async function openFountain(page: Page, source: string, marker: string) {
  await page.getByRole("button", { name: "File", exact: true }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /^Open screenplay/ }).click();
  await (
    await chooser
  ).setFiles({
    name: "Counted pages.fountain",
    mimeType: "text/plain",
    buffer: Buffer.from(source),
  });
  await expect(
    page.getByRole("textbox", { name: "Screenplay editor" }),
  ).toContainText(marker);
}

async function verifyDownloadedCount(
  page: Page,
  testInfo: TestInfo,
  filename: string,
  expected: number,
  expectedProgress: string,
) {
  const metric = page.getByLabel("PDF page count", { exact: true });
  await expect(metric).toHaveAttribute("aria-busy", "false", {
    timeout: 30000,
  });
  await expect(metric.locator("strong")).toHaveText(expectedProgress);
  await expect(metric).toContainText("PDF pages");
  await expect(page.getByText(/est\.\s*pages/i)).toHaveCount(0);
  // Insights must have generated progress before preview or download is opened.
  await expect(
    page.getByRole("dialog", { name: "PDF pages", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "File", exact: true }).click();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export…", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Export", exact: true })
    .getByRole("button", { name: "Export", exact: true })
    .click();
  const download = await downloading;
  const path = testInfo.outputPath(`${filename}.pdf`);
  await download.saveAs(path);
  const pdf = await PDFDocument.load(await readFile(path));
  expect(pdf.getPageCount()).toBe(expected);
  return pdf;
}

test("Insights counts generated screenplay pages without title pages, including explicit breaks, dialogue continuation and A4", async ({
  page,
}, testInfo) => {
  test.setTimeout(60000);
  await page.addInitScript(() => {
    Object.defineProperty(window, "showOpenFilePicker", {
      value: undefined,
      configurable: true,
    });
  });
  await page.goto("/");
  await expect(
    page.getByRole("textbox", { name: "Screenplay editor" }),
  ).toBeVisible();
  await openFountain(
    page,
    "INT. STUDIO - DAY\n\nA short opening scene.",
    "A short opening scene.",
  );
  await verifyDownloadedCount(page, testInfo, "without-title", 1, "⅛");

  await page.getByRole("button", { name: "Insert", exact: true }).click();
  await page.getByRole("button", { name: "Title page…", exact: true }).click();
  const title = page.getByRole("dialog", { name: "Title page", exact: true });
  await title
    .getByRole("textbox", { name: "Title", exact: true })
    .fill("Counted Pages");
  await title
    .getByRole("textbox", { name: "Author", exact: true })
    .fill("A Writer");
  await title.getByRole("button", { name: "Save title page" }).click();
  await expect(
    page.getByRole("region", { name: "Title page preview" }),
  ).toContainText("Counted Pages");
  await verifyDownloadedCount(page, testInfo, "with-title", 2, "⅛");

  const dialogue = Array.from(
    { length: 70 },
    (_, index) => `Dialogue line ${String(index + 1).padStart(2, "0")}.`,
  ).join("\n");
  await openFountain(
    page,
    `Title: Counted Pages\nAuthor: A Writer\n\nINT. STUDIO - DAY\n\nA short opening scene.\n\n===\n\nINT. SECOND ROOM - NIGHT\n\nMARA\n${dialogue}`,
    "Dialogue line 70.",
  );
  const letter = await verifyDownloadedCount(
    page,
    testInfo,
    "dialogue-and-page-break",
    4,
    "2⅜",
  );
  expect(letter.getPage(0).getSize()).toEqual({ width: 612, height: 792 });

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const settings = page.getByRole("dialog", { name: "Make yourself at home" });
  await settings
    .getByRole("combobox", { name: "Paper size", exact: true })
    .selectOption("a4");
  await expect(
    page.getByLabel("PDF page count", { exact: true }),
  ).toHaveAttribute("aria-busy", "true");
  await settings
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  const a4 = await verifyDownloadedCount(page, testInfo, "a4-pages", 4, "2⅜");
  expect(a4.getPage(0).getWidth()).toBeCloseTo(595.28);
  expect(a4.getPage(0).getHeight()).toBeCloseTo(841.89);
  await openFountain(
    page,
    "Title: Counted Pages\n\n!" +
      Array.from(
        { length: 9 * 55 + 28 },
        (_, index) => `Written row ${index + 1}.`,
      ).join("\n"),
    "Written row 523.",
  );
  await verifyDownloadedCount(
    page,
    testInfo,
    "nine-and-five-eighths-plus-title",
    11,
    "9⅝",
  );
});
