import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import test from "node:test";

const appPath = new URL("../../src/fountain_publisher/web/app.mjs", import.meta.url);
const htmlPath = new URL("../../src/fountain_publisher/web/index.html", import.meta.url);
const cssPath = new URL("../../src/fountain_publisher/web/styles.css", import.meta.url);
const workerPath = new URL("../../src/fountain_publisher/web/service-worker.js", import.meta.url);

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
  assert.equal(manifest.display, "standalone");
  assert.deepEqual(manifest.display_override, ["standalone"]);
  assert.match(html, /apple-mobile-web-app-capable" content="yes"/);
  assert.match(html, /rel="apple-touch-icon" href="icons\/apple-touch-icon\.png"/);
  assert.match(html, /rel="manifest" href="app\.webmanifest"/);
  assert.match(html, /id="install-app"/);
  assert.match(html, /id="toggle-fullscreen"/);
  assert.match(app, /beforeinstallprompt/);
  assert.match(app, /requestFullscreen/);
  assert.match(app, /navigator\.serviceWorker\.register\("\.\/service-worker\.js"\)/);
  assert.match(worker, /CACHE_NAME[\s\S]*request\.mode === "navigate"[\s\S]*caches\.match/);
  assert.match(build, /app\.webmanifest[\s\S]*service-worker\.js[\s\S]*icons/);
  assert.match(pyproject, /web\/icons\/\*/);
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

test("browser page-count compilation only updates metrics present in the document", async () => {
  const [html, app] = await Promise.all([readFile(htmlPath, "utf8"), readFile(appPath, "utf8")]);
  assert.doesNotMatch(html, /id="stat-runtime"/);
  assert.doesNotMatch(app, /\$\("#stat-runtime"\)\.textContent/);
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

test("Source, Preview, PDF, and Beat Sheet share the main workspace", async () => {
  const [html, app, css] = await Promise.all([readFile(htmlPath, "utf8"), readFile(appPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.match(html, /data-preview-mode="source"[\s\S]*data-preview-mode="live"[\s\S]*data-preview-mode="beats"[\s\S]*data-preview-mode="pdf"/);
  assert.match(css, /#source-panel, \.preview-panel, #beat-sheet-panel\s*\{\s*grid-column:\s*1;/);
  assert.match(css, /#stats-panel\s*\{\s*grid-column:\s*4;/);
  assert.match(html, /id="menu-toggle-source-tab"[^>]*>Show Source tab/);
  assert.match(app, /function sourceTabEnabled\(\)[\s\S]*source-tab-hidden[\s\S]*state\.previewMode === "source"/);
  assert.match(app, /function sourceTabEnabled\(\)[\s\S]*if \(stored !== null\) return stored === "true";[\s\S]*WORKSPACE_CACHE_KEY/);
  assert.match(app, /storedStatsCollapsed === null \|\| storedStatsCollapsed === "true"/);
  assert.match(css, /body\.source-tab-hidden \[data-preview-mode="source"\]/);
  assert.match(css, /#source-panel \.editor-shell\s*\{[^}]*width:\s*min\(816px,[^}]*margin:\s*34px auto 0;[^}]*box-shadow:\s*var\(--shadow\);/s);
  assert.match(css, /\.beat-sheet-workspace\s*\{[^}]*width:\s*min\(816px,[^}]*margin:\s*34px auto 0;[^}]*box-shadow:\s*var\(--shadow\);/s);
  assert.match(css, /grid-template-rows:\s*minmax\(0,\s*1fr\)/);
});

test("Insights remains independently collapsible without a Source sidebar", async () => {
  const [html, css] = await Promise.all([readFile(htmlPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.doesNotMatch(html, /class="panel-close"/);
  assert.doesNotMatch(html, /class="panel-toggle source-toggle"/);
  assert.match(html, /class="panel-toggle stats-toggle"[^>]*><span>›<\/span><b>Insights<\/b>/);
  assert.match(css, /stats-collapsed \.stats-toggle\s*\{[^}]*justify-content:\s*center;[^}]*gap:\s*8px;/s);
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

test("source and preview share syntax, cursor synchronization, and character completion behavior", async () => {
  const [html, app, css] = await Promise.all([readFile(htmlPath, "utf8"), readFile(appPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.match(html, /id="source-highlight"/);
  assert.match(html, /id="preview-completion-menu"/);
  assert.match(app, /function renderSourceSyntax\(/);
  assert.match(app, /showPreviewCharacterCompletions\(line\)/);
  assert.match(app, /const explicitCharacter = text\.startsWith\("@"\)/);
  assert.match(app, /\.classList\.add\("source-current"\)/);
  assert.match(css, /\.syntax-character/);
});

test("source highlighting follows the textarea viewport and rendered line geometry", async () => {
  const app = await readFile(appPath, "utf8");
  assert.match(app, /function boundedScrollLeft\(/);
  assert.match(app, /Math\.max\(0, element\.scrollWidth - element\.clientWidth\)/);
  assert.match(app, /function syncSourceOverlay\(\)/);
  assert.match(app, /highlight\.style\.width = source\.clientWidth/);
  assert.match(app, /if \(scrollLeft !== source\.scrollLeft\) source\.scrollLeft = scrollLeft/);
  assert.match(app, /highlight\.scrollLeft = boundedScrollLeft\(highlight, scrollLeft\)/);
  assert.match(app, /data-source-line=/);
  assert.match(app, /sourceLine\.getBoundingClientRect\(\)\.top - source\.getBoundingClientRect\(\)\.top/);
  assert.doesNotMatch(app, /rowsBefore \* 20\.15/);
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
  assert.match(app, /page\.addEventListener\("focusin"[\s\S]*setSourceCursorFromPreview\(line\)/);
  assert.doesNotMatch(app, /page\.addEventListener\("focusin"[^\n]*jumpToLine/);
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
  assert.match(app, /function scrollSourceTarget\([\s\S]*firstRect\.top - highlight\.getBoundingClientRect\(\)\.top \+ highlight\.scrollTop/);
  assert.match(app, /source\.addEventListener\("select"[\s\S]*updateCursor\(\{ scrollPreview: true \}\)/);
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
  assert.match(app, /const startMap =/);
  assert.match(app, /const endMap =/);
  assert.match(app, /const caretMap =/);
  assert.match(app, /activeInlineMarkers/);
  assert.match(app, /element\.classList\.contains\("scene"\)/);
  assert.match(app, /page\.focus\(\{ preventScroll: true \}\)[\s\S]*scrollTop = scrollTop/);
  assert.match(app, /requestAnimationFrame\(\(\) => \{[\s\S]*previewScroll\.scrollTop = scrollTop/);
  assert.doesNotMatch(app, /const insertAbove =/);
  assert.match(app, /const focusLine = startIndex \+ displayLines\.length - 1/);
  assert.match(app, /function previewCaretIsOnVisualEdge\(line, edge\)/);
  assert.match(app, /event\.key === "ArrowUp" \? -1 : event\.key === "ArrowDown" \? 1 : 0/);
  assert.match(app, /Number\(line\.dataset\.line\) \+ verticalDirection/);
});

test("top-level act headings are supported in the live editor", async () => {
  const [html, app, css] = await Promise.all([readFile(htmlPath, "utf8"), readFile(appPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.match(html, /id="menu-insert-section"[^>]*>Act heading/);
  assert.match(app, /match\(\/\^#\\s\+\(Act\\b\.\*\)\$\/i\)/);
  assert.match(app, /appendToSource\("# Act 1\\n\\n"\)/);
  assert.match(css, /\.script-line\.section\.act[^}]*display:\s*block;/);
  assert.match(app, /def _fp_format_pdf_act_headings\(screenplay\)/);
  assert.match(app, /Slug\(bold\(str\(paragraph\.text\)\.upper\(\)\), scene_number=None\)/);
  assert.match(css, /\.script-line\.section\.act[^}]*font:\s*700 16px\/1 var\(--screenplay\);[^}]*text-align:\s*left;/s);
});

test("source completions wait for typing on a new line and support explicit character lookup", async () => {
  const [app, css] = await Promise.all([readFile(appPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.match(app, /event\.key === "Enter"\) hideCompletions\(\)/);
  assert.match(app, /event\.inputType === "insertText"\) showCompletions\(\)/);
  assert.match(app, /if \(!allowBlank && !currentText\) return hideCompletions\(\)/);
  assert.match(app, /const explicitCharacter = trimmed\.startsWith\("@"\)/);
  assert.match(app, /state\.metadata\.characters\.some\(\(character\) => character\.name\.startsWith\(characterFragment\)\)/);
  assert.match(app, /function positionSourceCompletion\(\)/);
  assert.match(app, /const sourceScrollLeft = boundedScrollLeft\(source\)/);
  assert.match(app, /wrapped \? 0 : sourceScrollLeft/);
  assert.match(app, /marker\.getBoundingClientRect\(\)/);
  assert.match(app, /current\.match\(\/@\?\[A-Za-z0-9\._'-\]\*\$\/\)/);
  assert.match(app, /item\.value\.toUpperCase\(\) !== characterFragment/);
  assert.match(css, /#completion-menu\s*\{[^}]*position:\s*fixed;/s);
});

test("spellcheck exposes private local replacement suggestions in the unified editor menu", async () => {
  const [html, app] = await Promise.all([readFile(htmlPath, "utf8"), readFile(appPath, "utf8")]);
  assert.match(html, /Right-click spelling for suggestions/);
  assert.match(html, /aria-describedby="editor-status spellcheck-help"/);
  assert.match(app, /setAttribute\("spellcheck", String\(enabled\)\)/);
  assert.match(app, /type === "character" \? ` spellcheck="false"`/);
  assert.match(app, /import\("\.\/vendor\/spellcheck\.mjs"\)/);
  assert.match(app, /dictionary-en\.aff/);
  assert.match(app, /candidate\.word === candidate\.word\.toUpperCase\(\)/);
  assert.match(app, /checker\.suggest\(candidate\.word\)\.slice\(0, 5\)/);
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
  assert.match(css, /:root\s*\{[\s\S]*--source-bg:\s*#f6f6f5;[\s\S]*--source-ink:\s*#0f172a;[\s\S]*--syntax-scene:\s*#0284c7;[\s\S]*--syntax-character:\s*#7c3aed;[\s\S]*--syntax-transition:\s*#b45309;[\s\S]*--syntax-ignored:\s*#be123c;/);
  assert.match(css, /:root\[data-theme="dark"\]\s*\{[\s\S]*--source-bg:\s*#111315;[\s\S]*--source-ink:\s*#cbd5e1;[\s\S]*--syntax-scene:\s*#38bdf8;[\s\S]*--syntax-character:\s*#c4b5fd;[\s\S]*--syntax-transition:\s*#fbbf24;[\s\S]*--syntax-ignored:\s*#fb7185;/);
  assert.match(css, /\.editor-shell\s*\{[^}]*background:\s*var\(--source-bg\);/s);
  assert.match(css, /\.source-highlight\s*\{[^}]*color:\s*var\(--source-ink\);/s);
  assert.match(css, /\.line-numbers\s*\{[^}]*background:\s*var\(--source-gutter-bg\);/s);
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
  assert.match(app, /source = re\.sub\(r"\(\?m\)\^\(\[\^\\\\S\\\\r\\\\n\]\*\)>\(\\\\S/);
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
  assert.match(html, /id="beat-sheet-empty-state"[\s\S]*Map the story before/);
  assert.doesNotMatch(html, /data-blank-insert/);
  assert.match(app, /localStorage\.getItem\("fountain-publisher\.preview"\) \|\| "beats"/);
  assert.match(app, /beat-sheet-empty-state[^\n]*hidden = hasBeatSheet/);
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
  const css = await readFile(cssPath, "utf8");
  assert.match(css, /\.script-line\.section\.source-current/);
  assert.match(css, /content:\s*"EDITOR ONLY/);
  assert.match(css, /\.script-line\.empty\s*\{[^}]*display:\s*none;[^}]*\}[\s\S]*\.script-line\.empty\.source-current\s*\{[^}]*display:\s*block;/);
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
  assert.match(app, /paragraph\.line = plain\(f"\{label\}\. "\) \+ paragraph\.line/);
});

test("page totals come from the compiled Screenplain PDF", async () => {
  const [app, css] = await Promise.all([readFile(appPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.match(app, /function renderPageMetric\(metadata\)/);
  assert.match(app, /1:\s*\[1, 8\][\s\S]*4:\s*\[1, 2\][\s\S]*7:\s*\[7, 8\]/);
  assert.match(app, /class="page-fraction"><sup>\$\{fraction\[0\]\}<\/sup><i>\/<\/i><sub>\$\{fraction\[1\]\}<\/sub>/);
  assert.match(css, /\.page-fraction\s*\{[^}]*height:\s*1\.12em;[^}]*vertical-align:/s);
  assert.match(css, /\.page-fraction sup\s*\{[^}]*transform:\s*translateX\(-\.04em\);/s);
  assert.match(css, /\.page-fraction sub\s*\{[^}]*transform:\s*translateX\(\.04em\);/s);
  assert.match(css, /\.page-fraction i\s*\{[^}]*rotate\(9deg\)/s);
  assert.match(app, /function compileStaticPageCount/);
  assert.match(app, /result\.pageCount == null[\s\S]*\/api\/render\/pdf/);
  assert.match(app, /function countPdfBlobPages/);
  assert.match(app, /function screenplayPageCount\(physicalPages\)[\s\S]*titleFields/);
  assert.match(app, /lastPageEighths/);
  assert.match(app, /_fp_last_page_eighths/);
  assert.match(app, /estimatedSeconds = result\.pageCount \* 60/);
  assert.match(app, /_fp_prepare_screenplay[\s\S]*isinstance\(screenplay\.paragraphs\[0\], PageBreak\)/);
  assert.ok(app.includes('/Type\\s*\\/Page\\b'));
});

test("preview toolbar and rotating arrows stay compact", async () => {
  const [html, app, css] = await Promise.all([readFile(htmlPath, "utf8"), readFile(appPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.doesNotMatch(html, /id="page-estimate"/);
  assert.doesNotMatch(html, /id="preview-percent"/);
  assert.doesNotMatch(css, /\.preview-status/);
  assert.doesNotMatch(app, /function updatePreviewStatus\(/);
  assert.match(css, /stats-collapsed \.stats-toggle span\s*\{\s*transform:\s*rotate\(180deg\)/);
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
  assert.match(html, /id="character-analytics-back"[^>]*>← All scenes</);
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
  assert.match(app, /state\.metadata\.scenes\.length === 1 \? 0 : null/);
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
  assert.match(css, /--annotation-accent:\s*var\(--metric-scenes-ink\);/);
  assert.match(css, /\.annotation-orb\s*\{[^}]*appearance:\s*none;[^}]*-webkit-appearance:\s*none;[^}]*background-color:\s*var\(--annotation-accent\)/s);
  assert.match(worker, /fountain-publisher-shell-v2/);
  assert.match(worker, /\["styles\.css", "app\.mjs"\][\s\S]*fetch\(request\)[\s\S]*catch\(\(\) => caches\.match\(request\)\)/);
  assert.match(css, /\.annotation-orb\s*\{[^}]*top:\s*1px;/s);
  assert.match(app, /function alignAnnotationOrbs\(\)[\s\S]*marginCenterX[\s\S]*orb\.offsetWidth \* scale \* \.5[\s\S]*orb\.style\.left/);
  assert.match(app, /requestAnimationFrame\(alignAnnotationOrbs\)/);
  assert.match(css, /@media\s*\(max-width:\s*820px\)[\s\S]*padding:\s*48px max\(28px, 7vw\) 72px;/s);
  assert.match(css, /@media\s*\(max-width:\s*820px\)[\s\S]*\.annotation-orb\s*\{[^}]*width:\s*16px;[^}]*height:\s*16px;/s);
  assert.match(css, /\.annotation-orb::after\s*\{[^}]*inset:\s*-8px;/s);
  assert.match(app, /page\.addEventListener\("pointerdown"[\s\S]*previewTouchMenuTimer = setTimeout[\s\S]*showPreviewContextMenu[\s\S]*420/);
  assert.match(app, /page\.addEventListener\("pointermove"[\s\S]*Math\.hypot[\s\S]*cancelPreviewTouchMenu/);
  assert.match(css, /\.preview-context-menu button\s*\{[^}]*min-height:\s*44px;/s);
  assert.match(css, /\.preview-context-menu\s*\{/);
  assert.match(css, /\.general-notes\s*\{/);
});

test("Beat Sheet provides a source-backed draggable story map and Preview guide", async () => {
  const [html, app, css] = await Promise.all([readFile(htmlPath, "utf8"), readFile(appPath, "utf8"), readFile(cssPath, "utf8")]);
  assert.doesNotMatch(html, /beat-sheet-insight|id="beat-sheet-summary"|id="open-beat-sheet"/);
  assert.match(html, /id="beat-sheet-panel"[\s\S]*id="beat-premise"[\s\S]*id="beat-list"[^>]*beat-flow-editor/);
  assert.match(html, /id="beat-progress-graph"[^>]*aria-label="Beat pacing by cumulative screenplay words"/);
  assert.match(html, /id="view-beat-progress"[^>]*>View pacing graph</);
  assert.match(html, /id="beat-progress-dialog"[\s\S]*id="save-beat-progress"[^>]*>Save PNG</);
  assert.match(html, /id="menu-toggle-beat-guide"[\s\S]*id="beat-guide-layer"/);
  assert.match(app, /data-assign-beat-area>Assign \+ Next</);
  assert.match(app, /MANAGED_NOTE_RE = \/[\s\S]*BEATS/);
  assert.match(app, /function managedBeatSheetSource\(premise, beats\)/);
  assert.match(app, /Next Beat:[\s\S]*data-assign-beat-area[\s\S]*data-next-beat/);
  assert.match(app, /function selectedBeatArea\(\)[\s\S]*function assignCurrentBeatArea\(\)/);
  assert.match(app, /function jumpToBeatArea\(beat\)[\s\S]*!\["empty", "note", "boneyard"\]\.includes/);
  assert.match(app, /function setSourceLines\(lines\)[\s\S]*selectionDirection[\s\S]*setSelectionRange/);
  assert.doesNotMatch(app, /beatSceneEntries|Connect to scene/);
  assert.doesNotMatch(app, /Place at scene/);
  assert.match(app, /addEventListener\("dragover"[\s\S]*insertBefore\(draggedBeat/);
  assert.match(app, /function renderBeatGuide\(\)[\s\S]*beat-guide-layer/);
  assert.match(app, /beat-graph-node[\s\S]*beat-assignment[\s\S]*data-beat-jump/);
  assert.match(app, /beat-unassign[\s\S]*beatCard\(\{ \.\.\.beat, range: null \}\)[\s\S]*persistBeatSheet\(\)/);
  assert.match(app, /event\.key !== "Enter" \|\| !event\.target\.matches\("\.beat-text"\)[\s\S]*nextElementSibling[\s\S]*\.focus\(\)/);
  assert.match(app, /function persistBeatSheet\(\)[\s\S]*function scheduleBeatSheetSave\(\)/);
  assert.match(app, /beat-list"\)\.innerHTML = sheet\.beats\.map\(beatCard\)\.join\(""\)/);
  assert.doesNotMatch(app, /if \(!\$\("\.beat-card"[\s\S]*insertAdjacentHTML\("beforeend", beatCard\(\)\)/);
  assert.match(css, /#beat-sheet-panel\s*\{[\s\S]*\.beat-card\s*\{[\s\S]*\.beat-flow-editor[\s\S]*\.beat-graph-node[\s\S]*\.beat-guide-layer\s*\{[\s\S]*\.script-line\.beat-area/);
  assert.match(app, /beat-list"\)\.addEventListener\("pointerdown"[\s\S]*setPointerCapture[\s\S]*addEventListener\("pointermove"[\s\S]*finishPointerBeatDrag/);
  assert.match(app, /function renderBeatProgressGraph\(beats = currentBeatCards\(\)\)[\s\S]*beforeValue[\s\S]*afterValue[\s\S]*beat-plot-point/);
  assert.match(app, /function saveBeatProgressPng\(\)[\s\S]*XMLSerializer[\s\S]*canvas\.toBlob[\s\S]*beat-pacing\.png/);
  assert.match(css, /\.beat-progress-line\s*\{[^}]*stroke:/s);
  assert.match(css, /\.beat-drag\s*\{[^}]*touch-action:\s*none;[^}]*user-select:\s*none;/s);
  assert.match(css, /#source-panel \.panel-title\s*\{[^}]*justify-content:\s*flex-start;[^}]*gap:\s*16px;[^}]*background:\s*var\(--panel\);/s);
});

test("mobile preview clipboard actions preserve selections and avoid covering them", async () => {
  const app = await readFile(appPath, "utf8");
  assert.match(app, /previewContextEdit:\s*null/);
  assert.match(app, /previewContextText:\s*""/);
  assert.match(app, /runPreviewClipboardAction\(action,\s*previewContextLine,\s*\{\s*edit,\s*text\s*\}\)/);
  assert.match(app, /await navigator\.clipboard\.writeText\(text\);\s*replacePreviewSelection\(edit,\s*""\)/);
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
  assert.match(app, /const firstRect = sourceLine\?\.getClientRects\(\)\[0\]/);
  assert.match(app, /firstRect\.top - highlightRect\.top \+ highlight\.scrollTop/);
  assert.match(app, /class="line-number" style="top:/);
  assert.match(app, /gutter\.scrollTop = source\.scrollTop/);
  assert.match(app, /const newline = index < lines\.length - 1 \? "\\n" : "";/);
  assert.match(app, />\$\{value\}\$\{newline\}<\/span>`;\s*\}\)\.join\(""\)/);
  assert.match(css, /body\.source-wrap #source/);
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
  assert.match(html, /<h4>Vim mode<\/h4>[\s\S]*Visual mode[\s\S]*<kbd>dd<\/kbd>[\s\S]*<kbd>yy<\/kbd>/);
  assert.match(app, /vimEnabled:\s*localStorage\.getItem\("fountain-publisher\.vim-mode"\) === "true"/);
  assert.match(app, /function handleVimKey\(event, surface\)/);
  assert.match(app, /handleVimKey\(event, "source"\)/);
  assert.match(app, /handleVimKey\(event, "preview"\)/);
  assert.match(app, /\["h", "j", "k", "l", "0", "\^", "\$", "w", "b", "G"\]/);
  assert.match(app, /state\.vimYank = `\$\{position\.lines\[position\.line\]\}\\n`/);
  assert.match(app, /localStorage\.setItem\("fountain-publisher\.vim-mode", String\(state\.vimEnabled\)\)/);
  assert.match(app, /function vimPreviewTargetLine\(currentLine, command\)[\s\S]*\.script-line\[data-line\][\s\S]*!line\.classList\.contains\("empty"\)[\s\S]*line > currentLine[\s\S]*line < currentLine/);
  assert.match(app, /moveVimCursor\(key, previewFocus\)/);
  assert.match(app, /state\.vimMode === "visual"[\s\S]*focusVimSelection\(previewFocus[\s\S]*\["y", "d", "x"\]/);
  assert.match(app, /state\.vimMode === "insert"[\s\S]*\["\[", "c"\]\.includes\(event\.key\.toLowerCase\(\)\)/);
  assert.match(app, /state\.vimMode === "visual" && event\.ctrlKey && event\.key\.toLowerCase\(\) === "c"/);
  assert.match(app, /function renderedTextOffsetRect\(element, offset\)[\s\S]*getClientRects/);
  assert.match(app, /function moveVimDisplayLine\(command, previewFocus, visual = false\)[\s\S]*previewWrappedRowOffset[\s\S]*sourceWrappedRowOffset/);
  assert.match(app, /state\.vimPending === "g"[\s\S]*moveVimDisplayLine\(`g\$\{key\}`/);
  assert.match(app, /function moveVimHalfPage\(command, previewFocus, visual = false\)[\s\S]*viewportHeight \/ lineHeight \/ 2[\s\S]*previewWrappedRowOffset[\s\S]*sourceWrappedRowOffset/);
  assert.match(app, /event\.ctrlKey && \["d", "u"\]\.includes\(event\.key\.toLowerCase\(\)\)[\s\S]*moveVimHalfPage/);
  assert.match(css, /\.vim-status\[data-mode="normal"\][^}]*var\(--metric-pages-ink\)[\s\S]*\.vim-status\[data-mode="insert"\][^}]*var\(--metric-words-ink\)[\s\S]*\.vim-status\[data-mode="visual"\][^}]*var\(--metric-scenes-ink\)/);
  assert.match(css, /@media\s*\(max-width:\s*820px\)[\s\S]*\.desktop-setting, \.vim-status\s*\{\s*display:\s*none !important;/s);
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
  assert.match(html, /id="preview-background"[\s\S]*value="blank">Blank[\s\S]*value="dots" selected>Dots/);
  assert.doesNotMatch(html, /value="rain"|Raindrops|preview-rain-speed/);
  assert.doesNotMatch(html, /Damascus|value="damascus"/);
  assert.match(html, /id="preview-dot-radius" type="range" min="0\.6" max="1\.8" step="0\.1" value="1"/);
  assert.match(html, /id="background-pattern-preview"[^>]*data-background="dots"/);
  assert.match(html, /id="preview-dot-direction"[\s\S]*value="up"[\s\S]*value="down"[\s\S]*value="left"[\s\S]*value="right"[\s\S]*value="up-left"[\s\S]*value="up-right"[\s\S]*value="down-left"[\s\S]*value="down-right"[\s\S]*value="random"/);
  assert.match(html, /id="preview-dot-speed" type="range" min="1" max="100" step="1" value="20"/);
  assert.match(css, /\.preview-scroll\[data-background="dots"\][^}]*radial-gradient[^}]*background-size:\s*16px 16px;/s);
  assert.match(css, /\.background-pattern-preview\s*\{[^}]*background-color:\s*var\(--bg\);/s);
  assert.match(css, /background-position:\s*var\(--preview-dot-x, 0px\) var\(--preview-dot-y, 0px\)/);
  assert.doesNotMatch(css, /data-background="damascus"|repeating-radial-gradient/);
  assert.match(css, /#background-dialog\s*\{[^}]*width:\s*min\(390px,/s);
  assert.doesNotMatch(css, /\.preview-scroll\s*\{[^}]*background-color:/s);
  assert.match(app, /function applyPreviewBackground\(\)/);
  assert.match(app, /pattern === "dots" && !isMobilePreview\(\)/);
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
  assert.match(app, /function renderLineNumbers[\s\S]*?sourceLine\?\.getClientRects\(\)\[0\]/);
  assert.doesNotMatch(app, /sourceWrapColumns|fontSize \* 0\.61/);
  // setMobileTab must re-render editor chrome when switching to source tab
  assert.match(app, /function setMobileTab[\s\S]*?if \(panel === "source"\) \{ renderEditorChrome\(\); scrollSourceTarget\(currentPosition\(\)\.line, "center"\); \}/);
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

test("mobile exports use the share sheet with download fallback", async () => {
  const app = await readFile(appPath, "utf8");
  assert.match(app, /async function download\(/);
  assert.match(app, /anchor\.download = filename/);
  assert.match(app, /navigator\.canShare\?\.\(shareData\)/);
  assert.match(app, /await navigator\.share\(shareData\)/);
  assert.match(app, /await shareOrDownload\(blob,/);
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
