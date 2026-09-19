import { test, expect, type Page } from "@playwright/test";

const mod = process.platform === "darwin" ? "Meta" : "Control";

async function chooseBackground(page: Page, value: string) {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Workspace background", exact: true })
    .selectOption(value);
  await page.getByRole("button", { name: "Done", exact: true }).click();
}

test("background choices preserve the editor, undo history, and saved appearance", async ({
  page,
}) => {
  await page.goto("/");
  const editor = page.getByRole("textbox", { name: "Screenplay editor" });
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.press(`${mod}+End`);
  await page.keyboard.insertText(" The ambient canvas leaves the words alone.");
  const originalEditor = await editor.elementHandle();
  const decoration = page.locator(".workspace-background");

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Workspace background", exact: true }),
  ).toBeVisible();
  expect(
    await page
      .getByRole("combobox", { name: "Workspace background", exact: true })
      .locator("option")
      .evaluateAll((options) =>
        options.map((option) => (option as HTMLOptionElement).value).sort(),
      ),
  ).toEqual(["dots", "hyperspace", "plain", "topographic"]);
  await page.getByRole("button", { name: "Done", exact: true }).click();

  for (const pattern of ["dots", "topographic", "hyperspace"]) {
    await chooseBackground(page, pattern);
    await expect(decoration).toBeVisible();
    await expect(decoration).toHaveAttribute("data-pattern", pattern);
    await expect(decoration).toHaveAttribute("aria-hidden", "true");
    await expect(decoration).toHaveAttribute("data-running", "true");
    await expect(decoration).toHaveCSS("pointer-events", "none");
    await page.screenshot({ path: `test-results/workspace-${pattern}.png` });
    expect(
      await originalEditor!.evaluate(
        (node) => node === document.querySelector(".screenplay-editor"),
      ),
    ).toBe(true);
    await expect(editor).toContainText(
      "The ambient canvas leaves the words alone.",
    );
  }

  await page.getByRole("button", { name: "Undo", exact: true }).first().click();
  await expect(editor).not.toContainText(
    "The ambient canvas leaves the words alone.",
  );
  await page.getByRole("button", { name: "Redo", exact: true }).first().click();
  await expect(editor).toContainText(
    "The ambient canvas leaves the words alone.",
  );
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(editor).toContainText(
    "The ambient canvas leaves the words alone.",
  );
  await expect(decoration).toHaveAttribute("data-pattern", "hyperspace");
  await expect(decoration).toHaveAttribute("data-running", "true");
  await chooseBackground(page, "plain");
  await expect(decoration).toHaveCount(0);
  await page.reload();
  await expect(editor).toBeVisible();
  await expect(decoration).toHaveCount(0);
});

test("backgrounds respect reduced motion and stop when hidden on narrow screens", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(
    page.getByRole("textbox", { name: "Screenplay editor" }),
  ).toBeVisible();
  const decoration = page.locator(".workspace-background");
  for (const pattern of ["dots", "topographic", "hyperspace"]) {
    await chooseBackground(page, pattern);
    await expect(decoration).toHaveAttribute("data-running", "false");
    expect(
      await decoration.evaluate((element) =>
        element
          .getAnimations({ subtree: true })
          .some((animation) => animation.playState === "running"),
      ),
    ).toBe(false);
  }
  const stars = decoration.locator("canvas");
  const image = await stars.evaluate((canvas) => canvas.toDataURL());
  await stars.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  expect(await stars.evaluate((canvas) => canvas.toDataURL())).toBe(image);

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(decoration).toHaveAttribute("data-running", "true");
  await expect
    .poll(() => stars.evaluate((canvas) => canvas.toDataURL()))
    .not.toBe(image);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(decoration).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(decoration).toBeVisible();
  await expect(decoration).toHaveAttribute("data-running", "true");
});

test("hyperspace keeps long-draft typing and dialogue popup scrolling responsive", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "showOpenFilePicker", {
      value: undefined,
      configurable: true,
    });
  });
  await page.goto("/");
  await chooseBackground(page, "hyperspace");
  const source =
    "INT. OBSERVATORY - NIGHT\n\n" +
    Array.from(
      { length: 350 },
      (_, index) =>
        `!The telescope follows another distant light ${index}.\n\nMARA\nThe next point of light is ${index}.\n\n`,
    ).join("") +
    "!The observation continues.";
  await page.getByRole("button", { name: "File", exact: true }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /^Open screenplay/ }).click();
  await (
    await chooser
  ).setFiles({
    name: "Observatory.fountain",
    mimeType: "text/plain",
    buffer: Buffer.from(source),
  });
  const editor = page.getByRole("textbox", { name: "Screenplay editor" });
  await expect(editor.locator("p")).toHaveCount(1052);
  const untouchedParagraph = await editor.locator("p").nth(500).elementHandle();
  await page
    .getByRole("complementary", { name: "Screenplay insights" })
    .getByRole("button", { name: /^MARA / })
    .click();
  const dialog = page.getByRole("dialog", { name: "MARA", exact: true });
  await expect(dialog).toBeVisible();
  await expect(page.locator(".workspace-background")).toHaveAttribute(
    "data-running",
    "false",
  );
  await dialog.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  const list = dialog.locator(".speech-list");
  const before = await page
    .locator(".writing-scroll")
    .evaluate((element) => element.scrollTop);
  await list.hover();
  await page.mouse.wheel(0, 700);
  await expect
    .poll(() => list.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(100);
  expect(
    await page
      .locator(".writing-scroll")
      .evaluate((element) => element.scrollTop),
  ).toBe(before);
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await expect(page.locator(".workspace-background")).toHaveAttribute(
    "data-running",
    "true",
  );
  await editor.locator("p").last().click();
  await page.keyboard.press(mod === "Meta" ? "Meta+ArrowRight" : "End");
  await page.evaluate(() => {
    const scope = window as unknown as { ambientTypingTimes: number[] };
    scope.ambientTypingTimes = [];
    let start = 0;
    const editor = document.querySelector(".screenplay-editor")!;
    editor.addEventListener("keydown", () => {
      start = performance.now();
    });
    editor.addEventListener("input", () => {
      const began = start;
      requestAnimationFrame(() =>
        scope.ambientTypingTimes.push(performance.now() - began),
      );
    });
  });
  await page.keyboard.type(
    " The stars move, and the writer keeps her own pace.".repeat(3),
    { delay: 8 },
  );
  const times = await page.evaluate(() =>
    (
      window as unknown as { ambientTypingTimes: number[] }
    ).ambientTypingTimes.sort((a, b) => a - b),
  );
  const p95 = times[Math.floor(times.length * 0.95)] ?? Infinity;
  await testInfo.attach("hyperspace-typing-performance", {
    body: JSON.stringify(
      { blocks: 1052, inputs: times.length, p95Ms: p95, maxMs: times.at(-1) },
      null,
      2,
    ),
    contentType: "application/json",
  });
  expect(await untouchedParagraph!.evaluate((node) => node.isConnected)).toBe(
    true,
  );
  expect(times.length).toBeGreaterThan(100);
  expect(p95).toBeLessThan(75);
});
