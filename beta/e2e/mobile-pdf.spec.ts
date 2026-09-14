import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { mobileSection } from "./mobile-menu-helper";

for (const width of [390, 820]) {
  test(`mobile PDF offers a centered download without a preview at ${width}px`, async ({
    page,
  }) => {
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
    const button = dialog.getByRole("link", {
      name: "Download PDF",
      exact: true,
    });
    await expect(button).toBeVisible({ timeout: 30000 });
    await expect(dialog.locator("iframe, canvas, object, embed")).toHaveCount(
      0,
    );
    const area = await dialog.locator(".pdf-view").boundingBox();
    const bounds = await button.boundingBox();
    expect(
      Math.abs(bounds!.x + bounds!.width / 2 - area!.x - area!.width / 2),
    ).toBeLessThan(2);
    expect(
      Math.abs(bounds!.y + bounds!.height / 2 - area!.y - area!.height / 2),
    ).toBeLessThan(2);
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
