import type { Page } from "@playwright/test";
export async function mobileSection(
  page: Page,
  section: "File" | "Write" | "View" | "Share",
) {
  await page.locator(".mobile-file-trigger").click();
  await page
    .getByRole("group", { name: "Command categories" })
    .getByRole("button", { name: section, exact: true })
    .click();
}
