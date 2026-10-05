import { expect, test } from "@playwright/test";

test("the app carries readable and downloadable licenses, including when installed offline", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("textbox", { name: "Screenplay editor" }),
  ).toBeVisible();
  // The brand opens Help on both compact and desktop layouts.
  await page.locator("button.brand").click();
  await expect(
    page.getByRole("link", { name: "Third-party licenses", exact: true }),
  ).toHaveCount(0);
  if (process.env.TEST_BASE_URL) {
    await expect
      .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), {
        timeout: 30000,
      })
      .toBe(true);
    await context.setOffline(true);
  }
  const licenses = await context.newPage();
  await licenses.goto("/licenses.html");
  await expect(
    licenses.getByRole("heading", { name: "Third-party licenses" }),
  ).toBeVisible();
  await expect(licenses.locator("pre")).toContainText("pdf-lib");
  await expect(licenses.locator("pre")).toContainText("SIL OPEN FONT LICENSE");
  await expect(licenses.locator("pre")).toContainText("Apache License");
  await licenses.goto("/THIRD_PARTY_NOTICES.txt");
  await expect(licenses.locator("body")).toContainText(
    "Permission is hereby granted",
  );
  await expect(licenses.locator("body")).toContainText("Courier Prime");
  // Reading legal information never replaces the open screenplay.
  await expect(
    page.getByRole("textbox", { name: "Screenplay editor" }),
  ).toBeAttached();
});
