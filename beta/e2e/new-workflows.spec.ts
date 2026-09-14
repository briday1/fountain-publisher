import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { parseFountain, serializeFountain } from "../src/core/fountain";
import { sceneBeatRange, resolveBeatRange } from "../src/core/beatRanges";
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
  await page
    .getByRole("button", { name: "Export highlighted PDF…", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Export highlighted PDF",
    exact: true,
  });
  const exportButton = dialog.getByRole("button", {
    name: "Export highlighted PDF",
    exact: true,
  });
  await expect(exportButton).toBeDisabled();
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

test("old scene-wide beat imports can restore original precise ranges without changing writing", async ({
  page,
}) => {
  const body =
    "INT. ROOM - NIGHT\n\nFirst moment.\n\nMARA\nHello.\n\nSecond moment.\n\nMARA\nGoodbye.";
  const raw = [
    { text: "Arrival", range: { startLine: 2, endLine: 5 } },
    { text: "Departure", range: { startLine: 7, endLine: 10 } },
  ];
  const original =
    body +
    "\n\n[[FP-BEATS:" +
    encodeURIComponent(JSON.stringify({ beats: raw })) +
    "]]";
  const draft = parseFountain(original);
  draft.metadata.beats = draft.metadata.beats.map((beat, i) => ({
    ...beat,
    legacyRange: raw[i].range,
    range: sceneBeatRange(draft, draft.blocks[0].id),
  }));
  await setup(page);
  await open(page, serializeFountain(draft));
  await expect(
    page.getByRole("textbox", { name: "Screenplay editor" }),
  ).toContainText("Goodbye.");
  await page.getByRole("button", { name: "Beat sheet", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Beat sheet", exact: true });
  const file = page.waitForEvent("filechooser");
  await dialog
    .getByRole("button", { name: "Restore original beat ranges…" })
    .click();
  await (
    await file
  ).setFiles({
    name: "Original.fountain",
    mimeType: "text/plain",
    buffer: Buffer.from(original),
  });
  await expect(
    dialog.getByRole("button", { name: "Restore original beat ranges…" }),
  ).toHaveCount(0);
  const expected = parseFountain(original);
  for (const [i, beat] of expected.metadata.beats.entries()) {
    const range = resolveBeatRange(expected, beat.range!)!;
    await dialog
      .getByRole("button", { name: `Beat ${i + 1} details`, exact: true })
      .click();
    await expect(
      dialog.getByRole("spinbutton", {
        name: `Beat ${i + 1} start line`,
        exact: true,
      }),
    ).toHaveValue(String(range.startLine));
    await expect(
      dialog.getByRole("spinbutton", {
        name: `Beat ${i + 1} end line`,
        exact: true,
      }),
    ).toHaveValue(String(range.endLine));
  }
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
