import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const html = await readFile(new URL("../../src/fountain_publisher/web/index.html", import.meta.url), "utf8");
const css = await readFile(new URL("../../src/fountain_publisher/web/styles.css", import.meta.url), "utf8");
const dock = html.slice(html.indexOf('<aside id="search-dock"'), html.indexOf('<aside id="source-panel"'));

test("document search exposes one stable instance of each controller target", () => {
  const ids = ["search-dock", "document-search", "search-form", "search-query", "search-replace-row",
    "search-replacement", "search-previous", "search-next", "search-replace", "search-replace-all",
    "search-close", "search-case", "search-word", "search-regex", "search-status", "search-toggle-replace",
    "search-results-panel", "search-results", "search-results-close", "search-results-summary", "vim-command-form", "vim-command-input",
    "vim-command-prefix", "vim-command-status", "vim-command-close"];
  for (const id of ids) assert.equal([...dock.matchAll(new RegExp(`id="${id}"`, "g"))].length, 1, id);
  for (const id of ["search-dock", "document-search", "search-replace-row", "search-results-panel", "vim-command-form"]) {
    assert.match(dock, new RegExp(`<[^>]+id="${id}"[^>]*\\shidden[\\s>]`));
  }
});

test("Find and Replace are discoverable in Edit without opening a modal", () => {
  assert.match(html, /class="toolbar-menu edit-menu"[\s\S]*?<summary>Edit<\/summary>[\s\S]*?id="menu-find"[\s\S]*?id="menu-replace"/);
  assert.match(html, /<main id="workspace">\s*<aside id="search-dock"/);
  assert.doesNotMatch(dock, /<dialog|aria-modal|\son(?:click|input|submit|keydown)=/);
  assert.match(dock, /id="document-search" aria-label="Find in screenplay"/);
});

test("search controls have labels, announced status, and form-based next navigation", () => {
  assert.match(dock, /for="search-query"[\s\S]*?id="search-query" type="search"/);
  assert.match(dock, /for="search-replacement"[\s\S]*?<textarea id="search-replacement" rows="1"/);
  for (const id of ["search-status", "search-results-summary", "vim-command-status"]) {
    assert.match(dock, new RegExp(`id="${id}" role="status" aria-live="polite"`));
  }
  assert.match(dock, /id="search-next"[^>]*type="submit"[^>]*aria-label="Next match"/);
  assert.match(dock, /id="search-previous"[^>]*type="button"[^>]*aria-label="Previous match"/);
  assert.match(dock, /id="search-toggle-replace"[^>]*aria-controls="search-replace-row"[^>]*aria-expanded="false"/);
  for (const id of ["search-close", "vim-command-close", "search-results-close"]) {
    assert.match(dock, new RegExp(`id="${id}"[^>]*type="button"[^>]*aria-label="Close`));
  }
});

test("search dock consumes a bounded workspace row and preserves a flexible editor", () => {
  assert.match(css, /#workspace:has\(> #search-dock:not\(\[hidden\]\)\)\s*\{\s*grid-template-rows:\s*auto minmax\(0, 1fr\)/);
  assert.match(css, /#workspace:has\(> #search-dock:not\(\[hidden\]\)\) > :not\(#search-dock\)\s*\{\s*grid-row:\s*2/);
  const dockRule = css.match(/^#search-dock\s*\{([^}]+)\}/m)?.[1] || "";
  assert.match(dockRule, /max-height:/);
  assert.match(dockRule, /overflow:\s*auto/);
  assert.doesNotMatch(dockRule, /position:\s*(?:absolute|fixed)/);
  assert.match(css, /#search-results\s*\{[^}]*max-height:\s*180px;[^}]*overflow:\s*auto/);
  assert.match(css, /@media \(max-width: 820px\)[\s\S]*\.search-field input, \.search-field textarea, \.vim-command-field\s*\{[^}]*font-size:\s*16px/);
  assert.match(css, /#search-dock :is\(button, input, textarea\):focus-visible/);
  assert.match(css, /::highlight\(document-search-current\)\s*\{[^}]*background-color:[^}]*var\(--paper\)/);
});

test("help describes current-document scope, regex dialect, keyboard navigation and Vim commands", () => {
  assert.match(dock, /entire open screenplay, including Fountain markup/);
  assert.match(dock, /Regex uses JavaScript syntax/);
  const help = html.slice(html.indexOf('<section id="docs-shortcuts"'));
  for (const command of ["⌘ F", "Ctrl F", "⌥ ⌘ F", "Ctrl H", "F3", "Shift F3", "⌘ G", "Ctrl G", ":%s/old/new/g", ":grep /pattern/", ":g/pattern/p"]) {
    assert.ok(help.includes(command), command);
  }
  assert.match(help, /JavaScript syntax[\s\S]*not Vim’s regex dialect/);
  assert.match(help, /not other files in Drive or GitHub/);
  assert.match(help, /<kbd>n<\/kbd> \/ <kbd>N<\/kbd>/);
});
