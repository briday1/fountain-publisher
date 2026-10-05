import { expect, test, type Page } from "@playwright/test";

test.use({ serviceWorkers: "block" });
const account = {
  id: "code-recipient",
  email: "writer@example.test",
  displayName: "Alex Writer",
  privateTester: false,
  googleLinked: true,
  billingStatus: "none",
  cancelAtPeriodEnd: false,
  premiumUntil: 0,
};
async function setup(page: Page) {
  await page.route("**/src/product.ts*", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: "export const isWriteShape = true;",
    }),
  );
}
async function settings(page: Page) {
  const button = page.getByRole("button", { name: "Settings", exact: true });
  if (!(await button.isVisible()))
    await page.getByRole("button", { name: "File", exact: true }).click();
  await button.click();
  return page.getByRole("dialog", { name: "Settings", exact: true });
}

test("Premium shows the complete sample beat sheet, graph and character timeline", async ({
  page,
}, testInfo) => {
  await setup(page);
  await page.route("**/api/account", (route) =>
    route.fulfill({
      json: { account, premium: false, billingAvailable: false },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page
    .getByRole("button", { name: "Explore Premium…", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "WriteShape Premium",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".sample-beat-sheet .beat-flow-row")).toHaveCount(
    3,
  );
  await expect(
    dialog.locator('[data-sample-feature="Beat Sheet"]'),
  ).toHaveCount(1);
  await expect(
    dialog.locator('[data-sample-feature="Beat Guide"]'),
  ).toHaveCount(0);
  expect(
    await dialog.locator(".sample-gantt svg rect").count(),
  ).toBeGreaterThan(3);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await dialog.locator(".sample-gantt").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: testInfo.outputPath(`character-gantt-${width}.png`),
    });
    const sheet = dialog.locator(".sample-beat-sheet");
    await sheet.scrollIntoViewIfNeeded();
    const cards = (await sheet.locator(".beat-board").boundingBox())!;
    const graph = (await sheet
      .locator(".beat-pacing svg")
      .first()
      .boundingBox())!;
    expect(graph.y).toBeGreaterThanOrEqual(cards.y + cards.height);
    expect(graph.width).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: testInfo.outputPath(`all-beats-${width}.png`),
    });
  }
});
for (const width of [390, 1024]) {
  test(`code applies Premium once and persists on reload at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await setup(page);
    let claimed = false;
    const until = Math.floor(Date.now() / 1000) + 7 * 86400;
    let submissions = 0;
    await page.route("**/api/account", (route) =>
      route.fulfill({
        json: {
          account: {
            ...account,
            complimentaryIndefinite: claimed && width === 1024,
            complimentaryUntil: claimed && width === 390 ? until : 0,
          },
          premium: claimed,
          accessCodesAvailable: true,
          manageAccessCodes: false,
          billingAvailable: false,
          billingMode: "live",
          privateMode: false,
        },
      }),
    );
    await page.route("**/api/access-codes/redeem", async (route) => {
      submissions++;
      if (route.request().postDataJSON().code !== "READERS-TEST")
        return route.fulfill({
          status: 400,
          json: { error: "This code cannot be used." },
        });
      claimed = true;
      await route.fulfill({
        json: { ok: true, expiresAt: width === 390 ? until : null },
      });
    });
    await page.goto("/");
    await page
      .getByRole("button", { name: "WriteShape account", exact: true })
      .click();
    const profile = page.getByRole("dialog", { name: "Account", exact: true });
    await expect(
      profile.locator(".account-identity .account-badge"),
    ).toHaveText("Free");
    await expect(
      profile.getByLabel("Premium code", { exact: true }),
    ).toHaveCount(0);
    await expect(
      profile.getByText("Complimentary Premium", { exact: true }),
    ).toHaveCount(0);
    await expect(
      profile.getByText("Manage codes", { exact: true }),
    ).toHaveCount(0);
    await profile.getByRole("button", { name: "Have a code?" }).click();
    await profile
      .getByLabel("Premium code", { exact: true })
      .fill("INVALID-CODE");
    await profile.getByRole("button", { name: "Apply code" }).click();
    await expect(profile.getByRole("status")).toHaveText(
      "This code cannot be used.",
    );
    await expect(
      profile.locator(".account-identity .account-badge"),
    ).toHaveText("Free");
    await profile
      .getByLabel("Premium code", { exact: true })
      .fill(" READERS-TEST ");
    await profile.getByRole("button", { name: "Apply code" }).click();
    await expect(
      profile.locator(".account-identity .account-badge"),
    ).toHaveText("Premium");
    await expect(profile.getByRole("status")).toHaveText("Premium activated.");
    await expect(
      profile.getByLabel("Premium code", { exact: true }),
    ).toHaveCount(0);
    await expect(profile.locator(".account-plan-end")).toHaveCount(
      width === 390 ? 1 : 0,
    );
    await page.screenshot({
      path: testInfo.outputPath(`premium-${width}.png`),
    });
    await page.reload();
    await page
      .getByRole("button", { name: "WriteShape account", exact: true })
      .click();
    await expect(
      profile.locator(".account-identity .account-badge"),
    ).toHaveText("Premium");
    await expect(profile.getByRole("status")).toHaveCount(0);
    expect(submissions).toBe(2);
  });
}

test("new palettes coordinate UI colors, remain readable, and persist", async ({
  page,
}, testInfo) => {
  await setup(page);
  await page.route("**/api/account", (route) =>
    route.fulfill({
      json: {
        account,
        premium: true,
        accessCodesAvailable: true,
        billingAvailable: false,
      },
    }),
  );
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Screenplay editor" })
    .fill(
      "INT. WRITING ROOM - EVENING\n\nA fresh page waits.\n\nALEX\nLet's begin.",
    );
  for (const theme of ["sage", "rose", "dusk", "ocean"]) {
    const dialog = await settings(page);
    await dialog
      .getByRole("combobox", { name: "Theme", exact: true })
      .selectOption(theme);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    // Read the actual theme tokens from the rendered stylesheet, including foreground/background contrast.
    const colors = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      const value = (name: string) => style.getPropertyValue(name).trim();
      const luminance = (color: string) => {
        const rgb = color
          .replace("#", "")
          .match(/.{2}/g)!
          .map((v) => parseInt(v, 16) / 255)
          .map((v) =>
            v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
          );
        return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
      };
      const contrast = (a: string, b: string) => {
        const x = luminance(value(a)),
          y = luminance(value(b));
        return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
      };
      return {
        accent: value("--accent"),
        secondary: value("--accent-secondary"),
        tertiary: value("--accent-tertiary"),
        contrasts: [
          contrast("--ink", "--panel"),
          contrast("--muted", "--surface"),
          contrast("--paper-ink", "--paper"),
          contrast("--accent-contrast", "--accent"),
        ],
      };
    });
    expect(
      new Set([colors.accent, colors.secondary, colors.tertiary]).size,
    ).toBe(3);
    for (const ratio of colors.contrasts)
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    const heading = dialog.locator(".modal-header");
    const headingTop = (await heading.boundingBox())!.y;
    await dialog.evaluate((el) => {
      el.scrollTop = 120;
    });
    expect(await dialog.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    expect(
      Math.abs((await heading.boundingBox())!.y - headingTop),
    ).toBeLessThan(1);
    await dialog.getByRole("button", { name: "Close dialog" }).click();
    await page.screenshot({ path: testInfo.outputPath(`${theme}-editor.png`) });
  }
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "ocean");
  await page.setViewportSize({ width: 390, height: 844 });
  const dialog = await settings(page);
  await expect(
    dialog.getByRole("combobox", { name: "Theme", exact: true }),
  ).toHaveValue("ocean");
  await page.screenshot({
    path: testInfo.outputPath("ocean-mobile-settings.png"),
  });
});

for (const width of [390, 834, 1280]) {
  test(`dialog headings stay fixed and panels clear controls at ${width}px`, async ({
    page,
  }, testInfo) => {
    await setup(page);
    await page.setViewportSize({ width, height: 844 });
    await page.route("**/api/account", (route) =>
      route.fulfill({
        json: {
          account,
          premium: true,
          billingAvailable: false,
          privateMode: false,
        },
      }),
    );
    await page.goto("/");
    await page
      .getByRole("textbox", { name: "Screenplay editor" })
      .fill("INT. ROOM - DAY\n\nA writer opens the window.");
    await page
      .getByRole("button", { name: "WriteShape account", exact: true })
      .click();
    const profile = page.getByRole("dialog", { name: "Account", exact: true }),
      header = profile.locator(".modal-header");
    await profile.evaluate((el) => {
      el.scrollTop = 0;
    });
    const before = await header.boundingBox();
    await profile.evaluate((el) => {
      el.scrollTop = 120;
    });
    const after = await header.boundingBox();
    expect(Math.abs(after!.y - before!.y)).toBeLessThan(1);
    await profile.getByRole("button", { name: "Close dialog" }).click();
    const mobile = width <= 950;
    const controls = page
      .locator(mobile ? ".app-header" : ".document-pane-header")
      .first();
    const bounds = (await controls.boundingBox())!;
    for (const [selector, label] of [
      [".outline-panel", "Outline"],
      [".insights-panel", "Insights"],
    ]) {
      const panel = page.locator(selector);
      if (mobile) {
        await page.getByRole("button", { name: "File", exact: true }).click();
        await page
          .locator(".mobile-command-panel")
          .getByRole("button", { name: label, exact: true })
          .click();
      } else if (!(await panel.isVisible())) {
        await page
          .getByRole("button", {
            name: label === "Outline" ? "Toggle outline" : label,
            exact: true,
          })
          .click();
      }
      await expect(panel).toBeVisible();
      await expect
        .poll(async () => (await panel.boundingBox())!.y)
        .toBeGreaterThanOrEqual(bounds.y + bounds.height - 1);
      await page.screenshot({
        path: testInfo.outputPath(`${label.toLowerCase()}-${width}.png`),
      });
    }
    if (!mobile) {
      const workspace = (await page.locator(".workspace").boundingBox())!;
      const tabs = (await page
        .locator(".document-pane-header")
        .first()
        .boundingBox())!;
      expect(Math.abs(tabs.x - workspace.x)).toBeLessThan(2);
      expect(Math.abs(tabs.width - workspace.width)).toBeLessThan(2);
    }
    await page.screenshot({ path: testInfo.outputPath(`panels-${width}.png`) });
  });
}

test("Book starts clean, saves front matter, numbers headings and keeps colored bookmarks", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 960 });
  await setup(page);
  await page.route("**/api/account", (route) =>
    route.fulfill({
      json: {
        account: { ...account, privateTester: true },
        premium: true,
        billingAvailable: false,
      },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("button", { name: "New", exact: true }).click();
  await page
    .getByRole("dialog", { name: "New document", exact: true })
    .getByRole("button", { name: /^Book/ })
    .click();
  const editor = page.locator(".novel-editor");
  await expect(editor).toBeVisible();
  await expect(editor).not.toContainText("Untitled");
  await expect(editor).not.toContainText("Chapter 1");
  await page.getByRole("button", { name: "Add a title", exact: true }).click();
  const title = page.getByRole("dialog", { name: "Title page", exact: true });
  await title.getByLabel("Title", { exact: true }).fill("The Coast");
  await title.getByLabel("Author", { exact: true }).fill("Alex Morgan");
  await title.getByLabel(/Dedication/).fill("For the keepers.");
  await title
    .getByRole("button", { name: "Save title page", exact: true })
    .click();
  await expect(page.locator(".book-front-matter")).toContainText(
    "For the keepers.",
  );
  await editor.fill("The light reached the coast.");
  await editor.press("End");
  await page.getByRole("button", { name: "Insert", exact: true }).click();
  await page.getByRole("button", { name: "Footnote…", exact: true }).click();
  const footnote = page.getByRole("dialog", {
    name: "Add footnote",
    exact: true,
  });
  await footnote
    .getByRole("textbox", { name: "Footnote", exact: true })
    .fill("Coastal records, 1924.");
  await footnote
    .getByRole("button", { name: "Save footnote", exact: true })
    .click();
  const marker = editor.getByRole("button", {
    name: "Footnote 1: Coastal records, 1924.",
    exact: true,
  });
  await expect(marker).toBeVisible();
  await expect(editor.locator(".footnote-source")).toBeHidden();
  await marker.click();
  const editNote = page.getByRole("dialog", {
    name: "Edit footnote",
    exact: true,
  });
  await editNote
    .getByRole("textbox", { name: "Footnote", exact: true })
    .fill("Coastal records, revised 1925.");
  await editNote
    .getByRole("button", { name: "Save footnote", exact: true })
    .click();
  const outline = page.getByRole("complementary", {
    name: "Book outline",
    exact: true,
  });
  if (!(await outline.isVisible()))
    await page
      .getByRole("button", { name: "Toggle outline", exact: true })
      .click();
  await outline
    .getByRole("button", { name: "Add chapter", exact: true })
    .click();
  await outline
    .getByRole("button", { name: "Add chapter", exact: true })
    .click();
  await outline.getByRole("button", { name: "Add book", exact: true }).click();
  await expect(editor).toContainText("Chapter 2");
  await expect(editor).toContainText("Book 1");
  await editor.press("End");
  await outline
    .getByRole("button", { name: "Add bookmark", exact: true })
    .click();
  const mark = page.getByRole("dialog", { name: "New bookmark", exact: true });
  await mark.getByLabel("Name", { exact: true }).fill("Return to the coast");
  await mark.getByRole("radio", { name: "Purple", exact: true }).check();
  await mark
    .getByRole("button", { name: "Save bookmark", exact: true })
    .click();
  await expect(outline.locator(".bookmark-jump")).toContainText(
    "Return to the coast",
  );
  await outline.locator(".bookmark-jump").click();
  expect(
    await editor.evaluate((el) =>
      el.contains(document.getSelection()?.anchorNode || null),
    ),
  ).toBe(true);
  await expect(outline.locator(".bookmark-jump i")).toHaveCSS(
    "background-color",
    "rgb(123, 94, 181)",
  );
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".book-front-matter")).toContainText("The Coast");
  await expect(page.locator(".book-front-matter")).toContainText(
    "For the keepers.",
  );
  await expect(page.locator(".bookmark-jump")).toContainText(
    "Return to the coast",
  );
  await expect(
    editor.getByRole("button", {
      name: "Footnote 1: Coastal records, revised 1925.",
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("book-outline-bookmarks.png"),
  });
  const fontSettings = await settings(page);
  await expect(
    fontSettings.getByRole("combobox", { name: "Book font", exact: true }),
  ).toHaveValue("georgia");
  await expect(
    fontSettings.getByRole("combobox", {
      name: "Screenplay font",
      exact: true,
    }),
  ).toHaveValue("courier");
  await fontSettings
    .getByRole("combobox", { name: "Book font", exact: true })
    .selectOption("serif");
  await fontSettings
    .getByRole("combobox", { name: "Screenplay font", exact: true })
    .selectOption("mono");
  await fontSettings.getByRole("button", { name: "Done", exact: true }).click();
  await expect(editor).toHaveCSS("font-family", /DejaVu Serif/);
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("button", { name: "Export…", exact: true }).click();
  const bookExport = page.getByRole("dialog", {
    name: "Export book",
    exact: true,
  });
  await expect(
    bookExport.getByRole("checkbox", {
      name: "Keep selected font",
      exact: true,
    }),
  ).not.toBeChecked();
  await bookExport
    .getByRole("checkbox", { name: "Keep selected font", exact: true })
    .check();
  const downloaded = page.waitForEvent("download");
  await bookExport.getByRole("button", { name: "Export", exact: true }).click();
  const pdf = await downloaded;
  expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);
  await pdf.saveAs(testInfo.outputPath("book-selected-font.pdf"));
  await expect(bookExport).toBeHidden();
  await page.reload();
  await expect(editor).toHaveCSS("font-family", /DejaVu Serif/);

  await page.getByRole("button", { name: "File", exact: true }).click();
  await page
    .getByRole("button", { name: "Explore Premium…", exact: true })
    .click();
  const plans = page.getByRole("dialog", {
    name: "WriteShape Premium",
    exact: true,
  });
  await expect(
    plans.getByRole("tab", { name: "Book", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(plans.locator(".novel-outline li")).toHaveCount(4);
  await page.screenshot({
    path: testInfo.outputPath("premium-book-desktop.png"),
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    plans.getByRole("tab", { name: "Book", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("premium-book-phone.png"),
  });
  await plans.getByRole("tab", { name: "Screenplay", exact: true }).click();
  await expect(plans.locator('[data-sample-feature="Insights"]')).toHaveCount(
    1,
  );
});

test("Premium chapter focus edits the same book and navigates on desktop and phone", async ({
  page,
}, testInfo) => {
  await setup(page);
  await page.route("**/api/account", (route) =>
    route.fulfill({
      json: {
        account: { ...account, privateTester: true },
        premium: true,
        billingAvailable: false,
      },
    }),
  );
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("button", { name: "New", exact: true }).click();
  await page
    .getByRole("dialog", { name: "New document", exact: true })
    .getByRole("button", { name: /^Book/ })
    .click();
  const editor = page.locator(".novel-editor");
  const outline = page.getByRole("complementary", {
    name: "Book outline",
    exact: true,
  });
  if (!(await outline.isVisible()))
    await page
      .getByRole("button", { name: "Toggle outline", exact: true })
      .click();
  for (const text of [
    "First chapter stays connected.",
    "Second chapter stays safe.",
  ]) {
    await outline
      .getByRole("button", { name: "Add chapter", exact: true })
      .click();
    await editor.press("End");
    await editor.press("Enter");
    await editor.pressSequentially(text);
  }
  await outline
    .locator(".novel-outline li")
    .first()
    .getByRole("button", { name: "Section view actions", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Focus this section", exact: true })
    .click();
  const focus = page.getByRole("navigation", {
    name: "Focus mode",
    exact: true,
  });
  await expect(focus).toContainText("Chapter 1");
  await expect(
    editor.getByText("Second chapter stays safe.", { exact: true }),
  ).toBeHidden();
  await editor
    .getByText("First chapter stays connected.", { exact: true })
    .click();
  await editor.press("End");
  await editor.pressSequentially(" Revised.");
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    // The responsive layout closes desktop panels after the viewport changes.
    // Wait for that state instead of clicking a close button being unmounted.
    if (width === 390) await expect(outline).toBeHidden();
    await focus
      .getByRole("button", { name: "Next section", exact: true })
      .click();
    await expect(focus).toContainText("Chapter 2");
    await expect(
      editor.getByText("Second chapter stays safe.", { exact: true }),
    ).toBeVisible();
    await focus
      .getByRole("button", { name: "Previous section", exact: true })
      .click();
    await expect(
      editor.getByText("First chapter stays connected. Revised.", {
        exact: true,
      }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`chapter-focus-${width}.png`),
    });
  }
  await focus
    .getByRole("button", { name: "Whole document", exact: true })
    .click();
  await expect(focus).toHaveCount(0);
  await expect(
    editor.getByText("First chapter stays connected. Revised.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    editor.getByText("Second chapter stays safe.", { exact: true }),
  ).toBeVisible();
});

test("Free focus opens the Premium examples without changing the document", async ({
  page,
}) => {
  await setup(page);
  await page.route("**/api/account", (route) =>
    route.fulfill({
      json: { account, premium: false, billingAvailable: false },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "View", exact: true }).click();
  await page
    .getByRole("button", { name: "Focus on this scene · Premium", exact: true })
    .click();
  const plans = page.getByRole("dialog", {
    name: "WriteShape Premium",
    exact: true,
  });
  await expect(
    plans.getByRole("img", { name: /lantern room scene is isolated/ }),
  ).toBeVisible();
  await plans.getByRole("tab", { name: "Book", exact: true }).click();
  await expect(
    plans.getByRole("img", { name: /Chapter 2 is isolated/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Focus mode", exact: true }),
  ).toHaveCount(0);
});
