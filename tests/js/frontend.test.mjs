import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import test from "node:test";

const appPath = new URL("../../src/fountain_publisher/web/app.mjs", import.meta.url);
const htmlPath = new URL("../../src/fountain_publisher/web/index.html", import.meta.url);
const cssPath = new URL("../../src/fountain_publisher/web/styles.css", import.meta.url);

test("browser module has valid JavaScript syntax", () => {
  const result = spawnSync(process.execPath, ["--check", appPath.pathname], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
});

test("application shell exposes editing, preview, and insights regions", async () => {
  const html = await readFile(htmlPath, "utf8");
  assert.match(html, /id="source"/);
  assert.match(html, /id="screenplay-page"/);
  assert.match(html, /id="stats-panel"/);
  assert.match(html, /id="export-pdf"/);
});

test("hidden preview layers cannot be displayed by component styles", async () => {
  const css = await readFile(cssPath, "utf8");
  assert.match(css, /\[hidden\]\s*\{\s*display:\s*none\s*!important;/);
});

test("live compilation cancels stale requests and omits rendered HTML", async () => {
  const app = await readFile(appPath, "utf8");
  assert.match(app, /compileController\?\.abort\(\)/);
  assert.match(app, /includeHtml:\s*true/);
});

test("workspace regions keep their grid columns when sidebars collapse", async () => {
  const css = await readFile(cssPath, "utf8");
  assert.match(css, /\.preview-panel\s*\{\s*grid-column:\s*4;/);
  assert.match(css, /#stats-panel\s*\{\s*grid-column:\s*7;/);
  assert.match(css, /grid-template-rows:\s*minmax\(0,\s*1fr\)/);
});

test("side panels use one control and center collapsed labels", async () => {
  const [html, css] = await Promise.all([readFile(htmlPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.doesNotMatch(html, /class="panel-close"/);
  assert.match(html, /class="panel-toggle source-toggle"[^>]*><span>‹<\/span><b>Source<\/b>/);
  assert.match(html, /class="panel-toggle stats-toggle"[^>]*><span>›<\/span><b>Insights<\/b>/);
  assert.match(css, /source-collapsed \.source-toggle\s*\{[^}]*justify-content:\s*center;[^}]*gap:\s*8px;/s);
  assert.match(css, /stats-collapsed \.stats-toggle\s*\{[^}]*justify-content:\s*center;[^}]*gap:\s*8px;/s);
});

test("live and PDF previews have bounded scrolling containers", async () => {
  const [app, css] = await Promise.all([readFile(appPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.match(css, /\.preview-scroll\s*\{[^}]*overflow:\s*auto;/s);
  assert.match(css, /\.preview-scroll\.pdf-mode\s*\{[^}]*overflow:\s*hidden;/s);
  assert.match(css, /#pdf-frame\s*\{[^}]*height:\s*100%;/s);
  assert.match(app, /classList\.toggle\("pdf-mode",\s*mode\s*===\s*"pdf"\)/);
});

test("toolbar menus use Pugflow-style popup interaction", async () => {
  const [app, css] = await Promise.all([readFile(appPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.match(css, /\.toolbar-menu\s*\{[^}]*height:\s*30px;/s);
  assert.match(css, /\.toolbar-popover\s*\{[^}]*position:\s*absolute;[^}]*width:\s*210px;/s);
  assert.match(app, /document\.addEventListener\("pointerdown"/);
  assert.match(app, /event\.target\.closest\("summary"\)\) closeMenus\(menu\)/);
});

test("source and preview share syntax, cursor, and character completion behavior", async () => {
  const [html, app, css] = await Promise.all([readFile(htmlPath, "utf8"), readFile(appPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.match(html, /id="source-highlight"/);
  assert.match(html, /id="preview-completion-menu"/);
  assert.match(app, /function renderSourceSyntax\(/);
  assert.match(app, /showPreviewCharacterCompletions\(line\)/);
  assert.match(app, /\.classList\.add\("source-current"\)/);
  assert.match(css, /\.syntax-character/);
  assert.match(css, /\.script-line\.source-current/);
});

test("completion is Tab-only and preview suggestions are caret-positioned", async () => {
  const app = await readFile(appPath, "utf8");
  assert.doesNotMatch(app, /event\.key === "Enter" \|\| event\.key === "Tab"/);
  assert.match(app, /function positionPreviewCompletion\(/);
  assert.match(app, /caret\.getClientRects\(\)\[0\]/);
});

test("spellcheck exposes native replacement suggestions", async () => {
  const [html, app] = await Promise.all([readFile(htmlPath, "utf8"), readFile(appPath, "utf8")]);
  assert.match(html, /Right-click spelling for suggestions/);
  assert.match(html, /aria-describedby="editor-status spellcheck-help"/);
  assert.match(app, /setAttribute\("spellcheck", String\(enabled\)\)/);
  assert.match(app, /source\.blur\(\); source\.focus\(\)/);
});

test("dark mode inverts the screenplay page and toolbar uses SVG arrows", async () => {
  const [html, css] = await Promise.all([readFile(htmlPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.match(css, /--paper:\s*#17191b/);
  assert.match(css, /--paper-ink:\s*#f1f1ef/);
  assert.match(html, /id="undo"[^>]*><svg/);
  assert.match(html, /id="redo"[^>]*><svg/);
});

test("theme control uses Pugflow-style sun and moon icons", async () => {
  const [html, app, css] = await Promise.all([readFile(htmlPath, "utf8"), readFile(appPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.match(html, /class="theme-icon theme-sun"/);
  assert.match(html, /class="theme-icon theme-moon"/);
  assert.match(app, /dataset\.effectiveTheme/);
  assert.match(css, /data-effective-theme="dark"[^}]*\.theme-sun\s*\{\s*display:\s*none;/);
});

test("blank documents retain a page and title inference is constrained", async () => {
  const app = await readFile(appPath, "utf8");
  assert.match(app, /page\.hidden = state\.previewMode !== "live"/);
  assert.match(app, /const TITLE_KEYS = new Set/);
  assert.match(app, /titleContinuation/);
});

test("the long sample screenplay is opt-in with demo=1", async () => {
  const app = await readFile(appPath, "utf8");
  assert.match(app, /params\.get\("demo"\)\s*===\s*"1"\s*\?\s*SAMPLE\s*:\s*""/);
  assert.match(app, /let name = params\.get\("demo"\)\s*===\s*"1"/);
  const sample = app.match(/const SAMPLE = `([\s\S]*?)`;/)?.[1] || "";
  assert.ok(sample.split(/\s+/).length > 450, "demo should remain substantial");
  assert.doesNotMatch(sample, /FADE IN:|FADE OUT\.|CUT TO:/);
  assert.match(sample, />\*\*END\*\*</);
});

test("the active non-printing line remains visible as editor context", async () => {
  const css = await readFile(cssPath, "utf8");
  assert.match(css, /\.script-line\.section\.source-current/);
  assert.match(css, /content:\s*"EDITOR ONLY/);
});

test("scene outline clicks synchronize source and live preview", async () => {
  const app = await readFile(appPath, "utf8");
  assert.match(app, /function jumpToLine[\s\S]*updateCursor\(\{ scrollPreview: true \}\)/);
  assert.match(app, /#scene-list[\s\S]*jumpToLine\(Number\(button\.dataset\.line\)\)/);
});

test("live preview automatically prefixes scene headings", async () => {
  const app = await readFile(appPath, "utf8");
  assert.match(app, /`\$\{sceneNumber\}\. \$\{line\.display/);
  assert.match(app, /if \(lines\[i\]\.type === "scene"\) sceneNumber \+= 1/);
  assert.match(app, /paragraph\.line = plain\(f"\{number\}\. "\) \+ paragraph\.line/);
});

test("preview status, rotating arrows, and character table stay compact", async () => {
  const [html, app, css] = await Promise.all([readFile(htmlPath, "utf8"), readFile(appPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.match(html, /id="page-estimate">1\/1/);
  assert.doesNotMatch(html, /id="preview-percent"/);
  assert.doesNotMatch(css, /\.preview-status/);
  assert.match(app, /function updatePreviewStatus\(/);
  assert.match(app, /page-estimate"\)\.textContent = `\$\{current\}\/\$\{total\}`/);
  assert.match(css, /source-collapsed \.source-toggle span\s*\{\s*transform:\s*rotate\(180deg\)/);
  assert.match(css, /stats-collapsed \.stats-toggle span\s*\{\s*transform:\s*rotate\(180deg\)/);
  assert.match(app, /<table><thead><tr><th>Character<\/th><th>Lines<\/th><th>Duration<\/th>/);
});

test("document balance heading aligns with other insight labels", async () => {
  const css = await readFile(cssPath, "utf8");
  assert.match(css, /\.insight-section > summary\s*\{[^}]*justify-content:\s*flex-start;/s);
  assert.match(css, /\.insight-section > summary small\s*\{[^}]*margin-left:\s*auto;/s);
});

test("in-app documentation teaches the editor and Fountain syntax", async () => {
  const [html, app, css] = await Promise.all([readFile(htmlPath, "utf8"), readFile(appPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.match(html, /id="docs-dialog"/);
  assert.match(html, /Fountain format/);
  assert.match(html, /Forced elements and formatting/);
  assert.match(html, /Dual dialogue/);
  assert.match(app, /#docs-dialog"\)\.showModal\(\)/);
  assert.match(css, /\.docs-layout\s*\{[^}]*grid-template-columns:\s*175px 1fr;/s);
});

test("character table supports selection and CSV clipboard export", async () => {
  const [app, css] = await Promise.all([readFile(appPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.match(app, /data-copy-characters>Copy CSV/);
  assert.match(app, /navigator\.clipboard\.writeText\(text\)/);
  assert.match(app, /row\.map\(csvCell\)\.join\(","\)/);
  assert.match(app, /\["Character", "Lines", "Duration"\]/);
  assert.match(css, /\.character-list table\s*\{[^}]*user-select:\s*text;/s);
});

test("source word wrap defaults on and preserves logical line numbers", async () => {
  const [html, app, css] = await Promise.all([readFile(htmlPath, "utf8"), readFile(appPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.match(html, /id="word-wrap"[^>]*checked/);
  assert.match(app, /function sourceVisualRows\(/);
  assert.match(app, /source\.setAttribute\("wrap", enabled \? "soft" : "off"\)/);
  assert.match(css, /body\.source-wrap #source/);
});

test("shared undo and redo work from source and screenplay focus", async () => {
  const app = await readFile(appPath, "utf8");
  assert.match(app, /function undoDocument\(\)/);
  assert.match(app, /function redoDocument\(\)/);
  assert.doesNotMatch(app, /execCommand\("undo"\)/);
  assert.match(app, /page\.contains\(document\.activeElement\)/);
  assert.match(app, /event\.shiftKey \? redoDocument\(\) : undoDocument\(\)/);
  assert.match(app, /event\.key\.toLowerCase\(\) === "y"/);
});

test("dual dialogue renders concurrently in the live screenplay", async () => {
  const [html, app, css] = await Promise.all([readFile(htmlPath, "utf8"), readFile(appPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.match(app, /raw\.trim\(\)\.endsWith\("\^"\)/);
  assert.match(app, /class="dual-dialog"/);
  assert.match(css, /\.dual-dialog\s*\{[^}]*grid-template-columns:\s*1fr 1fr;/s);
  assert.match(html, /JANE \^/);
  assert.match(html, /Windows \/ Linux/);
});

test("GitHub Pages mode runs Screenplain in Pyodide", async () => {
  const app = await readFile(appPath, "utf8");
  assert.match(app, /STATIC_HOST = location\.hostname\.endsWith\("\.github\.io"\)/);
  assert.match(app, /function getBrowserScreenplain\(/);
  assert.match(app, /screenplain-0\.12\.0-py3-none-any\.whl/);
  assert.match(app, /pdf\.to_pdf\(screenplay, output, settings=settings\)/);
  assert.match(app, /STATIC_HOST[\s\S]*Browser preview/);
});
