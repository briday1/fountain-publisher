import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { mobileSection } from "./mobile-menu-helper";

for (const width of [390, 820]) {
  test(`PDF pages render and download at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(() => {
      Object.defineProperty(window, "showOpenFilePicker", { value: undefined });
    });
    await page.goto("/");
    await expect(
      page.getByRole("textbox", { name: "Screenplay editor" }),
    ).toBeVisible();
    await mobileSection(page, "File");
    const choosing = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: /^Open screenplay/ }).click();
    await (
      await choosing
    ).setFiles({
      name: "Mobile pages.fountain",
      mimeType: "text/plain",
      buffer: Buffer.from(
        "INT. ROOM - DAY\n\nA visible first page.\n\n===\n\nINT. ROOM - NIGHT\n\nA visible second page.",
      ),
    });
    await mobileSection(page, "View");
    await page.getByRole("button", { name: "PDF pages", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "PDF pages", exact: true });
    const first = dialog.getByRole("img", {
      name: "PDF page 1 of 2",
      exact: true,
    });
    await expect(first).toBeVisible({ timeout: 30000 });
    // Assert actual painted ink, not merely the existence of an empty canvas.
    expect(
      await first.evaluate((element) => {
        const canvas = element as HTMLCanvasElement;
        const data = canvas
          .getContext("2d")!
          .getImageData(0, 0, canvas.width, canvas.height).data;
        let ink = 0;
        for (let i = 0; i < data.length; i += 4)
          if (data[i] < 150 && data[i + 3] > 0) ink++;
        return ink;
      }),
    ).toBeGreaterThan(100);
    await dialog
      .getByRole("button", { name: "Next page", exact: true })
      .click();
    await expect(
      dialog.getByRole("img", { name: "PDF page 2 of 2" }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Next page", exact: true }),
    ).toBeDisabled();
    const downloading = page.waitForEvent("download");
    await dialog
      .getByRole("link", { name: "Download PDF", exact: true })
      .click();
    const download = await downloading;
    expect(download.suggestedFilename()).toBe("Mobile pages.pdf");
    const pdf = await PDFDocument.load(
      await readFile((await download.path())!),
    );
    expect(pdf.getPageCount()).toBe(2);
    await expect(dialog).toBeVisible();
  });
}
