import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

const app = await readFile(new URL("../../src/fountain_publisher/web/app.mjs", import.meta.url), "utf8");
const start = app.indexOf("function persistWorkspaceNow(");
const end = app.indexOf("const DOT_DIRECTIONS", start);
assert.ok(start >= 0 && end > start);

function harness({ idle = true } = {}) {
  let id = 0;
  const timers = new Map(), callbacks = new Map(), writes = [];
  const state = { cacheEnabled: true, cacheTimer: 0, viewCacheTimer: 0, viewCacheIdle: 0, filename: "Draft.fountain", savedSource: "saved", previewMode: "live" };
  const source = { value: "unsaved text", selectionStart: 0, selectionEnd: 0, scrollTop: 0 };
  const preview = { scrollTop: 0, scrollLeft: 0 };
  const context = {
    state, source, WORKSPACE_CACHE_KEY: "workspace", Date, JSON,
    $: () => preview,
    localStorage: { setItem(key, value) { writes.push(JSON.parse(value)); }, removeItem() { writes.length = 0; }, getItem() { return null; } },
    setTimeout(callback, delay) { const key = ++id; timers.set(key, { callback, delay }); return key; },
    clearTimeout(key) { timers.delete(key); },
    window: idle ? {
      requestIdleCallback(callback, options) { const key = ++id; callbacks.set(key, { callback, options }); return key; },
      cancelIdleCallback(key) { callbacks.delete(key); },
    } : {},
  };
  runInNewContext(app.slice(start, end), context);
  const fireTimer = key => { const { callback } = timers.get(key); timers.delete(key); callback(); };
  const fireIdle = () => { for (const [key, { callback }] of [...callbacks]) { callbacks.delete(key); callback(); } };
  return { context, state, source, preview, writes, timers, callbacks, fireTimer, fireIdle };
}

test("scroll-only recovery saves debounce to one idle write with latest viewport", () => {
  const h = harness();
  for (let top = 1; top <= 100; ++top) { h.preview.scrollTop = top; h.context.scheduleWorkspaceViewCache(); }
  assert.equal(h.writes.length, 0);
  assert.equal(h.timers.size, 1);
  const [timer, { delay }] = [...h.timers][0];
  assert.equal(delay, 700);
  h.fireTimer(timer);
  assert.equal(h.writes.length, 0);
  assert.equal(h.callbacks.size, 1);
  assert.equal([...h.callbacks.values()][0].options.timeout, 1500);
  h.fireIdle();
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0].previewScrollTop, 100);
  assert.equal(h.writes[0].source, "unsaved text");
});

test("scrolling never postpones the prompt document-edit backup", () => {
  const h = harness();
  h.context.scheduleWorkspaceCache();
  const key = h.state.cacheTimer;
  for (let index = 0; index < 20; ++index) h.context.scheduleWorkspaceViewCache();
  assert.equal(h.timers.size, 1);
  assert.equal(h.state.cacheTimer, key);
  assert.equal(h.timers.get(key).delay, 120);
  h.source.value = "latest committed edit";
  h.fireTimer(key);
  assert.equal(h.writes[0].source, "latest committed edit");
  assert.equal(h.state.cacheTimer, 0);
});

test("new edits cancel deferred view backups and keep one prompt save", () => {
  const h = harness();
  h.context.scheduleWorkspaceViewCache();
  h.fireTimer(h.state.viewCacheTimer);
  assert.equal(h.callbacks.size, 1);
  h.context.scheduleWorkspaceCache();
  assert.equal(h.callbacks.size, 0);
  assert.equal(h.timers.size, 1);
  h.fireTimer(h.state.cacheTimer);
  assert.equal(h.writes.length, 1);
});

test("continuing scrolling cancels an idle save that has not run yet", () => {
  const h = harness();
  h.context.scheduleWorkspaceViewCache();
  h.fireTimer(h.state.viewCacheTimer);
  h.context.scheduleWorkspaceViewCache();
  assert.equal(h.callbacks.size, 0);
  assert.equal(h.timers.size, 1);
  assert.equal(h.writes.length, 0);
});

test("explicit flush saves immediately and cancels every delayed write", () => {
  const h = harness();
  h.context.scheduleWorkspaceViewCache();
  h.fireTimer(h.state.viewCacheTimer);
  h.context.persistWorkspaceNow();
  assert.equal(h.writes.length, 1);
  assert.equal(h.callbacks.size, 0);
  assert.equal(h.timers.size, 0);
});

test("clear-on-exit cannot be undone by a late idle callback", () => {
  const h = harness();
  h.context.scheduleWorkspaceViewCache();
  h.fireTimer(h.state.viewCacheTimer);
  h.context.clearWorkspaceCache();
  h.fireIdle();
  assert.equal(h.callbacks.size, 0);
  assert.equal(h.timers.size, 0);
  assert.equal(h.writes.length, 0);
});

test("view saves work without requestIdleCallback and disabled recovery never schedules", () => {
  const h = harness({ idle: false });
  h.context.scheduleWorkspaceViewCache();
  h.fireTimer(h.state.viewCacheTimer);
  assert.equal(h.writes.length, 1);
  h.state.cacheEnabled = false;
  h.context.scheduleWorkspaceViewCache(); h.context.scheduleWorkspaceCache();
  assert.equal(h.timers.size, 0);
});
