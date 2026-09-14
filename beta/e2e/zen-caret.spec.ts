import { test, expect } from "@playwright/test";
import type { ElementHandle, Page } from "@playwright/test";

async function selectionState(page: Page) {
  return page.evaluate(() => {
    const selection = window.getSelection();
    if (!selection?.anchorNode || !selection.focusNode) return null;
    const blockId = (node: Node) =>
      (node instanceof Element ? node : node.parentElement)
        ?.closest("[data-id]")
        ?.getAttribute("data-id");
    return {
      anchorBlock: blockId(selection.anchorNode),
      anchorOffset: selection.anchorOffset,
      focusBlock: blockId(selection.focusNode),
      focusOffset: selection.focusOffset,
      collapsed: selection.isCollapsed,
    };
  });
}

async function visibleCaret(
  page: Page,
  original: ElementHandle,
  selection: Awaited<ReturnType<typeof selectionState>>,
) {
  const editor = page.getByRole("textbox", { name: "Screenplay editor" });
  await expect(editor).toBeFocused();
  expect(
    await original.evaluate(
      (element) => element === document.querySelector(".screenplay-editor"),
    ),
  ).toBe(true);
  expect(await selectionState(page)).toEqual(selection);
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const selected = window.getSelection();
          const viewport = document.querySelector(".writing-scroll");
          if (!selected?.rangeCount || !viewport) return false;
          const caret = selected.getRangeAt(0).getBoundingClientRect();
          const pane = viewport.getBoundingClientRect();
          return (
            caret.height > 0 &&
            caret.top >= pane.top - 1 &&
            caret.bottom <= pane.bottom + 1 &&
            caret.left >= pane.left - 1 &&
            caret.right <= pane.right + 1
          );
        }),
      {
        message:
          "The unchanged caret should be visible after the writing area changes width",
      },
    )
    .toBe(true);
}

test("long-paragraph caret remains visible and unchanged through Zen entry, button exit and Escape exit", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.goto("/");
  const editor = page.getByRole("textbox", { name: "Screenplay editor" });
  await expect(editor).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page
    .getByRole("button", { name: "New screenplay", exact: true })
    .click();
  await expect(editor).toHaveText("");
  const original = (await editor.elementHandle())!;
  const prose = `${Array.from({ length: 700 }, (_, index) => `Word${index}`).join(" ")}.`;
  await editor.click();
  await page.keyboard.insertText(prose);
  await expect(editor).toHaveText(prose);
  const selection = await selectionState(page);
  expect(selection?.collapsed).toBe(true);
  await visibleCaret(page, original, selection);

  for (const exit of ["button", "Escape"] as const) {
    await page
      .getByRole("button", { name: "Enter Zen mode", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Exit Zen", exact: true }),
    ).toBeVisible();
    await visibleCaret(page, original, selection);
    if (exit === "button")
      await page.getByRole("button", { name: "Exit Zen", exact: true }).click();
    else await page.keyboard.press("Escape");
    await expect(
      page.getByRole("toolbar", { name: "Writing controls", exact: true }),
    ).toBeVisible();
    await visibleCaret(page, original, selection);
    await expect(editor).toHaveText(prose);
  }
  // No click is needed to resume writing after either exit path.
  await page.keyboard.insertText(" Still writing.");
  await expect(editor).toHaveText(`${prose} Still writing.`);
});
