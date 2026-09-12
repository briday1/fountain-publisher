import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

const app = await readFile(new URL("../../src/fountain_publisher/web/app.mjs", import.meta.url), "utf8");
const helpers = app.slice(app.indexOf("function isScene("), app.indexOf("function analyzeLocally("));
assert.ok(helpers.includes("function classifyFountainLines("));

function harness() {
  const context = { docSettings: { sceneNumbers: "margin", sceneNumberFormat: "sequential" }, state: { metadata: {} } };
  runInNewContext(`${app.match(/^const TITLE_KEYS = .+;$/m)[0]}\n${helpers}`, context);
  const classify = context.classifyFountainLines;
  let parses = 0;
  context.classifyFountainLines = (text) => { parses += 1; return classify(text); };
  return { context, classify, get parses() { return parses; } };
}

test("cursor and rendering consumers share one classification for the exact source snapshot", () => {
  const h = harness();
  const text = "INT. OFFICE - DAY\n\nMAYA\nHello.";
  const first = h.context.classifyLines(text);
  for (let index = 0; index < 120; index += 1) assert.equal(h.context.classifyLines(text), first);
  assert.equal(h.parses, 1, "caret movement must not reparse every line");
  assert.equal(first[3].type, "dialogue");
});

test("every source edit invalidates classification, including equal-length context changes", () => {
  const h = harness();
  const dialogue = h.context.classifyLines("MAYA\nHello.");
  const action = h.context.classifyLines("Maya\nHello.");
  assert.equal(dialogue[1].type, "dialogue");
  assert.equal(action[1].type, "action");
  assert.notEqual(dialogue, action);
  assert.equal(h.parses, 2);
  const buried = h.context.classifyLines("/*\nMAYA\nHello.\n*/");
  assert.ok(buried.every((line) => line.type === "boneyard"));
  const revealed = h.context.classifyLines("\nMAYA\nHello.\n");
  assert.equal(revealed[2].type, "dialogue");
  assert.equal(h.parses, 4);
});

test("cache retains only the latest document instead of accumulating edits or open files", () => {
  const h = harness();
  const first = h.context.classifyLines("first document");
  for (let index = 0; index < 300; index += 1) h.context.classifyLines(`document ${index}`);
  assert.notEqual(h.context.classifyLines("first document"), first);
  assert.equal(h.parses, 302, "revisiting an evicted snapshot parses it again");
  assert.deepEqual(Object.keys(h.context.classifyLines.cached).sort(), ["lines", "text"]);
  assert.equal(h.context.classifyLines.cached.text, "first document");
});

test("cached arrays and line records cannot be poisoned by a rendering consumer", () => {
  const h = harness();
  const text = "MAYA\nHello.";
  const lines = h.context.classifyLines(text);
  assert.ok(Object.isFrozen(lines));
  assert.ok(lines.every(Object.isFrozen));
  assert.throws(() => { lines[0].type = "action"; }, TypeError);
  assert.throws(() => { lines[1] = { type: "scene" }; }, TypeError);
  assert.throws(() => { lines.push({ type: "note" }); }, /extensible|read only/);
  assert.equal(h.context.classifyLines(text)[0].type, "character");
  assert.equal(h.context.classifyLines(text).length, 2);
});

test("display settings and compiled metadata do not invalidate source-only classification", () => {
  const h = harness();
  const text = "# Act One\n\nINT. OFFICE - DAY\n\nMAYA\nHello.";
  const first = h.context.classifyLines(text);
  h.context.docSettings = { sceneNumbers: "inline", sceneNumberFormat: "act" };
  h.context.state.metadata = { pageCount: 123, lastPageEighths: 5 };
  assert.equal(h.context.classifyLines(text), first);
  assert.equal(h.parses, 1);
});

test("cached classification equals the original grammar for blank, title, forced, hidden and Unicode text", () => {
  const h = harness();
  const examples = [
    "", "\n", "\n\n", "Title: A test\n    continuation\nAuthor: Writer\n\nINT. ROOM - DAY",
    "MAYA\nHello.\n!A door closes.\nAction continues.",
    "@ÉLODIE\nBonjour, café. 👩‍💻\n\n@小林\nこんにちは。",
    "MAYA\nHello.\n> CUT TO:\nA room.", "MAYA  \nUppercase action.",
    "[[ordinary note]]\n[[FP-GENERAL:Hello%20world]]\n\n= Synopsis\n# Act One\n### Sequence",
    "/*\nINT. HIDDEN - DAY\n\nMAYA\nHidden dialogue.\n*/\nINT. VISIBLE - DAY",
    "> CENTERED <\n~song lyrics\n===\n.FORCED HEADING\n...a pause",
    "MAYA\n(left)\nHello.\n\nLEO ^\n(right)\nHi.",
  ];
  for (const source of examples) {
    for (const text of [source, source.replaceAll("\n", "\r\n"), source.replaceAll("\n", "\r")]) {
      assert.deepEqual(h.context.classifyLines(text), h.classify(text));
      assert.deepEqual(h.context.classifyLines(text), h.classify(text), "cache-hit output must match a fresh parse");
    }
  }
});

test("newline normalization remains equivalent without treating distinct source strings as cache hits", () => {
  const h = harness();
  const lf = h.context.classifyLines("MAYA\nHello.");
  const crlf = h.context.classifyLines("MAYA\r\nHello.");
  assert.deepEqual(lf, crlf);
  assert.notEqual(lf, crlf);
  assert.equal(h.parses, 2);
});
