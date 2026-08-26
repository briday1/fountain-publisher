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

test("live compilation cancels stale requests and HTML export is absent", async () => {
  const [html, app] = await Promise.all([readFile(htmlPath, "utf8"), readFile(appPath, "utf8")]);
  assert.match(app, /compileController\?\.abort\(\)/);
  assert.doesNotMatch(html, /export-html|HTML document/);
  assert.doesNotMatch(app, /includeHtml:\s*true|compileWithBrowserScreenplain\("html"/);
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
  assert.match(app, /params\.get\("demo"\)\s*===\s*"1"\s*\?\s*SAMPLE\s*:\s*BLANK_TEMPLATE/);
  assert.match(app, /let name = params\.get\("demo"\)\s*===\s*"1"/);
  const sample = app.match(/const SAMPLE = `([\s\S]*?)`;/)?.[1] || "";
  assert.ok(sample.split(/\s+/).length > 450, "demo should remain substantial");
  assert.doesNotMatch(sample, /FADE IN:|FADE OUT\.|CUT TO:/);
  assert.match(sample, />\*\*END\*\*</);
  assert.match(app, /function fountainInlineHtml[\s\S]*<strong>\$1<\/strong>/);
  assert.match(app, /const content = display \? fountainInlineHtml\(display\)/);
});

test("new documents open to a blank canvas with starter helpers", async () => {
  const [html, app] = await Promise.all([readFile(htmlPath, "utf8"), readFile(appPath, "utf8")]);
  const template = app.match(/const BLANK_TEMPLATE = `([\s\S]*?)`;/)?.[1] ?? "";
  assert.equal(template, "");
  assert.match(html, /id="title-page-dialog"/);
  assert.match(html, /id="insert-title-page"/);
  assert.match(html, /id="insert-scene"/);
  assert.match(html, /id="insert-dialogue"/);
});

test("the active non-printing line remains visible as editor context", async () => {
  const css = await readFile(cssPath, "utf8");
  assert.match(css, /\.script-line\.section\.source-current/);
  assert.match(css, /content:\s*"EDITOR ONLY/);
});

test("scene outline clicks synchronize source and live preview", async () => {
  const app = await readFile(appPath, "utf8");
  assert.match(app, /function jumpToLine[\s\S]*updateCursor\(\{ scrollPreview: true \}\)/);
  assert.match(app, /function jumpToInsightScene[\s\S]*jumpToLine\(oneBased, false\)/);
  assert.match(app, /#scene-list[\s\S]*jumpToInsightScene\(Number\(button\.dataset\.line\)\)/);
  assert.match(app, /function setMobileTab[\s\S]*requestAnimationFrame\(\(\) => jumpToLine\(state\.insightLine, false\)\)/);
});

test("live preview numbers scene headings via computed labels", async () => {
  const app = await readFile(appPath, "utf8");
  assert.match(app, /function computeSceneLabels\(/);
  assert.match(app, /line\.display\.replace\(\/\^\\\.\//);
  assert.match(app, /sceneLabels\.get\(lines\[i\]\.index\)/);
  assert.match(app, /paragraph\.line = plain\(f"\{label\}\. "\) \+ paragraph\.line/);
});

test("page totals come from the compiled Screenplain PDF", async () => {
  const app = await readFile(appPath, "utf8");
  assert.match(app, /metadata\.pageCount \?\? "—"/);
  assert.match(app, /function compileStaticPageCount/);
  assert.match(app, /result\.pageCount == null[\s\S]*\/api\/render\/pdf/);
  assert.match(app, /function countPdfBlobPages/);
  assert.match(app, /physicalPages - \(excludeTitlePage \? 1 : 0\)/);
  assert.match(app, /_fp_prepare_screenplay[\s\S]*isinstance\(screenplay\.paragraphs\[0\], PageBreak\)/);
  assert.ok(app.includes('/Type\\s*\\/Page\\b'));
});

test("preview toolbar, rotating arrows, and character table stay compact", async () => {
  const [html, app, css] = await Promise.all([readFile(htmlPath, "utf8"), readFile(appPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.doesNotMatch(html, /id="page-estimate"/);
  assert.doesNotMatch(html, /id="preview-percent"/);
  assert.doesNotMatch(css, /\.preview-status/);
  assert.doesNotMatch(app, /function updatePreviewStatus\(/);
  assert.match(css, /source-collapsed \.source-toggle span\s*\{\s*transform:\s*rotate\(180deg\)/);
  assert.match(css, /stats-collapsed \.stats-toggle span\s*\{\s*transform:\s*rotate\(180deg\)/);
  assert.match(app, /<table><thead><tr><th>Character<\/th><th>Lines<\/th><th>Duration<\/th>/);
});

test("document balance heading aligns with other insight labels", async () => {
  const css = await readFile(cssPath, "utf8");
  assert.match(css, /\.insight-section > summary\s*\{[^}]*justify-content:\s*flex-start;/s);
  assert.match(css, /\.insight-section > summary small\s*\{[^}]*margin-left:\s*auto;/s);
});

test("empty scene messages use the full list width", async () => {
  const css = await readFile(cssPath, "utf8");
  assert.match(css, /\.scene-list li\.empty-list\s*\{\s*display:\s*block;/);
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
  assert.doesNotMatch(app, /\.map\(previewLineHtml\)/);
  assert.match(css, /\.dual-dialog\s*\{[^}]*grid-template-columns:\s*1fr 1fr;/s);
  assert.match(html, /JANE \^/);
  assert.match(html, /Windows \/ Linux/);
});

test("GitHub Pages mode runs Screenplain in Pyodide", async () => {
  const app = await readFile(appPath, "utf8");
  assert.match(app, /STATIC_HOST = location\.hostname\.endsWith\("\.github\.io"\)/);
  assert.match(app, /function getBrowserScreenplain\(/);
  assert.match(app, /screenplain-0\.12\.0-py3-none-any\.whl/);
  assert.match(app, /CourierPrime-Regular\.ttf/);
  assert.match(app, /\/fonts\/CourierPrime-Regular\.ttf/);
  assert.match(app, /pdf\.to_pdf\(screenplay, output, template_constructor=NumberedDocTemplate, settings=settings\)/);
  assert.match(app, /STATIC_HOST \? compileStaticPageCount\(revision\) : compile\(revision\)/);
});

test("custom static hosts fall back to browser compilation instead of parsing HTML", async () => {
  const app = await readFile(appPath, "utf8");
  assert.match(app, /shouldUseBrowserCompiler\(response,\s*"application\/json"\)/);
  assert.match(app, /STATIC_HOST = true;\s*await compileStaticPageCount\(revision\)/);
  assert.match(app, /shouldUseBrowserCompiler\(response,\s*expectedType\)/);
  assert.match(app, /STATIC_HOST = true;\s*return compileBinaryWithBrowser\(path,\s*selectedPageSize\)/);
});

test("scene numbers default to margin, support act format, and apply to PDF", async () => {
  const [html, app, css] = await Promise.all([readFile(htmlPath, "utf8"), readFile(appPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.match(app, /sceneNumbers.*"margin"/);
  assert.match(app, /sceneNumberFormat.*"sequential"/);
  assert.match(app, /function computeSceneLabels\(/);
  assert.match(app, /A\$\{Math\.max\(actNum,\s*1\)\}S\$\{actSceneNum\}/);
  assert.match(css, /body\.scene-nums-margin.*::before/s);
  assert.match(css, /position:\s*absolute;/);
  assert.match(html, /id="scene-num-placement"/);
  assert.match(html, /id="scene-num-format"/);
});

test("mobile shows one panel at a time via tab bar", async () => {
  const [html, app, css] = await Promise.all([readFile(htmlPath, "utf8"), readFile(appPath, "utf8"), readFile(cssPath, "utf8")]);
  // Tab bar exists in HTML
  assert.match(html, /class="mobile-panel-tabs"/);
  assert.match(html, /data-mobile-panel="source"/);
  assert.match(html, /data-mobile-panel="preview"/);
  assert.match(html, /data-mobile-panel="stats"/);
  // Mobile media query hides non-active panels
  assert.match(css, /\.mobile-panel-tabs\s*\{\s*display:\s*none;/);
  assert.match(css, /max-width:\s*640px/);
  assert.match(css, /body\[data-mobile-tab="source"\] #source-panel\s*\{\s*display:\s*flex;/);
  assert.match(css, /body\[data-mobile-tab="preview"\] \.preview-panel\s*\{\s*display:\s*flex;/);
  assert.match(css, /body\[data-mobile-tab="stats"\] #stats-panel\s*\{\s*display:\s*flex/);
  // JS function exists and persists choice
  assert.match(app, /function setMobileTab\(/);
  assert.match(app, /localStorage\.setItem\("fountain-publisher\.mobile-tab"/);
  assert.match(app, /dataset\.mobileTab = panel/);
});

test("character completions appear in preview regardless of line position", async () => {
  const app = await readFile(appPath, "utf8");
  // previousBlank restriction must be absent from the showPreviewCharacterCompletions function body
  const fnMatch = app.match(/function showPreviewCharacterCompletions\([^)]*\)\s*\{[^}]*\}/);
  assert.ok(fnMatch, "showPreviewCharacterCompletions function should exist");
  assert.doesNotMatch(fnMatch[0], /previousBlank/);
  // The function still filters by uppercase pattern
  assert.match(fnMatch[0], /\/\^\[A-Z\]/);
});

test("mobile preview tab hides the Preview/PDF view-switcher", async () => {
  const css = await readFile(cssPath, "utf8");
  // The view-switcher must be hidden inside the mobile media query
  assert.match(css, /@media\s*\(max-width:\s*640px\)[^}]*\{[^@]*\.view-switcher\s*\{\s*display:\s*none;/s);
});

test("mobile PDF export path remains accessible via toolbar File menu", async () => {
  const html = await readFile(htmlPath, "utf8");
  // Export PDF button must exist in the toolbar (not inside .view-switcher)
  assert.match(html, /id="export-pdf"/);
  // The export dialog must include a PDF format option
  assert.match(html, /id="export-dialog"/);
  assert.match(html, /value="pdf"[^>]*>PDF screenplay/);
});

test("mobile Insights layout has responsive overflow and wrapping rules", async () => {
  const css = await readFile(cssPath, "utf8");
  // Inside the mobile media query: character-list allows horizontal scroll
  assert.match(css, /@media\s*\(max-width:\s*640px\)[^@]*\.character-list\s*\{[^}]*overflow-x:\s*auto;/s);
  // Inside the mobile media query: scene list buttons wrap text
  assert.match(css, /@media\s*\(max-width:\s*640px\)[^@]*\.scene-list button\s*\{[^}]*white-space:\s*normal;/s);
});

test("line numbers are correct before the source panel is interacted with", async () => {
  const app = await readFile(appPath, "utf8");
  // sourceWrapColumns must bail out (return Infinity) when clientWidth is 0
  // so line numbers don't go sparse on hidden panels (mobile or any init state)
  assert.match(app, /function sourceWrapColumns[\s\S]*?if \(!source\.clientWidth\) return Infinity;/);
  // setMobileTab must re-render editor chrome when switching to source tab
  assert.match(app, /function setMobileTab[\s\S]*?if \(panel === "source"\) renderEditorChrome\(\);/);
});

test("browser Screenplain compile handles missing style attributes defensively", async () => {
  const app = await readFile(appPath, "utf8");
  // slug_style access must be guarded
  assert.match(app, /hasattr\(settings,\s*"slug_style"\)/);
  // style loop uses getattr with None default
  assert.match(app, /getattr\(settings,\s*style_name,\s*None\)/);
  // handle_pageBegin uses getattr for font_settings
  assert.match(app, /getattr\(_font_settings,\s*"family_name",\s*"Courier"\)/);
});

test("mobile PDF export downloads directly without opening the share sheet", async () => {
  const app = await readFile(appPath, "utf8");
  assert.match(app, /async function download\(/);
  assert.match(app, /anchor\.download = filename/);
  assert.doesNotMatch(app, /navigator\.share/);
  assert.match(app, /await download\(blob,/);
});

test("compiler failures expose actionable desktop and browser errors", async () => {
  const app = await readFile(appPath, "utf8");
  assert.match(app, /Desktop compiler unavailable:.*Restart Fountain Publisher/);
  assert.match(app, /Browser PDF compiler failed:.*Reload the page/);
  assert.match(app, /function shouldUseBrowserCompiler\(/);
});

test("mobile page count is preserved across source edits", async () => {
  const app = await readFile(appPath, "utf8");
  // analyzeLocally must carry the current pageCount from state so it survives re-renders
  assert.match(app, /pageCount:\s*state\.metadata\?\.pageCount \?\? null/);
});

test("mobile toolbar compresses the about menu and fixes popover visibility", async () => {
  const [html, css] = await Promise.all([readFile(htmlPath, "utf8"), readFile(cssPath, "utf8")]);
  // HTML: about-menu text wrapped in a class so it can be hidden on mobile
  assert.match(html, /class="about-label"/);
  // HTML: toolbar menus have individual classes
  assert.match(html, /class="toolbar-menu file-menu"/);
  assert.match(html, /class="toolbar-menu view-menu"/);
  assert.match(html, /class="toolbar-menu help-menu"/);
  // CSS: view-menu and help-menu are hidden on mobile
  assert.match(css, /@media\s*\(max-width:\s*640px\)[^@]*\.view-menu,\s*\.help-menu\s*\{\s*display:\s*none;/s);
  // CSS: popovers use position:fixed on mobile so they are always in-viewport
  assert.match(css, /@media\s*\(max-width:\s*640px\)[^@]*\.toolbar-popover\s*\{[^}]*position:\s*fixed;/s);
  // CSS: about label is hidden on mobile
  assert.match(css, /@media\s*\(max-width:\s*640px\)[^@]*\.about-label\s*\{\s*display:\s*none;/s);
});
