import { expect, test } from "@playwright/test";

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 26_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1",
});

test("mobile keyboard pan keeps the top app bar inside Safari's visual viewport", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const state = {
      width: 390,
      height: 844,
      offsetTop: 0,
      offsetLeft: 0,
      pageTop: 0,
      pageLeft: 0,
    };
    const viewport = new EventTarget();
    for (const key of Object.keys(state) as Array<keyof typeof state>)
      Object.defineProperty(viewport, key, {
        configurable: true,
        get: () => state[key],
      });
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: viewport,
    });
    (
      window as unknown as {
        setTestVisualViewport: (
          next: Partial<typeof state>,
          event?: "resize" | "scroll",
        ) => void;
      }
    ).setTestVisualViewport = (next, event = "resize") => {
      Object.assign(state, next);
      viewport.dispatchEvent(new Event(event));
    };
  });

  await page.goto("/");
  const app = page.locator(".app");
  const header = page.locator(".app-header");
  const editor = page.getByRole("textbox", { name: "Screenplay editor" });
  await expect(editor).toBeVisible();
  await editor.fill("The header stays visible while typing.");
  const originalEditor = await editor.elementHandle();

  await expect.poll(async () => (await header.boundingBox())?.y ?? -1).toBe(0);
  await expect.poll(async () => Math.round((await app.boundingBox())?.height ?? 0)).toBe(
    844,
  );

  // WebKit can pan the page without document scrolling and can briefly leave
  // offsetTop at zero. pageTop still exposes the visual displacement.
  await page.evaluate(() => {
    (
      window as unknown as {
        setTestVisualViewport: (
          next: Record<string, number>,
          event?: "resize" | "scroll",
        ) => void;
      }
    ).setTestVisualViewport(
      {
        height: 430,
        offsetTop: 0,
        pageTop: 108,
      },
      "scroll",
    );
  });

  await expect
    .poll(async () => Math.round((await header.boundingBox())?.y ?? -1))
    .toBe(108);
  await expect
    .poll(async () => Math.round((await app.boundingBox())?.height ?? 0))
    .toBe(430);
  expect(
    await page.evaluate(() => ({
      scrollY,
      visualTop: getComputedStyle(document.documentElement)
        .getPropertyValue("--fp-visual-top")
        .trim(),
    })),
  ).toEqual({ scrollY: 0, visualTop: "108px" });

  // Address-bar/keyboard dismissal returns the shell to the full visible area.
  await page.evaluate(() => {
    (
      window as unknown as {
        setTestVisualViewport: (
          next: Record<string, number>,
          event?: "resize" | "scroll",
        ) => void;
      }
    ).setTestVisualViewport({
      height: 844,
      offsetTop: 0,
      pageTop: 0,
    });
  });
  await expect.poll(async () => Math.round((await header.boundingBox())?.y ?? -1)).toBe(0);
  await expect
    .poll(async () => Math.round((await app.boundingBox())?.height ?? 0))
    .toBe(844);
  expect(
    await originalEditor!.evaluate(
      (node) => node === document.querySelector(".screenplay-editor"),
    ),
  ).toBe(true);
  await expect(editor).toContainText("The header stays visible while typing.");
});
