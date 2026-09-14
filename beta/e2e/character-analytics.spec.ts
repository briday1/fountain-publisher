import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const ensemble = `Title: The Crossing
Author: A Writer

# Act I

INT. STATION - DAY

The train waits.

MARA
You said the train would wait.
We still have time.

ELI
Not much.

EXT. PLATFORM - DAY

An announcement crackles through the station.

MARA
Then we leave together.

# Act II

INT. TRAIN - NIGHT

JUNE
Tickets, please.

MARA
Two for the next stop.
`;

async function openScript(page: Page, source = ensemble) {
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
  await page.getByRole("button", { name: "File", exact: true }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /^Open screenplay/ }).click();
  await (
    await chooser
  ).setFiles({
    name: "Character analytics.fountain",
    mimeType: "text/plain",
    buffer: Buffer.from(source),
  });
  await expect(
    page.getByRole("textbox", { name: "Screenplay editor" }),
  ).toContainText("MARA");
}

test("character analytics restores cast overview, scene and act Gantts, PNG export, and full dialogue browsing", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openScript(page);
  await page
    .getByRole("button", { name: /^Character analytics(?: →)?$/ })
    .click();
  const overview = page.getByRole("dialog", {
    name: "Character Analytics",
    exact: true,
  });
  await expect(overview).toBeVisible();
  await expect(
    overview.getByRole("img", {
      name: "MARA, INT. STATION - DAY: 2 lines",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    overview.getByRole("button", {
      name: "View Act II character Gantt",
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("characters-overview.png"),
    fullPage: true,
  });
  const sceneHeader = overview.getByRole("button", {
    name: "View Scene 1: INT. STATION - DAY character Gantt",
    exact: true,
  });
  await sceneHeader.focus();
  await page.keyboard.press("Enter");
  const scene = page.getByRole("dialog", {
    name: "Scene 1 Character Gantt",
    exact: true,
  });
  await expect(scene).toBeVisible();
  await expect(
    scene.getByRole("img", {
      name: "MARA: 6 dialogue words, starting at word 3",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    scene.getByRole("img", {
      name: "ELI: 2 dialogue words, starting at word 13",
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("characters-scene-gantt.png"),
    fullPage: true,
  });
  const downloadEvent = page.waitForEvent("download");
  await scene.getByRole("button", { name: "Save PNG", exact: true }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe(
    "The Crossing-character-analytics.png",
  );
  const path = await download.path();
  expect(path).not.toBeNull();
  const png = await readFile(path!);
  expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(png.readUInt32BE(16)).toBeGreaterThanOrEqual(1820);
  expect(png.readUInt32BE(20)).toBe(268);
  await scene.getByRole("button", { name: "Overview", exact: true }).click();
  await overview
    .getByRole("button", { name: "View Act I character Gantt", exact: true })
    .click();
  const act = page.getByRole("dialog", {
    name: "Act I Character Gantt",
    exact: true,
  });
  await expect(act).toBeVisible();
  await expect(
    act.getByRole("img", {
      name: "MARA: 4 dialogue words, starting at word 21",
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("characters-act-gantt.png"),
    fullPage: true,
  });
  await act
    .getByRole("button", { name: "View all MARA dialogue", exact: true })
    .click();
  const dialogue = page.getByRole("dialog", { name: "MARA", exact: true });
  await expect(dialogue).toBeVisible();
  await expect(dialogue).toContainText("You said the train would wait.");
  await expect(dialogue).toContainText("Then we leave together.");
  await expect(dialogue).toContainText("Two for the next stop.");
  await dialogue
    .getByRole("button", { name: /^All character analytics/ })
    .click();
  await expect(overview).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(overview).not.toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Screenplay editor" }),
  ).toContainText("Two for the next stop.");
  expect(errors).toEqual([]);
});

test("single-scene analytics opens its Gantt directly and remains scrollable on mobile", async ({
  page,
}, testInfo) => {
  await openScript(page, "INT. ROOM - DAY\n\nMARA\nOne clear line.\n");
  await page
    .getByRole("button", { name: /^Character analytics(?: →)?$/ })
    .click();
  const chart = page.getByRole("dialog", {
    name: "Scene 1 Character Gantt",
    exact: true,
  });
  await expect(chart).toBeVisible();
  await expect(
    chart.getByRole("button", { name: "Overview", exact: true }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    chart.getByRole("button", { name: "Close character analytics" }),
  ).toBeVisible();
  const viewport = chart.getByRole("region", {
    name: "Scrollable character analytics chart",
  });
  expect(
    await viewport.evaluate(
      (element) => element.scrollWidth > element.clientWidth,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("characters-mobile-gantt.png"),
    fullPage: true,
  });
  await chart.getByRole("button", { name: "Go to scene", exact: true }).click();
  await expect(chart).not.toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Screenplay editor" }),
  ).toBeFocused();
});
