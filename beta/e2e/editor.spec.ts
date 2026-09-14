import { test, expect } from "@playwright/test";
const mod = process.platform === "darwin" ? "Meta" : "Control";
test("deployed beta starts both account sign-ins using the existing callbacks", async ({
  request,
}) => {
  test.skip(
    process.env.TEST_BASE_URL !== "https://beta.fountain-publisher.com",
    "Requires the deployed beta account adapter.",
  );
  const api = "https://api.fountain-publisher.com";
  for (const provider of ["github", "google"]) {
    const response = await request.get(
      `${api}/beta/api/auth/${provider}/start`,
      {
        maxRedirects: 0,
      },
    );
    expect(response.status()).toBe(302);
    const destination = new URL(response.headers().location);
    expect(destination.hostname).toBe(
      provider === "github" ? "github.com" : "accounts.google.com",
    );
    expect(destination.searchParams.get("redirect_uri")).toBe(
      `${api}/auth/${provider}/callback`,
    );
    const cookies = response
      .headersArray()
      .filter((header) => header.name.toLowerCase() === "set-cookie");
    expect(
      cookies.some((header) =>
        header.value.startsWith(`fp_${provider}_oauth=`),
      ),
    ).toBe(true);
    expect(
      cookies.some((header) =>
        header.value.startsWith(`fp_beta_return=${provider};`),
      ),
    ).toBe(true);
  }
});

test("deployed app reopens a saved draft and builds its PDF while offline", async ({
  page,
  context,
}) => {
  test.skip(
    !process.env.TEST_BASE_URL,
    "Requires a built app with its service worker.",
  );
  await page.goto("/");
  const editor = page.getByRole("textbox", { name: "Screenplay editor" });
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.press(`${mod}+a`);
  await page.keyboard.insertText(
    "The draft remains mine when the connection goes away.",
  );
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), {
      timeout: 30000,
    })
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(editor).toHaveText(
    "The draft remains mine when the connection goes away.",
  );
  await page.getByRole("tab", { name: "PDF", exact: true }).click();
  await expect(
    page.locator('iframe[title="Published screenplay PDF"]'),
  ).toBeVisible({
    timeout: 30000,
  });
  await page.getByRole("tab", { name: "Screenplay", exact: true }).click();
  await editor.click();
  await page.keyboard.press(`${mod}+End`);
  await page.keyboard.insertText(" I can keep writing offline.");
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(editor).toContainText("I can keep writing offline.");
});

test("writing, native selection, undo, save, reload and view switching preserve content", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const editor = page.getByRole("textbox", { name: "Screenplay editor" });
  await expect(editor).toBeVisible();
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page
    .getByRole("button", { name: "New screenplay", exact: true })
    .click();
  await editor.click();
  await page.keyboard.type("INT. KITCHEN - DAY");
  await page.keyboard.press("Enter");
  await page.keyboard.type("The kettle sings.");
  await page.keyboard.press("Enter");
  await page.keyboard.type("MARA");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Good morning.");
  await expect(editor.locator("[data-kind=scene]")).toHaveText(
    "INT. KITCHEN - DAY",
  );
  await expect(editor.locator("[data-kind=dialogue]")).toHaveText(
    "Good morning.",
  );
  await page.keyboard.down("Shift");
  for (let i = 0; i < 8; i++) await page.keyboard.press("ArrowLeft");
  await page.keyboard.up("Shift");
  await page.keyboard.type("night.");
  await expect(editor).toContainText("Good night.");
  await page.keyboard.press(`${mod}+z`);
  await expect(editor).toContainText("Good morning.");
  await page.getByRole("tab", { name: "Beat Sheet" }).click();
  await page.getByRole("button", { name: "Add beat", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Beat 1 title" })
    .fill("A new beginning");
  await page.getByRole("tab", { name: "Screenplay", exact: true }).click();
  await expect(editor).toContainText("Good morning.");
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(editor).toContainText("Good morning.");
  await page.getByRole("tab", { name: "Beat Sheet" }).click();
  await expect(page.getByRole("textbox", { name: "Beat 1 title" })).toHaveValue(
    "A new beginning",
  );
  expect(errors).toEqual([]);
});
test("formatting across text, unicode deletion and find/replace remain undoable", async ({
  page,
}) => {
  await page.goto("/");
  const editor = page.getByRole("textbox", { name: "Screenplay editor" });
  await editor.click();
  await page.keyboard.press(`${mod}+a`);
  await page.keyboard.insertText("Café 🦊");
  await page.keyboard.press("Backspace");
  await expect(editor).toHaveText("Café ");
  await page.keyboard.press(`${mod}+a`);
  await page.keyboard.press(`${mod}+b`);
  await expect(editor.locator("strong")).toHaveText("Café ");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.insertText("still here");
  await page
    .getByRole("button", { name: "Find and replace", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Find in screenplay" }).fill("still");
  await page.getByRole("textbox", { name: "Replacement text" }).fill("always");
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(editor).toContainText("always here");
  await page.getByRole("button", { name: "Close find" }).click();
  await page.keyboard.press(`${mod}+z`);
  await expect(editor).toContainText("still here");
});
test("PDF builds independently and save does not reset the editor undo history", async ({
  page,
}) => {
  await page.goto("/");
  const editor = page.getByRole("textbox", { name: "Screenplay editor" });
  await editor.click();
  await page.keyboard.press(`${mod}+End`);
  await page.keyboard.insertText(" Added at the end.");
  await page.getByRole("tab", { name: "PDF", exact: true }).click();
  await expect(
    page.locator('iframe[title="Published screenplay PDF"]'),
  ).toBeVisible({ timeout: 30000 });
  await page.getByRole("tab", { name: "Screenplay", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).first().click();
  await expect(editor).not.toContainText("Added at the end.");
});
test("desktop and mobile layout expose a usable editor without horizontal app overflow", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("textbox", { name: "Screenplay editor" }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Close outline", exact: true }),
  ).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Close insights", exact: true }),
  ).not.toBeVisible();
  await page
    .getByRole("button", { name: "Toggle outline", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Close outline", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Screenplay editor" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
});

test("title presentation and heading preferences retain the active editor and its undo history", async ({
  page,
}) => {
  await page.goto("/");
  const editor = page.getByRole("textbox", { name: "Screenplay editor" });
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page
    .getByRole("button", { name: "New screenplay", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Title page preview" }),
  ).toHaveCount(0);
  await editor.click();
  await page.keyboard.type("INT. STUDIO - NIGHT");
  await page.keyboard.press("Enter");
  await page.keyboard.type("A voice finds its way home.");
  const originalEditor = await editor.elementHandle();
  await page.getByRole("button", { name: "Title page", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Title page", exact: true });
  await dialog
    .getByRole("textbox", { name: "Title", exact: true })
    .fill("The Quiet Hour\nA radio play");
  await dialog
    .getByRole("textbox", { name: "Author", exact: true })
    .fill("Renée Writer");
  await dialog
    .getByRole("textbox", { name: "Contact", exact: true })
    .fill("writer@example.com\nNew York");
  await dialog
    .getByRole("textbox", { name: "Copyright", exact: true })
    .fill("© 2026 Renée Writer");
  await dialog.getByRole("button", { name: "Save title page" }).click();
  const title = page.getByRole("region", { name: "Title page preview" });
  await expect(title).toContainText("A radio play");
  await expect(title).toContainText("© 2026 Renée Writer");
  await expect(title.locator('[data-title-field="title"]')).toHaveCSS(
    "font-weight",
    "400",
  );
  await expect(title.locator('[data-title-field="title"]')).toHaveCSS(
    "font-family",
    /Courier Prime/,
  );
  await expect(editor).toHaveCSS("line-height", "16px");
  await expect(editor.locator('[data-kind="scene"]')).toHaveCSS(
    "font-weight",
    "700",
  );
  await page.getByRole("button", { name: "Appearance settings" }).click();
  await page.getByRole("switch", { name: "Bold scene headings" }).uncheck();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(editor.locator('[data-kind="scene"]')).toHaveCSS(
    "font-weight",
    "400",
  );
  expect(
    await originalEditor!.evaluate(
      (el) => el === document.querySelector(".screenplay-editor"),
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Undo", exact: true }).first().click();
  await expect(editor).not.toContainText("A voice finds its way home.");
  await expect(editor).toContainText("INT. STUDIO - NIGHT");
  await page.getByRole("button", { name: "Redo", exact: true }).first().click();
  await expect(editor).toContainText("A voice finds its way home.");
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(title).toContainText("© 2026 Renée Writer");
  await expect(editor.locator('[data-kind="scene"]')).toHaveCSS(
    "font-weight",
    "400",
  );
  await page.screenshot({
    path: "test-results/title-presentation.png",
    fullPage: true,
  });
});

test("long screenplay keeps native typing responsive with insights enabled", async ({
  page,
}, testInfo) => {
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
  const scene = (i: number) =>
    `INT. LOCATION ${i} - DAY\n\n` +
    Array.from(
      { length: 15 },
      () =>
        `!The room is quiet. A writer watches the door and waits for a familiar voice. The light changes. Nobody moves. It is a moment that could last forever, or end before anyone has time to notice.\n\n`,
    ).join("");
  const source = Array.from({ length: 120 }, (_, i) => scene(i + 1)).join("\n");
  await page.getByRole("button", { name: "File", exact: true }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /^Open Fountain/ }).click();
  await (
    await chooser
  ).setFiles({
    name: "Long screenplay.fountain",
    mimeType: "text/plain",
    buffer: Buffer.from(source),
  });
  const editor = page.getByRole("textbox", { name: "Screenplay editor" });
  await expect(editor.locator("p")).toHaveCount(1920, { timeout: 20000 });
  await editor.locator("p").first().click();
  await page.keyboard.press("End");
  await page.evaluate(() => {
    const times: number[] = [];
    (window as unknown as { typingTimes: number[] }).typingTimes = times;
    let start = 0;
    const editor = document.querySelector(".screenplay-editor")!;
    editor.addEventListener("keydown", () => {
      start = performance.now();
    });
    editor.addEventListener("input", () => {
      const began = start;
      requestAnimationFrame(() => times.push(performance.now() - began));
    });
  });
  await page.keyboard.type(
    " A writer keeps going. The story is still hers. ".repeat(4),
    { delay: 8 },
  );
  const times = await page.evaluate(
    () => (window as unknown as { typingTimes: number[] }).typingTimes,
  );
  times.sort((a, b) => a - b);
  const p95 = times[Math.floor(times.length * 0.95)] ?? Infinity;
  await testInfo.attach("typing-performance", {
    body: JSON.stringify(
      {
        blocks: 1920,
        bytes: Buffer.byteLength(source),
        keystrokes: times.length,
        p95Ms: p95,
        maxMs: times.at(-1),
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
  console.log(
    `Typing: 1,920 blocks, ${times.length} inputs, p95 ${p95.toFixed(1)} ms`,
  );
  expect(times.length).toBeGreaterThan(100);
  expect(p95).toBeLessThan(75);
});
