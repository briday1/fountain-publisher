import { expect, test } from "@playwright/test";

for (const format of ["sequential", "act"]) {
  test(`mobile scene numbers stay inside the writing area (${format})`, async ({
    page,
  }, testInfo) => {
    await page.addInitScript((sceneNumberFormat) => {
      localStorage.setItem(
        "fp2.preferences",
        JSON.stringify({
          sceneNumbers: "margin",
          sceneNumberFormat,
          theme: "dark",
        }),
      );
    }, format);
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto("/");
    const editor = page.getByRole("textbox", { name: "Screenplay editor" });
    await expect(editor).toBeVisible();
    await editor.click();
    await page.keyboard.press("ControlOrMeta+a");
    await editor.evaluate((element) => {
      const clipboardData = new DataTransfer();
      clipboardData.setData(
        "text/plain",
        "# ACT ONE\n\nINT. CABIN - NIGHT\n\nRain hammers the roof.\n\n.INT. A VERY LONG CABIN HEADING WITH ROOM FOR THE ENTIRE SCENE NUMBER - NIGHT #123A#",
      );
      element.dispatchEvent(
        new ClipboardEvent("paste", {
          clipboardData,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    const scenes = editor.locator('p[data-kind="scene"]');
    await expect(scenes).toHaveCount(2);
    await expect(scenes.nth(1)).toHaveAttribute("data-scene-number", "123A");
    for (const width of [320, 393, 768, 950]) {
      await page.setViewportSize({ width, height: 852 });
      for (const scene of await scenes.all()) {
        const bounds = await scene.evaluate((node) => {
          const before = getComputedStyle(node, "::before");
          const rect = node.getBoundingClientRect();
          const scroll = node
            .closest(".writing-scroll")!
            .getBoundingClientRect();
          return {
            position: before.position,
            content: before.content,
            left: rect.left,
            right: rect.right,
            scrollLeft: scroll.left,
            scrollRight: scroll.right,
            fits: node.scrollWidth <= node.clientWidth + 1,
          };
        });
        expect(bounds.position).toBe("static");
        expect(bounds.content).not.toBe("none");
        expect(bounds.left).toBeGreaterThanOrEqual(bounds.scrollLeft);
        expect(bounds.right).toBeLessThanOrEqual(bounds.scrollRight + 1);
        expect(bounds.fits).toBe(true);
      }
    }
    await page.setViewportSize({ width: 393, height: 852 });
    await page.screenshot({
      path: testInfo.outputPath(`mobile-scene-numbers-${format}.png`),
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    expect(
      await scenes
        .first()
        .evaluate((node) => getComputedStyle(node, "::before").position),
    ).toBe("absolute");
  });
}
