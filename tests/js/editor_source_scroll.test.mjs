import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

const app = await readFile(new URL("../../src/fountain_publisher/web/app.mjs", import.meta.url), "utf8");

function functionsBetween(start, end) {
  const from = app.indexOf(start);
  const to = app.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `${start} must precede ${end}`);
  return app.slice(from, to);
}

function scrollHarness({ lineCount = 4 } = {}) {
  const calls = { classification: 0, preview: 0, syntax: 0, cache: 0, valueReads: 0, valueWrites: 0, selectionWrites: 0, gutterWrites: 0, overlaySizes: 0 };
  const frames = new Map();
  const listeners = new Map();
  let frameId = 0;
  let resize;
  let text = Array.from({ length: lineCount }, (_, index) => `Line ${index}`).join("\n");
  let disallowSourceRead = false;
  const rows = new Map(Array.from({ length: lineCount }, (_, index) => [index, { offsetTop: 14 + index * 20 }]));
  const source = {
    clientWidth: 400, clientHeight: 200, scrollWidth: 1000, scrollHeight: lineCount * 20 + 100,
    scrollTop: 0, scrollLeft: 0,
    selectionStart: 8, selectionEnd: 10, selectionDirection: "backward",
    get value() {
      calls.valueReads += 1;
      assert.equal(disallowSourceRead, false, "pure scrolling must not scan or serialize document text");
      return text;
    },
    set value(value) { calls.valueWrites += 1; text = value; },
    setSelectionRange() { calls.selectionWrites += 1; throw new Error("scrolling must not move the selection"); },
    addEventListener(type, handler, options) { listeners.set(type, { handler, options }); },
  };
  const highlight = {
    style: new Proxy({ width: "400px", height: "200px" }, {
      set(target, key, value) { calls.overlaySizes += 1; target[key] = value; return true; },
    }),
    clientWidth: 400, scrollWidth: 1000, scrollHeight: source.scrollHeight,
    scrollTop: 0, scrollLeft: 0,
    innerHTML: "Existing highlighted text",
  };
  const gutter = {
    scrollTop: 0,
    html: "Existing line numbers",
    set innerHTML(value) { calls.gutterWrites += 1; this.html = value; },
    get innerHTML() { return this.html; },
  };
  const currentLine = { style: {} };
  const remoteLayers = [{ scrollTop: 0, scrollLeft: 0, innerHTML: "Remote cursor markup" }];
  const remoteContainer = {};
  const cursor = { textContent: "" };
  const status = { textContent: "" };
  const computed = { lineHeight: "20px", paddingTop: "14px" };
  const sandbox = {
    source,
    $(selector, root) {
      if (root === highlight) return rows.get(Number(selector.match(/\d+/)?.[0]));
      return { "#source-highlight": highlight, "#line-numbers": gutter, "#current-line": currentLine, "#collaboration-cursors": remoteContainer, "#cursor-position": cursor, "#editor-status": status }[selector];
    },
    $$(selector, root) {
      assert.equal(selector, ".collaboration-cursor-layer");
      assert.equal(root, remoteContainer);
      return remoteLayers;
    },
    getComputedStyle: () => computed,
    requestAnimationFrame(callback) { const id = ++frameId; frames.set(id, callback); return id; },
    ResizeObserver: class {
      constructor(callback) { resize = callback; }
      observe(element) { assert.equal(element, source); }
    },
    classifyLines(value) { calls.classification += 1; return value.split("\n").map(() => ({ type: "action" })); },
    updatePreviewCursor() { calls.preview += 1; },
    renderSourceSyntax() { calls.syntax += 1; },
    scheduleWorkspaceViewCache() { calls.cache += 1; },
  };
  const code = [
    functionsBetween("function renderEditorChrome(", "function fountainSyntaxHtml("),
    functionsBetween("function boundedScrollLeft(", "function scrollPreviewTarget("),
    functionsBetween("let sourceCurrentLineIndex =", "function renderInsights("),
    functionsBetween('source.addEventListener("scroll",', "document.fonts?.ready"),
  ].join("\n");
  runInNewContext(code, sandbox);
  return {
    source, highlight, gutter, currentLine, remoteLayers, computed, rows, cursor, status, calls, sandbox, frames,
    disallowSourceRead(value = true) { disallowSourceRead = value; },
    scroll() { listeners.get("scroll").handler(); },
    resize() { resize(); },
    scrollOptions: listeners.get("scroll").options,
    flush() { for (const [id, callback] of [...frames]) { frames.delete(id); callback(); } },
    resetCalls() { for (const key of Object.keys(calls)) calls[key] = 0; },
  };
}

test("scroll bursts align the latest viewport once without scanning text or updating Preview", () => {
  const editor = scrollHarness({ lineCount: 5000 });
  editor.sandbox.updateCursor();
  const initialCursor = editor.cursor.textContent;
  const initialStatus = editor.status.textContent;
  editor.resetCalls();
  editor.disallowSourceRead();
  for (let event = 0; event < 200; event += 1) {
    editor.source.scrollTop = event * 3;
    editor.source.scrollLeft = event;
    editor.scroll();
  }
  assert.equal(editor.frames.size, 1);
  assert.equal(editor.highlight.scrollTop, 0, "scroll events defer geometry work to the animation frame");
  assert.equal(editor.scrollOptions.passive, true);
  editor.flush();
  assert.equal(editor.highlight.scrollTop, 597);
  assert.equal(editor.highlight.scrollLeft, 199);
  assert.equal(editor.gutter.scrollTop, 597);
  assert.equal(editor.remoteLayers[0].scrollTop, 597);
  assert.equal(editor.remoteLayers[0].scrollLeft, 199);
  assert.equal(editor.currentLine.style.transform, "translateY(-577px)");
  assert.equal(editor.calls.cache, 1);
  for (const key of ["classification", "preview", "syntax", "valueReads", "valueWrites", "selectionWrites", "gutterWrites", "overlaySizes"]) {
    assert.equal(editor.calls[key], 0, `${key} does not belong on the scroll hot path`);
  }
  assert.equal(editor.highlight.innerHTML, "Existing highlighted text");
  assert.equal(editor.gutter.innerHTML, "Existing line numbers");
  assert.equal(editor.remoteLayers[0].innerHTML, "Remote cursor markup");
  assert.equal(editor.cursor.textContent, initialCursor);
  assert.equal(editor.status.textContent, initialStatus);
  assert.deepEqual([editor.source.selectionStart, editor.source.selectionEnd, editor.source.selectionDirection], [8, 10, "backward"]);
});

test("a subsequent frame uses new scroll positions rather than a captured first-event snapshot", () => {
  const editor = scrollHarness();
  editor.disallowSourceRead();
  editor.source.scrollTop = 20;
  editor.scroll();
  editor.source.scrollTop = 50;
  editor.flush();
  assert.equal(editor.highlight.scrollTop, 50);
  editor.source.scrollTop = 75;
  editor.scroll();
  assert.equal(editor.frames.size, 1, "completed work does not leave a stuck frame flag");
  editor.source.scrollTop = 95;
  editor.source.scrollLeft = 88;
  editor.flush();
  assert.equal(editor.highlight.scrollTop, 95);
  assert.equal(editor.highlight.scrollLeft, 88);
  assert.equal(editor.calls.cache, 2);
});

test("scroll synchronization clamps horizontal offsets and aligns newly added remote layers", () => {
  const editor = scrollHarness();
  editor.disallowSourceRead();
  editor.source.scrollLeft = 900;
  editor.source.scrollTop = 120;
  editor.scroll();
  editor.remoteLayers.push({ innerHTML: "New remote cursor" });
  editor.flush();
  assert.equal(editor.source.scrollLeft, 600);
  assert.equal(editor.highlight.scrollLeft, 600);
  for (const layer of editor.remoteLayers) assert.deepEqual([layer.scrollTop, layer.scrollLeft], [120, 600]);
  editor.source.scrollLeft = -12;
  editor.scroll();
  editor.flush();
  assert.equal(editor.source.scrollLeft, 0);
  assert.equal(editor.highlight.scrollLeft, 0);
});

test("resize bursts refresh existing wrap geometry and gutter positions without rebuilding syntax or Preview", () => {
  const editor = scrollHarness();
  editor.sandbox.updateCursor();
  editor.resetCalls();
  for (let index = 0; index < 20; index += 1) editor.resize();
  assert.equal(editor.frames.size, 1);
  editor.source.clientWidth = 250;
  editor.source.clientHeight = 150;
  editor.highlight.clientWidth = 250;
  editor.source.scrollTop = 40;
  editor.rows.get(1).offsetTop = 94;
  editor.rows.get(2).offsetTop = 154;
  editor.flush();
  assert.equal(editor.highlight.style.width, "250px");
  assert.equal(editor.highlight.style.height, "150px");
  assert.equal(editor.currentLine.style.transform, "translateY(40px)");
  assert.match(editor.gutter.innerHTML, /top:94px">2<\/span>/);
  assert.match(editor.gutter.innerHTML, /top:154px">3<\/span>/);
  assert.equal(editor.calls.gutterWrites, 1);
  assert.equal(editor.calls.classification, 0);
  assert.equal(editor.calls.syntax, 0);
  assert.equal(editor.calls.preview, 0);
  assert.equal(editor.calls.valueWrites, 0);
  assert.equal(editor.calls.selectionWrites, 0);
  assert.equal(editor.calls.cache, 0, "resizing alone does not serialize the workspace");
});

test("resize and scroll share a frame without losing either resize work or the newest scroll coordinates", () => {
  const editor = scrollHarness();
  editor.scroll();
  editor.resize();
  editor.source.clientWidth = 320;
  editor.source.clientHeight = 180;
  editor.source.scrollTop = 71;
  editor.source.scrollLeft = 27;
  editor.flush();
  assert.equal(editor.frames.size, 0);
  assert.equal(editor.calls.gutterWrites, 1);
  assert.equal(editor.calls.cache, 1);
  assert.equal(editor.highlight.style.width, "320px");
  assert.equal(editor.highlight.style.height, "180px");
  assert.equal(editor.highlight.scrollTop, 71);
  assert.equal(editor.gutter.scrollTop, 71);
  assert.equal(editor.remoteLayers[0].scrollLeft, 27);
});

test("font/zoom and reflow measurements are fresh, not cached from an earlier layout", () => {
  const editor = scrollHarness();
  editor.sandbox.updateCursor();
  editor.resetCalls();
  editor.disallowSourceRead();
  editor.source.scrollTop = 12;
  editor.computed.lineHeight = "30px";
  editor.computed.paddingTop = "21px";
  editor.rows.get(1).offsetTop = 81;
  editor.scroll();
  editor.flush();
  assert.equal(editor.currentLine.style.height, "30px");
  assert.equal(editor.currentLine.style.transform, "translateY(48px)");
  assert.equal(editor.calls.valueReads, 0);
});

test("semantic cursor updates still refresh the status, Preview and subsequent scroll decoration", () => {
  const editor = scrollHarness();
  editor.source.selectionStart = editor.source.selectionEnd = 16;
  editor.source.selectionDirection = "forward";
  editor.sandbox.updateCursor({ scrollPreview: true });
  assert.equal(editor.cursor.textContent, "Ln 3, Col 3");
  assert.equal(editor.status.textContent, "Action");
  assert.equal(editor.calls.classification, 1);
  assert.equal(editor.calls.preview, 1);
  editor.resetCalls();
  editor.disallowSourceRead();
  editor.source.scrollTop = 9;
  editor.scroll();
  editor.flush();
  assert.equal(editor.currentLine.style.transform, "translateY(31px)");
  assert.equal(editor.calls.classification, 0);
  assert.equal(editor.calls.preview, 0);
});

test("pending scroll work observes newly rendered line nodes after typing or document replacement", () => {
  const editor = scrollHarness();
  editor.scroll();
  editor.source.value = "New first line\nNew second line";
  editor.source.selectionStart = editor.source.selectionEnd = 17;
  editor.rows.clear();
  editor.rows.set(0, { offsetTop: 14 });
  editor.rows.set(1, { offsetTop: 74 });
  editor.sandbox.renderEditorChrome();
  assert.equal(editor.calls.syntax, 1);
  assert.equal(editor.cursor.textContent, "Ln 2, Col 3");
  editor.resetCalls();
  editor.disallowSourceRead();
  editor.source.scrollTop = 15;
  editor.flush();
  assert.equal(editor.currentLine.style.transform, "translateY(45px)");
  assert.equal(editor.highlight.scrollTop, 15);
  assert.equal(editor.calls.classification, 0);
  assert.equal(editor.calls.syntax, 0);
  assert.equal(editor.calls.preview, 0);
});

test("overlay sizing does not repeat identical style writes and recovers after a hidden source panel", () => {
  const editor = scrollHarness();
  editor.sandbox.syncSourceOverlay();
  assert.equal(editor.calls.overlaySizes, 0);
  editor.source.clientWidth = editor.source.clientHeight = 0;
  editor.resize();
  editor.flush();
  assert.equal(editor.highlight.style.width, "");
  assert.equal(editor.highlight.style.height, "");
  editor.source.clientWidth = 510;
  editor.source.clientHeight = 240;
  editor.resize();
  editor.flush();
  assert.equal(editor.highlight.style.width, "510px");
  assert.equal(editor.highlight.style.height, "240px");
  assert.equal(editor.calls.syntax, 0);
  assert.equal(editor.calls.preview, 0);
});
