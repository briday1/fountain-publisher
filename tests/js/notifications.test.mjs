import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

const web = new URL("../../src/fountain_publisher/web/", import.meta.url);
const [html, css, app] = await Promise.all(["index.html", "styles.css", "app.mjs"].map((path) => readFile(new URL(path, web), "utf8")));
function declarations(selector) {
  const rule = [...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((match) => match[1].trim() === selector);
  assert.ok(rule, `Missing ${selector} rule`);
  return Object.fromEntries(rule[2].split(";").filter((item) => item.trim()).map((item) => {
    const colon = item.indexOf(":");
    return [item.slice(0, colon).trim(), item.slice(colon + 1).trim()];
  }));
}

test("notifications live outside the workspace and every hideable editor panel", () => {
  assert.equal([...html.matchAll(/id="toast"/g)].length, 1);
  assert.ok(/<\/main>\s*<div id="toast"[^>]*><\/div>/.test(html), "toast must be a sibling after the workspace, not inside a panel");
  const toast = html.match(/<div id="toast"[^>]*>/)[0];
  assert.match(toast, /role="status"/);
  assert.match(toast, /aria-live="polite"/);
  assert.match(toast, /aria-atomic="true"/);
  assert.doesNotMatch(toast, /\b(?:tabindex|hidden|contenteditable)=?/);
});

test("notification overlay stays above document layers without catching editor input", () => {
  const toast = declarations(".toast");
  assert.equal(toast.width, "max-content");
  assert.equal(toast.position, "fixed");
  assert.equal(toast["pointer-events"], "none");
  for (const selector of [".beat-guide-layer", ".preview-context-menu", ".app-toolbar"]) {
    assert.ok(Number(toast["z-index"]) > Number(declarations(selector)["z-index"]), selector);
  }
  assert.equal(toast.opacity, "0");
  assert.equal(declarations(".toast.show").opacity, "1");
});

test("notification bounds follow the visible viewport and wrap long filenames", () => {
  const toast = declarations(".toast");
  assert.match(toast.top, /var\(--visual-viewport-top\).*var\(--visual-viewport-height\)/);
  assert.match(toast.top, /safe-area-inset-bottom/);
  assert.match(toast.left, /var\(--visual-viewport-left\).*var\(--visual-viewport-width\)/);
  assert.match(toast["max-width"], /var\(--visual-viewport-width\)/);
  assert.match(toast["max-height"], /var\(--visual-viewport-height\)/);
  assert.equal(toast["overflow-wrap"], "anywhere");
  assert.equal(toast["white-space"], "normal");
  assert.equal(declarations(".toast.show").transform, "translate(-50%, -100%)");
});

function notificationHarness() {
  const timers = new Map(), classes = new Set();
  let next = 0;
  const element = {
    textContent: "", classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name) },
    focus() { assert.fail("Notifications must not steal editor focus"); },
    set innerHTML(_value) { assert.fail("Notification messages must remain plain text"); },
  };
  const context = {
    $: (selector) => { assert.equal(selector, "#toast"); return element; },
    setTimeout: (callback, delay) => { timers.set(++next, { callback, delay }); return next; },
    clearTimeout: (id) => timers.delete(id),
  };
  runInNewContext(app.slice(app.indexOf("let toastTimer;"), app.indexOf("function sourceLines()")), context);
  return { toast: context.toast, element, classes, timers };
}

test("save and restore notifications are plain text and disappear without moving focus", () => {
  const h = notificationHarness();
  for (const message of ["Workspace restored", "Saved to Drive", "Saved <example>.fountain"]) {
    h.toast(message);
    assert.equal(h.element.textContent, message);
    assert.ok(h.classes.has("show"));
    const timer = [...h.timers.values()].at(-1);
    assert.equal(timer.delay, 2200);
    timer.callback();
    assert.equal(h.classes.has("show"), false);
  }
});

test("a newer notification cancels the old dismissal timer", () => {
  const h = notificationHarness();
  h.toast("Workspace restored");
  const firstTimer = [...h.timers.keys()][0];
  h.toast("Saved to Drive");
  assert.equal(h.timers.has(firstTimer), false);
  assert.equal(h.timers.size, 1);
  assert.equal(h.element.textContent, "Saved to Drive");
  assert.ok(h.classes.has("show"));
});
