import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";
import {
  BACKGROUND_FPS, BACKGROUND_PIXEL_BUDGET, backgroundBitmapSize,
  backgroundElementVisible, backgroundTileGrid, createBackgroundLoop,
} from "../../src/fountain_publisher/web/background-performance.mjs";

function frames() {
  let next = 0;
  const queued = new Map();
  return {
    requestFrame(callback) { queued.set(++next, callback); return next; },
    cancelFrame(id) { queued.delete(id); },
    tick(time) { const pending = [...queued.values()]; queued.clear(); pending.forEach((callback) => callback(time)); },
    get pending() { return queued.size; },
    get callback() { return queued.values().next().value; },
  };
}

test("background animation is capped independently of monitor refresh rate", () => {
  for (const refreshRate of [60, 120, 144, 240]) {
    const clock = frames();
    const draws = [];
    const loop = createBackgroundLoop(clock);
    loop.start((time, dt) => draws.push({ time, dt }));
    for (let frame = 0; frame <= refreshRate; frame += 1) clock.tick(frame * 1000 / refreshRate);
    assert.ok(draws.length <= BACKGROUND_FPS + 1, `${refreshRate}Hz produced ${draws.length} draws`);
    assert.ok(draws.length >= 25, "decorations must still animate");
    assert.ok(draws.at(-1).time <= 1001, "elapsed animation time must not run faster than real time");
  }
});

test("static/reduced-motion frame schedules no recurring work", () => {
  const clock = frames();
  let draws = 0;
  createBackgroundLoop(clock).start(() => { draws += 1; }, { animated: false });
  assert.equal(draws, 1);
  assert.equal(clock.pending, 0);
});

test("pause cancels old callbacks and resuming does not fast-forward motion", () => {
  const clock = frames();
  const loop = createBackgroundLoop(clock);
  const deltas = [];
  loop.start((time, dt) => deltas.push(dt));
  clock.tick(0);
  const stale = clock.callback;
  loop.stop();
  stale(1000);
  assert.equal(clock.pending, 0);
  assert.equal(deltas.length, 1);
  loop.start((time, dt) => deltas.push(dt));
  clock.tick(60000);
  clock.tick(60034);
  assert.ok(deltas.at(-1) < .04);
});

test("a callback cannot resurrect the loop after stopping it", () => {
  const clock = frames();
  const loop = createBackgroundLoop(clock);
  loop.start(() => loop.stop());
  assert.equal(clock.pending, 0);
  loop.start((time, dt) => { if (dt) loop.stop(); });
  clock.tick(0);
  clock.tick(34);
  assert.equal(clock.pending, 0);
});

test("4K/5K/ultrawide and high-DPI backgrounds have a bounded bitmap", () => {
  for (const [width, height, dpr] of [[1440, 900, 2], [3840, 2160, 2], [5120, 2880, 2], [7680, 2160, 3], [390, 844, 3]]) {
    const bitmap = backgroundBitmapSize(width, height, dpr);
    assert.ok(bitmap.width * bitmap.height <= BACKGROUND_PIXEL_BUDGET);
    assert.ok(bitmap.width <= 2048 && bitmap.height <= 2048);
    assert.ok(Math.abs(bitmap.width / bitmap.height - width / height) < .02);
  }
});

test("tile work is bounded at every supported density and display size", () => {
  for (const density of [30, 100, 240]) {
    for (const [width, height] of [[1440, 900], [3840, 2160], [5120, 2880], [7680, 2160]]) {
      const { columns, rows, unit } = backgroundTileGrid(width, height, density);
      assert.ok(columns * rows <= 900);
      assert.ok(unit >= 24);
    }
  }
});

test("visibility rejects hidden ancestors, closed dialogs, CSS-hidden surfaces and hidden tabs", () => {
  const element = { closest: () => null, getClientRects: () => [{}] };
  assert.equal(backgroundElementVisible(element), true);
  assert.equal(backgroundElementVisible(element, true), false);
  element.closest = (selector) => selector.includes("dialog:not([open])") ? {} : null;
  assert.equal(backgroundElementVisible(element), false);
  element.closest = () => null;
  element.getClientRects = () => [];
  assert.equal(backgroundElementVisible(element), false);
});

const app = await readFile(new URL("../../src/fountain_publisher/web/app.mjs", import.meta.url), "utf8");
const backgroundCode = app.slice(app.indexOf("const DOT_DIRECTIONS ="), app.indexOf("const backgroundResizeObserver ="));

function applicationBackgrounds() {
  const clock = frames();
  const motion = { matches: false };
  const document = { hidden: false, documentElement: { dataset: { effectiveTheme: "dark" } } };
  const state = { previewMode: "live" };
  let mobile = false;
  function element({ hidden = false, preview = false, width = 1440, height = 900 } = {}) {
    const calls = { clear: 0, bounds: 0, inheritedWrites: 0, draw: 0 };
    const context = new Proxy({}, { get(target, key) { return target[key] ?? (() => { if (key === "clearRect") calls.clear += 1; else calls.draw += 1; }); } });
    return { hidden, preview, calls, width: 0, height: 0,
      style: { transform: "", setProperty() { calls.inheritedWrites += 1; } },
      closest(selector) { return selector === ".preview-panel" ? (this.preview ? {} : null) : this.hidden ? {} : null; },
      getClientRects() { return this.hidden ? [] : [{}]; },
      getBoundingClientRect() { calls.bounds += 1; return { width, height }; },
      getContext() { return context; },
    };
  }
  const visible = element({ preview: true });
  const hiddenPanel = element({ hidden: true });
  const closedDialog = element({ hidden: true, width: 300, height: 92 });
  const dots = [element({ preview: true }), element({ hidden: true })];
  const canvases = [visible, hiddenPanel, closedDialog];
  const sandbox = vm.createContext({
    backgroundBitmapSize, backgroundElementVisible, backgroundTileGrid, createBackgroundLoop,
    document, state, devicePixelRatio: 2,
    requestAnimationFrame: clock.requestFrame, cancelAnimationFrame: clock.cancelFrame,
    matchMedia: () => motion, isMobilePreview: () => mobile,
    $$: (selector) => selector === ".background-dots-layer" ? dots : canvases,
    getComputedStyle: () => ({ getPropertyValue: () => "#ffffff" }),
  });
  vm.runInContext(backgroundCode, sandbox);
  const configure = vm.runInContext(`(pattern, speed = 20) => {
    currentBackgroundPattern = pattern;
    ambientPattern = pattern;
    hyperspaceSpeed = ambientSpeed = speed;
    startDotMotion("down", speed);
    refreshBackgroundRendering();
  }`, sandbox);
  const refresh = vm.runInContext("refreshBackgroundRendering", sandbox);
  return { clock, configure, refresh, motion, document, state, visible, hiddenPanel, closedDialog, dots,
    setMobile(value) { mobile = value; },
  };
}

test("actual renderer draws only visible canvases and caches geometry across frames", () => {
  const app = applicationBackgrounds();
  app.configure("tiles");
  for (let index = 0; index < 120; index += 1) app.clock.tick(index * 1000 / 120);
  assert.ok(app.visible.calls.clear > 20);
  assert.equal(app.visible.calls.bounds, 1, "animation must not force a layout measurement every frame");
  assert.equal(app.hiddenPanel.calls.clear, 0);
  assert.equal(app.closedDialog.calls.clear, 0);
  app.closedDialog.hidden = false;
  app.refresh();
  assert.equal(app.closedDialog.calls.clear, 1, "opening the dialog renders its preview");
});

test("actual renderer stops for hidden tab/PDF and resumes without resetting preferences", () => {
  const app = applicationBackgrounds();
  app.configure("hyperspace");
  app.document.hidden = true;
  app.refresh();
  assert.equal(app.clock.pending, 0);
  app.document.hidden = false;
  app.state.previewMode = "pdf";
  app.refresh();
  assert.equal(app.clock.pending, 0, "PDF fully covers the workspace decoration");
  app.state.previewMode = "live";
  app.refresh();
  assert.equal(app.clock.pending, 1);
});

test("actual renderer reacts to reduced motion and uses static frames on mobile", () => {
  const app = applicationBackgrounds();
  app.configure("geometric");
  app.motion.matches = true;
  app.refresh();
  assert.equal(app.clock.pending, 0);
  app.motion.matches = false;
  app.refresh();
  assert.equal(app.clock.pending, 1);
  app.setMobile(true);
  app.refresh();
  assert.equal(app.clock.pending, 0);
});

test("moving dots touch only visible dedicated transforms, never inherited surface styles", () => {
  const app = applicationBackgrounds();
  app.configure("dots");
  app.clock.tick(0);
  app.clock.tick(34);
  assert.match(app.dots[0].style.transform, /translate3d\(0\.00px, 0\.17px, 0\)/);
  assert.equal(app.dots[1].style.transform, "");
  assert.equal(app.dots[0].calls.inheritedWrites, 0);
  app.configure("dots", 0);
  assert.equal(app.clock.pending, 0, "zero speed must stop an already running direction");
});
