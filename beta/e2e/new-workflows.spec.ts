import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { parseFountain, serializeFountain } from "../src/core/fountain";
const mod = process.platform === "darwin" ? "Meta" : "Control";
async function setup(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(window, "showOpenFilePicker", {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(window, "showSaveFilePicker", {
      value: undefined,
      configurable: true,
    });
  });
  await page.goto("/");
  await expect(
    page.getByRole("textbox", { name: "Screenplay editor" }),
  ).toBeVisible();
}
async function open(page: Page, source: string, name = "Two Voices.fountain") {
  await page.getByRole("button", { name: "File", exact: true }).click();
  const picker = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /^Open screenplay/ }).click();
  await (
    await picker
  ).setFiles({ name, mimeType: "text/plain", buffer: Buffer.from(source) });
}
const source =
  "Title: Two Voices\nAuthor: A Writer\n\nINT. ROOM - DAY\n\nMARA\nHello.\n\nELI\nHi.\n\n!The room goes quiet.";

test("next beat highlights its passage without selecting or replacing the writing", async ({
  page,
}) => {
  await setup(page);
  const doc = parseFountain(
    "INT. ROOM - DAY\n\n!The first moment.\n\n!The next moment stays intact.",
  );
  doc.metadata.beats = doc.blocks.slice(1).map((block, index) => ({
    id: `beat-${index}`,
    title: `Moment ${index + 1}`,
    description: "",
    color: "#458c74",
    act: "I",
    range: {
      start: { blockId: block.id, offset: 0 },
      end: { blockId: block.id, offset: block.text.length },
    },
  }));
  await open(page, serializeFountain(doc));
  const editor = page.getByRole("textbox", { name: "Screenplay editor" });
  await expect(editor).toContainText("The next moment stays intact.");
  const guideToggle = page
    .getByRole("toolbar", { name: "Writing controls" })
    .getByRole("button", { name: /Beat guide/i });
  if ((await guideToggle.getAttribute("aria-pressed")) !== "true")
    await guideToggle.click();
  await page.getByRole("button", { name: "Next guide beat" }).click();
  await expect(editor.locator(".navigation-highlight")).toHaveText(
    "The next moment stays intact.",
  );
  expect(await page.evaluate(() => window.getSelection()?.isCollapsed)).toBe(
    true,
  );
  await page.keyboard.insertText("Still here: ");
  await expect(editor.locator("p").last()).toHaveText(
    "Still here: The next moment stays intact.",
  );
  await expect(editor.locator(".navigation-highlight")).toHaveCount(0);
  await page.keyboard.press(`${mod}+z`);
  await expect(editor.locator("p").last()).toHaveText(
    "The next moment stays intact.",
  );
  await page.getByRole("button", { name: "Previous guide beat" }).click();
  await page.getByRole("button", { name: "Next guide beat" }).click();
  await page.keyboard.press("Delete");
  await expect(editor.locator("p").last()).toHaveText(
    "he next moment stays intact.",
  );
});

test("highlighted PDF chooser exports selected names and preserves the ordinary preview and editor", async ({
  page,
}) => {
  await setup(page);
  await open(page, source);
  const editor = page.getByRole("textbox", { name: "Screenplay editor" });
  await expect(editor).toContainText("The room goes quiet.");
  const node = await editor.elementHandle();
  const toolbar = page.getByRole("toolbar", { name: "Writing controls" });
  await expect(
    toolbar.getByRole("button", { name: "Settings", exact: true }),
  ).toHaveCount(0);
  expect(
    await toolbar
      .getByRole("button", { name: "Beat sheet", exact: true })
      .evaluate((el) => getComputedStyle(el).fontWeight),
  ).toBe(
    await toolbar
      .getByRole("button", { name: "Insights", exact: true })
      .evaluate((el) => getComputedStyle(el).fontWeight),
  );
  await expect(
    toolbar.getByRole("button", { name: "Enter Zen mode", exact: true }),
  ).toHaveAttribute("title", /Zen/);
  await page.getByRole("button", { name: "File", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /formatted HTML/i }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Export…", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Export",
    exact: true,
  });
  const exportButton = dialog.getByRole("button", {
    name: "Export",
    exact: true,
  });
  await expect(exportButton).toBeEnabled();
  await dialog.getByRole("checkbox", { name: "MARA", exact: true }).check();
  await dialog.getByRole("checkbox", { name: "ELI", exact: true }).check();
  const colors = await dialog
    .locator(".highlight-character-list span")
    .evaluateAll((elements) =>
      elements.map((el) => getComputedStyle(el).backgroundColor),
    );
  expect(new Set(colors).size).toBe(2);
  const download = page.waitForEvent("download");
  await exportButton.click();
  const pdf = await download;
  expect(pdf.suggestedFilename()).toBe("Two-Voices-highlighted-ELI-MARA.pdf");
  expect(
    (
      await PDFDocument.load(await readFile((await pdf.path())!))
    ).getPageCount(),
  ).toBe(2);
  await expect(dialog).not.toBeVisible();
  await toolbar
    .getByRole("button", { name: "PDF preview", exact: true })
    .click();
  await expect(page.getByTitle("Published screenplay PDF")).toBeVisible({
    timeout: 30000,
  });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close dialog" })
    .click();
  expect(
    await node!.evaluate(
      (el) => el === document.querySelector(".screenplay-editor"),
    ),
  ).toBe(true);
  const titleGap = await page
    .locator(".title-preview")
    .evaluate(
      (el) =>
        el.getBoundingClientRect().top -
        el.parentElement!.getBoundingClientRect().top,
    );
  expect(titleGap).toBeLessThanOrEqual(97);
});

test("native character completion accepts Tab, handles ambiguity, and keeps undo and Enter natural", async ({
  page,
}) => {
  await setup(page);
  await open(page, source.replace("ELI\nHi.", "MARTIN\nHi."));
  const editor = page.getByRole("textbox", { name: "Screenplay editor" });
  await expect(editor).toContainText("MARTIN");
  await editor.click();
  await page.keyboard.press(`${mod}+a`);
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await page.keyboard.type("MA");
  const suggestions = page.getByRole("listbox", {
    name: "Character name suggestions",
  });
  await expect(suggestions).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Tab");
  await expect(editor.locator("p").last()).toHaveText("MARTIN");
  await expect(editor.locator("p").last()).toHaveAttribute(
    "data-kind",
    "character",
  );
  await expect(editor).toBeFocused();
  await page.keyboard.press(`${mod}+z`);
  await expect(editor.locator("p").last()).toHaveText("MA");
  await page.keyboard.press(`${mod}+Shift+z`);
  await expect(editor.locator("p").last()).toHaveText("MARTIN");
  await page.keyboard.press("Enter");
  await page.keyboard.type("A new voice.");
  await expect(editor.locator("p").last()).toHaveAttribute(
    "data-kind",
    "dialogue",
  );
  await expect(editor.locator("p").last()).toHaveText("A new voice.");
});

test("FDX imports into an editable Fountain document and malformed input leaves the draft intact", async ({
  page,
}) => {
  await setup(page);
  const xml =
    '<?xml version="1.0"?><FinalDraft DocumentType="Script"><Content><Paragraph Type="Scene Heading"><Text>INT. CAFÉ - DAY</Text></Paragraph><Paragraph Type="Action"><Text Style="Bold">The door opens.</Text></Paragraph><Paragraph Type="Character"><Text>RENÉE</Text></Paragraph><Paragraph Type="Dialogue"><Text>Bonjour &amp; bienvenue.</Text></Paragraph></Content><TitlePage><Content><Paragraph Alignment="Center"><Text>Morning</Text></Paragraph><Paragraph Alignment="Center"><Text>Written by</Text></Paragraph><Paragraph Alignment="Center"><Text>A Writer</Text></Paragraph></Content></TitlePage></FinalDraft>';
  await open(page, xml, "Morning.FDX");
  const editor = page.getByRole("textbox", { name: "Screenplay editor" });
  await expect(editor.locator("strong")).toHaveText("The door opens.");
  await expect(editor.locator("[data-kind=dialogue]")).toHaveText(
    "Bonjour & bienvenue.",
  );
  await expect(
    page.getByRole("region", { name: "Title page preview" }),
  ).toContainText("Morning");
  await page.getByRole("button", { name: "File", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const saved = await download;
  expect(saved.suggestedFilename()).toBe("Morning.fountain");
  const doc = parseFountain(await readFile((await saved.path())!, "utf8"));
  expect(doc.blocks.find((b) => b.kind === "dialogue")?.text).toBe(
    "Bonjour & bienvenue.",
  );
  await open(page, "<FinalDraft>broken", "Broken.fdx");
  await expect(
    page.getByRole("status").filter({ hasText: "not a valid Final Draft" }),
  ).toContainText("not a valid Final Draft");
  await expect(editor).toContainText("Bonjour & bienvenue.");
});

test("popup scrolling and character-aware typing stay responsive with a long screenplay", async ({
  page,
}, testInfo) => {
  await setup(page);
  const long =
    "INT. ROOM - DAY\n\n" +
    Array.from(
      { length: 450 },
      (_, i) =>
        `!A quiet moment ${i}.\n\n${i % 3 === 0 ? "ELI" : "MARA"}\nThe next line of dialogue is ${i}.\n\n`,
    ).join("") +
    "!The final moment.";
  await open(page, long, "Long cast.fountain");
  const editor = page.getByRole("textbox", { name: "Screenplay editor" });
  await expect(editor).toContainText("The final moment.");
  await page
    .getByRole("complementary", { name: "Screenplay insights" })
    .getByRole("button", { name: /^MARA / })
    .click();
  const dialog = page.getByRole("dialog", { name: "MARA", exact: true });
  await expect(dialog).toBeVisible();
  const cdp = await page.context().newCDPSession(page);
  const object = (
    await cdp.send("Runtime.evaluate", {
      expression: 'document.querySelector("dialog[open]")',
    })
  ).result.objectId!;
  const listeners = await cdp.send("DOMDebugger.getEventListeners", {
    objectId: object,
  });
  expect(
    listeners.listeners.filter(
      (l) => ["wheel", "touchmove"].includes(l.type) && !l.passive,
    ),
  ).toHaveLength(0);
  expect(
    await dialog.evaluate(
      (el) => getComputedStyle(el, "::backdrop").backdropFilter,
    ),
  ).toBe("none");
  await dialog.evaluate((el) => (el.scrollTop = el.scrollHeight));
  const list = dialog.locator(".speech-list");
  await list.hover();
  const before = await page
    .locator(".writing-scroll")
    .evaluate((el) => el.scrollTop);
  await page.evaluate(() => {
    const scope = window as unknown as {
      frameGaps: number[];
      profile: boolean;
    };
    scope.frameGaps = [];
    scope.profile = true;
    let previous = performance.now();
    function frame(now: number) {
      scope.frameGaps.push(now - previous);
      previous = now;
      if (scope.profile) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
  for (let i = 0; i < 24; i++) await page.mouse.wheel(0, 40);
  const frames = await page.evaluate(() => {
    const scope = window as unknown as {
      frameGaps: number[];
      profile: boolean;
    };
    scope.profile = false;
    return scope.frameGaps.sort((a, b) => a - b);
  });
  expect(await list.evaluate((el) => el.scrollTop)).toBeGreaterThan(100);
  expect(
    await page.locator(".writing-scroll").evaluate((el) => el.scrollTop),
  ).toBe(before);
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await editor.locator("p").last().click();
  await page.keyboard.press(mod === "Meta" ? "Meta+ArrowRight" : "End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("MA");
  await page.keyboard.press("Tab");
  await expect(editor.locator("p").last()).toHaveText("MARA");
  await page.keyboard.press("Enter");
  await page.evaluate(() => {
    const scope = window as unknown as { typingTimes: number[] };
    scope.typingTimes = [];
    let start = 0;
    const el = document.querySelector(".screenplay-editor")!;
    el.addEventListener("keydown", () => {
      start = performance.now();
    });
    el.addEventListener("input", () => {
      const began = start;
      requestAnimationFrame(() =>
        scope.typingTimes.push(performance.now() - began),
      );
    });
  });
  await page.keyboard.type(
    "The story keeps moving and the words arrive without waiting. ".repeat(3),
    { delay: 8 },
  );
  const times = await page.evaluate(() =>
    (window as unknown as { typingTimes: number[] }).typingTimes.sort(
      (a, b) => a - b,
    ),
  );
  const scrollP95 = frames[Math.floor(frames.length * 0.95)];
  const typingP95 = times[Math.floor(times.length * 0.95)];
  await testInfo.attach("popup-and-cast-performance", {
    body: JSON.stringify({ blocks: 1352, cues: 450, scrollP95, typingP95 }),
    contentType: "application/json",
  });
  console.log(
    `Long cast: popup frame p95 ${scrollP95.toFixed(1)} ms, typing p95 ${typingP95.toFixed(1)} ms`,
  );
  expect(times.length).toBeGreaterThan(100);
  expect(typingP95).toBeLessThan(75);
});
