import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";

const app = await readFile(new URL("../../src/fountain_publisher/web/app.mjs", import.meta.url), "utf8");

function section(start, end) {
  const offset = app.indexOf(start);
  assert.notEqual(offset, -1, start);
  const limit = app.indexOf(end, offset);
  assert.notEqual(limit, -1, end);
  return app.slice(offset, limit);
}

// Exercise real key dispatch as well as its helpers. Testing helpers alone misses
// commands that exist in the file but are shadowed by earlier key handlers.
const vimCode = [
  section("function setVimMode(", "function previewTextPoint("),
  section("function moveVimCursor(", 'source.addEventListener("input"'),
].join("\n");

function editor(value, cursor = 0, surface = "source") {
  const state = {
    vimMode: "normal", vimPending: "", vimYank: "", vimYankLine: false,
    vimVisualLine: false, vimVisualAnchor: cursor, vimVisualFocus: cursor,
  };
  const source = {
    value, selectionStart: cursor, selectionEnd: cursor, selectionDirection: "none",
    setSelectionRange(start, end, direction = "none") {
      this.selectionStart = start;
      this.selectionEnd = end;
      this.selectionDirection = direction;
    },
  };
  const calls = { mutations: [], focus: [], undo: 0, redo: 0, halfPage: 0 };
  const context = {
    state, source,
    vimActive: () => true,
    sourceLines: () => source.value.split("\n"),
    sourceOffsetForLine: (lines, line, column) => lines.slice(0, line).reduce((total, text) => total + text.length + 1, 0) + column,
    hideCompletions() {}, hidePreviewCompletions() {}, updateVimUi() {},
    syncVimPreviewPosition() {},
    focusVimCursor(previewFocus, offset = source.selectionStart) {
      source.setSelectionRange(offset, offset);
      calls.focus.push(previewFocus);
    },
    changeVimSource(next, offset, previewFocus) {
      calls.mutations.push({ before: source.value, after: next, previewFocus });
      source.value = next;
      source.setSelectionRange(offset, offset);
    },
    focusVimSelection(_previewFocus, anchor, focus) {
      state.vimVisualAnchor = anchor;
      state.vimVisualFocus = focus;
      const range = context.vimVisualRange(anchor, focus);
      source.setSelectionRange(range.start, range.end, focus < anchor ? "backward" : "forward");
    },
    undoDocument() { calls.undo += 1; },
    redoDocument() { calls.redo += 1; },
    moveVimHalfPage() { calls.halfPage += 1; },
  };
  runInNewContext(vimCode, context);
  return {
    state, source, calls,
    key(key, options = {}) {
      let prevented = false;
      const handled = context.handleVimKey({
        key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false,
        ...options, preventDefault() { prevented = true; },
      }, surface);
      return { handled, prevented };
    },
    keys(sequence) { for (const key of sequence) this.key(key); },
  };
}

for (const surface of ["source", "preview"]) {
  for (const command of [
    { keys: "dw", value: "foo bar", cursor: 0, result: "bar", yank: "foo ", mode: "normal" },
    { keys: "dw", value: "foo, bar", cursor: 0, result: ", bar", yank: "foo", mode: "normal" },
    { keys: "de", value: "foo bar", cursor: 0, result: " bar", yank: "foo", mode: "normal" },
    { keys: "db", value: "foo bar", cursor: 6, result: "foo r", yank: "ba", mode: "normal" },
    { keys: "diw", value: "alpha beta gamma", cursor: 8, result: "alpha  gamma", yank: "beta", mode: "normal" },
    { keys: "caw", value: "alpha beta gamma", cursor: 8, result: "alpha gamma", yank: "beta ", mode: "insert" },
    { keys: "ciw", value: "alpha beta gamma", cursor: 8, result: "alpha  gamma", yank: "beta", mode: "insert" },
    { keys: "cw", value: "foo bar", cursor: 0, result: " bar", yank: "foo", mode: "insert" },
    { keys: "yiw", value: "alpha beta gamma", cursor: 8, result: "alpha beta gamma", yank: "beta", mode: "normal" },
    { keys: "yw", value: "foo, bar", cursor: 0, result: "foo, bar", yank: "foo", mode: "normal" },
  ]) {
    test(`${surface}: ${command.keys} on ${JSON.stringify(command.value)} dispatches the operator`, () => {
      const document = editor(command.value, command.cursor, surface);
      document.keys(command.keys);
      assert.equal(document.source.value, command.result);
      assert.equal(document.state.vimYank, command.yank);
      assert.equal(document.state.vimMode, command.mode);
      assert.equal(document.state.vimPending, "");
      assert.equal(document.calls.mutations.length, command.keys.startsWith("y") ? 0 : 1);
      if (document.calls.mutations.length) assert.equal(document.calls.mutations[0].previewFocus, surface === "preview");
    });
  }
}

test("an operator text-object prefix waits for its object without entering Insert mode", () => {
  const document = editor("alpha beta", 8);
  document.keys("ci");
  assert.equal(document.state.vimMode, "normal");
  assert.equal(document.state.vimPending, "ci");
  assert.equal(document.source.value, "alpha beta");
  document.key("w");
  assert.equal(document.state.vimMode, "insert");
  assert.equal(document.state.vimPending, "");
  assert.equal(document.source.value, "alpha ");
  document.key("Escape");
  assert.equal(document.state.vimMode, "normal");
});

test("standalone w finds a real word boundary, not the start of a sliced string", () => {
  const document = editor("alpha beta gamma");
  document.key("w");
  assert.equal(document.source.selectionStart, 6);
  document.key("w");
  assert.equal(document.source.selectionStart, 11);
  document.key("b");
  assert.equal(document.source.selectionStart, 6);
  document.key("e");
  assert.equal(document.source.selectionStart, 9);
  assert.equal(document.source.value, "alpha beta gamma");
});

test("Escape cancels complete and partial operator prefixes", () => {
  for (const prefix of ["d", "di", "ca", "yi"]) {
    const document = editor("alpha beta");
    document.keys(prefix);
    document.key("Escape");
    document.key("w");
    assert.equal(document.source.value, "alpha beta", prefix);
    assert.equal(document.source.selectionStart, 6, prefix);
    assert.equal(document.state.vimPending, "", prefix);
    assert.equal(document.state.vimMode, "normal", prefix);
  }
});

test("unsupported operator continuations cancel without running unrelated editing commands", () => {
  for (const keys of ["dx", "dia", "cae"]) {
    const document = editor("alpha beta");
    document.keys(keys);
    assert.equal(document.source.value, "alpha beta", keys);
    assert.equal(document.state.vimPending, "", keys);
    assert.equal(document.state.vimMode, "normal", keys);
  }
});

test("holding Shift preserves an operator prefix for uppercase WORD text objects", () => {
  const document = editor("foo-bar baz", 2);
  document.keys("di");
  assert.equal(document.key("Shift").handled, false);
  assert.equal(document.state.vimPending, "di");
  document.key("W", { shiftKey: true });
  assert.equal(document.source.value, " baz");
  assert.equal(document.state.vimYank, "foo-bar");
});

test("application shortcuts and Ctrl-R cancel pending operators", () => {
  for (const options of [{ metaKey: true }, { ctrlKey: true }]) {
    const document = editor("alpha beta");
    document.keys("di");
    assert.deepEqual(document.key("s", options), { handled: false, prevented: false });
    document.key("w");
    assert.equal(document.source.value, "alpha beta");
    assert.equal(document.state.vimPending, "");
  }
  const document = editor("alpha beta");
  document.key("d");
  document.key("r", { ctrlKey: true });
  assert.equal(document.calls.redo, 1);
  assert.equal(document.state.vimPending, "");
});

test("doubled operators and standalone insert commands still dispatch", () => {
  const document = editor("alpha\nbeta");
  document.keys("dd");
  assert.equal(document.source.value, "beta");
  assert.equal(document.state.vimYank, "alpha\n");
  assert.equal(document.state.vimYankLine, true);
  document.key("i");
  assert.equal(document.state.vimMode, "insert");
  assert.equal(document.state.vimPending, "");
  assert.deepEqual(document.key("w"), { handled: false, prevented: false });
});
