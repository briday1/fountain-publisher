import { test, expect } from "@playwright/test";
import { mobileSection } from "./mobile-menu-helper";

test("fresh and reopened blank documents stay empty", async ({ page }) => {
  await page.goto("/");
  const editor = page.getByRole("textbox", { name: "Screenplay editor" });
  await expect(editor).toBeVisible();
  await expect(editor).toHaveText("");
  await page.reload();
  await expect(editor).toHaveText("");
  await editor.fill("My own writing");
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page
    .getByRole("button", { name: "New screenplay", exact: true })
    .click();
  await expect(editor).toHaveText("");
  await page.reload();
  await expect(editor).toHaveText("");
});

for (const width of [390, 820]) {
  test(`mobile page has no decorative canvas at ${width}px and no Zen mode`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await expect(
      page.getByRole("textbox", { name: "Screenplay editor" }),
    ).toBeVisible();
    await mobileSection(page, "View");
    await expect(page.getByRole("button", { name: /Zen mode/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(
      page.getByRole("combobox", { name: "Workspace background" }),
    ).not.toBeVisible();
    await page.getByRole("button", { name: "Done", exact: true }).click();
    for (const zoom of ["100", "80", "125"]) {
      await mobileSection(page, "Write");
      await page
        .getByRole("combobox", { name: "Page zoom", exact: true })
        .selectOption(zoom);
      await expect(
        page.getByRole("button", { name: /Zen mode/ }),
      ).not.toBeVisible();
      await page.getByRole("button", { name: "Back to writing" }).click();
      const styles = await page.locator(".writing-scroll").evaluate((el) => {
        const canvas = getComputedStyle(el);
        const paper = getComputedStyle(el.querySelector(".screenplay-paper")!);
        const wrap = getComputedStyle(el.querySelector(".paper-wrap")!);
        return {
          image: canvas.backgroundImage,
          color: canvas.backgroundColor,
          paper: paper.backgroundColor,
          margin: wrap.margin,
          max: wrap.maxWidth,
        };
      });
      expect(styles.image).toBe("none");
      expect(styles.color).toBe(styles.paper);
      expect(styles.margin).toBe("0px");
      expect(styles.max).toBe("none");
    }
  });
}
