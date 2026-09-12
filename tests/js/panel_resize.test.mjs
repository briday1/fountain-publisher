import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

const app = await readFile(new URL("../../src/fountain_publisher/web/app.mjs", import.meta.url), "utf8");
const start = app.indexOf("function installResizer(");
const code = app.slice(start, app.indexOf("function clampPreviewScroll(", start));

function harness() {
  const events = {}, frames = new Map(), widths = [], geometry = [], stored = [];
  let captured = false, frame = 0, zooms = 0, width = "370px";
  const element = { addEventListener: (type, handler) => { events[type] = handler; }, setPointerCapture() { captured = true; }, hasPointerCapture: () => captured, setAttribute() {} };
  const context = {
    document: { documentElement: { style: { setProperty(_key, value) { widths.push(value); width = value; } } } },
    localStorage: { setItem(_key, value) { stored.push(value); } },
    getComputedStyle: () => ({ getPropertyValue: () => width }),
    state: { previewZoom: "fit" },
    requestAnimationFrame: callback => { const id = ++frame; frames.set(id, callback); return id; },
    cancelAnimationFrame: id => frames.delete(id),
    scheduleSourceGeometry: options => geometry.push(options),
    applyZoom: () => zooms++,
    renderEditorChrome() { assert.fail("Resizing must not reparse or recreate source text"); },
  };
  runInNewContext(code, context);
  context.installResizer(element, "--source-w", 1, 250, 600);
  return { events, frames, widths, geometry, stored, zooms: () => zooms };
}

test("panel drag batches pointer bursts into one latest-width geometry update", () => {
  const h = harness();
  h.events.pointermove({ pointerId: 1, clientX: 500 });
  assert.equal(h.frames.size, 0);
  h.events.pointerdown({ pointerId: 1, clientX: 100 });
  for (let x = 101; x <= 140; ++x) h.events.pointermove({ pointerId: 1, clientX: x });
  assert.equal(h.frames.size, 1);
  assert.deepEqual(h.widths, []);
  [...h.frames.values()][0]();
  assert.deepEqual(h.widths, ["410px"]);
  assert.equal(h.geometry.length, 1);
  assert.equal(h.geometry[0].resize, true);
  assert.equal(h.zooms(), 1);
  assert.deepEqual(h.stored, ["410"]);
});

test("drag completion flushes final coordinates once and keeps keyboard sizing immediate", () => {
  const h = harness();
  h.events.pointerdown({ pointerId: 1, clientX: 100 });
  h.events.pointermove({ pointerId: 1, clientX: 800 });
  h.events.pointerup(); h.events.lostpointercapture();
  assert.equal(h.frames.size, 0);
  assert.deepEqual(h.widths, ["600px"]);
  h.events.keydown({ key: "Home", preventDefault() {} });
  assert.deepEqual(h.widths, ["600px", "250px"]);
  h.events.dblclick();
  assert.equal(h.widths.at(-1), "370px");
});
