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
const backgroundCode = app.slice(app.indexOf("const DOT_DIRECTIONS ="), app.indexOf("function escapeHtml("));

function applicationBackgrounds() {
  const clock = frames();
  const motion = { matches: false, addEventListener() {} };
  const document = { hidden: false, documentElement: { dataset: { effectiveTheme: "dark" } },
    body: { classList: { contains: () => false } }, addEventListener() {} };
  const state = { previewMode: "live" };
  const observers = [];
  class MutationObserver {
    constructor(callback) { this.callback = callback; this.targets = new Map(); observers.push(this); }
    observe(target, options) { this.targets.set(target, options); }
  }
  class ResizeObserver { observe() {} }
  function attributeChanged(target, attributeName) {
    for (const observer of observers) {
      if (observer.targets.get(target)?.attributeFilter.includes(attributeName)) observer.callback([{ target, attributeName }]);
    }
  }
  const dialogs = ["background-dialog", "annotation-dialog", "character-note-dialog", "general-note-dialog", "export-dialog"].map((id) => ({
    id, open: false, contains(element) { return element.dialog === this; },
  }));
  const settingsDialog = dialogs[0];
  let mobile = false;
  function element({ hidden = false, preview = false, dialog = null, width = 1440, height = 900 } = {}) {
    const calls = { clear: 0, bounds: 0, inheritedWrites: 0, draw: 0, transforms: 0 };
    const context = new Proxy({}, { get(target, key) { return target[key] ?? (() => { if (key === "clearRect") calls.clear += 1; else calls.draw += 1; }); } });
    let transform = "";
    return { hidden, preview, dialog, calls, width: 0, height: 0,
      style: { get transform() { return transform; }, set transform(value) { transform = value; calls.transforms += 1; },
        setProperty() { calls.inheritedWrites += 1; } },
      closest(selector) { return selector === ".preview-panel" ? (this.preview ? {} : null) : this.hidden || (this.dialog && !this.dialog.open) ? {} : null; },
      getClientRects() { return this.hidden ? [] : [{}]; },
      getBoundingClientRect() { calls.bounds += 1; return { width, height }; },
      getContext() { return context; },
    };
  }
  const visible = element({ preview: true });
  const hiddenPanel = element({ hidden: true });
  const closedDialog = element({ dialog: settingsDialog, width: 300, height: 92 });
  const dots = [element({ preview: true }), element({ hidden: true }), element({ dialog: settingsDialog })];
  const canvases = [visible, hiddenPanel, closedDialog];
  const panels = new Map(["#source-panel", "#beat-sheet-panel", ".preview-panel", "#preview-scroll"].map((selector) => [selector, {}]));
  const sandbox = vm.createContext({
    backgroundBitmapSize, backgroundElementVisible, backgroundTileGrid, createBackgroundLoop,
    document, state, devicePixelRatio: 2, MutationObserver, ResizeObserver,
    requestAnimationFrame: clock.requestFrame, cancelAnimationFrame: clock.cancelFrame,
    matchMedia: () => motion, isMobilePreview: () => mobile,
    $: (selector) => { assert.ok(panels.has(selector), `Unknown panel ${selector}`); return panels.get(selector); },
    $$: (selector) => {
      if (selector === "dialog") return dialogs;
      if (selector === "dialog[open]") return dialogs.filter((dialog) => dialog.open);
      if (selector === ".background-dots-layer") return dots;
      assert.equal(selector, ".hyperspace-canvas");
      return canvases;
    },
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
  return { clock, configure, refresh, motion, document, state, visible, hiddenPanel, closedDialog, dots, dialogs, observers, attributeChanged,
    setDialogOpen(dialog, open) { dialog.open = open; attributeChanged(dialog, "open"); },
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
  app.setDialogOpen(app.dialogs[0], true);
  app.clock.tick(1000);
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

for (const pattern of ["hyperspace", "tiles", "geometric", "dots"]) {
  test(`${pattern} workspace decoration pauses for every note modal and resumes on close`, () => {
    const app = applicationBackgrounds();
    const surface = pattern === "dots" ? app.dots[0] : app.visible;
    const draws = () => pattern === "dots" ? surface.calls.transforms : surface.calls.clear;
    app.configure(pattern);
    let time = 0;
    for (const dialog of app.dialogs.slice(1)) {
      app.clock.tick(time);
      app.clock.tick(time + 34);
      const before = draws();
      const bounds = surface.calls.bounds;
      const staleFrame = app.clock.callback;
      app.setDialogOpen(dialog, true);
      staleFrame(time + 68);
      app.clock.tick(time + 68);
      assert.equal(draws(), before, `${dialog.id} must stop decoration beneath its backdrop`);
      assert.equal(surface.calls.bounds, bounds, "covered decoration must not incur new layout reads");
      assert.equal(app.clock.pending, 0, "an open note modal must leave no background animation queued");
      for (let frame = 0; frame < 120; frame += 1) app.clock.tick(time + 100 + frame * 1000 / 120);
      assert.equal(draws(), before);
      app.setDialogOpen(dialog, false);
      app.clock.tick(time + 1200);
      assert.ok(draws() > before, "closing the modal must restore the chosen background");
      assert.equal(app.clock.pending, 1);
      time += 1300;
    }
  });

  test(`${pattern} settings preview animates without animating covered workspace`, () => {
    const app = applicationBackgrounds();
    const workspace = pattern === "dots" ? app.dots[0] : app.visible;
    const preview = pattern === "dots" ? app.dots[2] : app.closedDialog;
    const draws = (surface) => pattern === "dots" ? surface.calls.transforms : surface.calls.clear;
    app.configure(pattern);
    const before = draws(workspace);
    app.setDialogOpen(app.dialogs[0], true);
    for (let frame = 0; frame < 120; frame += 1) app.clock.tick(frame * 1000 / 120);
    assert.equal(draws(workspace), before);
    assert.ok(draws(preview) > 20, "the background settings preview must remain animated");
    const previewBefore = draws(preview);
    app.setDialogOpen(app.dialogs[1], true);
    app.clock.tick(1000);
    assert.equal(app.clock.pending, 0, "another modal over settings pauses its preview too");
    assert.equal(draws(preview), previewBefore);
    app.setDialogOpen(app.dialogs[1], false);
    app.clock.tick(1034);
    assert.ok(draws(preview) > previewBefore);
    assert.equal(draws(workspace), before);
    app.setDialogOpen(app.dialogs[0], false);
    app.clock.tick(1068);
    assert.ok(draws(workspace) > before);
    assert.equal(draws(preview), previewBefore + 1, "closing settings stops its preview");
  });
}

test("modal visibility observes only each dialog's open attribute, not editor DOM mutations", () => {
  const app = applicationBackgrounds();
  const [observer] = app.observers;
  assert.equal(app.observers.length, 1);
  for (const dialog of app.dialogs) {
    const options = observer.targets.get(dialog);
    assert.equal(options.attributes, true);
    assert.deepEqual([...options.attributeFilter], ["open"]);
  }
  for (const options of observer.targets.values()) {
    assert.ok(!options.subtree && !options.childList && !options.characterData,
      "typing and source syntax updates must not trigger a document-wide observer");
  }
  app.configure("tiles");
  const queued = app.clock.callback;
  app.attributeChanged(app.dialogs[1], "class");
  app.attributeChanged({}, "class");
  assert.equal(app.clock.callback, queued, "unrelated attributes must not restart animation");
});
