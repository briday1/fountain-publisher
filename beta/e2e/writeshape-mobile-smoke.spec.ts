import { expect, test } from "@playwright/test";

test("returning from Account or navigation restores the full mobile canvas", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const state = { height: 844, offsetTop: 0, pageTop: 0 };
    const viewport = new EventTarget();
    for (const key of Object.keys(state) as Array<keyof typeof state>)
      Object.defineProperty(viewport, key, { get: () => state[key] });
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: viewport,
    });
    (
      window as unknown as {
        setViewport: (next: Partial<typeof state>, emit?: boolean) => void;
      }
    ).setViewport = (next, emit = true) => {
      Object.assign(state, next);
      if (emit) viewport.dispatchEvent(new Event("resize"));
    };
  });
  await page.route("**/api/account", (route) =>
    route.fulfill({
      json: {
        account: {
          id: "viewport-test",
          email: "writer@example.test",
          privateTester: true,
        },
        premium: true,
        cloudStorage: true,
        privateMode: true,
        billingAvailable: false,
        portalAvailable: false,
      },
    }),
  );
  await page.goto("/");
  const app = page.locator(".app");
  const header = page.locator(".app-header");
  const editor = page.getByRole("textbox", { name: "Screenplay editor" });
  await editor.fill("Keep this draft while returning from Account.");
  const original = await editor.elementHandle();
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page
    .locator(".mobile-command-panel")
    .getByRole("button", { name: "Account", exact: true })
    .click();
  const account = page.getByRole("dialog", { name: "Account", exact: true });
  await expect(account).toBeVisible();
  // iOS may leave its last keyboard measurement cached after a dialog closes.
  await page.evaluate(() =>
    (
      window as unknown as {
        setViewport: (next: Record<string, number>) => void;
      }
    ).setViewport({ height: 660 }),
  );
  await account
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  const fullCanvas = async () => {
    await expect
      .poll(async () => Math.round((await app.boundingBox())?.height ?? 0))
      .toBe(844);
    await expect
      .poll(async () => {
        const bar = await page.locator(".statusbar").boundingBox();
        return bar ? Math.round(bar.y + bar.height) : -1;
      })
      .toBe(844);
    await expect
      .poll(async () => Math.round((await header.boundingBox())?.y ?? -1))
      .toBe(0);
  };
  await fullCanvas();
  // Retain the keyboard-pan fix while actually editing.
  await editor.click();
  await page.evaluate(() =>
    (
      window as unknown as {
        setViewport: (next: Record<string, number>) => void;
      }
    ).setViewport({ height: 430, pageTop: 108 }),
  );
  await expect
    .poll(async () => Math.round((await app.boundingBox())?.height ?? 0))
    .toBe(430);
  await expect
    .poll(async () => Math.round((await header.boundingBox())?.y ?? -1))
    .toBe(108);
  // Returning to a tab can happen without a visualViewport resize event.
  await page.evaluate(() => {
    (
      window as unknown as {
        setViewport: (next: Record<string, number>, emit: boolean) => void;
      }
    ).setViewport({ height: 844, pageTop: 0 }, false);
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await fullCanvas();
  // A Back/Forward cache restoration can retain the old viewport object too.
  await page.evaluate(() =>
    (
      window as unknown as {
        setViewport: (next: Record<string, number>) => void;
      }
    ).setViewport({ height: 430, pageTop: 108 }),
  );
  await expect
    .poll(async () => Math.round((await app.boundingBox())?.height ?? 0))
    .toBe(430);
  await page.evaluate(() =>
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true }),
    ),
  );
  await fullCanvas();
  expect(
    await original!.evaluate(
      (node) => node === document.querySelector(".screenplay-editor"),
    ),
  ).toBe(true);
  await expect(editor).toContainText(
    "Keep this draft while returning from Account.",
  );
});

test.skip(
  process.env.WRITESHAPE_BUILD_SMOKE !== "1",
  "Runs against the isolated WriteShape production build",
);

test.use({
  // These tests stub account/cloud APIs. WebKit sends service-worker-controlled
  // requests past page.route, even when the worker leaves /api uncached.
  // Offline/service-worker behavior is covered by the dedicated offline suite.
  serviceWorkers: "block",
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 26_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1",
});

test("mobile title page stays centered in the writing canvas across zoom and keyboard focus", async ({
  page,
}) => {
  await page.goto("/");
  const editor = page.getByRole("textbox", { name: "Screenplay editor" });
  await expect(editor).toBeVisible();
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("button", { name: "Title page…", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Title page", exact: true });
  await dialog.getByRole("textbox", { name: "Title", exact: true }).fill("Aaa");
  await dialog
    .getByRole("button", { name: "Save title page", exact: true })
    .click();
  const title = page.getByRole("region", { name: "Title page preview" });
  const canvas = page.getByRole("region", {
    name: "Current document",
    exact: true,
  });
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    for (const zoom of [60, 100, 125, 200]) {
      await page.getByRole("button", { name: "File", exact: true }).click();
      await page
        .locator(".mobile-command-panel")
        .getByRole("combobox", { name: "Zoom", exact: true })
        .selectOption(String(zoom));
      await page
        .locator(".mobile-command-panel")
        .getByRole("button", { name: "Close dialog", exact: true })
        .click();
      await editor.focus();
      const bounds = await title.boundingBox();
      const frame = await canvas.boundingBox();
      expect(
        Math.abs(bounds!.x + bounds!.width / 2 - frame!.x - frame!.width / 2),
      ).toBeLessThanOrEqual(1);
      expect(bounds!.x).toBeGreaterThanOrEqual(frame!.x);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
        frame!.x + frame!.width + 1,
      );
      expect(
        await canvas.evaluate(
          (node) => node.scrollWidth <= node.clientWidth + 1,
        ),
      ).toBe(true);
    }
  }
});

test("private build keeps mobile editor text at 16px on focus", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/WriteShape/);
  const editor = page.getByRole("textbox", { name: "Screenplay editor" });
  await expect(editor).toBeVisible();
  await expect(editor).toHaveCSS("font-size", "16px");
  await editor.click();
  await expect(editor).toBeFocused();
  await expect(editor).toHaveCSS("font-size", "16px");
  await editor.fill("Keep this sentence.");
  const original = await editor.elementHandle();
  const header = page.locator(".mobile-header-format");
  await expect(header.locator("select, input, textarea")).toHaveCount(0);
  const element = header.getByRole("button", {
    name: "Screenplay element",
    exact: true,
  });
  await expect(element).toHaveCSS("height", "32px");
  await expect(header.locator(".writing-element-hit")).toHaveCSS(
    "height",
    "44px",
  );
  await element.tap();
  await expect(element).toHaveAttribute("aria-expanded", "true");
  await page
    .locator(".anchored-menu-popup")
    .getByRole("button", { name: "Dialogue", exact: true })
    .tap();
  await expect(editor.locator('p[data-kind="dialogue"]')).toHaveText(
    "Keep this sentence.",
  );
  await expect(editor).toBeFocused();
  await expect(page.locator(".anchored-menu-popup")).toHaveCount(0);
  expect(
    await original!.evaluate(
      (node) => node === document.querySelector(".screenplay-editor"),
    ),
  ).toBe(true);
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page
        .locator(".app-header")
        .evaluate((node) => node.scrollWidth <= node.clientWidth),
    ).toBe(true);
    await expect(element).toBeVisible();
  }
  await page.screenshot({ path: "test-results/writeshape-mobile.png" });
});

for (const signedIn of [false, true]) {
  test(`mobile menu keeps ${signedIn ? "Account" : "Sign in"} directly accessible and preserves the draft`, async ({
    page,
  }) => {
    const label = signedIn ? "Account" : "Sign in";
    await page.route("**/api/account", (route) =>
      route.fulfill({
        json: {
          account: signedIn
            ? {
                id: "menu-test",
                email: "writer@example.test",
                displayName: "Writer",
                privateTester: true,
                googleLinked: true,
                billingStatus: "none",
                cancelAtPeriodEnd: false,
                premiumUntil: 0,
              }
            : null,
          premium: signedIn,
          cloudStorage: signedIn,
          privateMode: true,
          googleAvailable: true,
          billingAvailable: false,
          portalAvailable: false,
        },
      }),
    );
    await page.goto("/");
    const editor = page.getByRole("textbox", { name: "Screenplay editor" });
    await expect(editor).toBeVisible();
    await editor.fill("Keep this draft while checking my account.");
    await expect(
      page
        .locator(".app-header")
        .getByText(/private test|sandbox|premium|free plan/i),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "File", exact: true }).click();
    const menu = page.locator(".mobile-command-panel");
    await expect(menu.locator(".mobile-command-group h3")).toHaveText([
      "Tools",
      "Files",
      "View",
      "Preferences",
    ]);
    const tools = menu.locator(".mobile-command-group").filter({
      has: page.getByRole("heading", { name: "Tools", exact: true }),
    });
    await tools
      .getByRole("combobox", { name: "Zoom", exact: true })
      .selectOption("125");
    const beatGuide = tools.getByRole("switch", { name: "Beat guide" });
    await expect(beatGuide).not.toBeChecked();
    await beatGuide.click();
    await expect(beatGuide).toBeChecked();
    await beatGuide.click();
    await expect(beatGuide).not.toBeChecked();
    const files = menu.locator(".mobile-command-group").filter({
      has: page.getByRole("heading", { name: "Files", exact: true }),
    });
    await expect(files.getByRole("button")).toHaveText([
      "New",
      /^Open…/,
      "Files…",
      /^Save[^A-Za-z]*/,
      /^Save As…/,
      "Version history…",
      "Review changes…",
      "Export…",
      "Rename…",
      "Account",
    ]);
    const accountButton = menu.getByRole("button", {
      name: "Account",
      exact: true,
    });
    await expect(accountButton).toHaveCount(1);
    await expect(
      menu.locator("details").getByRole("button", { name: label, exact: true }),
    ).toHaveCount(0);
    await expect(menu).toHaveCSS("opacity", "1");
    expect(
      await menu.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      animations: "disabled",
      path: `test-results/writeshape-menu-${signedIn ? "account" : "sign-in"}.png`,
    });
    await accountButton.click();
    await expect(menu).toHaveCount(0);
    await expect(
      page.getByRole("dialog", { name: label, exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Close dialog" }).click();
    await expect(editor).toHaveText(
      "Keep this draft while checking my account.",
    );

    await page.setViewportSize({ width: 1440, height: 1000 });
    const header = page.locator(".app-header");
    await expect(
      header.getByRole("button", { name: label, exact: true }),
    ).toHaveCount(0);
    await expect(
      header.getByRole("button", { name: "Files", exact: true }),
    ).toHaveCount(0);
    await expect(header.locator(".document-name")).toHaveCount(0);
    await header
      .getByRole("button", { name: "WriteShape account", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: label, exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Close dialog" }).click();
    await expect(editor).toHaveText(
      "Keep this draft while checking my account.",
    );
    await page.getByRole("button", { name: "File", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Files…", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Account", exact: true }),
    ).toHaveCount(1);
  });
}

test("Premium file locations exclude hosted storage without an owner invitation", async ({
  page,
}) => {
  await page.route("**/api/account", (route) =>
    route.fulfill({
      json: {
        account: { id: "premium-writer", email: "writer@example.test" },
        premium: true,
        cloudStorage: false,
        existingCloudFiles: false,
        privateMode: true,
        manageCloudAccess: false,
      },
    }),
  );
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    for (const action of ["Files…", "Save As…"]) {
      await page.getByRole("button", { name: "File", exact: true }).click();
      await page.getByRole("button", { name: action }).click();
      const dialog = page.getByRole("dialog", {
        name: action === "Files…" ? "Files" : "Save as…",
        exact: true,
      });
      await expect(dialog.getByRole("tab")).toHaveText([
        "Google Drive",
        "Local",
      ]);
      await dialog
        .getByRole("button", { name: "Close dialog", exact: true })
        .click();
    }
  }
});

test("cloud documents without a storage invitation open read-only and make an editable local copy", async ({
  page,
}) => {
  await page.route("**/api/account", (route) =>
    route.fulfill({
      json: {
        account: { id: "downgrade-test", email: "writer@example.test" },
        premium: false,
        cloudStorage: false,
        existingCloudFiles: true,
        privateMode: true,
      },
    }),
  );
  const file = {
    id: "11111111-1111-1111-1111-111111111111",
    parent: "",
    kind: "file",
    name: "Preserved.fountain",
    revision: 1,
    content: "INT. ROOM - DAY\n\nThese words belong to the writer.\n",
  };
  await page.route("**/api/library**", (route) => {
    if (route.request().method() !== "GET")
      return route.fulfill({
        status: 403,
        json: { error: "Storage invitation required" },
      });
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({
      json:
        path === "/api/library"
          ? {
              items: [file],
              breadcrumbs: [],
              canWrite: false,
              usage: {
                usedBytes: 60,
                currentBytes: 60,
                historyBytes: 0,
                quotaBytes: null,
                historyLimit: null,
                fileCount: 1,
                folderCount: 0,
                versionCount: 0,
              },
            }
          : file,
    });
  });
  await page.goto("/");
  await page.getByRole("textbox", { name: "Screenplay editor" }).waitFor();
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("button", { name: "Files…", exact: true }).click();
  await page
    .getByRole("tab", { name: "Existing cloud files", exact: true })
    .click();
  await page
    .getByRole("option", { name: "Fountain file: Preserved.fountain" })
    .click();
  await page.getByRole("button", { name: "Open file", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "Screenplay editor" });
  await expect(editor).toHaveAttribute("contenteditable", "false");
  await expect(page.locator(".document-readonly")).toContainText(
    "Read-only document",
  );
  await expect(editor).toContainText("These words belong to the writer.");
  await page
    .getByRole("button", { name: "Make local copy", exact: true })
    .click();
  await expect(editor).toHaveAttribute("contenteditable", "true");
  await expect(page.locator(".document-readonly")).toHaveCount(0);
  await expect(editor).toContainText("These words belong to the writer.");
});

test("support reports expose reviewed technical context without document contents", async ({
  page,
}) => {
  await page.goto("/");
  const editor = page.getByRole("textbox", { name: "Screenplay editor" });
  await editor.fill("Private screenplay words must stay out of diagnostics");
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page
    .getByRole("button", { name: "Report a problem", exact: true })
    .click();
  const report = page.getByRole("dialog", { name: "Report a problem" });
  await expect(report).toBeVisible();
  await report.getByText("Review technical details", { exact: true }).click();
  await expect(report.locator("pre")).not.toContainText(
    "Private screenplay words",
  );
  await expect(report).toContainText("support@writeshape.com");
  await expect(
    report.getByRole("button", { name: "Email report" }),
  ).toBeVisible();
});

test("removing a storage invitation preserves unsynced writing and requires an explicit sync restart", async ({
  page,
}) => {
  let cloudStorage = true;
  const file = {
    id: "22222222-2222-2222-2222-222222222222",
    parent: "",
    kind: "file",
    name: "Draft.fountain",
    revision: 1,
    content: "Original writing.\n",
  };
  let writes = 0;
  await page.route("**/api/account", (route) =>
    route.fulfill({
      json: {
        account: { id: "writer", email: "writer@example.test" },
        premium: true,
        cloudStorage,
        existingCloudFiles: true,
        privateMode: true,
      },
    }),
  );
  await page.route("**/api/library**", (route) => {
    if (route.request().method() !== "GET") {
      writes++;
      return route.abort();
    }
    return route.fulfill({
      json:
        new URL(route.request().url()).pathname === "/api/library"
          ? { items: [file], breadcrumbs: [], canWrite: cloudStorage }
          : file,
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("button", { name: "Files…", exact: true }).click();
  await page
    .getByRole("option", { name: "Fountain file: Draft.fountain" })
    .click();
  await page.getByRole("button", { name: "Open file", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "Screenplay editor" });
  await expect(
    page.getByRole("dialog", { name: "Files", exact: true }),
  ).not.toBeVisible();
  await expect(editor).toContainText("Original writing.");
  await expect(editor).toHaveAttribute("contenteditable", "true");
  await editor.click();
  await editor.fill("Unsynced words that must survive.");
  cloudStorage = false;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(editor).toHaveAttribute("contenteditable", "false");
  await expect(editor).toContainText("Unsynced words that must survive.");
  cloudStorage = true;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    page.getByRole("button", { name: "Resume sync", exact: true }),
  ).toBeVisible();
  await expect(editor).toHaveAttribute("contenteditable", "false");
  const writesBeforeReload = writes;
  await page.reload();
  await expect(editor).toContainText("Unsynced words that must survive.");
  await expect(editor).toHaveAttribute("contenteditable", "false");
  expect(writes).toBe(writesBeforeReload);
  await page
    .getByRole("button", { name: "Make local copy", exact: true })
    .click();
  await expect(editor).toHaveAttribute("contenteditable", "true");
  await expect(editor).toContainText("Unsynced words that must survive.");
});

test("mobile file browser selects downloads and renames without replacing the draft", async ({
  page,
}) => {
  await page.route("**/api/account", (route) =>
    route.fulfill({
      json: {
        account: { id: "files", email: "writer@example.test" },
        premium: true,
        cloudStorage: true,
        privateMode: true,
      },
    }),
  );
  const files = [
    {
      id: "33333333-3333-3333-3333-333333333333",
      name: "One.fountain",
      kind: "file",
      parent: "",
      revision: 1,
      content: "First.",
    },
    {
      id: "44444444-4444-4444-4444-444444444444",
      name: "Two.fountain",
      kind: "file",
      parent: "",
      revision: 1,
      content: "Second.",
    },
  ];
  await page.route("**/api/library**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/copy")) {
      const input = route.request().postDataJSON();
      const copy = {
        ...files[0],
        id: "55555555-5555-5555-5555-555555555555",
        name: input.name,
        revision: 1,
      };
      files.push(copy);
      return route.fulfill({ json: copy });
    }
    if (path.endsWith("/manage")) {
      const input = route.request().postDataJSON();
      expect(input.action).toBe("rename");
      expect(input.revision).toBe(1);
      files[0].name = input.name;
      files[0].revision++;
      return route.fulfill({ json: files[0] });
    }
    return route.fulfill({
      json:
        path === "/api/library"
          ? { items: files, breadcrumbs: [], canWrite: true }
          : files.find((file) => path.endsWith(file.id)),
    });
  });
  await page.goto("/");
  const editor = page.getByRole("textbox", { name: "Screenplay editor" });
  await editor.fill("Keep my active draft.");
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("button", { name: "Files…", exact: true }).click();
  await page
    .getByRole("button", { name: "Folder actions", exact: true })
    .click();
  await page.getByRole("button", { name: "Select all", exact: true }).click();
  await page
    .getByRole("button", { name: "Folder actions", exact: true })
    .click();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download selected", exact: true })
    .click();
  expect((await downloadPromise).suggestedFilename()).toBe(
    "WriteShape-files.zip",
  );
  await page
    .getByRole("option", { name: "Fountain file: One.fountain" })
    .click();
  await page
    .getByRole("button", { name: "Actions for One.fountain", exact: true })
    .click();
  await page.getByRole("button", { name: "Rename", exact: true }).click();
  await page
    .getByRole("textbox", { name: "New item name" })
    .fill("Renamed.fountain");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(
    page.getByRole("option", { name: "Fountain file: Renamed.fountain" }),
  ).toBeVisible();
  await page
    .getByRole("option", { name: "Fountain file: Renamed.fountain" })
    .click();
  await page
    .getByRole("button", { name: "Actions for Renamed.fountain", exact: true })
    .click();
  await page.getByRole("button", { name: "Copy", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Copy name" })).toHaveValue(
    "Renamed copy.fountain",
  );
  await page.getByRole("button", { name: "Create copy", exact: true }).click();
  await expect(
    page.getByRole("option", { name: "Fountain file: Renamed copy.fountain" }),
  ).toBeVisible();
  expect(files[0].content).toBe("First.");
  expect(files[2].content).toBe("First.");
  await page.screenshot({ path: "test-results/writeshape-file-browser.png" });
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(editor).toHaveText("Keep my active draft.");
});

test("Finder folder menus copy nested folders and move complete folders to Trash and back", async ({
  page,
}) => {
  await page.route("**/api/account", (route) =>
    route.fulfill({
      json: {
        account: {
          id: "folder-owner",
          email: "writer@example.test",
          displayName: "Writer",
          privateTester: true,
          googleLinked: false,
        },
        premium: true,
        cloudStorage: true,
        privateMode: true,
        googleAvailable: false,
        billingAvailable: false,
      },
    }),
  );
  let copied = false;
  const book = {
    id: "book",
    name: "Book",
    parent: "",
    kind: "folder",
    revision: 1,
  };
  const copy = {
    id: "book-copy",
    name: "Book copy",
    parent: "",
    kind: "folder",
    revision: 1,
  };
  await page.route("**/api/library**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/library/book/copy") {
      expect(route.request().postDataJSON()).toMatchObject({
        revision: 1,
        name: "Book copy",
        parent: "",
      });
      copied = true;
      return route.fulfill({ json: copy });
    }
    if (url.pathname === "/api/library/book/manage") {
      const input = route.request().postDataJSON();
      expect(input.revision).toBe(book.revision);
      book.parent = input.action === "trash" ? "__trash__" : input.parent;
      book.revision++;
      return route.fulfill({ json: book });
    }
    const parent = url.searchParams.get("parent") || "";
    return route.fulfill({
      json: {
        items: [book, ...(copied ? [copy] : [])].filter(
          (item) => item.parent === parent,
        ),
        breadcrumbs:
          parent === "__trash__" ? [{ id: "__trash__", name: "Trash" }] : [],
        canWrite: true,
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("button", { name: "Files…", exact: true }).click();
  await expect(page.locator(".library-actionbar")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Actions for Book", exact: true })
    .click();
  await page.getByRole("button", { name: "Copy", exact: true }).click();
  await page.getByRole("button", { name: "Create copy", exact: true }).click();
  await expect(
    page.getByRole("option", { name: "Folder: Book copy", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Actions for Book", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Move to trash", exact: true })
    .click();
  await expect(
    page.getByText("A folder and everything inside it will move together.", {
      exact: false,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Confirm move to trash", exact: true })
    .click();
  await expect(
    page.getByRole("option", { name: "Folder: Book", exact: true }),
  ).toHaveCount(0);
  await page
    .locator(".library-sidebar")
    .getByRole("button", { name: "Trash", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Actions for Book", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Restore / move", exact: true })
    .click();
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await page
    .locator(".library-sidebar")
    .getByRole("button", { name: "My Storage", exact: true })
    .click();
  await expect(
    page.getByRole("option", { name: "Folder: Book", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("option", { name: "Folder: Book copy", exact: true }),
  ).toBeVisible();
});

test("WriteShape plan examples fit phone widths and File exposes Account", async ({
  page,
}) => {
  await page.route("**/api/account", (route) =>
    route.fulfill({
      json: {
        account: null,
        premium: false,
        privateMode: true,
        billingAvailable: false,
      },
    }),
  );
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: "File", exact: true }).click();
    if (width <= 950) {
      const files = page.locator(".mobile-command-group").filter({
        has: page.getByRole("heading", { name: "Files", exact: true }),
      });
      await expect(
        files.getByRole("button", { name: "Account", exact: true }),
      ).toBeVisible();
      await files.getByRole("button", { name: "Account", exact: true }).click();
    } else {
      await page.getByRole("button", { name: "Account", exact: true }).click();
    }
    await expect(
      page.getByRole("dialog", { name: "Sign in", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    await page.getByRole("button", { name: "File", exact: true }).click();
    await page
      .getByRole("button", { name: "Explore Premium…", exact: true })
      .click();
    const plans = page.getByRole("dialog", {
      name: "WriteShape Premium",
      exact: true,
    });
    for (const mode of ["Screenplay", "Book"]) {
      await plans.getByRole("tab", { name: mode, exact: true }).click();
      await expect(
        plans.locator(".sample-beat-sheet .beat-flow-row"),
      ).toHaveCount(4);
      await expect(
        plans.locator(".sample-beat-sheet .beat-scene-heading"),
      ).toHaveCount(1);
      const overflow = await plans.evaluate((dialog) => {
        const failures: string[] = [];
        for (const el of dialog.querySelectorAll<HTMLElement>(
          "figure, .sample-document, .sample-analytics, .character-analytics-viewport, .beat-pacing-scroll, .plan-comparison",
        )) {
          if (el.scrollWidth > el.clientWidth + 2)
            failures.push(
              `${el.closest("section")?.querySelector("h3")?.textContent}: ${el.tagName}.${el.className} (${el.firstElementChild?.className}): ${el.scrollWidth}/${el.clientWidth}`,
            );
        }
        for (const img of dialog.querySelectorAll<HTMLImageElement>(
          ".sample-pdf img",
        )) {
          if (img.complete && !img.naturalWidth)
            failures.push("PDF image did not load");
        }
        return failures;
      });
      expect(overflow).toEqual([]);
      if (width === 390) {
        await plans
          .locator(".sample-beat-sheet")
          .first()
          .scrollIntoViewIfNeeded();
        await page.screenshot({
          path: `test-results/plans-${mode.toLowerCase()}-mobile.png`,
        });
      }
    }
  }
});
