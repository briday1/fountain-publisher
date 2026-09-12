import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { runInNewContext } from "node:vm";

const appPath = new URL("../../src/fountain_publisher/web/app.mjs", import.meta.url);
const htmlPath = new URL("../../src/fountain_publisher/web/index.html", import.meta.url);
const cssPath = new URL("../../src/fountain_publisher/web/styles.css", import.meta.url);
const workerPath = new URL("../../src/fountain_publisher/web/service-worker.js", import.meta.url);
const runtimeSource = await readFile(new URL("../../src/fountain_publisher/web/compiler-runtime.mjs", import.meta.url), "utf8");

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

test("local file opening accepts text-based screenplay PDFs for Fountain reconstruction", async () => {
  const [html, app, notices, pyproject] = await Promise.all([
    readFile(htmlPath, "utf8"), readFile(appPath, "utf8"),
    readFile(new URL("../../src/fountain_publisher/web/THIRD_PARTY_NOTICES.md", import.meta.url), "utf8"),
    readFile(new URL("../../pyproject.toml", import.meta.url), "utf8"),
  ]);
  assert.match(html, /Open Fountain or PDF/);
  assert.match(html, /Text-based PDFs are reconstructed locally/);
  assert.match(app, /function pdfLayoutToFountain\(pages\)[\s\S]*scenePattern[\s\S]*titlePage[\s\S]*const character[\s\S]*const type/);
  assert.match(app, /function stagePlayLayoutToFountain\(pages\)[\s\S]*castNames[\s\S]*matchCue[\s\S]*# Cast of Characters[\s\S]*# \$\{text\.toUpperCase\(\)\}/);
  assert.match(app, /function flattenedScreenplayToFountain\(value\)[\s\S]*cueIndexes[\s\S]*Credit:[\s\S]*beginsAction/);
  assert.match(app, /function normalizeScreenplayPaste\(value\)[\s\S]*u2028[\s\S]*alreadyFountain[\s\S]*INT\|EXT[\s\S]*positionedCue[\s\S]*pageArtifacts[\s\S]*flattenedCueCount[\s\S]*flattenedScreenplayToFountain\(text\)[\s\S]*pdfLayoutToFountain\(\[text\]\)/);
  assert.match(app, /source\.addEventListener\("paste"[\s\S]*clipboardTextForEditor\(pasted\)[\s\S]*setRangeText/);
  assert.match(app, /page\.addEventListener\("paste"[\s\S]*clipboardTextForEditor[\s\S]*replacePreviewSelection/);
  assert.match(html, /paste text copied from a conventionally formatted screenplay PDF/);
  assert.match(app, /async function importPdfFile\(file\)[\s\S]*file\.arrayBuffer\(\)[\s\S]*fetch\("\/healthz", \{ cache: "no-store" \}\)[\s\S]*health\?\.status === "ok"[\s\S]*if \(!localPython\)[\s\S]*compilerClient\.extractPdf\(bytes\)[\s\S]*\/api\/import\/pdf[\s\S]*pdfLayoutToFountain\(pages\)[\s\S]*\.fountain/);
  assert.match(runtimeSource, /pypdf-6\.17\.0-py3-none-any\.whl[\s\S]*micropip\.install\(_fp_pypdf_wheel, deps=False\)/);
  assert.match(runtimeSource, /from pypdf import PdfReader[\s\S]*def _fp_extract_pdf\(path\)[\s\S]*extraction_mode="layout"/);
  assert.match(notices, /pypdf 6\.17\.0 — BSD 3-Clause/);
  assert.match(pyproject, /"pypdf==6\.17\.0"/);
});

test("fallback file picker leaves unknown Fountain file types selectable on mobile", async () => {
  const [html, app] = await Promise.all([readFile(htmlPath, "utf8"), readFile(appPath, "utf8")]);
  const input = html.match(/<input\b[^>]*\bid="file-input"[^>]*>/)?.[0];
  assert.ok(input);
  assert.match(input, /\btype="file"/);
  assert.doesNotMatch(input, /\baccept\s*=/i);
  let clicks = 0;
  const context = {
    confirmDiscard: async () => true,
    window: {},
    $: (selector) => {
      assert.equal(selector, "#file-input");
      return { click: () => clicks++ };
    },
  };
  runInNewContext(app.slice(app.indexOf("async function openFile("), app.indexOf("async function openLocalFile(")), context);
  await context.openFile();
  assert.equal(clicks, 1);
  context.confirmDiscard = async () => false;
  await context.openFile();
  assert.equal(clicks, 1, "declining to discard must not open the picker");
});

test("native file picker leaves Android BIN files selectable and preserves the file handle", async () => {
  const app = await readFile(appPath, "utf8");
  const loaded = [];
  const options = [];
  const content = "INT. OFFICE - DAY\n\nA writer types.";
  const file = { name: "Screenplay - Draft (1).fountain", type: "application/octet-stream", text: async () => content };
  const handle = { getFile: async () => file };
  const context = {
    state: {},
    confirmDiscard: async () => true,
    window: { showOpenFilePicker: async (option) => { options.push(option); return [handle]; } },
    setDocument: (...args) => loaded.push(args),
    toast: (message) => assert.fail(message),
    $: () => assert.fail("Browsers with showOpenFilePicker must not use the fallback input"),
  };
  runInNewContext(app.slice(app.indexOf("async function openFile("), app.indexOf("function pdfLayoutToFountain(")), context);
  await context.openFile();
  assert.deepEqual({ ...options[0] }, { multiple: false }, "native pickers must not filter out unknown MIME types");
  assert.deepEqual(loaded, [[content, file.name, true]]);
  assert.equal(context.state.handle, handle);
  context.confirmDiscard = async () => false;
  await context.openFile();
  assert.equal(options.length, 1, "declining to discard must not open the native picker");
  assert.equal(loaded.length, 1);
});

test("local imports accept Fountain MIME variants and retain PDF detection", async () => {
  const app = await readFile(appPath, "utf8");
  const loaded = [];
  const pdfs = [];
  const context = {
    state: {},
    setDocument: (...args) => loaded.push(args),
    importPdfFile: (file) => pdfs.push(file),
  };
  runInNewContext(app.slice(app.indexOf("async function openLocalFile("), app.indexOf("function pdfLayoutToFountain(")), context);
  const content = "INT. OFFICE - DAY\n\nA writer types.";
  for (const type of ["", "application/octet-stream", "text/x-fountain", "application/x-fountain", "text/plain"]) {
    await context.openLocalFile({ name: "Script.FOUNTAIN", type, text: async () => content });
    assert.deepEqual(loaded.at(-1), [content, "Script.FOUNTAIN", true]);
    assert.equal(context.state.handle, null);
  }
  await context.openLocalFile({ name: "Script.txt", type: "text/plain", text: async () => content });
  assert.deepEqual(loaded.at(-1), [content, "Script.txt", true]);
  for (const file of [{ name: "Script.PDF", type: "" }, { name: "Script", type: "application/pdf" }]) {
    await context.openLocalFile(file);
    assert.equal(pdfs.at(-1), file);
  }
  assert.equal(loaded.length, 6, "PDFs must not be imported as plain text");
  await assert.rejects(context.openLocalFile({ name: "Unreadable.fountain", text: async () => { throw new Error("Read failed"); } }), /Read failed/);
  assert.equal(loaded.length, 6, "failed reads must preserve the current document");
});

test("app installs as a standalone PWA and offers desktop window controls", async () => {
  const [html, app, manifestText, worker, build, pyproject] = await Promise.all([
    readFile(htmlPath, "utf8"),
    readFile(appPath, "utf8"),
    readFile(new URL("../../src/fountain_publisher/web/app.webmanifest", import.meta.url), "utf8"),
    readFile(new URL("../../src/fountain_publisher/web/service-worker.js", import.meta.url), "utf8"),
    readFile(new URL("../../scripts/build-web.mjs", import.meta.url), "utf8"),
    readFile(new URL("../../pyproject.toml", import.meta.url), "utf8"),
  ]);
  const manifest = JSON.parse(manifestText);
  assert.equal(manifest.name, "Fountain Publisher");
  assert.equal(manifest.short_name, "Fountain Publisher");
  assert.equal(manifest.display, "standalone");
  assert.deepEqual(manifest.display_override, ["standalone"]);
  assert.equal(manifest.theme_color, "#202326");
  assert.equal(manifest.background_color, "#17191b");
  assert.match(html, /name="color-scheme" content="light dark"/);
  assert.match(html, /id="app-theme-color" content="#202326"/);
  assert.match(html, /apple-mobile-web-app-status-bar-style" content="black-translucent"/);
  assert.match(html, /apple-mobile-web-app-capable" content="yes"/);
  assert.match(html, /rel="apple-touch-icon" href="icons\/apple-touch-icon\.png"/);
  assert.match(html, /rel="manifest" href="app\.webmanifest"/);
  assert.match(html, /id="install-app"/);
  assert.match(html, /id="toggle-fullscreen"/);
  assert.match(app, /beforeinstallprompt/);
  assert.match(app, /requestFullscreen/);
  assert.match(app, /effective === "dark" \? "#202326" : "#eeeeed"/);
  assert.match(app, /prefers-color-scheme: dark[\s\S]*addEventListener\?\.\("change"[\s\S]*state\.theme === "system"/);
  assert.match(app, /navigator\.serviceWorker\.register\("\.\/service-worker\.js"\)/);
  assert.match(worker, /CACHE_NAME[\s\S]*request\.mode === "navigate"[\s\S]*caches\.match/);
  assert.match(build, /app\.webmanifest[\s\S]*service-worker\.js[\s\S]*icons/);
  assert.match(pyproject, /web\/icons\/\*/);
});

test("theme picker previews all available palettes", async () => {
  const [html, app, css] = await Promise.all([readFile(htmlPath, "utf8"), readFile(appPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.match(html, /id="theme-dialog"[\s\S]*data-theme-option="system"[\s\S]*data-theme-option="light"[\s\S]*data-theme-option="dark"[\s\S]*data-theme-option="solarized-light"[\s\S]*data-theme-option="solarized-dark"[\s\S]*data-theme-option="espresso"[\s\S]*data-theme-option="dracula"[\s\S]*data-theme-option="tokyo-night"[\s\S]*data-theme-option="synth-wave"/);
  assert.match(app, /function openThemeDialog\(\)[\s\S]*showModal\(\)/);
  assert.match(app, /espresso:\s*\{[^}]*dark:\s*true[^}]*\}[\s\S]*dracula:\s*\{[^}]*dark:\s*true[^}]*\}[\s\S]*"tokyo-night":\s*\{[^}]*dark:\s*true[^}]*\}[\s\S]*"synth-wave":\s*\{[^}]*dark:\s*true/);
  assert.match(app, /themes\[theme\]\.dark \? "dark" : "light"/);
  assert.match(css, /:root\[data-theme="solarized-light"\][\s\S]*:root\[data-theme="solarized-dark"\]/);
  assert.match(css, /:root\[data-theme="espresso"\][\s\S]*:root\[data-theme="dracula"\][\s\S]*:root\[data-theme="tokyo-night"\][\s\S]*:root\[data-theme="synth-wave"\]/);
  assert.match(css, /--surface:\s*#eeeeed;[\s\S]*--paper:\s*#fff;/);
  assert.match(css, /:root\[data-theme="solarized-light"\][^}]*--paper:\s*#fdf6e3;[^}]*--paper-ink:\s*#073642;/);
  assert.match(css, /:root\s*\{[^}]*--bg:\s*#c8cbcd;/);
  assert.match(css, /:root\[data-theme="solarized-light"\][^}]*--bg:\s*#d2c9b1;/);
  assert.match(html, /theme-preview-layer-light[\s\S]*theme-preview-layer-dark/);
  assert.match(css, /\.theme-preview-system \.theme-preview-layer-dark[^}]*clip-path:\s*polygon\(100% 0, 100% 100%, 0 100%\)/);
  assert.match(css, /\.theme-preview-system \.theme-preview::after[^}]*linear-gradient\(to bottom right/);
  assert.match(css, /\.theme-preview-espresso[\s\S]*\.theme-preview-dracula[\s\S]*\.theme-preview-tokyo-night[\s\S]*\.theme-preview-synth-wave/);
  assert.match(css, /\.theme-options\s*\{[^}]*overflow-y:\s*auto/);
});

test("Zen mode leaves only work and compact view controls", async () => {
  const [html, app, css] = await Promise.all([readFile(htmlPath, "utf8"), readFile(appPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.match(html, /id="toggle-zen"[\s\S]*id="zen-controls"[^>]*hidden[\s\S]*data-preview-mode="source"[\s\S]*data-preview-mode="live"[\s\S]*data-preview-mode="beats"[\s\S]*id="exit-zen"/);
  assert.match(app, /async function setZenMode\(enabled[\s\S]*zen-controls[\s\S]*requestFullscreen/);
  assert.match(app, /function renderBeatGuide\(\)[\s\S]*--zen-beat-guide-height[\s\S]*layer\.offsetHeight/);
  assert.match(app, /function handleFullscreenChange\(\)[\s\S]*setZenMode\(false, \{ syncFullscreen: false \}\)/);
  assert.match(app, /event\.key === "Escape" && document\.body\.classList\.contains\("zen-mode"\)/);
  assert.match(css, /body\.zen-mode \.app-toolbar[\s\S]*body\.zen-mode #workspace[\s\S]*height:\s*100vh !important/);
  assert.match(css, /\.zen-controls\s*\{[^}]*left:\s*50%;[^}]*transform:\s*translateX\(-50%\)/);
  assert.match(css, /body\.zen-mode \.beat-guide-layer\s*\{[^}]*top:\s*0;/);
  assert.match(css, /body\.zen-mode \.zen-controls\s*\{[^}]*--zen-beat-guide-height/);
  assert.match(css, /body\.zen-mode #source-panel \.editor-shell\s*\{[^}]*margin:\s*34px auto;[^}]*border-bottom:\s*1px solid var\(--border\)/);
  assert.match(css, /body\.source-tab-hidden \[data-preview-mode="source"\]/);
});

test("production deployment cannot be displaced by PR cleanup", async () => {
  const workflow = await readFile(new URL("../../.github/workflows/pages-preview.yml", import.meta.url), "utf8");
  assert.match(workflow, /concurrency:[\s\S]*group:\s*pages-\$\{\{ github\.event_name \}\}[\s\S]*cancel-in-progress:\s*false/);
});

test("desktop panel headers share a height and preview controls follow its title", async () => {
  const [html, css] = await Promise.all([readFile(htmlPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.match(html, /class="preview-heading"[\s\S]*<small>SCREENPLAY<\/small><h2>Preview<\/h2>[\s\S]*class="view-switcher"/);
  assert.match(css, /\.panel-title\s*\{[^}]*min-height:\s*58px;/s);
  assert.match(css, /\.preview-toolbar\s*\{[^}]*min-height:\s*58px;/s);
  assert.match(css, /\.preview-title, #source-panel \.panel-title > div:first-child, \.beat-sheet-header > div:first-child\s*\{[^}]*flex:\s*0 0 96px;[^}]*width:\s*96px;/s);
  assert.match(css, /\.beat-sheet-header h2\s*\{[^}]*font-size:\s*16px;[^}]*line-height:\s*1\.1;/s);
  assert.match(css, /\.beat-sheet-header small\s*\{[^}]*font-size:\s*9px;[^}]*font-weight:\s*700;[^}]*letter-spacing:\s*\.12em;/s);
});

test("tablet landscape keeps document identity clear of history controls", async () => {
  const [html, app, css] = await Promise.all([readFile(htmlPath, "utf8"), readFile(appPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.match(css, /\.app-toolbar::after\s*\{[^}]*flex:\s*0 0 246px;/s);
  assert.match(css, /\.global-actions\s*\{[^}]*flex:\s*0 1 auto;/s);
  assert.match(css, /\.document-identity\s*\{[^}]*right:\s*12px;[^}]*width:\s*230px;/s);
  assert.match(css, /#filename\s*\{[^}]*flex:\s*1 1 auto;/s);
  assert.match(css, /\.compile-status\s*\{[^}]*flex:\s*0 0 auto;[^}]*white-space:\s*nowrap;/s);
  assert.doesNotMatch(app, /updateToolbarIdentityLayout|scheduleToolbarIdentityLayout/);
  assert.match(css, /@media\s*\(max-width:\s*900px\)[\s\S]*\.about-label\s*\{\s*display:\s*none;/s);
  assert.match(html, /class="[^"]*help-menu[^"]*"[\s\S]*<\/nav>\s*<div class="history-actions"[^>]*>[\s\S]*id="undo"[\s\S]*id="redo"/);
  assert.match(css, /@media\s*\(max-width:\s*820px\)[\s\S]*\.app-toolbar::after\s*\{\s*display:\s*none;/s);
  assert.match(css, /@media\s*\(max-width:\s*820px\)[\s\S]*\.document-identity\s*\{[^}]*position:\s*relative;[^}]*display:\s*flex !important;[^}]*flex:\s*1 1 auto;/s);
  assert.match(css, /@media\s*\(max-width:\s*820px\)[\s\S]*\.history-actions \.toolbar-divider\s*\{\s*display:\s*none;/s);
  assert.doesNotMatch(css, /#undo, #redo\s*\{\s*display:\s*none;/);
  assert.match(app, /function shouldAutofocusSource\(\)\s*\{[\s\S]*navigator\.maxTouchPoints === 0/);
  assert.match(app, /mode === "source"[\s\S]*shouldAutofocusSource\(\)[\s\S]*source\.focus\(\{ preventScroll: true \}\)/);
});

test("mobile filenames shrink within the toolbar without obscuring the menu button", async () => {
  const css = await readFile(cssPath, "utf8");
  const mobile = css.slice(css.indexOf("@media (max-width: 820px)"));
  const identity = mobile.match(/\.document-identity\s*\{([^}]+)\}/)?.[1];
  assert.ok(identity);
  assert.match(identity, /min-width:\s*0;/);
  assert.match(identity, /overflow:\s*hidden;/);
  assert.match(identity, /flex:\s*1 1 auto;/);
  assert.match(css, /#filename\s*\{[^}]*min-width:\s*0;[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/);
  assert.match(mobile, /\.mobile-menu-toggle\s*\{[^}]*flex:\s*0 0 38px;[^}]*width:\s*38px;/);
});

test("browser page-count compilation only updates metrics present in the document", async () => {
  const [html, app] = await Promise.all([readFile(htmlPath, "utf8"), readFile(appPath, "utf8")]);
  assert.doesNotMatch(html, /id="stat-runtime"/);
  assert.doesNotMatch(app, /\$\("#stat-runtime"\)\.textContent/);
});

test("hidden preview layers cannot be displayed by component styles", async () => {
  const css = await readFile(cssPath, "utf8");
  assert.match(css, /\[hidden\]\s*\{\s*display:\s*none\s*!important;/);
});

test("live compilation rejects stale results and HTML export is absent", async () => {
  const [html, app] = await Promise.all([readFile(htmlPath, "utf8"), readFile(appPath, "utf8")]);
  assert.match(app, /if \(!result \|\| !isCurrentCompile\(request\)\) return/);
  assert.doesNotMatch(html, /export-html|HTML document/);
  assert.doesNotMatch(app, /includeHtml:\s*true|compileWithBrowserScreenplain\("html"/);
});

test("Source, Preview, PDF, and Beat Sheet share the main workspace", async () => {
  const [html, app, css] = await Promise.all([readFile(htmlPath, "utf8"), readFile(appPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.match(html, /data-preview-mode="source"[\s\S]*data-preview-mode="live"[\s\S]*data-preview-mode="beats"[\s\S]*data-preview-mode="pdf"/);
  assert.match(css, /#source-panel, \.preview-panel, #beat-sheet-panel\s*\{\s*grid-column:\s*1;/);
  assert.match(css, /#stats-panel\s*\{\s*grid-column:\s*3;/);
  assert.match(html, /id="menu-toggle-source-tab"[^>]*>Show Source tab/);
  assert.match(app, /function sourceTabEnabled\(\)[\s\S]*source-tab-hidden[\s\S]*state\.previewMode === "source"/);
  assert.match(app, /function sourceTabEnabled\(\)[\s\S]*if \(stored !== null\) return stored === "true";[\s\S]*WORKSPACE_CACHE_KEY/);
  assert.match(app, /storedStatsCollapsed === null \|\| storedStatsCollapsed === "true"/);
  assert.match(css, /body\.source-tab-hidden \[data-preview-mode="source"\]/);
  assert.match(css, /#source-panel \.editor-shell\s*\{[^}]*width:\s*min\(816px,[^}]*margin:\s*34px auto 0;[^}]*box-shadow:\s*var\(--shadow\);/s);
  assert.match(css, /\.beat-sheet-workspace\s*\{[^}]*width:\s*816px;[^}]*margin:\s*34px auto 0;[^}]*box-shadow:\s*var\(--shadow\);/s);
  assert.match(css, /grid-template-rows:\s*minmax\(0,\s*1fr\)/);
});

test("Insights remains independently collapsible without a Source sidebar", async () => {
  const [html, app, css] = await Promise.all([readFile(htmlPath, "utf8"), readFile(appPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.doesNotMatch(html, /class="panel-close"/);
  assert.doesNotMatch(html, /class="panel-toggle source-toggle"/);
  assert.doesNotMatch(html, /class="panel-toggle stats-toggle"/);
  assert.match(html, /class="insights-open-button" data-toggle-stats[^>]*><i aria-hidden="true"><\/i><b>Insights<\/b><span>‹<\/span>/);
  assert.match(html, /panel-title[\s\S]*class="insights-close-button" data-toggle-stats[^>]*>›<\/button>\s*<div><small>DOCUMENT<\/small><h2>Insights<\/h2><\/div>/);
  assert.match(css, /grid-template-columns:\s*minmax\(360px, 1fr\) 4px var\(--stats-w\)/);
  assert.match(css, /stats-collapsed \.insights-open-button\s*\{[^}]*display:\s*inline-flex/);
  assert.match(app, /\$\$\('\[data-toggle-stats\]'\)\.forEach/);
});

test("desktop Insights has a roomier default width and legible title", async () => {
  const css = await readFile(cssPath, "utf8");
  assert.match(css, /--stats-w:\s*330px/);
  assert.match(css, /#stats-panel \.panel-title h2\s*\{[^}]*font-size:\s*18px;/);
});

test("live and PDF previews have bounded scrolling containers", async () => {
  const [app, css] = await Promise.all([readFile(appPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.match(css, /\.preview-scroll\s*\{[^}]*overflow:\s*auto;/s);
  assert.match(css, /\.preview-scroll\.pdf-mode\s*\{[^}]*overflow:\s*hidden;/s);
  assert.match(css, /#pdf-frame\s*\{[^}]*height:\s*100%;/s);
  assert.match(app, /classList\.toggle\("pdf-mode",\s*mode\s*===\s*"pdf"\)/);
  assert.match(app, /\$\("#preview-page-stage"\)\.hidden = mode !== "live"/);
});

test("switching through PDF restores the live Preview viewport", async () => {
  const app = await readFile(appPath, "utf8");
  assert.match(app, /livePreviewScrollTop:\s*0/);
  assert.match(app, /livePreviewScrollLeft:\s*0/);
  assert.match(app, /if \(state\.previewMode === "live" && mode === "pdf"\)[\s\S]*state\.livePreviewScrollTop = preview\.scrollTop;[\s\S]*state\.livePreviewScrollLeft = preview\.scrollLeft;/);
  assert.match(app, /else if \(returnToLive\) requestAnimationFrame\(\(\) => requestAnimationFrame\(\(\) => \{[\s\S]*preview\.scrollTop = state\.livePreviewScrollTop;[\s\S]*preview\.scrollLeft = state\.livePreviewScrollLeft;[\s\S]*clampPreviewScroll\(preview\)/);
  assert.match(app, /previewScrollTop:\s*state\.previewMode === "live"/);
  assert.match(app, /previewScrollLeft:\s*state\.previewMode === "live"/);
});

test("toolbar menus use Pugflow-style popup interaction", async () => {
  const [app, css] = await Promise.all([readFile(appPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.match(css, /\.toolbar-menu\s*\{[^}]*height:\s*30px;/s);
  assert.match(css, /\.toolbar-popover\s*\{[^}]*position:\s*absolute;[^}]*width:\s*210px;/s);
  assert.match(app, /document\.addEventListener\("pointerdown"/);
  assert.doesNotMatch(app, /event\.target\.closest\("summary"\)[\s\S]*event\.preventDefault\(\)/);
  assert.match(app, /menu\.addEventListener\("toggle", \(\) => \{[\s\S]*if \(menu\.open\) closeMenus\(menu\)/);
});

test("select controls keep the app shape instead of iPad bubble styling", async () => {
  const css = await readFile(cssPath, "utf8");
  assert.match(css, /select\s*\{[^}]*appearance:\s*none;[^}]*-webkit-appearance:\s*none;[^}]*border-radius:\s*var\(--control-radius\);[^}]*background-image:/s);
});

test("interactive controls share one rounded shape", async () => {
  const css = await readFile(cssPath, "utf8");
  assert.match(css, /--control-radius:\s*6px/);
  assert.match(css, /button:not\(\.annotation-orb\)[\s\S]*select,[\s\S]*input:not\(\[type="checkbox"\]\)[\s\S]*textarea,[\s\S]*\.toolbar-menu > summary,[\s\S]*\.setting-row\s*\{\s*border-radius:\s*var\(--control-radius\) !important;/);
  assert.match(css, /\.github-files button:first-child\s*\{[^}]*var\(--control-radius\)/);
});

test("app info uses one understated GitHub link", async () => {
  const [html, css] = await Promise.all([readFile(htmlPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.doesNotMatch(html, /Compiled with <strong>Screenplain<\/strong>/);
  assert.doesNotMatch(html, /href="https:\/\/github\.com\/vilcans\/screenplain"/);
  assert.match(html, />View on GitHub<\/a>/);
  assert.match(css, /\.about-popover a\s*\{[^}]*color:\s*var\(--ink\);[^}]*font-weight:\s*700;/s);
});

test("third-party license notices accompany local and static distributions", async () => {
  const [html, readme, notices, build] = await Promise.all([
    readFile(htmlPath, "utf8"),
    readFile(new URL("../../README.md", import.meta.url), "utf8"),
    readFile(new URL("../../src/fountain_publisher/web/THIRD_PARTY_NOTICES.md", import.meta.url), "utf8"),
    readFile(new URL("../../scripts/build-web.mjs", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(html, />Third-party notices<\/a>/);
  assert.match(readme, /\[Third-party notices\]\(src\/fountain_publisher\/web\/THIRD_PARTY_NOTICES\.md\)/);
  assert.match(notices, /Pyodide 314\.0\.6[\s\S]*Mozilla Public License 2\.0/);
  assert.match(notices, /Screenplain 0\.12\.0[\s\S]*ReportLab 5\.0\.1[\s\S]*Courier Prime/);
  assert.match(build, /THIRD_PARTY_NOTICES\.md/);
});

test("public privacy and terms pages disclose connected-service data use", async () => {
  const [privacy, terms, build] = await Promise.all([
    readFile(new URL("../../src/fountain_publisher/web/privacy.html", import.meta.url), "utf8"),
    readFile(new URL("../../src/fountain_publisher/web/terms.html", import.meta.url), "utf8"),
    readFile(new URL("../../scripts/build-web.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(privacy, /Google API Services User Data Policy/);
  assert.match(privacy, /Cloudflare Durable Object/);
  assert.match(terms, /Your work and accounts/);
  assert.match(build, /privacy\.html/);
  assert.match(build, /terms\.html/);
});

test("source and preview share syntax, cursor synchronization, and character completion behavior", async () => {
  const [html, app, css] = await Promise.all([readFile(htmlPath, "utf8"), readFile(appPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.match(html, /id="source-highlight"/);
  assert.match(html, /id="preview-completion-menu"/);
  assert.match(app, /function renderSourceSyntax\(/);
  assert.match(app, /showPreviewCharacterCompletions\(line\)/);
  assert.match(app, /const explicitCharacter = text\.startsWith\("@"\) \|\| element\.classList\.contains\("character"\)/);
  assert.match(app, /\.classList\.add\("source-current"\)/);
  assert.match(css, /\.syntax-character/);
});

test("source highlighting follows the textarea viewport and rendered line geometry", async () => {
  const app = await readFile(appPath, "utf8");
  assert.match(app, /function boundedScrollLeft\(/);
  assert.match(app, /Math\.max\(0, element\.scrollWidth - element\.clientWidth\)/);
  assert.match(app, /function syncSourceOverlay\(\{ resize = true \} = \{\}\)/);
  assert.match(app, /const width = source\.clientWidth[\s\S]*highlight\.style\.width = width/);
  assert.match(app, /if \(scrollLeft !== source\.scrollLeft\) source\.scrollLeft = scrollLeft/);
  assert.match(app, /highlight\.scrollLeft = boundedScrollLeft\(highlight, scrollLeft\)/);
  assert.match(app, /data-source-line=/);
  assert.match(app, /sourceLine\.offsetTop - source\.scrollTop - parseFloat\(computed\.paddingTop\)/);
  assert.doesNotMatch(app, /rowsBefore \* 20\.15/);
});

test("source layout cannot feed overlay dimensions back into its grid tracks", async () => {
  const css = await readFile(cssPath, "utf8");
  const shell = css.match(/\.editor-shell\s*\{([^}]+)\}/)?.[1];
  assert.match(shell, /grid-template-columns:\s*43px minmax\(0,\s*1fr\)/);
  assert.match(shell, /grid-template-rows:\s*minmax\(0,\s*1fr\)/);
  assert.match(shell, /-webkit-text-size-adjust:\s*none/);
  assert.match(css, /\.source-highlight\s*\{[^}]*position:\s*relative/);
  assert.match(css, /\.editor-footer\s*\{[^}]*flex:\s*0 0 auto;[^}]*white-space:\s*nowrap/);
  assert.doesNotMatch(css, /\.source-highlight \.syntax-[^{]+\{[^}]*(?:font-weight|font-style):/);
});

test("source overlays match both textarea client dimensions before syncing scroll", async () => {
  const app = await readFile(appPath, "utf8");
  const functions = app.slice(app.indexOf("function boundedScrollLeft("), app.indexOf("function currentPosition("));
  const source = { clientWidth: 385, clientHeight: 245, scrollWidth: 900, scrollLeft: 900, scrollTop: 600 };
  const highlight = { style: {}, clientWidth: 385, scrollWidth: 900 };
  const layer = {};
  const context = { source, $: () => highlight, $$: () => [layer] };
  runInNewContext(`${functions}\nsyncSourceOverlay();`, context);
  assert.equal(highlight.style.width, "385px");
  assert.equal(highlight.style.height, "245px");
  assert.equal(source.scrollLeft, 515);
  assert.equal(highlight.scrollLeft, 515);
  assert.equal(highlight.scrollTop, 600);
  assert.equal(layer.scrollTop, 600);
  source.clientWidth = 0;
  source.clientHeight = 0;
  runInNewContext("syncSourceOverlay();", context);
  assert.equal(highlight.style.width, "");
  assert.equal(highlight.style.height, "");
});

test("source line navigation uses unscaled line offsets at every workspace zoom", async () => {
  const app = await readFile(appPath, "utf8");
  const navigation = app.slice(app.indexOf("function jumpToLine("), app.indexOf("function jumpToInsightScene("));
  const calls = [];
  const source = {
    value: "First\nSecond\nThird",
    setSelectionRange: (...range) => calls.push(range),
  };
  runInNewContext(`${navigation}\njumpToLine(3, false);`, {
    source, updateCursor: () => {}, scrollSourceTarget: (...args) => calls.push(args),
  });
  assert.deepEqual(calls, [[13, 18], [2, "center"]]);
  assert.doesNotMatch(navigation, /getBoundingClientRect|getClientRects/);
});

test("completion is Tab-only and preview suggestions are caret-positioned", async () => {
  const [app, css] = await Promise.all([readFile(appPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.doesNotMatch(app, /event\.key === "Enter" \|\| event\.key === "Tab"/);
  assert.match(app, /function positionPreviewCompletion\(/);
  assert.match(app, /caret\.getClientRects\(\)\[0\]/);
  assert.match(app, /anchor\.bottom \+ 6/);
  assert.match(css, /\.preview-completion-menu\s*\{[^}]*position:\s*fixed;/s);
});

test("preview edits keep the source cursor on the edited line", async () => {
  const app = await readFile(appPath, "utf8");
  assert.match(app, /function setSourceCursorFromPreview[\s\S]*source\.setSelectionRange\(offset, offset\);[\s\S]*scrollSourceTarget\(index\)/);
  assert.match(app, /page\.addEventListener\("focusin", \(\) => \{ const edit = previewSelection\(\); if \(edit\) setSourceSelectionFromPreview\(edit\); \}\)/);
  assert.doesNotMatch(app, /page\.addEventListener\("focusin"[^\n]*jumpToLine/);
});

test("screenplay editors disable automatic capitalization and word replacement", async () => {
  const html = await readFile(htmlPath, "utf8");
  for (const id of ["source", "screenplay-page"]) {
    const editor = html.match(new RegExp(`<[^>]+id="${id}"[^>]*>`))?.[0];
    assert.ok(editor, `${id} editor exists`);
    assert.match(editor, /autocapitalize="off"/);
    assert.match(editor, /autocorrect="off"/);
    assert.match(editor, /autocomplete="off"/);
  }
  assert.match(html, /id="screenplay-page"[^>]*spellcheck="true"/);
});

test("iPad hardware Enter edits Preview directly without waiting for beforeinput", async () => {
  const app = await readFile(appPath, "utf8");
  assert.match(app, /page\.addEventListener\("keydown"[\s\S]*event\.key === "Enter"[\s\S]*event\.preventDefault\(\);[\s\S]*replacePreviewSelection\(edit, "\\n"\)/);
  assert.match(app, /if \(!fromPreview \|\| state\.previewMode === "source"\) renderEditorChrome\(\)/);
  assert.match(app, /if \(fromPreview\) state\.insightTimer = setTimeout\(\(\) => renderInsights\(analyzeLocally\(source\.value\)\), 80\)/);
});

test("preview cursor synchronization highlights the active line", async () => {
  const [html, app, css] = await Promise.all([readFile(htmlPath, "utf8"), readFile(appPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.match(html, /id="screenplay-page"[^>]*contenteditable="plaintext-only"/);
  assert.doesNotMatch(app, /class="\$\{className\}"[^>]*contenteditable/);
  assert.match(app, /function currentPosition\(\)[\s\S]*source\.selectionDirection !== "backward"[\s\S]*source\.selectionEnd/);
  assert.match(app, /function setSourceSelectionFromPreview\(edit\)[\s\S]*source\.setSelectionRange\(start, end, edit\.direction\)/);
  assert.match(app, /page\.addEventListener\("pointerup"[\s\S]*previewLineForNode\(getSelection\(\)\?\.focusNode\)[\s\S]*setSourceSelectionFromPreview\(edit\)/);
  assert.match(app, /page\.addEventListener\("keyup"[\s\S]*setSourceSelectionFromPreview\(edit\)/);
  assert.match(css, /\.screenplay-page:focus\s*\{\s*outline:\s*none;/);
  assert.match(css, /\.script-line\.source-current\s*\{[^}]*background:\s*color-mix\([^}]*var\(--syntax-scene\)[^}]*\}/s);
  assert.doesNotMatch(css, /\.script-line\.source-current\s*\{[^}]*box-shadow:/s);
});

test("source and preview navigation scroll in both directions", async () => {
  const app = await readFile(appPath, "utf8");
  const sourceNavigation = app.slice(app.indexOf("function scrollSourceTarget("), app.indexOf("function updatePreviewCursor("));
  assert.match(sourceNavigation, /const top = target\.offsetTop/);
  assert.match(app, /source\.addEventListener\("select"[^\n]*scrollPreview: document\.activeElement === source/);
  assert.match(app, /function updatePreviewCursor[\s\S]*scrollPreviewTarget\(target, scrollBlock\)/);
  assert.match(app, /panel === "source"[\s\S]*scrollSourceTarget\(currentPosition\(\)\.line, "center"\)/);
});

test("preview edits are source-backed and preserve the viewport", async () => {
  const app = await readFile(appPath, "utf8");
  assert.match(app, /page\.addEventListener\("beforeinput"[\s\S]*event\.preventDefault\(\);[\s\S]*replacePreviewSelection\(edit/);
  assert.match(app, /function replacePreviewSelection[\s\S]*lines\.splice\(startIndex, endIndex - startIndex \+ 1, \.\.\.replacements, \.\.\.preservedNotes\)/);
  assert.match(app, /function previewDeleteSelection/);
  assert.match(app, /page\.addEventListener\("paste"/);
  assert.match(app, /insertFromPaste/);
  assert.match(app, /function fountainInlineSourceMap/);
  assert.match(app, /data-type="\$\{escapeHtml\(type\)\}"/);
  assert.match(app, /function fountainInlineSourceMap\(value\)\s*\{\s*return parseFountainInline\(value\)\.sourceMap/);
  assert.match(app, /activeInlineMarkers/);
  assert.match(app, /element\.classList\.contains\("scene"\)/);
  assert.match(app, /page\.focus\(\{ preventScroll: true \}\)[\s\S]*scrollTop = scrollTop/);
  const render = app.slice(app.indexOf("function renderPreview("), app.indexOf("function placeCaretAtOffset("));
  assert.match(render, /applyZoom\(\{ center: false \}\);[\s\S]*previewScroll\.scrollTop = scrollTop/);
  assert.doesNotMatch(app, /const insertAbove =/);
  assert.match(app, /const focusLine = startIndex \+ displayLines\.length - 1/);
  assert.match(app, /function previewCaretIsOnVisualEdge\(line, edge\)/);
  assert.match(app, /event\.key === "ArrowUp" \? -1 : event\.key === "ArrowDown" \? 1 : 0/);
  assert.match(app, /adjacentPreviewEditableLine\(line, verticalDirection\)/);
  assert.match(app, /setSourceCursorFromPreview\(adjacent, offset\);\s*scrollPreviewTarget\(adjacent\)/);
});

test("programmatic Source selections never navigate the visible Preview", async () => {
  const app = await readFile(appPath, "utf8");
  const listener = app.split("\n").find((line) => line.startsWith('source.addEventListener("select",'));
  let handler;
  const source = { addEventListener: (type, callback) => { handler = callback; } };
  const document = { activeElement: {} };
  let scrollPreview;
  runInNewContext(listener, { source, document, updateCursor: (options) => { scrollPreview = options.scrollPreview; }, scheduleWorkspaceCache() {} });
  handler();
  assert.equal(scrollPreview, false);
  document.activeElement = source;
  handler();
  assert.equal(scrollPreview, true);
});

test("Preview rerender restores its viewport without recentering or deferred scroll writes", async () => {
  const app = await readFile(appPath, "utf8");
  const render = app.slice(app.indexOf("function renderPreview("), app.indexOf("function placeCaretAtOffset("));
  const viewport = { scrollTop: 1800, scrollLeft: 120 };
  const frames = [];
  const context = {
    source: { value: "An action." }, page: {},
    state: { previewMode: "live" },
    $: (selector) => selector === "#preview-scroll" ? viewport : {},
    classifyLines: () => [{ raw: "An action." }], renderPreviewLines: () => "",
    renderBeatGuide() {}, updatePreviewCursor() {}, renderCollaborationPresence() {}, alignAnnotationOrbs() {},
    applyZoom: ({ center }) => { assert.equal(center, false); viewport.scrollTop = 0; },
    requestAnimationFrame: (fn) => frames.push(fn),
  };
  runInNewContext(`${render}\nrenderPreview();`, context);
  assert.equal(viewport.scrollTop, 1800);
  assert.equal(viewport.scrollLeft, 120);
  viewport.scrollTop = 1900;
  viewport.scrollLeft = 160;
  frames.forEach((fn) => fn());
  assert.equal(viewport.scrollTop, 1900);
  assert.equal(viewport.scrollLeft, 160);
});

test("annotation close restores selection and viewport across cancellation, insertion, and deletion", async () => {
  const app = await readFile(appPath, "utf8");
  const restore = app.slice(app.indexOf("function restoreAnnotationContext("), app.indexOf("function hidePreviewContextMenu("));
  const original = ["First action.", "[[A note]]", "", "Second action.", "[[FP-BEATS:old-ranges]]"];
  for (const [lines, change] of [
    [original, null],
    [original.toSpliced(1, 1).with(-1, "[[FP-BEATS:rebased-ranges]]"), { index: 1, removed: 1, added: 0 }],
    [original.toSpliced(1, 0, "[[Another note]]").with(-1, "[[FP-BEATS:rebased-ranges]]"), { index: 1, removed: 0, added: 1 }],
    [original.toSpliced(1, 0, "[[Another note]]", "").with(-1, "[[FP-BEATS:rebased-ranges]]"), { index: 1, removed: 0, added: 2 }],
  ]) {
    for (const direction of ["forward", "backward"]) {
      const viewport = { scrollTop: 0, scrollLeft: 0 };
      const elements = lines.map((text, index) => ({ text, index }));
      let restored;
      let endpoints;
      const context = {
        state: { noteEditor: { context: {
          change, scrollTop: 1800, scrollLeft: 120,
          selection: { startLine: 0, endLine: 3, startOffset: 2, endOffset: 5, direction },
        } } },
        sourceLines: () => lines,
        page: { focus: (options) => assert.equal(options.preventScroll, true) },
        $: (selector) => selector === "#preview-scroll" ? viewport : elements[Number(selector.match(/\d+/)[0])],
        previewTextPoint: (element, offset) => ({ node: element, offset }),
        getSelection: () => ({ setBaseAndExtent: (...args) => { endpoints = args; } }),
        setSourceSelectionFromPreview: (edit) => { restored = edit; },
      };
      runInNewContext(`${restore}\nrestoreAnnotationContext();`, context);
      assert.equal(restored.startLine.text, "First action.");
      assert.equal(restored.endLine.text, "Second action.");
      assert.equal(restored.startOffset, 2);
      assert.equal(restored.endOffset, 5);
      assert.equal(endpoints[0].text, direction === "backward" ? "Second action." : "First action.");
      assert.equal(viewport.scrollTop, 1800);
      assert.equal(viewport.scrollLeft, 120);
      assert.equal(context.state.noteEditor.context, undefined);
    }
  }
  assert.match(app, /annotation-dialog"\)\.addEventListener\("close", restoreAnnotationContext\)/);
  assert.match(app, /event\.target\.closest\("\.annotation-orb"\)\) \{ event\.preventDefault\(\); return; \}/);
  assert.match(app, /context\.change = \{ index: insertAt, removed: 0, added: lines\.length - previousLength \}/);
  assert.match(app, /context\.change = \{ index: state\.noteEditor\.line, removed: 1, added: 0 \}/);
});

test("top-level act headings are supported in the live editor", async () => {
  const [html, app, css] = await Promise.all([readFile(htmlPath, "utf8"), readFile(appPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.match(html, /id="menu-insert-section"[^>]*>Act heading/);
  assert.match(app, /match\(\/\^#\\s\+\(Act\\b\.\*\)\$\/i\)/);
  assert.match(app, /appendToSource\("# Act 1\\n\\n"\)/);
  assert.match(css, /\.script-line\.section\.act[^}]*display:\s*block;/);
  assert.match(runtimeSource, /def _fp_format_pdf_act_headings\(screenplay\)/);
  assert.match(runtimeSource, /Slug\(bold\(str\(paragraph\.text\)\.upper\(\)\), scene_number=None\)/);
  assert.match(css, /\.script-line\.section\.act[^}]*font:\s*700 16px\/1 var\(--screenplay\);[^}]*text-align:\s*left;/s);
});

test("source completions wait for typing on a new line and support explicit character lookup", async () => {
  const [app, css] = await Promise.all([readFile(appPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.match(app, /event\.key === "Enter"\) hideCompletions\(\)/);
  assert.match(app, /event\.inputType === "insertText"\) showCompletions\(\)/);
  assert.match(app, /if \(!allowBlank && !currentText\) return hideCompletions\(\)/);
  assert.match(app, /const explicitCharacter = trimmed\.startsWith\("@"\)/);
  assert.match(app, /state\.metadata\.characters\.some\(\(character\) => character\.name\.toUpperCase\(\)\.startsWith\(characterFragment\)\)/);
  assert.match(app, /function positionSourceCompletion\(\)/);
  assert.match(app, /const sourceScrollLeft = boundedScrollLeft\(source\)/);
  assert.match(app, /wrapped \? 0 : sourceScrollLeft/);
  assert.match(app, /marker\.getBoundingClientRect\(\)/);
  assert.match(app, /explicitCharacter \|\| previousBlank \? current\.trimStart\(\)/);
  assert.match(app, /item\.value\.toUpperCase\(\) !== characterFragment/);
  assert.match(css, /#completion-menu\s*\{[^}]*position:\s*fixed;/s);
});

test("PDF reconstruction emits ordinary character cues in every import layout", async () => {
  const app = await readFile(appPath, "utf8");
  const functions = app.slice(app.indexOf("function pdfLayoutToFountain("), app.indexOf("function normalizeScreenplayPaste("));
  const context = {};
  runInNewContext(functions, context);
  const screenplay = context.pdfLayoutToFountain(["INT. ROOM - DAY\n\n              MAYA CHEN\n        Hello there.\n"]);
  const stagePlay = context.pdfLayoutToFountain(["The Play\nby\nA Writer", "Cast of Characters\nMAYA CHEN: A scientist\nACT ONE\nMAYA CHEN Hello there."]);
  const flattened = context.flattenedScreenplayToFountain("INT. ROOM - DAY\nMAYA CHEN\nHello there.");
  for (const text of [screenplay, stagePlay, flattened]) {
    assert.match(text, /\n\nMAYA CHEN\nHello there\./);
    assert.doesNotMatch(text, /^@/m);
  }
});

test("Source character completion matches full explicit names and preserves the marker", async () => {
  const app = await readFile(appPath, "utf8");
  const candidates = app.slice(app.indexOf("function completionCandidates("), app.indexOf("function showCompletions("));
  const accept = app.slice(app.indexOf("function acceptCompletion("), app.indexOf("async function newFile("));
  for (const [typed, expected] of [["@MAYA C", "@Maya Chen\n"], ["@ma", "@Maya Chen\n"], ["@", "@Maya Chen\n"], ["MAYA C", "Maya Chen\n"], ["Action with @MAYA C", "Action with @MAYA C"]]) {
    const source = {
      value: `INT. ROOM - DAY\n\n${typed}`,
      setRangeText(value, start, end) { this.value = this.value.slice(0, start) + value + this.value.slice(end); },
    };
    source.selectionStart = source.value.length;
    const context = {
      source, currentPosition: () => ({ line: 2, start: "INT. ROOM - DAY\n\n".length }),
      state: { metadata: { characters: [{ name: "Maya Chen", lines: 3 }], locations: [], titleFields: [] }, completionIndex: 0 },
      isScene: () => false, hideCompletions() {}, sourceChanged() {}, canEditDocument: () => true,
    };
    runInNewContext(`${candidates}\n${accept}\nstate.completionItems = completionCandidates(); acceptCompletion();`, context);
    assert.equal(source.value, `INT. ROOM - DAY\n\n${expected}`);
  }
});

test("Preview completion recognizes hidden force markers and keeps the source-backed caret", async () => {
  const app = await readFile(appPath, "utf8");
  const show = app.slice(app.indexOf("function showPreviewCharacterCompletions("), app.indexOf("function renderPreviewCharacterCompletions("));
  const accept = app.slice(app.indexOf("function acceptPreviewCharacterCompletion("), app.indexOf("function renderEditorChrome("));
  for (const text of ["", "Maya C", "@Maya C"]) {
    let replacement;
    const line = { textContent: text, classList: { contains: (name) => name === "character" } };
    const context = {
      line, state: { metadata: { characters: [{ name: "Maya Chen" }] } },
      renderPreviewCharacterCompletions() {}, hidePreviewCompletions() {},
      replacePreviewSelection(edit, value) { replacement = { edit, value }; },
    };
    runInNewContext(`${show}\n${accept}\nshowPreviewCharacterCompletions(line); acceptPreviewCharacterCompletion();`, context);
    assert.equal(replacement.value, text.startsWith("@") ? "@Maya Chen" : "Maya Chen");
    assert.equal(replacement.edit.startLine, line);
    assert.equal(replacement.edit.endOffset, text.length);
  }
  assert.match(app, /if \(typeChanged\) \{\s*renderPreview\(\{ focusLine, focusOffset \}\);\s*showPreviewCharacterCompletions/);
  let hidden = false;
  runInNewContext(`${show}\nshowPreviewCharacterCompletions(null);`, { hidePreviewCompletions() { hidden = true; } });
  assert.equal(hidden, true);
});

test("spellcheck exposes private local replacement suggestions in the unified editor menu", async () => {
  const [html, app] = await Promise.all([readFile(htmlPath, "utf8"), readFile(appPath, "utf8")]);
  assert.match(html, /Right-click spelling for suggestions/);
  assert.match(html, /aria-describedby="editor-status spellcheck-help"/);
  assert.match(html, /id="source"[^>]*spellcheck="false"/);
  assert.match(app, /type === "character" \? ` spellcheck="false" autocorrect="off" autocomplete="off"`/);
  assert.match(app, /function sourceSpellingHtml\(value, type, checker\)[\s\S]*type === "character"[\s\S]*word === word\.toUpperCase\(\)/);
  assert.match(app, /source\.setAttribute\("spellcheck", "false"\)/);
  assert.match(app, /import\("\.\/vendor\/spellcheck\.mjs"\)/);
  assert.match(app, /dictionary-en\.aff/);
  assert.match(app, /candidate\.word === candidate\.word\.toUpperCase\(\)/);
  assert.match(app, /checker\.suggest\(candidate\.word\)\.slice\(0, 5\)/);
});

test("the unified editor menu toggles supported Fountain emphasis", async () => {
  const [html, app] = await Promise.all([readFile(htmlPath, "utf8"), readFile(appPath, "utf8")]);
  for (const action of ["bold", "italic", "bold-italic", "underline"]) assert.match(html, new RegExp(`data-context-action="${action}"`));
  assert.doesNotMatch(html, /data-context-action="strikethrough"/);
  assert.match(app, /function toggleFountainEmphasis\(action, context, surface\)/);
  assert.match(app, /const markers = \{ bold: "\*\*", italic: "\*", "bold-italic": "\*\*\*", underline: "_" \}/);
  assert.match(app, /function normalizeNestedFountainEmphasis\(text, action\)[\s\S]*action === "italic"[\s\S]*action === "bold"[\s\S]*action === "bold-italic"/);
  assert.match(app, /selected\.startsWith\(marker\)[\s\S]*source\.value\.slice\(Math\.max\(0, start - marker\.length\), start\) === marker[\s\S]*replacement = `\$\{marker\}\$\{normalizeNestedFountainEmphasis\(selected, action\)\}\$\{marker\}`/);
  assert.match(app, /toggleFountainEmphasis\(action, contextSelection, contextSurface\)/);
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
  assert.match(css, /:root\s*\{[^}]*color-scheme:\s*light;/s);
  assert.match(css, /:root\[data-theme="dark"\]\s*\{[^}]*color-scheme:\s*dark;/s);
  assert.match(css, /data-effective-theme="dark"[^}]*\.theme-sun\s*\{\s*display:\s*none;/);
});

test("source editor uses neutral backgrounds with colored screenplay cues", async () => {
  const css = await readFile(cssPath, "utf8");
  assert.match(css, /:root\s*\{[\s\S]*--source-bg:\s*#f6f6f5;[\s\S]*--source-ink:\s*#0f172a;[\s\S]*--syntax-scene:\s*#0284c7;[\s\S]*--syntax-character:\s*#366fc2;[\s\S]*--syntax-transition:\s*#b45309;[\s\S]*--syntax-ignored:\s*#be123c;/);
  assert.match(css, /:root\[data-theme="dark"\]\s*\{[\s\S]*--source-bg:\s*#111315;[\s\S]*--source-ink:\s*#cbd5e1;[\s\S]*--syntax-scene:\s*#38bdf8;[\s\S]*--syntax-character:\s*#d7c1da;[\s\S]*--syntax-transition:\s*#fbbf24;[\s\S]*--syntax-ignored:\s*#fb7185;/);
  assert.match(css, /\.editor-shell\s*\{[^}]*background:\s*var\(--source-bg\);/s);
  assert.match(css, /\.source-highlight\s*\{[^}]*color:\s*var\(--source-ink\);/s);
  assert.match(css, /\.line-numbers\s*\{[^}]*background:\s*var\(--source-gutter-bg\);/s);
  assert.match(css, /\.source-highlight \.syntax-dialogue\s*\{\s*color:\s*color-mix\(in srgb, var\(--syntax-dialogue\) 65%, var\(--source-ink\)\);/);
  assert.match(css, /\.source-highlight \.syntax-action\s*\{\s*color:\s*color-mix\(in srgb, var\(--syntax-action\) 65%, var\(--source-ink\)\);/);
});

test("Preview can color screenplay elements with the active theme", async () => {
  const [html, app, css] = await Promise.all([readFile(htmlPath, "utf8"), readFile(appPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.match(html, /id="preview-colors"[^>]*type="checkbox"[^>]*role="switch"/);
  assert.match(app, /fountain-publisher\.preview-colors/);
  assert.match(app, /classList\.toggle\("preview-colors",\s*(?:event\.target\.checked|previewColors)\)/);
  for (const type of ["title-value", "scene", "action", "character", "parenthetical", "dialogue", "transition", "section.act"]) {
    assert.match(css, new RegExp(`body\\.preview-colors \\.script-line\\.${type.replace(".", "\\.")}`));
  }
  assert.match(css, /body\.preview-colors \.script-line\.scene\s*\{[^}]*color-mix\(in srgb, var\(--syntax-scene\) 65%, var\(--paper-ink\)\)/);
  assert.match(css, /:root\[data-theme="espresso"\][^}]*--syntax-action:[^;}]+;[^}]*--syntax-dialogue:/);
  assert.match(css, /:root\[data-theme="dracula"\][^}]*--syntax-action:[^;}]+;[^}]*--syntax-dialogue:/);
  assert.match(css, /:root\[data-theme="tokyo-night"\][^}]*--syntax-action:[^;}]+;[^}]*--syntax-dialogue:/);
  assert.match(css, /:root\[data-theme="synth-wave"\][^}]*--syntax-action:[^;}]+;[^}]*--syntax-dialogue:/);
});

test("blank documents retain a page and title inference is constrained", async () => {
  const app = await readFile(appPath, "utf8");
  assert.match(app, /page\.hidden = state\.previewMode !== "live"/);
  assert.match(app, /const TITLE_KEYS = new Set/);
  assert.match(app, /titleContinuation/);
});

test("compact centered bold markup renders without literal angle markers", async () => {
  const app = await readFile(appPath, "utf8");
  assert.match(app, /line\.raw\.trim\(\)\.match\(\/\^>\\s\*\(\.\*\?\)\\s\*</);
  assert.match(runtimeSource, /source = re\.sub\(r"\(\?m\)\^\(\[\^\\\\S\\\\r\\\\n\]\*\)>\(\\\\S/);
});

test("the long sample screenplay is opt-in with demo=1", async () => {
  const app = await readFile(appPath, "utf8");
  assert.match(app, /params\.get\("demo"\)\s*===\s*"1"\s*\?\s*SAMPLE\s*:\s*BLANK_TEMPLATE/);
  assert.match(app, /let name = params\.get\("demo"\)\s*===\s*"1"/);
  const sample = app.match(/const SAMPLE = `([\s\S]*?)`;/)?.[1] || "";
  assert.ok(sample.split(/\s+/).length > 450, "demo should remain substantial");
  assert.doesNotMatch(sample, /FADE IN:|FADE OUT\.|CUT TO:/);
  assert.match(sample, />\*\*END\*\*</);
  assert.match(app, /function fountainInlineHtml\(value\)\s*\{\s*return parseFountainInline\(value\)\.html/);
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
  assert.match(html, /id="beat-sheet-empty-state"[\s\S]*Map the story before/);
  assert.doesNotMatch(html, /data-blank-insert/);
  assert.match(app, /beat-sheet-empty-state[^\n]*hidden = hasBeatSheet/);
});

test("the app always opens in live Preview regardless of saved view state", async () => {
  const app = await readFile(appPath, "utf8");
  const initialize = app.match(/async function initialize\(\) \{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.match(initialize, /setMobileTab\("preview"\)/);
  assert.match(initialize, /await setPreviewMode\("live"\)/);
  assert.doesNotMatch(initialize, /localStorage\.getItem\("fountain-publisher\.(?:preview|mobile-tab)"\)/);
  assert.doesNotMatch(initialize, /cached\?\.previewMode/);
});

test("preview gives title-page fields a compact visual boundary", async () => {
  const [app, css] = await Promise.all([readFile(appPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.match(app, /<section class="title-page-block" aria-label="Title page fields">/);
  assert.match(css, /\.title-page-block\s*\{[^}]*margin:\s*72px -18px 0;[^}]*border:\s*1px dashed/s);
  assert.match(css, /\.title-page-block::before\s*\{[^}]*content:\s*"TITLE PAGE"/s);
  assert.doesNotMatch(css, /\.script-line\.title-value\.title\s*\{[^}]*margin-top:\s*230px/);
});

test("the browser continuously restores a separate local recovery workspace", async () => {
  const [html, app] = await Promise.all([readFile(htmlPath, "utf8"), readFile(appPath, "utf8")]);
  assert.match(app, /WORKSPACE_CACHE_KEY = "fountain-publisher\.workspace\.v1"/);
  assert.match(app, /function persistWorkspaceNow\([\s\S]*source:\s*source\.value[\s\S]*savedSource:\s*state\.savedSource[\s\S]*selectionStart:[\s\S]*sourceScrollTop:[\s\S]*previewScrollTop:[\s\S]*previewMode:[\s\S]*zoom:/);
  assert.match(app, /window\.addEventListener\("beforeunload", \(\) => \{[\s\S]*clearWorkspaceOnExit\(\)[\s\S]*clearWorkspaceCache\(\)[\s\S]*persistWorkspaceNow\(\)/);
  assert.doesNotMatch(app, /beforeunload[^\n]*preventDefault/);
  assert.match(app, /toast\("Workspace restored"\)/);
  assert.match(app, /const enableWorkspaceCache = params\.get\("demo"\) !== "1"/);
  assert.match(app, /source\.setSelectionRange\(start, end\)[\s\S]*state\.cacheEnabled = enableWorkspaceCache/);
  assert.match(html, /continuously cached in this browser/);
  assert.match(html, /recovery draft is separate from your files/);
  assert.match(html, /id="clear-workspace-on-exit"/);
  assert.match(app, /if \(clearWorkspaceOnExit\(\)\) clearWorkspaceCache\(\)/);
});

test("the active non-printing line remains visible as editor context", async () => {
  const [app, css] = await Promise.all([readFile(appPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.match(css, /\.script-line\.section\.source-current/);
  assert.match(css, /content:\s*"EDITOR ONLY/);
  assert.match(css, /\.script-line\.empty\s*\{[^}]*display:\s*none;[^}]*\}[\s\S]*\.script-line\.empty\.source-current, \.script-line\.empty\.preview-empty-context\s*\{[^}]*display:\s*block;/);
  assert.match(app, /function revealPreviewEmptyRun\(target, includePrevious = false\)[\s\S]*includePrevious \? targetLine - 1[\s\S]*lines\[start - 1\]\?\.type === "empty"[\s\S]*preview-empty-context/);
  assert.match(app, /function insertPreviewDraftRow\(target\)[\s\S]*className = "script-line empty preview-empty-context preview-draft-row"[\s\S]*dataset\.line = String\(draftLine\)/);
  assert.match(app, /function renderPreview\(\{ focusLine = null, focusOffset = null, revealEmptyBefore = false, draftBefore = false \} = \{\}\)[\s\S]*if \(draftBefore\) insertPreviewDraftRow\(target\)/);
  assert.match(app, /updatePreviewCursor\(false, "nearest", revealEmptyBefore\)/);
  assert.match(app, /function updatePreviewCursor\(scroll = false, scrollBlock = "nearest", revealEmptyBefore = false\)[\s\S]*revealPreviewEmptyRun\(target, revealEmptyBefore\)/);
  assert.match(app, /renderPreview\(\{ focusLine, focusOffset, revealEmptyBefore: insertedText\.includes\("\\n"\), draftBefore: insertedText\.includes\("\\n"\) && before\.length === 0 \}\)/);
  assert.match(app, /function focusVimCursor[\s\S]*revealPreviewEmptyRun\(line, position\.column === 0\)[\s\S]*page\.focus/);
  assert.doesNotMatch(app, /limitBlankLineRun/);
  assert.match(app, /source\.addEventListener\("input", \(event\) => \{\s*if \(event\.isComposing \|\| state\.sourceComposing\) return;\s*if \(source\.value !== state\.lastSourceValue\) sourceChanged\(\);/);
  assert.match(app, /page\.addEventListener\("pointerup"[\s\S]*setSourceSelectionFromPreview\(edit\); updatePreviewCursor\(\)/);
  assert.match(app, /page\.addEventListener\("focusout"[\s\S]*preview-empty-context/);
  assert.match(app, /draftBefore: insertedText\.includes\("\\n"\) && before\.length === 0/);
  assert.match(app, /const nextType = classifyLines\(source\.value\)\[focusLine\]\?\.type;[\s\S]*nextType !== edit\.startLine\.dataset\.type[\s\S]*renderPreview\(\{ focusLine, focusOffset \}\)/);
  assert.match(app, /function syncPreviewLine[\s\S]*nextType !== element\.dataset\.type[\s\S]*renderPreview\(\{ focusLine: index, focusOffset \}\)/);
  assert.match(css, /\.script-line\.empty\.preview-draft-row\s*\{[^}]*display:\s*block !important;[^}]*height:\s*16px;/s);
});

test("Preview navigation never enters editor-only source lines", async () => {
  const app = await readFile(appPath, "utf8");
  assert.match(app, /function previewLineIsEditable[\s\S]*line\.classList\.contains\("section"\)[\s\S]*line\.classList\.contains\("act"\)[\s\S]*"synopsis", "note", "boneyard", "title-key", "page-break"/);
  assert.match(app, /function adjacentPreviewEditableLine[\s\S]*filter\(previewLineIsEditable\)/);
  assert.match(app, /const adjacent = adjacentPreviewEditableLine\(line, verticalDirection\)/);
  assert.match(app, /const candidates = \$\$\("\.script-line\[data-display\]", page\)\.filter\(previewLineIsEditable\)/);
  assert.match(app, /function vimPreviewTargetLine[\s\S]*previewLineIsEditable\(line\) && !line\.classList\.contains\("empty"\)/);
  assert.match(app, /function vimPreviewEndpoint[\s\S]*if \(!previewLineIsEditable\(line\)\) return null/);
});

test("Preview action spacing follows Screenplain paragraph spacing", async () => {
  const css = await readFile(cssPath, "utf8");
  assert.match(css, /\.script-line\.action\s*\{[^}]*margin:\s*16px 0 0;/);
  assert.match(css, /\.script-line\.action \+ \.script-line\.action\s*\{[^}]*margin-top:\s*0;/);
});

test("scene outline clicks synchronize source and live preview", async () => {
  const [app, css] = await Promise.all([readFile(appPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.match(app, /function jumpToLine[\s\S]*updateCursor\(\{ scrollPreview: true \}\)/);
  assert.match(app, /function jumpToInsightScene[\s\S]*jumpToLine\(oneBased, false\)/);
  assert.match(app, /#scene-list[\s\S]*jumpToInsightScene\(Number\(button\.dataset\.line\)\)/);
  assert.match(app, /function setMobileTab[\s\S]*requestAnimationFrame\(\(\) => jumpToLine\(state\.insightLine, false\)\)/);
  assert.match(app, /function scrollPreviewTarget[\s\S]*previewScroll\.scrollTop = Math\.max\(0, top\)/);
  assert.match(app, /previewScroll\.scrollLeft = boundedScrollLeft\(previewScroll, left\)/);
  assert.doesNotMatch(app, /target\?\.scrollIntoView/);
  assert.match(css, /\.preview-toolbar\s*\{[^}]*flex:\s*0 0 auto;/s);
});

test("Insights nests scenes beneath top-level acts in one outline", async () => {
  const [html, app, css] = await Promise.all([readFile(htmlPath, "utf8"), readFile(appPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.match(html, /<summary>Outline <small id="scene-count">/);
  assert.doesNotMatch(html, /Scene outline/);
  assert.doesNotMatch(html, /id="act-outline-section"|id="act-list"/);
  assert.match(app, /sections\.push\(\{ level: match\[1\]\.length, title: match\[2\], line: index \+ 1 \}\)/);
  assert.match(app, /filter\(\(section\) => section\.level === 1\)/);
  assert.match(app, /class="outline-act"[\s\S]*class="outline-act-heading"[\s\S]*<ol>\$\{actScenes/);
  assert.match(app, /scene\.actNumber === actNumber/);
  assert.match(app, /outlineSceneRow\(scene, String\(sceneIndex \+ 1\)\)/);
  assert.match(css, /\.scene-list \.outline-act > ol\s*\{[^}]*padding:\s*0 0 4px 12px;/s);
});

test("live preview numbers scene headings via computed labels", async () => {
  const app = await readFile(appPath, "utf8");
  assert.match(app, /function computeSceneLabels\(/);
  assert.match(app, /line\.display\.replace\(\/\^\\\.\//);
  assert.match(app, /sceneLabels\.get\(lines\[i\]\.index\)/);
  assert.match(runtimeSource, /paragraph\.line = plain\(f"\{label\}\. "\) \+ paragraph\.line/);
});

test("page totals come from the compiled Screenplain PDF", async () => {
  const [app, css] = await Promise.all([readFile(appPath, "utf8"), readFile(cssPath, "utf8")]);
  const compiler = await readFile(new URL("../../src/fountain_publisher/web/local-compiler.mjs", import.meta.url), "utf8");
  assert.match(app, /function renderPageMetric\(metadata\)/);
  assert.match(app, /1:\s*\[1, 8\][\s\S]*4:\s*\[1, 2\][\s\S]*7:\s*\[7, 8\]/);
  assert.match(app, /class="page-fraction"><sup>\$\{fraction\[0\]\}<\/sup><sub>\$\{fraction\[1\]\}<\/sub>/);
  assert.match(css, /\.page-fraction\s*\{[^}]*display:\s*inline-grid;[^}]*height:\s*1em;[^}]*vertical-align:\s*middle;[^}]*font-weight:\s*400;[^}]*translateY\(-\.03em\);/s);
  assert.match(css, /\.page-fraction::after\s*\{[^}]*top:\s*50%;[^}]*border-top:/s);
  assert.match(css, /\.page-fraction sup, \.page-fraction sub\s*\{[^}]*place-items:\s*center;[^}]*transform:\s*none;/s);
  assert.match(app, /function compilePageCount/);
  assert.match(compiler, /pageCount: Math\.max\(0, physicalPages - titlePages\)/);
  assert.match(runtimeSource, /usage\["title_pages"\] = int\(self\.has_title_page\)/);
  assert.match(app, /lastPageEighths/);
  assert.match(runtimeSource, /_fp_last_page_eighths/);
  assert.match(app, /estimatedSeconds = result\.pageCount \* 60/);
  assert.match(runtimeSource, /_fp_prepare_screenplay[\s\S]*isinstance\(screenplay\.paragraphs\[0\], PageBreak\)/);
  assert.ok(compiler.includes('/Type\\s*\\/Page\\b'));
});

test("preview toolbar and rotating arrows stay compact", async () => {
  const [html, app, css] = await Promise.all([readFile(htmlPath, "utf8"), readFile(appPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.doesNotMatch(html, /id="page-estimate"/);
  assert.doesNotMatch(html, /id="preview-percent"/);
  assert.doesNotMatch(css, /\.preview-status/);
  assert.doesNotMatch(app, /function updatePreviewStatus\(/);
  assert.match(css, /\.insights-open-button i::after\s*\{[^}]*border-left:/);
  assert.match(css, /\.preview-actions select\s*\{[^}]*width:\s*72px;[^}]*padding-left:\s*8px !important;[^}]*padding-right:\s*20px !important;[^}]*text-align:\s*center;[^}]*text-align-last:\s*center;/);
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

test("character analytics supports a scrollable timeline, PNG save, and CSV copy", async () => {
  const [html, app, css] = await Promise.all([readFile(htmlPath, "utf8"), readFile(appPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.match(html, /summary>Characters <small id="character-count">/);
  assert.match(html, /class="character-analytics-button"[^>]*data-character-analytics>Character Analytics/);
  assert.match(css, /\.character-analytics-button, \.character-csv-button\s*\{[^}]*width:\s*100%;[^}]*text-align:\s*center;/s);
  assert.match(html, /id="character-analytics-chart"/);
  assert.doesNotMatch(html, /id="character-analytics-full"/);
  assert.match(html, /id="character-analytics-back"[^>]*>← Overview</);
  assert.match(html, /id="copy-character-lines"[^>]*>Copy line usage CSV/);
  assert.match(app, /navigator\.clipboard\.writeText\(characterLineUsageCsv\(\)\)/);
  assert.match(app, /characters\.map\(\(character\) => `\$\{character\.name\}, \$\{character\.lines\}`\)/);
  assert.doesNotMatch(app, /\["Character", "Dialogue Lines"\]/);
  assert.doesNotMatch(app, /function characterLineUsageCsv\(\)[\s\S]*csvCell/);
  assert.doesNotMatch(app, /<th>Duration<\/th>/);
  assert.doesNotMatch(app, /function formatDuration\(/);
  assert.match(app, /\.toBlob\(resolve,\s*"image\/png"\)/);
  assert.match(css, /\.analytics-chart-scroll\s*\{[^}]*overflow:\s*auto;/s);
  assert.match(html, /id="character-line-table"/);
  assert.match(html, /id="character-line-table" class="character-line-table"/);
  assert.doesNotMatch(app, /table\.style\.width/);
  assert.match(app, /function characterChartColor\(name\)[\s\S]*findIndex[\s\S]*--character-chart-/);
  assert.match(app, /function chartLabelColor\(color\)[\s\S]*luminance/);
  assert.match(app, /renderSceneCharacterAnalytics[\s\S]*characterChartColor\(character\)/);
  assert.match(app, /renderCharacterAnalytics[\s\S]*characterChartColor\(character\.name\)/);
  assert.match(app, /const intensity = maxLines === minLines \? 1 : 0\.3 \+ 0\.7[\s\S]*context\.globalAlpha = intensity/);
  assert.match(app, /intensity >= 0\.62 \? chartLabelColor\(characterColor\) : ink/);
  assert.match(app, /function sceneCharacterWordSegments\(sceneIndex\)[\s\S]*segments\.push\(\{ character: active, start: position, words \}\)/);
  assert.match(app, /function renderSceneCharacterAnalytics\(sceneIndex\)[\s\S]*segment\.start \/ total[\s\S]*segment\.words \/ total/);
  assert.match(app, /presentCharacters[\s\S]*rollupOrder[\s\S]*rollupOrder\.filter\(\(character\) => presentCharacters\.has\(character\)\)/);
  const sceneGantt = app.slice(app.indexOf("function renderSceneCharacterAnalytics"), app.indexOf("function renderCharacterAnalytics"));
  assert.doesNotMatch(sceneGantt, /fillText\(String\(segment\.words\)/);
  assert.match(app, /fillText\(String\(lineCount\)/);
  assert.match(app, /function characterAnalyticsGroups\(\)[\s\S]*characterAnalyticsActGroups[\s\S]*characterAnalyticsDocumentGroup/);
  assert.match(app, /function characterAnalyticsActGroups\(\)[\s\S]*sections[\s\S]*kind: "act"/);
  assert.match(app, /function characterAnalyticsDocumentGroup\(\)[\s\S]*kind: "document"/);
  assert.match(app, /function characterGroupLineUsage\(group\)[\s\S]*line\.type === "dialogue"[\s\S]*usage\.set/);
  assert.match(app, /groups\.length === 1 \? groups\[0\] : null/);
  assert.match(app, /y < 28[\s\S]*!state\.metadata\.scenes\.length[\s\S]*characterAnalyticsDocumentGroup\(\)[\s\S]*characterAnalyticsActGroups\(\)\.find/);
  assert.match(app, /character-analytics-chart"\)\.addEventListener\("click"[\s\S]*sceneIndex[\s\S]*renderCharacterAnalytics\(\)/);
  assert.match(app, /function renderSceneCharacterAnalytics\(sceneIndex\)[\s\S]*chartViewport\.clientWidth - labelWidth/);
  assert.match(app, /function openCharacterAnalytics\(\)[\s\S]*showModal\(\);[\s\S]*renderCharacterAnalytics\(\)/);
  assert.match(app, /return String\(sceneInAct\)/);
  assert.match(app, /fillRect\(0, y, labelWidth \+ scenes\.length \* sceneWidth, rowHeight\)/);
  assert.doesNotMatch(app, /moveTo\(0, y \+ rowHeight \+ 0\.5\)/);
  assert.match(css, /--character-chart-1:\s*#0072b2;[\s\S]*--character-chart-8:\s*#716400;/);
  assert.match(css, /:root\[data-theme="dark"\][\s\S]*--character-chart-1:\s*#56b4e9;[\s\S]*--character-chart-8:\s*#d7c75b;/);
});

test("source-backed annotations and notes expose preview and sidebar CRUD", async () => {
  const [html, app, css, worker] = await Promise.all([readFile(htmlPath, "utf8"), readFile(appPath, "utf8"), readFile(cssPath, "utf8"), readFile(workerPath, "utf8")]);
  assert.match(html, /id="annotation-dialog"/);
  assert.match(html, /id="annotation-text" rows="6"(?![^>]*required)/);
  assert.match(html, /button value="cancel" formnovalidate>Cancel<\/button>/);
  assert.match(html, /id="character-note-dialog"/);
  assert.match(html, /id="general-note-dialog"/);
  assert.match(html, /summary>General notes/);
  assert.match(html, /id="preview-context-menu"/);
  assert.match(html, /data-context-action="annotation"/);
  assert.match(html, /data-context-action="copy"/);
  assert.match(html, /data-context-action="cut"/);
  assert.match(html, /data-context-action="paste"/);
  assert.match(app, /MANAGED_NOTE_RE/);
  assert.match(app, /page\.addEventListener\("contextmenu"/);
  assert.match(app, /source\.addEventListener\("contextmenu"/);
  assert.match(app, /function showPreviewContextMenu/);
  assert.match(app, /function runPreviewClipboardAction/);
  assert.match(app, /document\.execCommand\("copy"\)/);
  assert.match(app, /navigator\.clipboard\.readText\(\)/);
  assert.match(app, /data-annotation-line/);
  assert.match(app, /function annotationAfter\(lines, index\)/);
  assert.match(app, /next\?\.type === "note" && !managedNote\(next\.raw\)/);
  assert.match(app, /const insertAt = state\.noteEditor\.insertAfter \+ 1;/);
  assert.match(app, /const nextType = classifyLines\(source\.value\)\[insertAt\]\?\.type;/);
  assert.match(app, /lines\.splice\(insertAt, 0, `\[\[\$\{text\}\]\]`\)/);
  assert.match(app, /if \(nextType === "character"[\s\S]*lines\.splice\(insertAt \+ 1, 0, ""\)/);
  assert.doesNotMatch(app, /class="script-line note annotation-line"/);
  assert.match(app, /managedCharacterSource/);
  assert.match(app, /managedGeneralSource/);
  assert.match(app, /const preservedNotes = startIndex === endIndex/);
  assert.match(app, /const candidates = \$\$\("\.script-line\[data-display\]"/);
  assert.match(app, /\["dialogue", "parenthetical", "note"\]\.includes/);
  assert.match(css, /\.annotation-orb\s*\{/);
  assert.match(css, /--annotation-accent:\s*var\(--syntax-character\);/);
  assert.match(css, /\.note-indicator\s*\{[^}]*color:\s*var\(--annotation-accent\);[^}]*text-shadow:[^;}]*var\(--annotation-accent\)/s);
  assert.match(css, /\.annotation-orb\s*\{[^}]*appearance:\s*none;[^}]*-webkit-appearance:\s*none;[^}]*background-color:\s*var\(--annotation-accent\)/s);
  assert.match(worker, /fountain-publisher-shell-v11/);
  assert.match(worker, /\["styles\.css", "app\.mjs"\][\s\S]*fetch\(request\)[\s\S]*catch\(\(\) => caches\.match\(request\)\)/);
  assert.match(css, /\.annotation-orb\s*\{[^}]*top:\s*1px;/s);
  assert.match(app, /function alignAnnotationOrbs\(\)[\s\S]*marginCenterX[\s\S]*orb\.offsetWidth \* scale \* \.5[\s\S]*orb\.style\.left/);
  assert.match(app, /requestAnimationFrame\(alignAnnotationOrbs\)/);
  assert.match(css, /@media\s*\(max-width:\s*820px\)[\s\S]*padding:\s*48px max\(28px, 7vw\) 72px;/s);
  assert.match(css, /\.annotation-orb\s*\{[^}]*width:\s*12px;[^}]*height:\s*12px;/s);
  assert.match(css, /@media\s*\(max-width:\s*820px\)[\s\S]*\.annotation-orb\s*\{[^}]*width:\s*14px;[^}]*height:\s*14px;/s);
  assert.match(css, /\.annotation-orb::after\s*\{[^}]*inset:\s*-8px;/s);
  assert.match(app, /page\.addEventListener\("pointerdown"[\s\S]*previewTouchMenuTimer = setTimeout[\s\S]*showPreviewContextMenu[\s\S]*420/);
  assert.match(app, /page\.addEventListener\("pointermove"[\s\S]*Math\.hypot[\s\S]*cancelPreviewTouchMenu/);
  assert.match(css, /\.preview-context-menu button\s*\{[^}]*min-height:\s*44px;/s);
  assert.match(css, /\.preview-context-menu\s*\{/);
  assert.match(css, /\.general-notes\s*\{/);
});

test("annotation and note deletion uses a muted rose treatment", async () => {
  const [html, css] = await Promise.all([readFile(htmlPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.match(html, /id="delete-annotation" class="danger"/);
  assert.match(html, /id="delete-character-note" class="danger"/);
  assert.match(html, /id="delete-general-note" class="danger"/);
  assert.match(css, /\.dialog-actions \.danger\s*\{[^}]*border-color:\s*color-mix\(in srgb, var\(--danger\) 52%, var\(--border\)\);[^}]*background:\s*color-mix\(in srgb, var\(--danger\) 11%, var\(--surface\)\);[^}]*color:/s);
  assert.match(css, /\.dialog-actions \.danger:hover\s*\{[^}]*background:\s*color-mix\(in srgb, var\(--danger\) 17%, var\(--surface\)\);/s);
});

test("primary Save and export actions use a muted blue treatment", async () => {
  const [html, css] = await Promise.all([readFile(htmlPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.match(html, /class="primary" id="save-character-analytics"[^>]*>Save PNG/);
  assert.match(html, /class="primary" id="save-beat-progress"[^>]*>Save PNG/);
  assert.match(css, /\.dialog-actions \.primary, \.github-save-fields button\.primary, \.analytics-actions \.primary, \.beat-sheet-actions \.primary\s*\{[^}]*border-color:\s*color-mix\(in srgb, var\(--accent\) 52%, var\(--border\)\);[^}]*background:\s*color-mix\(in srgb, var\(--accent\) 11%, var\(--surface\)\);[^}]*color:/s);
  assert.match(css, /\.dialog-actions \.primary:hover,[^}]*background:\s*color-mix\(in srgb, var\(--accent\) 17%, var\(--surface\)\);/s);
});

test("the annotation editor uses one compact field heading", async () => {
  const [html, app, css] = await Promise.all([readFile(htmlPath, "utf8"), readFile(appPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.match(html, /<label class="annotation-field"><span id="annotation-heading">Edit Annotation<\/span><textarea id="annotation-text"/);
  assert.doesNotMatch(html, /<small>SCREENPLAY<\/small><h2 id="annotation-heading"/);
  assert.match(app, /line === null \? "Add Annotation" : "Edit Annotation"/);
  assert.match(css, /\.note-form > \.annotation-field\s*\{\s*margin-top:\s*0;/);
});

test("Beat Sheet Enter inserts and focuses a new beat after the current beat", async () => {
  const app = await readFile(appPath, "utf8");
  const handlerSource = app.slice(
    app.indexOf('$("#beat-list").addEventListener("keydown"'),
    app.indexOf("let beatSheetSaveTimer"),
  );
  for (const currentIndex of [0, 1, 2]) {
    const cards = ["First", "Middle", "Last"].map((text) => ({
      text,
      range: { startLine: 1, endLine: 3 },
      get nextElementSibling() { return cards[cards.indexOf(this) + 1] || null; },
      insertAdjacentHTML(position, html) {
        assert.equal(position, "afterend");
        assert.equal(html, "<li></li>");
        cards.splice(cards.indexOf(this) + 1, 0, { text: "", range: null });
      },
    }));
    const originalCards = [...cards];
    const current = cards[currentIndex];
    let handler;
    let focused;
    let renumbered = 0;
    let saved = 0;
    let prevented = 0;
    runInNewContext(handlerSource, {
      $: (selector, card) => {
        if (selector === "#beat-list") {
          return { addEventListener: (type, listener) => {
            assert.equal(type, "keydown");
            handler = listener;
          } };
        }
        assert.equal(selector, ".beat-text");
        return { focus: () => { focused = card; } };
      },
      beatCard: () => "<li></li>",
      renumberBeatCards: () => { renumbered += 1; },
      scheduleBeatSheetSave: () => { saved += 1; },
    });
    const target = {
      closest: (selector) => selector === ".beat-card" ? current : null,
      matches: (selector) => selector === ".beat-text",
    };
    handler({ key: "Tab", target, preventDefault: () => { prevented += 1; } });
    assert.deepEqual(cards, originalCards);
    assert.equal(prevented, 0);
    handler({ key: "Enter", target, preventDefault: () => { prevented += 1; } });
    const expected = [...originalCards];
    expected.splice(currentIndex + 1, 0, { text: "", range: null });
    assert.deepEqual(cards, expected);
    assert.equal(focused, cards[currentIndex + 1]);
    assert.equal(renumbered, 1);
    assert.equal(saved, 1);
    assert.equal(prevented, 1);
  }
});

test("Beat Sheet provides a source-backed draggable story map and Preview guide", async () => {
  const [html, app, css] = await Promise.all([readFile(htmlPath, "utf8"), readFile(appPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.doesNotMatch(html, /beat-sheet-insight|id="beat-sheet-summary"|id="open-beat-sheet"/);
  assert.match(html, /id="beat-sheet-panel"[\s\S]*id="beat-premise"[\s\S]*id="beat-list"[^>]*beat-flow-editor/);
  assert.match(html, /id="beat-progress-graph"[^>]*aria-label="Beat pacing by cumulative screenplay words"/);
  assert.match(html, /id="view-beat-progress"[^>]*><span>View pacing graph<\/span><b>Pacing<\/b>/);
  assert.match(html, /id="export-beat-sheet"[^>]*><span>Export PDF<\/span><b>Export<\/b>/);
  assert.match(html, /id="add-beat"[^>]*><span>\+ Add beat<\/span><b>\+ Beat<\/b>/);
  assert.match(html, /id="beat-progress-dialog"[\s\S]*id="save-beat-progress"[^>]*>Save PNG</);
  assert.match(html, /id="menu-toggle-beat-guide"[\s\S]*id="beat-guide-layer"/);
  assert.match(app, /data-assign-beat-area>Assign \+ Next</);
  assert.match(app, /MANAGED_NOTE_RE = \/[\s\S]*BEATS/);
  assert.match(app, /function managedBeatSheetSource\(premise, beats\)/);
  assert.match(app, /Next Beat:[\s\S]*data-assign-beat-area[\s\S]*data-next-beat/);
  assert.match(app, /function selectedBeatArea\(\)[\s\S]*function assignCurrentBeatArea\(\)/);
  assert.match(app, /function transformBeatRange\(range, editStart, oldCount, newCount\)[\s\S]*editEnd <= start[\s\S]*editStart >= endExclusive[\s\S]*return null;/);
  assert.match(app, /function rebaseBeatRanges\(previousValue, nextValue\)[\s\S]*while \(prefix[\s\S]*previousSuffix[\s\S]*transformBeatRange\(beat\.range, prefix, oldCount, newCount\)[\s\S]*managedBeatSheetSource/);
  assert.match(app, /function mergeCurrentManagedNotes\(historyValue, currentValue\)[\s\S]*historyLines\.filter\(\(line\) => !managedNote\(line\)\)[\s\S]*currentLines\.filter\(\(line\) => managedNote\(line\)\)[\s\S]*cleanHistory\.push\(\.\.\.managed\)/);
  assert.match(app, /source\.value = mergeCurrentManagedNotes\(state\.history\[index\], source\.value\);\s*sourceChanged\(\{ fromPreview: previewLine !== null, record: false \}\)/);
  assert.match(app, /function setSourceLines\(lines, \{ record = true \} = \{\}\)[\s\S]*sourceChanged\(\{ record \}\)/);
  assert.match(app, /assignCurrentBeatArea\(\)[\s\S]*setSourceLines\(lines, \{ record: false \}\)/);
  assert.match(app, /annotation-form[\s\S]*setSourceLines\(lines\);[\s\S]*delete-annotation[\s\S]*deleteNoteLine\(state\.noteEditor\?\.line\)/);
  assert.match(app, /function persistBeatSheet\(\)[\s\S]*record: false/);
  assert.match(app, /character-note-form[\s\S]*record: false[\s\S]*general-note-form[\s\S]*record: false/);
  assert.match(app, /function sourceChanged\([^]*?\n\}[^]*?function scheduleCompile/);
  assert.match(app, /rebaseBeatRanges\(state\.lastSourceValue, source\.value\)[\s\S]*state\.lastSourceValue = source\.value/);
  assert.match(app, /function jumpToBeatArea\(beat\)[\s\S]*!\["empty", "note", "boneyard"\]\.includes/);
  assert.match(app, /function setSourceLines\(lines, \{ record = true \} = \{\}\)[\s\S]*selectionDirection[\s\S]*setSelectionRange/);
  assert.doesNotMatch(app, /beatSceneEntries|Connect to scene/);
  assert.doesNotMatch(app, /Place at scene/);
  assert.match(app, /class="beat-number beat-drag" draggable="false"[\s\S]*aria-keyshortcuts="ArrowUp ArrowDown Home End"/);
  assert.match(app, /add-beat"\)\.addEventListener\("click"[\s\S]*beat-card\.selected[\s\S]*insertAdjacentHTML\("afterend", beatCard\(\)\)[\s\S]*added[\s\S]*\.focus\(\)/);
  assert.match(app, /beat-list"\)\.addEventListener\("focusin"[\s\S]*card\.classList\.add\("selected"\)/);
  assert.match(app, /const up = `<svg[\s\S]*const down = `<svg/);
  assert.match(app, /function renderBeatGuide\(\)[\s\S]*beat-guide-layer/);
  assert.match(app, /beat-graph-node[\s\S]*beat-assignment[\s\S]*data-beat-jump/);
  assert.match(app, /data-beat-jump title="Open \$\{escapeHtml\(assignment\)\} in Preview"/);
  assert.match(app, /event\.target\.closest\("\[data-beat-jump\]"\)[\s\S]*setPreviewMode\("live"\)[\s\S]*jumpToBeatArea\(beat\)/);
  assert.match(app, /\? `Lines \$\{beat\.range\.startLine \+ 1\}–\$\{beat\.range\.endLine \+ 1\}`[\s\S]*: "Unassigned"/);
  assert.doesNotMatch(app, /Scene \$\{scene\.number\} · \$\{scene\.heading\}/);
  assert.match(app, /beat-unassign[\s\S]*beatCard\(\{ \.\.\.beat, range: null \}\)[\s\S]*persistBeatSheet\(\)/);
  assert.match(app, /event\.key !== "Enter" \|\| !event\.target\.matches\("\.beat-text"\)[\s\S]*nextElementSibling[\s\S]*\.focus\(\)/);
  assert.match(app, /function persistBeatSheet\(\)[\s\S]*function scheduleBeatSheetSave\(\)/);
  assert.match(app, /beat-list"\)\.innerHTML = sheet\.beats\.map\(beatCard\)\.join\(""\)/);
  assert.doesNotMatch(app, /if \(!\$\("\.beat-card"[\s\S]*insertAdjacentHTML\("beforeend", beatCard\(\)\)/);
  assert.match(css, /#beat-sheet-panel\s*\{[\s\S]*\.beat-card\s*\{[\s\S]*\.beat-flow-editor[\s\S]*\.beat-graph-node[\s\S]*\.beat-guide-layer\s*\{[\s\S]*\.script-line\.beat-area/);
  assert.match(app, /beat-list"\)\.addEventListener\("pointerdown"[\s\S]*event\.pointerType === "mouse" && event\.button !== 0[\s\S]*setPointerCapture[\s\S]*addEventListener\("pointermove"[\s\S]*finishPointerBeatDrag/);
  assert.match(app, /\["ArrowUp", "ArrowDown", "Home", "End"\][\s\S]*prepend\(card\)[\s\S]*append\(card\)[\s\S]*handle\.focus\(\)/);
  assert.match(app, /function renderBeatProgressGraph\(beats = currentBeatCards\(\)\)[\s\S]*beforeValue[\s\S]*afterValue[\s\S]*beat-plot-point/);
  assert.match(app, /function saveBeatProgressPng\(\)[\s\S]*XMLSerializer[\s\S]*canvas\.toBlob[\s\S]*beat-pacing\.png/);
  assert.match(runtimeSource, /def _fp_compile_beat_sheet\(title, premise, beats, page_size="letter"\):[\s\S]*SimpleDocTemplate[\s\S]*Paragraph\("PREMISE"[\s\S]*Paragraph\("STORY BEATS"[\s\S]*document\.build/);
  assert.match(app, /async function exportBeatSheetPdf\(\)[\s\S]*currentBeatCards\(\)[\s\S]*compileBeatSheetPdf[\s\S]*Beat Sheet\.pdf/);
  assert.match(css, /\.beat-progress-line\s*\{[^}]*stroke:/s);
  assert.match(css, /\.beat-graph-node > \.beat-number\s*\{[^}]*cursor:\s*grab;[^}]*touch-action:\s*none;[^}]*user-select:\s*none;/s);
  assert.match(app, /beat-number[\s\S]*beat-node-box[\s\S]*beat-card-fields[\s\S]*beat-assignment-wrap[\s\S]*beat-unassign[\s\S]*beat-remove/);
  assert.match(css, /\.beat-list\s*\{[^}]*--beat-node-size:\s*27px;/s);
  assert.match(css, /\.beat-flow-editor::before\s*\{[^}]*left:\s*calc\(var\(--beat-arrow-lane\) \+ var\(--beat-node-size\) \/ 2\)/s);
  assert.match(css, /\.beat-graph-node\s*\{[^}]*grid-template-columns:\s*var\(--beat-node-size\) minmax\(0, 1fr\);[^}]*margin:\s*0;/s);
  assert.match(css, /\.beat-graph-node \+ \.beat-graph-node\s*\{\s*margin-top:\s*0;/);
  assert.match(css, /:root\[data-effective-theme="dark"\] \.beat-graph-node > \.beat-number\s*\{[^}]*background:\s*color-mix/);
  assert.match(css, /\.beat-shift\s*\{[^}]*left:\s*calc\(-1 \* var\(--beat-arrow-lane\)\);[^}]*grid-template-rows:\s*1fr 1fr;[^}]*opacity:\s*0;/s);
  assert.match(css, /\.beat-graph-node:has\(> \.beat-number:hover\) > \.beat-shift,[^}]*opacity:\s*1;[^}]*pointer-events:\s*auto;/s);
  assert.match(css, /\.beat-node-box\s*\{[^}]*min-height:\s*39px;[^}]*border-bottom:\s*1px solid var\(--border\);/s);
  assert.match(css, /\.beat-assignment-wrap\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) 22px 22px;/s);
  assert.match(css, /\.beat-remove\s*\{[^}]*border:\s*1px solid transparent;[^}]*background:\s*transparent;/s);
  assert.match(css, /\.beat-remove:is\(:hover, :focus-visible, :active\)\s*\{[^}]*border-color:\s*color-mix\(in srgb, var\(--danger\) 65%, var\(--border\)\);[^}]*background:\s*color-mix\(in srgb, var\(--danger\) 17%, var\(--surface\)\);/s);
  assert.match(css, /\.beat-assignment-wrap\s*\{[^}]*grid-column:\s*2;[^}]*justify-self:\s*end;/s);
  assert.match(css, /\.beat-sheet-workspace\s*\{[^}]*width:\s*816px;/s);
  assert.match(css, /#source-panel \.editor-shell, #source-panel \.editor-footer, \.beat-sheet-workspace, \.beat-sheet-actions\s*\{\s*zoom:\s*var\(--workspace-zoom, 1\);/s);
  assert.match(css, /\.beat-sheet-actions\s*\{[^}]*width:\s*816px;/s);
  assert.match(css, /#beat-sheet-panel\s*\{[^}]*container-type:\s*inline-size;/s);
  assert.match(css, /@media\s*\(max-width:\s*820px\)[\s\S]*\.beat-sheet-workspace\s*\{[^}]*--beat-compact-control:\s*clamp\(20px, calc\(17px \+ \.85cqi\), 24px\);[^}]*align-self:\s*stretch;[^}]*width:\s*100%;[^}]*min-width:\s*100%;[^}]*max-width:\s*none;[\s\S]*\.beat-sheet-empty-state, \.premise-field, \.beat-sheet-title, \.beat-list\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*none;[\s\S]*\.beat-list\s*\{[^}]*--beat-row-size:\s*clamp\(39px, calc\(34\.5px \+ 1\.4cqi\), 46px\);[\s\S]*\.beat-assignment-wrap\s*\{[^}]*max-width:\s*clamp\(96px, 20cqi, 160px\);/s);
  assert.match(css, /@media\s*\(max-width:\s*820px\)[\s\S]*\.beat-sheet-title h3\s*\{\s*display:\s*none;[\s\S]*\.beat-sheet-title > div:last-child\s*\{[^}]*flex-wrap:\s*nowrap;/s);
  assert.match(css, /#source-panel \.panel-title\s*\{[^}]*justify-content:\s*flex-start;[^}]*gap:\s*16px;[^}]*background:\s*var\(--panel\);/s);
});

test("the Preview beat guide alone uses a subtle frosted surface", async () => {
  const [app, css] = await Promise.all([readFile(appPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.match(css, /\.beat-guide-layer\s*\{[^}]*background:\s*color-mix\(in srgb, var\(--panel\) 66%, transparent\);[^}]*-webkit-backdrop-filter:\s*blur\(14px\) saturate\(125%\);[^}]*backdrop-filter:\s*blur\(14px\) saturate\(125%\);/s);
  assert.match(css, /\.preview-panel\.beat-runner-on \.preview-scroll\s*\{\s*padding-top:\s*0;/);
  assert.match(app, /function scrollPreviewTarget[\s\S]*coveredTop = scrollRect\.top \+ \(beatGuide\.hidden \? 0 : beatGuide\.getBoundingClientRect\(\)\.height\)[\s\S]*targetRect\.top < coveredTop/);
  assert.doesNotMatch(css, /\.beat-sheet-(?:panel|header|workspace)[^{]*\{[^}]*backdrop-filter:/s);
});

test("mobile preview clipboard actions preserve selections and avoid covering them", async () => {
  const app = await readFile(appPath, "utf8");
  assert.match(app, /previewContextEdit:\s*null/);
  assert.match(app, /previewContextText:\s*""/);
  assert.match(app, /runPreviewClipboardAction\(action,\s*previewContextLine,\s*\{\s*edit,\s*text\s*\}\)/);
  assert.match(app, /await navigator\.clipboard\.writeText\(text\);\s*if \(!canEditDocument\(\) \|\| !isCurrentEditTarget\(target, state, source\.value\)\)[^\n]+\s*replacePreviewSelection\(edit,\s*""\)/);
  assert.match(app, /isMobilePreview\(\) && state\.previewContextText[\s\S]*selectionRect\.bottom \+ 12[\s\S]*selectionRect\.top - height - 12/);
});

test("insight colors coordinate with the source palette", async () => {
  const css = await readFile(cssPath, "utf8");
  assert.match(css, /\.balance > div\s*\{[^}]*background:\s*var\(--syntax-scene\);/s);
  assert.match(css, /\.balance > div span\s*\{[^}]*background:\s*var\(--syntax-character\);/s);
  assert.match(css, /\.metric-grid div:nth-child\(1\)\s*\{\s*color:\s*var\(--metric-pages-ink\);\s*\}/s);
  assert.match(css, /\.metric-grid div:nth-child\(2\)\s*\{\s*color:\s*var\(--metric-scenes-ink\);\s*\}/s);
  assert.match(css, /\.metric-grid div:nth-child\(3\)\s*\{\s*color:\s*var\(--metric-words-ink\);\s*\}/s);
  assert.doesNotMatch(css, /\.metric-grid div:nth-child\([123]\)[^}]*background:/s);
  assert.match(css, /@media\s*\(max-width:\s*820px\)[\s\S]*\.metric-grid\s*\{\s*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/s);
});

test("source backgrounds are neutral and character analytics canvas hugs its table", async () => {
  const [app, css] = await Promise.all([readFile(appPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.match(css, /--source-bg:\s*#f6f6f5;[\s\S]*--source-gutter-bg:\s*#ececeb;/);
  assert.match(css, /--source-bg:\s*#111315;[\s\S]*--source-gutter-bg:\s*#181a1c;/);
  assert.match(app, /const width = scenes\.length \? labelWidth \+ scenes\.length \* sceneWidth : 480;/);
  assert.match(app, /const height = actHeight \+ sceneHeight \+ Math\.max\(characters\.length, 1\) \* rowHeight;/);
  assert.doesNotMatch(app, /scenes\.length \* sceneWidth \+ 18|rowHeight \+ 18/);
});

test("source word wrap defaults on and preserves logical line numbers", async () => {
  const [html, app, css] = await Promise.all([readFile(htmlPath, "utf8"), readFile(appPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.match(html, /id="word-wrap"[^>]*checked/);
  assert.match(app, /source\.setAttribute\("wrap", enabled \? "soft" : "off"\)/);
  assert.match(app, /class="line-number" style="top:/);
  assert.match(app, /function renderLineNumbers\(\)[\s\S]*sourceLine\?\.offsetTop \|\| 0/);
  assert.doesNotMatch(app, /function renderLineNumbers\(\)[\s\S]*?getBoundingClientRect\(\)[\s\S]*?function fountainSyntaxHtml/);
  assert.match(app, /function scrollSourceTarget[\s\S]*const top = target\.offsetTop;/);
  assert.match(app, /sourceLine\.offsetTop - source\.scrollTop - parseFloat\(computed\.paddingTop\)/);
  assert.match(app, /new ResizeObserver\(\(\) => scheduleSourceGeometry\(\{ resize: true \}\)\)[\s\S]*observe\(source\)/);
  assert.match(app, /document\.fonts\?\.ready\.then\(\(\) => renderEditorChrome\(\)\)/);
  assert.match(app, /gutter\.scrollTop = source\.scrollTop/);
  assert.match(app, /lines\.map\(\(line\) => \{[\s\S]*<span data-source-line="\$\{line\.index\}"[\s\S]*>\$\{value\}<\/span>`;\s*\}\)\.join\(""\)/);
  assert.match(css, /body\.source-wrap #source/);
  assert.match(css, /\.source-highlight > \[data-source-line\]\s*\{[^}]*display:\s*block;[^}]*min-height:\s*1\.55em;/);
  assert.match(css, /\.line-number\s*\{[^}]*position:\s*absolute;[^}]*right:\s*9px;/s);
  assert.match(css, /\.line-number-spacer\s*\{[^}]*visibility:\s*hidden;/s);
  assert.doesNotMatch(app, /function sourceVisualRows|function sourceWrapColumns/);
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

test("desktop Vim mode is persistent and shared by Source and Preview", async () => {
  const [html, app, css] = await Promise.all([readFile(htmlPath, "utf8"), readFile(appPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.match(html, /class="setting-row desktop-setting"[^>]*>[\s\S]*Vim mode[\s\S]*id="vim-mode"/);
  assert.match(html, /id="vim-source-status"[^>]*hidden>NORMAL/);
  assert.match(html, /id="vim-preview-status"[^>]*hidden>NORMAL/);
  assert.match(html, /id="source-panel"[\s\S]*class="preview-actions workspace-zoom-actions"><b id="vim-source-status" class="vim-status" hidden>NORMAL<\/b><button data-zoom-out/);
  assert.doesNotMatch(html, /class="editor-mode"><b id="vim-source-status"/);
  assert.match(html, /<h4>Vim mode<\/h4>[\s\S]*Visual mode[\s\S]*<kbd>dd<\/kbd>[\s\S]*<kbd>yy<\/kbd>/);
  assert.match(app, /vimEnabled:\s*localStorage\.getItem\("fountain-publisher\.vim-mode"\) === "true"/);
  assert.match(app, /function handleVimKey\(event, surface\)/);
  assert.match(app, /handleVimKey\(event, "source"\)/);
  assert.match(app, /handleVimKey\(event, "preview"\)/);
  assert.match(app, /\["h", "j", "k", "l", "0", "\^", "\$", "w", "b", "e", "G"\]/);
  assert.match(app, /function vimWordRange\(offset, around = false, big = false\)/);
  assert.match(app, /\["w", "W"\]\.includes\(key\) && \["i", "a"\]\.includes\(state\.vimPending\)/);
  assert.match(app, /vimWordRange\(state\.vimVisualFocus, state\.vimPending === "a", key === "W"\)/);
  assert.match(app, /function applyVimTextObject\(operator, inner, big, offset, previewFocus\)/);
  assert.match(app, /function applyVimOperatorMotion\(operator, motion, offset, previewFocus\)/);
  assert.match(app, /\["i", "a"\]\.includes\(key\) && \["d", "c", "y"\]\.includes\(state\.vimPending\)/);
  assert.match(app, /\["w", "W"\]\.includes\(key\) && \["di", "da", "ci", "ca", "yi", "ya"\]\.includes\(state\.vimPending\)/);
  assert.match(app, /\["w", "W", "e", "b"\]\.includes\(key\) && \["d", "c", "y"\]\.includes\(state\.vimPending\)/);
  assert.match(app, /applyVimTextObject\(operator, inner, key === "W", source\.selectionStart, previewFocus\)/);
  assert.match(app, /applyVimOperatorMotion\(operator, key, source\.selectionStart, previewFocus\)/);
  assert.match(app, /state\.vimYank = source\.value\.slice\(range\.start, range\.end\)/);
  assert.match(app, /wordChar = big \? \/\\S\/ : \/\\w\//);
  assert.match(app, /vimVisualLine:\s*false/);
  assert.match(app, /state\.vimVisualLine = key === "V"/);
  assert.match(app, /state\.vimYank = `\$\{position\.lines\[position\.line\]\}\\n`/);
  assert.match(app, /localStorage\.setItem\("fountain-publisher\.vim-mode", String\(state\.vimEnabled\)\)/);
  assert.match(app, /function vimPreviewTargetLine\(currentLine, command\)[\s\S]*\.script-line\[data-line\][\s\S]*!line\.classList\.contains\("empty"\)[\s\S]*line > currentLine[\s\S]*line < currentLine/);
  assert.match(app, /moveVimCursor\(key, previewFocus\)/);
  assert.match(app, /state\.vimMode === "visual"[\s\S]*focusVimSelection\(previewFocus[\s\S]*\["y", "d", "x"\]/);
  assert.match(app, /state\.vimMode === "insert"[\s\S]*\["\[", "c"\]\.includes\(event\.key\.toLowerCase\(\)\)/);
  assert.match(app, /state\.vimMode === "visual" && event\.ctrlKey && event\.key\.toLowerCase\(\) === "c"/);
  assert.match(app, /function renderedTextOffsetRect\(element, offset\)[\s\S]*getClientRects/);
  assert.match(app, /function moveVimDisplayLine\(command, previewFocus, visual = false\)[\s\S]*previewWrappedRowOffset[\s\S]*sourceWrappedRowOffset/);
  assert.match(app, /function previewNativeDisplayRowOffset\(command, startOffset\)[\s\S]*selection\.modify\("move"[\s\S]*"line"/);
  assert.match(app, /state\.vimPending === "g"[\s\S]*moveVimDisplayLine\(`g\$\{key\}`/);
  assert.match(app, /function moveVimHalfPage\(command, previewFocus, visual = false\)[\s\S]*viewportHeight \/ lineHeight \/ 2[\s\S]*previewWrappedRowOffset[\s\S]*sourceWrappedRowOffset/);
  assert.match(app, /event\.ctrlKey && \["d", "u"\]\.includes\(event\.key\.toLowerCase\(\)\)[\s\S]*moveVimHalfPage/);
  assert.match(css, /\.vim-status\[data-mode="normal"\][^}]*var\(--metric-pages-ink\)[\s\S]*\.vim-status\[data-mode="insert"\][^}]*var\(--metric-words-ink\)[\s\S]*\.vim-status\[data-mode="visual"\][^}]*var\(--metric-scenes-ink\)/);
  assert.match(css, /@media\s*\(max-width:\s*820px\)[\s\S]*\.desktop-setting, \.vim-status\s*\{\s*display:\s*none !important;/s);
  assert.match(html, /<kbd>diw<\/kbd>\/<kbd>daw<\/kbd>\/<kbd>diW<\/kbd>\/<kbd>daW<\/kbd>/);
  assert.match(html, /<kbd>ciw<\/kbd>\/<kbd>caw<\/kbd>\/<kbd>ciW<\/kbd>\/<kbd>caW<\/kbd>/);
  assert.match(html, /<kbd>iw<\/kbd>\/<kbd>aw<\/kbd>\/<kbd>iW<\/kbd>\/<kbd>aW<\/kbd>/);
});

test("Vim word text objects and operator motions edit and yank correctly", async () => {
  const app = await readFile(appPath, "utf8");
  const helpers = app.slice(app.indexOf("function vimWordRange"), app.indexOf("function handleVimKey"));
  const makeContext = (value) => {
    const state = { vimYank: "", vimYankLine: false, vimMode: "normal", vimVisualLine: false, vimVisualAnchor: 0, vimVisualFocus: 0 };
    const source = { value, selectionStart: 0, selectionEnd: 0 };
    const calls = { changes: [], modes: [], cursors: [] };
    const sandbox = {
      state,
      source,
      sourceLines: () => source.value.split("\n"),
      sourceOffsetForLine: (lines, line, column) => lines.slice(0, line).reduce((sum, text) => sum + text.length + 1, 0) + column,
      vimLinePosition: (offset = 0) => {
        const before = source.value.slice(0, offset);
        const line = before.split("\n").length - 1;
        const start = before.lastIndexOf("\n") + 1;
        const lines = source.value.split("\n");
        return { lines, line, start, column: offset - start, end: start + (lines[line]?.length || 0) };
      },
      moveVimCursor: (command, _previewFocus, startOffset = source.selectionStart) => {
        let offset = startOffset;
        if (command === "b") {
          const rest = source.value.slice(0, Math.max(0, offset)).replace(/\W+$/, "");
          const match = [...rest.matchAll(/\b\w/g)].at(-1);
          offset = match?.index ?? 0;
        } else if (command === "e") {
          const match = source.value.slice(offset + 1).match(/\w\b/);
          offset = match ? offset + 1 + match.index : Math.max(0, source.value.length - 1);
        }
        return offset;
      },
      focusVimCursor: (_previewFocus, offset) => { calls.cursors.push(offset); },
      changeVimSource: (next, offset) => { source.value = next; calls.changes.push([next, offset]); },
      setVimMode: (mode) => { state.vimMode = mode; calls.modes.push(mode); },
    };
    runInNewContext(`${helpers}
this.run = {
  wordRange: (offset, around, big) => { const { start, end } = vimWordRange(offset, around, big); return start + ":" + end; },
  textObject: (op, inner, big, offset) => applyVimTextObject(op, inner, big, offset, false),
  motion: (op, motion, offset) => applyVimOperatorMotion(op, motion, offset, false),
};`, sandbox);
    return { ...sandbox.run, state, source, calls };
  };

  // word vs WORD ranges
  let ctx = makeContext("foo.bar baz");
  assert.equal(ctx.wordRange(1, false, false), "0:3", "iw stops at punctuation");
  assert.equal(ctx.wordRange(1, false, true), "0:7", "iW spans punctuation");
  assert.equal(ctx.wordRange(1, true, true), "0:8", "aW adds trailing space");

  // diw / daw / ciw / caw
  ctx = makeContext("alpha beta gamma");
  assert.equal(ctx.textObject("d", true, false, 8), true);
  assert.equal(ctx.source.value, "alpha  gamma", "diw removes the word");
  assert.equal(ctx.state.vimYank, "beta");
  assert.equal(ctx.state.vimMode, "normal");

  ctx = makeContext("alpha beta gamma");
  ctx.textObject("d", false, false, 8);
  assert.equal(ctx.source.value, "alpha gamma", "daw removes word + trailing space");
  assert.equal(ctx.state.vimYank, "beta ");

  ctx = makeContext("alpha beta gamma");
  ctx.textObject("c", true, false, 8);
  assert.equal(ctx.source.value, "alpha  gamma", "ciw removes the word");
  assert.deepEqual([...ctx.calls.modes], ["insert"], "ciw enters insert");

  ctx = makeContext("alpha be-ta gamma");
  ctx.textObject("c", false, true, 8);
  assert.equal(ctx.source.value, "alpha gamma", "caW removes WORD + trailing space");
  assert.equal(ctx.state.vimYank, "be-ta ");
  assert.deepEqual([...ctx.calls.modes], ["insert"], "caW enters insert");

  ctx = makeContext("alpha be-ta gamma");
  ctx.textObject("d", true, true, 8);
  assert.equal(ctx.source.value, "alpha  gamma", "diW removes the WORD");
  assert.equal(ctx.state.vimYank, "be-ta");

  ctx = makeContext("alpha beta gamma");
  ctx.textObject("y", true, false, 8);
  assert.equal(ctx.source.value, "alpha beta gamma", "yiw does not modify text");
  assert.equal(ctx.state.vimYank, "beta");
  assert.deepEqual([...ctx.calls.cursors], [6], "yiw moves cursor to word start");

  // operator motions
  ctx = makeContext("foo, bar");
  ctx.motion("d", "w", 0);
  assert.equal(ctx.source.value, ", bar", "dw stops at punctuation");
  assert.equal(ctx.state.vimYank, "foo");

  ctx = makeContext("foo, bar");
  ctx.motion("d", "W", 0);
  assert.equal(ctx.source.value, "bar", "dW consumes trailing whitespace");
  assert.equal(ctx.state.vimYank, "foo, ");

  ctx = makeContext("foo bar");
  ctx.motion("c", "w", 0);
  assert.equal(ctx.source.value, " bar", "cw behaves like ce");
  assert.equal(ctx.state.vimYank, "foo");
  assert.deepEqual([...ctx.calls.modes], ["insert"], "cw enters insert");

  ctx = makeContext("foo, bar");
  ctx.motion("c", "W", 0);
  assert.equal(ctx.source.value, " bar", "cW excludes trailing whitespace");
  assert.equal(ctx.state.vimYank, "foo,");

  ctx = makeContext("foo bar");
  ctx.motion("d", "e", 0);
  assert.equal(ctx.source.value, " bar", "de deletes through end of word");
  assert.equal(ctx.state.vimYank, "foo");

  ctx = makeContext("foo bar baz");
  ctx.motion("d", "b", 5);
  assert.equal(ctx.source.value, "foo ar baz", "db deletes back to word start");
  assert.equal(ctx.state.vimYank, "b");

  ctx = makeContext("foo bar");
  ctx.motion("y", "w", 0);
  assert.equal(ctx.source.value, "foo bar", "yw does not modify text");
  assert.equal(ctx.state.vimYank, "foo ", "yw includes whitespace up to the next word");
  assert.deepEqual([...ctx.calls.cursors], [0], "yw moves cursor to range start");
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

test("every host runs Screenplain in the tab's bundled Pyodide runtime", async () => {
  const app = await readFile(appPath, "utf8");
  assert.match(runtimeSource, /function loadCompilerRuntime\(/);
  assert.match(runtimeSource, /screenplain-0\.12\.0-py3-none-any\.whl/);
  assert.match(runtimeSource, /CourierPrime-Regular\.ttf/);
  assert.match(runtimeSource, /\/fonts\/CourierPrime-Regular\.ttf/);
  assert.match(runtimeSource, /pdf\.to_pdf\(screenplay, output, template_constructor=NumberedDocTemplate, settings=settings\)/);
  assert.match(app, /setTimeout\(\(\) => compilePageCount\(revision\)/);
  assert.match(app, /const compilerClient = createCompilerWorkerClient\(\)/);
  assert.match(app, /const compileLocally = compilerClient\.compile/);
  assert.doesNotMatch(app, /runPython|loadPyodide|getBrowserScreenplain/);
});

test("compilation and export have no server path or server fallback", async () => {
  const app = await readFile(appPath, "utf8");
  const compiler = await readFile(new URL("../../src/fountain_publisher/web/local-compiler.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(app, /\/api\/(?:compile|render\/pdf|export\/fdx)|shouldUseBrowserCompiler|requestBinary/);
  assert.doesNotMatch(compiler, /fetch\(|WebSocket|localStorage|BroadcastChannel|collaboration/);
  assert.match(app, /await compileLocally\(format, request\)/);
});

test("compiler and background modules ship in production and refreshed offline shells", async () => {
  const [build, shell, html] = await Promise.all([
    readFile(new URL("../../scripts/build-web.mjs", import.meta.url), "utf8"),
    readFile(workerPath, "utf8"), readFile(htmlPath, "utf8"),
  ]);
  for (const name of ["compiler-client.mjs", "compiler-worker.mjs", "compiler-runtime.mjs", "local-compiler.mjs", "background-performance.mjs"]) {
    assert.ok(build.includes(`web/${name}`), `${name} must be copied into the production assets`);
    assert.ok(shell.includes(`"./${name}"`), `${name} must be available offline`);
    assert.ok(shell.includes(`"${name}"`), `${name} must use network-first updates`);
    assert.ok((await readFile(new URL(`../../src/fountain_publisher/web/${name}`, import.meta.url), "utf8")).length);
  }
  assert.match(html, /worker-src 'self'/);
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

test("mobile shows one panel at a time through the View menu", async () => {
  const [html, app, css] = await Promise.all([readFile(htmlPath, "utf8"), readFile(appPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.doesNotMatch(html, /class="mobile-panel-tabs"/);
  assert.match(html, /class="toolbar-menu view-menu"/);
  assert.match(html, /id="menu-toggle-source-tab"/);
  assert.match(html, /id="menu-toggle-stats"/);
  // Mobile view state hides non-active panels without consuming a tab row.
  assert.match(css, /\.mobile-panel-tabs\s*\{\s*display:\s*none;/);
  assert.match(css, /--mobile-tabs-h:\s*0px;/);
  assert.match(css, /max-width:\s*820px/);
  assert.match(css, /body\[data-mobile-tab="source"\] #source-panel\s*\{\s*display:\s*flex;/);
  assert.match(css, /body\[data-mobile-tab="preview"\] \.preview-panel\s*\{\s*display:\s*flex;/);
  assert.match(css, /body\[data-mobile-tab="beats"\] #beat-sheet-panel\s*\{\s*display:\s*flex;/);
  assert.match(css, /body\[data-mobile-tab="stats"\] #stats-panel\s*\{\s*display:\s*flex/);
  assert.match(css, /#preview-scroll, #source-panel, #beat-sheet-panel\s*\{\s*background-image:\s*none !important;/);
  // View-menu routing persists the selected mobile workspace.
  assert.match(app, /function setMobileTab\(/);
  assert.match(app, /localStorage\.setItem\("fountain-publisher\.mobile-tab"/);
  assert.match(app, /state\.previewMode = mode[\s\S]*document\.body\.dataset\.mobileTab = mobilePanel/);
  assert.match(app, /dataset\.mobileTab = panel/);
  assert.match(app, /isMobilePreview\(\)[\s\S]*const opening = state\.previewMode !== "source";[\s\S]*setMobileTab\(opening \? "source" : "preview"\)/);
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

test("mobile preview excludes PDF, supports Beat Sheet, and reflows horizontally", async () => {
  const [html, app, css] = await Promise.all([readFile(htmlPath, "utf8"), readFile(appPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.match(css, /@media\s*\(max-width:\s*820px\)[\s\S]*\.view-switcher\s*\{\s*display:\s*none;/);
  assert.match(css, /\.preview-scroll\s*\{[^}]*overflow-x:\s*hidden;/s);
  assert.match(css, /\.screenplay-page\s*\{[^}]*width:\s*100%;[^}]*font-size:\s*calc\(16px \* var\(--mobile-preview-zoom,\s*1\)\);/s);
  assert.match(css, /body\.scene-nums-margin \.screenplay-page\s*\{[^}]*padding-left:\s*calc\(54px \* var\(--mobile-preview-zoom,\s*1\)\);/s);
  assert.match(app, /isMobilePreview\(\) && mode === "pdf"/);
  assert.match(app, /panel === "beats"[\s\S]*setPreviewMode\("beats"\)/);
  assert.match(app, /empty-beat-sheet-button[\s\S]*data-open-beat-sheet>Open Beat Sheet/);
  assert.match(css, /\.beat-guide-layer\.empty \.beat-runner-actions \.empty-beat-sheet-button\s*\{[^}]*display:\s*block;/s);
  assert.match(html, /class="view-switcher"[\s\S]*data-preview-mode="live"[\s\S]*data-preview-mode="pdf"/);
  assert.match(html, /class="preview-actions workspace-zoom-actions"[\s\S]*id="zoom-out"[\s\S]*id="zoom"[\s\S]*id="zoom-in"[\s\S]*id="zoom-fit"/);
});

test("preview zoom clamps scaled bounds and reports the calculated fit percentage", async () => {
  const [html, app, css] = await Promise.all([readFile(htmlPath, "utf8"), readFile(appPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.match(html, /id="zoom-fit-value" value="fit" hidden/);
  assert.match(html, /<option value="200">200%<\/option>/);
  assert.equal((html.match(/data-workspace-zoom/g) || []).length, 3);
  assert.match(app, /\$\$\('\[data-workspace-zoom\]'\)[\s\S]*--workspace-zoom/);
  assert.match(css, /#source-panel \.editor-shell, #source-panel \.editor-footer, \.beat-sheet-workspace, \.beat-sheet-actions\s*\{\s*zoom:\s*var\(--workspace-zoom, 1\);/);
  assert.match(html, /id="zoom-in"[\s\S]*id="zoom-fit"[^>]*>Fit<\/button>/);
  assert.match(css, /\.preview-actions \.zoom-fit\[aria-pressed="true"\]\s*\{[^}]*border-color:\s*var\(--border\);[^}]*color:\s*var\(--ink\);[^}]*background:\s*var\(--surface-2\);/s);
  assert.match(app, /scale = Math\.max\(\.25,\s*Math\.min\(2,\s*availableWidth \/ 816\)\)/);
  assert.match(app, /preview\.scrollLeft = Math\.max\(0,\s*\(preview\.scrollWidth - preview\.clientWidth\) \/ 2\)/);
  assert.match(app, /function clampPreviewScroll\(preview = \$\("#preview-scroll"\)\)/);
  assert.match(app, /const maxTop = Math\.max\(0, preview\.scrollHeight - preview\.clientHeight\)/);
  assert.match(app, /preview\.scrollTop = Math\.max\(0, Math\.min\(preview\.scrollTop, maxTop\)\)/);
  assert.match(app, /Math\.max\(1056, page\.scrollHeight\) \* scale/);
  assert.match(app, /fitOption\.textContent = `\$\{Math\.round\(scale \* 100\)\}%`/);
  assert.match(app, /zoomControl\.value = "fit"/);
  assert.match(app, /"150",\s*"175",\s*"200"/);
  assert.match(app, /const fitPercent = Number\.parseInt\(\$\("#zoom-fit-value"\)\.textContent, 10\) \|\| 100/);
  assert.match(app, /value > fitPercent/);
  assert.match(app, /value < fitPercent/);
  assert.match(css, /\.preview-page-stage\s*\{[^}]*position:\s*relative;/s);
  assert.match(css, /\.screenplay-page\s*\{[^}]*position:\s*absolute;/s);
  assert.match(app, /if \(state\.previewZoom === "fit"\) requestAnimationFrame\(applyZoom\);/);
  assert.doesNotMatch(app, /if \(state\.previewZoom === "fit"\)\s*\{\s*zoom\.value = "100";/);
  assert.match(app, /\["fit",\s*"70",\s*"85",\s*"100",\s*"115",\s*"130",\s*"150",\s*"175",\s*"200"\]/);
  assert.match(css, /\.preview-page-stage\s*\{[^}]*margin:\s*0 auto;/s);
});

test("preview background popup supports themed, directional dot motion", async () => {
  const [html, app, css] = await Promise.all([readFile(htmlPath, "utf8"), readFile(appPath, "utf8"), readFile(cssPath, "utf8")]);
  const settingsMenu = html.match(/<details class="toolbar-menu settings-menu">([\s\S]*?)<\/details>/)?.[1] || "";
  assert.match(settingsMenu, /id="open-background-dialog"[^>]*>Background…<\/button>/);
  assert.match(html, /<dialog id="background-dialog"/);
  assert.match(html, /id="preview-background"[\s\S]*value="blank">Blank[\s\S]*value="dots" selected>Dots[\s\S]*value="hyperspace">Hyperspace[\s\S]*value="geometric">Geometric drift[\s\S]*value="constellation">Constellation[\s\S]*value="topographic">Topographic[\s\S]*value="tiles">Tiles/);
  assert.doesNotMatch(html, /Isometric cubes|Aurora polygons|>Orbit</);
  assert.doesNotMatch(html, /value="rain"|Raindrops|preview-rain-speed/);
  assert.doesNotMatch(html, /Damascus|value="damascus"/);
  assert.match(html, /id="preview-dot-radius" type="range" min="0\.6" max="1\.8" step="0\.1" value="1"/);
  assert.match(html, /id="background-pattern-preview"[^>]*data-background="dots"/);
  assert.match(html, /id="preview-dot-direction"[\s\S]*value="up"[\s\S]*value="down"[\s\S]*value="left"[\s\S]*value="right"[\s\S]*value="up-left"[\s\S]*value="up-right"[\s\S]*value="down-left"[\s\S]*value="down-right"[\s\S]*value="random"/);
  assert.match(html, /id="preview-dot-speed" type="range" min="0" max="100" step="1" value="20"/);
  assert.match(html, /id="preview-star-density" type="range" min="30" max="240" step="5" value="100"/);
  assert.match(html, /id="preview-star-colors-row"[^>]*hidden[\s\S]*id="preview-star-colors" type="checkbox" role="switch"/);
  assert.match(css, /\.background-dots-layer\s*\{[^}]*radial-gradient[^}]*background-size:\s*16px 16px;/s);
  assert.match(css, /\.background-pattern-preview\s*\{[^}]*background-color:\s*var\(--bg\);/s);
  assert.match(app, /layer\.style\.transform = `translate3d/);
  assert.doesNotMatch(app + css, /--preview-dot-x|--preview-dot-y/);
  assert.doesNotMatch(css, /data-background="damascus"|repeating-radial-gradient/);
  assert.match(css, /#background-dialog\s*\{[^}]*width:\s*min\(380px,/s);
  assert.match(css, /#background-form > label\s*\{[^}]*flex-direction:\s*column;[^}]*gap:\s*5px;[^}]*margin:\s*13px 0;/s);
  assert.match(css, /#background-form \.range-setting\s*\{[^}]*width:\s*100%;/);
  assert.match(html, /id="background-form"[\s\S]*class="dialog-actions"><button class="primary" value="default">Done<\/button>/);
  assert.doesNotMatch(css, /\.preview-scroll\s*\{[^}]*background-color:/s);
  assert.match(app, /function applyPreviewBackground\(\)/);
  assert.match(app, /function drawHyperspace\(canvas, dt = 0\)[\s\S]*star\.x \/ star\.z[\s\S]*context\.lineTo\(x, y\)/);
  assert.match(app, /function refreshBackgroundRendering\(\)[\s\S]*backgroundLoop\.stop\(\)[\s\S]*document\.hidden/);
  assert.match(app, /animated = !backgroundMotionQuery\.matches && !isMobilePreview\(\)/);
  assert.match(app, /const AMBIENT_PATTERNS = \["geometric", "constellation", "topographic", "tiles"\]/);
  assert.match(app, /function drawAmbient\(canvas, time = 0\)[\s\S]*ambientPattern === "geometric"[\s\S]*ambientPattern === "constellation"[\s\S]*ambientPattern === "topographic"[\s\S]*ambientPattern === "tiles"/);
  assert.match(app, /function ambientTiles\(canvas, columns, rows, now\)[\s\S]*Math\.random\(\)[\s\S]*progress \* progress \* \(3 - 2 \* progress\)/);
  assert.match(app, /const speedRatio = ambientSpeed \/ 100;[\s\S]*speedRatio \* speedRatio \* 6[\s\S]*speedRatio \* speedRatio \* 4/);
  assert.match(app, /ambientPattern === "tiles"[\s\S]*backgroundTileGrid\(width, height, ambientDensity\)[\s\S]*ambientTiles\(canvas, columns, rows, time\)[\s\S]*const spread = total \/ count[\s\S]*for \(const walker of tileField\.walkers\)[\s\S]*context\.fillRect\(left, top, size, size\)/);
  assert.doesNotMatch(app, /tile\.rotation|tile\.x|tile\.y/);
  assert.match(app, /backgroundLoop\.start\([\s\S]*\(hyperspace \? hyperspaceSpeed : ambientSpeed\) > 0/);
  assert.match(app, /animated: animated && dotMotionSpeed > 0 && dotMotionDirection !== "still"/);
  assert.match(app, /storedSpeedValue !== null && storedSpeed >= 0/);
  assert.match(app, /star\.tint >= \.82[\s\S]*accentColors\[colorIndex\]/);
  assert.match(app, /preview-star-density[\s\S]*preview-star-density-value[\s\S]*const animated = pattern === "hyperspace" \|\| AMBIENT_PATTERNS\.includes\(pattern\)/);
  assert.match(app, /localStorage\.setItem\("fountain-publisher\.preview-star-density", event\.target\.value\)/);
  assert.match(app, /localStorage\.setItem\("fountain-publisher\.preview-star-colors", String\(event\.target\.checked\)\)/);
  assert.match(css, /\[data-background="hyperspace"\] > \.hyperspace-canvas[\s\S]*display:\s*block/);
  assert.match(css, /\.background-pattern-preview span\s*\{[^}]*position:\s*relative;[^}]*z-index:\s*1;/s);
  assert.match(css, /\.background-pattern-preview\s*\{[^}]*position:\s*relative;[^}]*isolation:\s*isolate;[^}]*contain:\s*paint;/s);
  assert.match(css, /\.background-pattern-preview \.hyperspace-canvas\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0;[^}]*width:\s*100%;[^}]*height:\s*100%;/s);
  assert.match(css, /@media\s*\(max-width:\s*820px\)[\s\S]*\.background-dots-layer\s*\{\s*display:\s*none !important/);
  assert.match(css, /\.beat-guide-layer\s*\{[^}]*position:\s*absolute;/s);
  assert.match(app, /localStorage\.setItem\("fountain-publisher\.preview-background", event\.target\.value\)/);
  assert.match(app, /localStorage\.setItem\("fountain-publisher\.preview-dot-radius", event\.target\.value\)/);
  assert.match(app, /localStorage\.setItem\("fountain-publisher\.preview-dot-direction", event\.target\.value\)/);
  assert.match(app, /localStorage\.setItem\("fountain-publisher\.preview-dot-speed", event\.target\.value\)/);
  assert.match(app, /time - dotRandomChangedAt >= 60000/);
  assert.match(app, /1 - Math\.exp\(-dt \/ 6\)/);
  assert.match(app, /hidden = pattern !== "dots"/);
  assert.match(app, /open-background-dialog[\s\S]*requestAnimationFrame\(\(\) => \{[\s\S]*setMobileMenu\(false\);[\s\S]*\$\("#background-dialog"\)\.showModal\(\)/);
  assert.match(app, /event\.target\.closest\("button, a"\)[\s\S]*requestAnimationFrame\(\(\) => \{[\s\S]*menu\.open = false;[\s\S]*setMobileMenu\(false\)/);
});

test("mobile PDF export path remains accessible via toolbar File menu", async () => {
  const html = await readFile(htmlPath, "utf8");
  // Export PDF button must exist in the toolbar (not inside .view-switcher)
  assert.match(html, /id="export-pdf"/);
  // The export dialog must include a PDF format option
  assert.match(html, /id="export-dialog"/);
  assert.match(html, /value="pdf"[^>]*>PDF screenplay/);
});

test("mobile Insights layout has responsive wrapping rules", async () => {
  const css = await readFile(cssPath, "utf8");
  // Inside the mobile media query: scene list buttons wrap text
  assert.match(css, /@media\s*\(max-width:\s*820px\)[^@]*\.scene-list button\s*\{[^}]*white-space:\s*normal;/s);
});

test("line numbers are correct before the source panel is interacted with", async () => {
  const app = await readFile(appPath, "utf8");
  // Numbers come from rendered line positions, so hidden panels cannot create
  // bogus character-count estimates before their real width is available.
  const lineNumbers = app.slice(app.indexOf("function renderLineNumbers("), app.indexOf("function fountainSyntaxHtml("));
  assert.match(lineNumbers, /sourceLine\?\.offsetTop/);
  assert.doesNotMatch(app, /sourceWrapColumns|fontSize \* 0\.61/);
  // setMobileTab must re-render editor chrome when switching to source tab
  assert.match(app, /function setMobileTab[\s\S]*?if \(panel === "source"\) \{ renderEditorChrome\(\); scrollSourceTarget\(currentPosition\(\)\.line, "center"\); \}/);
});

test("browser Screenplain compile handles missing style attributes defensively", async () => {
  // slug_style access must be guarded
  assert.match(runtimeSource, /hasattr\(settings,\s*"slug_style"\)/);
  // style loop uses getattr with None default
  assert.match(runtimeSource, /getattr\(settings,\s*style_name,\s*None\)/);
  // handle_pageBegin uses getattr for font_settings
  assert.match(runtimeSource, /getattr\(_font_settings,\s*"family_name",\s*"Courier"\)/);
});

test("mobile exports use the share sheet with download fallback", async () => {
  const app = await readFile(appPath, "utf8");
  assert.match(app, /async function download\(/);
  assert.match(app, /anchor\.download = filename/);
  assert.match(app, /navigator\.canShare\?\.\(shareData\)/);
  assert.match(app, /await navigator\.share\(shareData\)/);
  assert.match(app, /await shareOrDownload\(blob,/);
});

test("compiler failures stay local and expose actionable browser errors", async () => {
  const app = await readFile(appPath, "utf8");
  assert.match(app, /Browser PDF compiler failed:.*Reload the page/);
  assert.match(app, /Your document was not sent to a server for compilation/);
  assert.doesNotMatch(app, /Desktop compiler unavailable|browserLastPageEighths/);
});

test("mobile page count is preserved across source edits", async () => {
  const app = await readFile(appPath, "utf8");
  // analyzeLocally must carry the current pageCount from state so it survives re-renders
  assert.match(app, /const pageCount = state\.metadata\?\.pageCount \?\? null/);
});

test("mobile toolbar keeps View available and fixes popover visibility", async () => {
  const [html, app, css] = await Promise.all([readFile(htmlPath, "utf8"), readFile(appPath, "utf8"), readFile(cssPath, "utf8")]);
  // HTML: about-menu text wrapped in a class so it can be hidden on mobile
  assert.match(html, /class="about-label"/);
  // HTML: toolbar menus have individual classes
  assert.match(html, /class="toolbar-menu file-menu"/);
  assert.match(html, /class="toolbar-menu view-menu"/);
  assert.match(html, /class="toolbar-menu help-menu"/);
  assert.match(html, /id="mobile-menu-toggle"[^>]*aria-controls="global-actions"/);
  assert.match(html, /id="mobile-menu-backdrop"/);
  // CSS: View and Help remain available; PDF preview stays out of the compact mobile menu.
  assert.doesNotMatch(css, /@media\s*\(max-width:\s*820px\)[^@]*\.help-menu\s*\{\s*display:\s*none;/s);
  assert.match(css, /\.view-menu \[data-preview-mode="pdf"\]\s*\{\s*display:\s*none;/);
  // CSS: popovers use position:fixed on mobile so they are always in-viewport
  assert.match(css, /@media\s*\(max-width:\s*820px\)[^@]*\.toolbar-popover\s*\{[^}]*position:\s*fixed;/s);
  assert.match(css, /body\.mobile-menu-open \.global-actions\s*\{\s*transform:\s*translateX\(0\);/);
  assert.match(css, /\.app-toolbar\s*\{[^}]*z-index:\s*30;/s);
  assert.match(css, /\.mobile-menu-backdrop\s*\{[^}]*z-index:\s*29;/s);
  assert.match(css, /\.global-actions \.toolbar-menu > summary\s*\{[^}]*height:\s*44px;/s);
  assert.match(app, /function setMobileMenu\(open\)[\s\S]*mobile-menu-open[\s\S]*aria-expanded/);
  // CSS: about label is hidden on mobile
  assert.match(css, /@media\s*\(max-width:\s*820px\)[^@]*\.about-label\s*\{\s*display:\s*none;/s);
});

test("mobile top bars stay pinned during focus, zoom, and viewport scrolling", async () => {
  const [app, css] = await Promise.all([readFile(appPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.match(css, /@media\s*\(max-width:\s*820px\)[\s\S]*\.app-toolbar\s*\{[^}]*position:\s*fixed;[^}]*top:\s*var\(--visual-viewport-top\);/s);
  assert.match(css, /#workspace\s*\{[^}]*position:\s*fixed;[^}]*height:\s*calc\(var\(--visual-viewport-height\) - var\(--toolbar-h\) - var\(--mobile-tabs-h\)\);/s);
  assert.match(app, /function updateMobileViewport\(\)[\s\S]*visualViewport[\s\S]*--visual-viewport-top[\s\S]*--visual-viewport-height/);
  assert.match(app, /visualViewport\?\.addEventListener\("resize", scheduleMobileViewportUpdate\)/);
  assert.match(app, /visualViewport\?\.addEventListener\("scroll", scheduleMobileViewportUpdate\)/);
  assert.match(app, /document\.addEventListener\("focusin", scheduleMobileViewportUpdate\)/);
});

test("GitHub browser text fields accept iPad hardware-keyboard input", async () => {
  const [html, app] = await Promise.all([readFile(htmlPath, "utf8"), readFile(appPath, "utf8")]);
  assert.match(html, /id="github-repository"[^>]*autocapitalize="off"[^>]*inputmode="text"/);
  assert.match(html, /id="github-filename"[^>]*autocapitalize="off"[^>]*inputmode="text"/);
  assert.match(app, /function prepareGithubKeyboardInputs[\s\S]*navigator\.maxTouchPoints > 0[\s\S]*removeAttribute\("list"\)/);
  assert.match(app, /dialog\.addEventListener\("keydown", \(event\) => event\.stopPropagation\(\)\)/);
  assert.match(app, /dialog\.addEventListener\("beforeinput", \(event\) => event\.stopPropagation\(\)\)/);
  assert.match(app, /dialog\.addEventListener\("pointerup"[\s\S]*input\.focus\(\{ preventScroll: true \}\)/);
  assert.match(app, /openGithubBrowser[\s\S]*prepareGithubKeyboardInputs\(\)/);
});
