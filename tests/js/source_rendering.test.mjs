import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

const app = await readFile(new URL("../../src/fountain_publisher/web/app.mjs", import.meta.url), "utf8");
function section(start, end) {
  const first = app.indexOf(start);
  const last = app.indexOf(end, first);
  assert.ok(first >= 0 && last > first, `Missing function boundary: ${start}`);
  return app.slice(first, last);
}
const code = `${app.match(/^const TITLE_KEYS = .+;$/m)[0]}
${section("function escapeHtml(", "function fountainInlineHtml(")}
${section("function isScene(", "function analyzeLocally(")}
${section("function renderLineNumbers(", "function boundedScrollLeft(")}`;

function harness(value = "first\nsecond\nthird") {
  const events = [];
  const stats = { html: 0, sourceHtml: 0, gutterHtml: 0, top: 0, height: 0, classes: 0, numbers: 0, created: 0, selectors: 0, spelling: 0, dictionaryLoads: 0 };
  class Element {
    constructor(tagName = "span") {
      this.tagName = tagName.toUpperCase();
      this.children = [];
      this.parentNode = null;
      this.dataset = {};
      this._className = "";
      this._html = "";
      this._text = "";
      this._top = 0;
      this._scrollHeight = 0;
      this.scrollTop = 0;
      const style = {};
      this.style = new Proxy(style, { set: (target, key, next) => {
        if (key === "top") stats.top += 1;
        if (key === "height") stats.height += 1;
        events.push(`write:${String(key)}`);
        target[key] = next;
        return true;
      } });
    }
    get lastElementChild() { return this.children.at(-1) || null; }
    get childElementCount() { return this.children.length; }
    get className() { return this._className; }
    set className(value) { stats.classes += 1; events.push("write:class"); this._className = value; }
    get innerHTML() { return this._html; }
    set innerHTML(value) {
      stats.html += 1;
      if (this === highlight) stats.sourceHtml += 1;
      if (this === gutter) stats.gutterHtml += 1;
      events.push("write:html"); this._html = value;
      for (const child of this.children) child.parentNode = null;
      this.children.length = 0;
    }
    get textContent() { return this._text; }
    set textContent(value) { stats.numbers += 1; events.push("write:text"); this._text = value; }
    get offsetTop() { events.push("read:top"); return this._top; }
    get scrollHeight() { events.push("read:height"); return this._scrollHeight; }
    append(...nodes) { for (const node of nodes) this.insertBefore(node, null); }
    insertBefore(node, before) {
      if (node.tagName === "#FRAGMENT") {
        for (const child of [...node.children]) this.insertBefore(child, before);
        return node;
      }
      node.remove();
      const index = before === null ? this.children.length : this.children.indexOf(before);
      assert.ok(index >= 0);
      this.children.splice(index, 0, node); node.parentNode = this;
      events.push("write:insert");
      return node;
    }
    remove() {
      if (!this.parentNode) return;
      const children = this.parentNode.children;
      children.splice(children.indexOf(this), 1); this.parentNode = null;
      events.push("write:remove");
    }
    replaceWith(node) {
      const parent = this.parentNode;
      parent.insertBefore(node, this); this.remove();
    }
  }
  const highlight = new Element("pre");
  const gutter = new Element("div");
  const source = { value, scrollTop: 0, get scrollHeight() { events.push("read:source-height"); return 600; } };
  const enabled = { checked: false };
  const state = { spellchecker: null };
  const dictionary = { correct(word) { stats.spelling += 1; return word !== "mispelled"; } };
  let resolveDictionary;
  const dictionaryPromise = new Promise((resolve) => { resolveDictionary = resolve; });
  const context = { source, state,
    document: {
      createElement(tag) { stats.created += 1; return new Element(tag); },
      createDocumentFragment: () => new Element("#fragment"),
    },
    $: (selector) => {
      stats.selectors += 1;
      if (selector === "#source-highlight") return highlight;
      if (selector === "#line-numbers") return gutter;
      if (selector === "#spellcheck") return enabled;
      assert.fail(`Unexpected per-line selector: ${selector}`);
    },
    getSpellchecker() { stats.dictionaryLoads += 1; return dictionaryPromise; },
  };
  runInNewContext(code, context);
  return { context, source, state, highlight, gutter, enabled, dictionary, events, stats, Element,
    reset() { for (const key of Object.keys(stats)) stats[key] = 0; events.length = 0; },
    async loadDictionary() { state.spellchecker = dictionary; resolveDictionary(dictionary); await dictionaryPromise; await Promise.resolve(); },
  };
}

test("Source updates reuse every unaffected line and never replace the complete highlight", () => {
  const h = harness(Array.from({ length: 5000 }, (_, index) => `Action line ${index}.`).join("\n"));
  h.context.renderSourceSyntax();
  const nodes = [...h.highlight.children];
  assert.equal(nodes.length, 5000);
  h.reset();
  h.source.value = h.source.value.replace("Action line 2500.", "Changed action 2500.");
  h.context.renderSourceSyntax();
  assert.equal(h.stats.html, 1, "one changed line needs one markup update");
  assert.equal(h.stats.sourceHtml, 0);
  assert.equal(h.stats.created, 0);
  assert.equal(h.stats.classes, 0, "unchanged type does not rewrite its class");
  assert.ok(nodes.every((node, index) => node === h.highlight.children[index]));
  h.reset(); h.context.renderSourceSyntax();
  assert.equal(h.stats.html, 0, "same source/settings is a no-op");
  assert.equal(h.stats.created, 0);
  h.context.renderLineNumbers();
  for (let index = 0; index < 30; index += 1) {
    h.reset();
    h.source.value = h.source.value.replace(/Changed action 2500[^\n]*/, `Changed action 2500 revision ${index}.`);
    h.context.renderSourceSyntax();
    h.context.renderLineNumbers();
    assert.equal(h.stats.html, 1, `edit ${index} only rewrites its changed line`);
    assert.equal(h.stats.created, 0, `edit ${index} retains highlight and gutter nodes`);
    assert.equal(h.stats.gutterHtml, 0);
    assert.equal(h.stats.top, 0, "unchanged layout produces no gutter style writes");
    assert.equal(h.stats.selectors, 4, "two fixed selectors for each renderer, independent of document length");
  }
});

test("context-dependent line types update even when their source text is unchanged", () => {
  const h = harness("MAYA\nHello.");
  h.context.renderSourceSyntax();
  const nodes = [...h.highlight.children];
  assert.equal(nodes[0].className, "syntax-character");
  assert.equal(nodes[1].className, "syntax-dialogue");
  h.source.value = "Maya\nHello.";
  h.context.renderSourceSyntax();
  assert.equal(h.highlight.children[0], nodes[0]);
  assert.equal(h.highlight.children[1], nodes[1]);
  assert.equal(nodes[0].className, "");
  assert.equal(nodes[1].className, "");
});

test("insertions, deletions, blank documents and same-length document switches retain correct indexed markup", () => {
  const h = harness("first\nsecond\nthird");
  h.context.renderSourceSyntax();
  const firstNode = h.highlight.children[0];
  for (const text of ["first\ninserted\nsecond\nthird", "first\nthird", "other\nfile!", "", "\n\n"]) {
    h.source.value = text;
    h.context.renderSourceSyntax();
    const lines = h.context.classifyLines(text);
    assert.equal(h.highlight.children.length, lines.length);
    assert.equal(h.highlight.children[0], firstNode);
    lines.forEach((line, index) => {
      const node = h.highlight.children[index];
      assert.equal(node.dataset.sourceLine, String(index));
      assert.equal(node.innerHTML, h.context.sourceSpellingHtml(line.raw, line.type, null) || " ");
    });
  }
});

test("spellcheck toggles, dictionary readiness and replacement checker identity invalidate line markup", async () => {
  const h = harness("mispelled word\n\nMAYA\nmispelled dialogue");
  h.context.renderSourceSyntax();
  h.enabled.checked = true;
  for (let index = 0; index < 20; index += 1) h.context.renderSourceSyntax();
  assert.equal(h.stats.dictionaryLoads, 1, "only one readiness callback is attached while the dictionary loads");
  await h.loadDictionary();
  assert.match(h.highlight.children[0].innerHTML, /source-spelling-error/);
  h.reset(); h.context.renderSourceSyntax();
  assert.equal(h.stats.spelling, 0, "unchanged text does not run the spellchecker again");
  assert.equal(h.stats.html, 0);
  h.state.spellchecker = { correct: () => true };
  h.context.renderSourceSyntax();
  assert.doesNotMatch(h.highlight.children[0].innerHTML, /source-spelling-error/);
  h.state.spellchecker = h.dictionary;
  h.context.renderSourceSyntax();
  assert.match(h.highlight.children[0].innerHTML, /source-spelling-error/);
  h.enabled.checked = false;
  h.context.renderSourceSyntax();
  assert.doesNotMatch(h.highlight.children[0].innerHTML, /source-spelling-error/);
});

test("replaced highlight nodes are repopulated from canonical source rather than stale cache entries", () => {
  const h = harness("first\nsecond");
  h.context.renderSourceSyntax();
  const replacement = new h.Element("span");
  h.highlight.children[1].replaceWith(replacement);
  h.context.renderSourceSyntax();
  assert.equal(h.highlight.children[1], replacement);
  assert.equal(replacement.dataset.sourceLine, "1");
  assert.equal(replacement.innerHTML, "second");
});

test("gutter reads each line position directly before all writes and preserves line-number nodes", () => {
  const h = harness();
  h.context.renderSourceSyntax();
  h.highlight.children.forEach((node, index) => { node._top = 14 + index * 25.5; });
  h.highlight._scrollHeight = 750;
  h.reset(); h.context.renderLineNumbers();
  assert.equal(h.stats.selectors, 2, "container selectors only, not one selector per line");
  assert.equal(h.stats.gutterHtml, 0);
  assert.deepEqual(h.gutter.children.slice(0, -1).map((node) => node.style.top), ["14px", "39.5px", "65px"]);
  assert.equal(h.gutter.lastElementChild.className, "line-number-spacer");
  assert.equal(h.gutter.lastElementChild.style.height, "750px");
  const firstWrite = h.events.findIndex((event) => event.startsWith("write:"));
  assert.ok(h.events.slice(firstWrite).every((event) => !event.startsWith("read:")), "layout reads are batched ahead of DOM/style writes");
  const nodes = [...h.gutter.children];
  h.reset(); h.context.renderLineNumbers();
  assert.deepEqual(h.gutter.children, nodes);
  assert.equal(h.stats.created, 0);
  assert.equal(h.stats.top, 0);
  assert.equal(h.stats.height, 0);
  assert.equal(h.stats.numbers, 0);
});

test("wrapped-line geometry, viewport resize, line count and scroll update only the affected gutter state", () => {
  const h = harness();
  h.context.renderSourceSyntax();
  h.highlight.children.forEach((node, index) => { node._top = 14 + index * 20; });
  h.context.renderLineNumbers();
  const first = h.gutter.children[0];
  h.highlight.children[1]._top = 74;
  h.highlight.children[2]._top = 94;
  h.source.scrollTop = 42;
  h.reset(); h.context.renderLineNumbers();
  assert.equal(h.stats.top, 2);
  assert.equal(h.gutter.scrollTop, 42);
  h.source.value = "first\nsecond\nthird\nfourth";
  h.context.renderSourceSyntax(); h.context.renderLineNumbers();
  assert.equal(h.gutter.children.length, 5);
  assert.deepEqual(h.gutter.children.slice(0, -1).map((node) => node.textContent), ["1", "2", "3", "4"]);
  h.source.value = "";
  h.context.renderSourceSyntax(); h.context.renderLineNumbers();
  assert.equal(h.gutter.children.length, 2);
  assert.equal(h.gutter.children[0], first);
  assert.equal(h.gutter.children[0].textContent, "1");
});
