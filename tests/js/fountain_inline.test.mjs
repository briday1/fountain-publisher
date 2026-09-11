import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { parseFountainInline, replaceFountainRange } from "../../src/fountain_publisher/web/fountain-inline.mjs";

test("Preview renders the same supported inline corpus as the export engine", async () => {
  const corpus = JSON.parse(await readFile(new URL("../fixtures/fountain-inline.json", import.meta.url), "utf8"));
  const names = ["bold", "italic", "underline"];
  for (const fixture of corpus) {
    const actual = parseFountainInline(fixture.source).runs.flatMap((run) =>
      Array.from(run.text, (character) => [character, names.filter((_, style) => run.styles & (1 << style))]));
    const expected = fixture.runs.flatMap((run) => Array.from(run.text, (character) => [character, [...run.styles].sort()]));
    assert.deepEqual(actual, expected, fixture.source);
  }
});

const fixtures = [
  ["", "", ""],
  ["ordinary text", "ordinary text", "ordinary text"],
  ["*a*", "a", "<em>a</em>"],
  ["**a**", "a", "<strong>a</strong>"],
  ["***a***", "a", "<strong><em>a</em></strong>"],
  ["_a_", "a", "<u>a</u>"],
  ["**bold *italic* end**", "bold italic end", "<strong>bold </strong><strong><em>italic</em></strong><strong> end</strong>"],
  ["*italic **bold** end*", "italic bold end", "<em>italic </em><strong><em>bold</em></strong><em> end</em>"],
  ["_under **bold**_", "under bold", "<u>under </u><strong><u>bold</u></strong>"],
  ["**bold _under *all*_ end**", "bold under all end", "<strong>bold </strong><strong><u>under </u></strong><strong><em><u>all</u></em></strong><strong> end</strong>"],
  [String.raw`\*literal\*`, "*literal*", "*literal*"],
  [String.raw`\_literal`, String.raw`\_literal`, String.raw`\_literal`],
  [String.raw`\_literal\_`, "\\literal\\", "\\<u>literal\\</u>"],
  [String.raw`**a \*literal\* b**`, "a *literal* b", "<strong>a *literal* b</strong>"],
  [String.raw`C:\Users\writer`, String.raw`C:\Users\writer`, String.raw`C:\Users\writer`],
  [String.raw`one \\ two`, String.raw`one \\ two`, String.raw`one \\ two`],
  ["* a *", "* a *", "* a *"],
  ["unmatched **text", "unmatched **text", "unmatched **text"],
  ["****", "****", "****"],
  ["*line\nbreak*", "*line\nbreak*", "*line\nbreak*"],
  ["**😀e\u0301👩‍👩‍👧‍👦**", "😀e\u0301👩‍👩‍👧‍👦", "<strong>😀e\u0301👩‍👩‍👧‍👦</strong>"],
  ['**<script>&"**', '<script>&"', "<strong>&lt;script&gt;&amp;&quot;</strong>"],
];

for (const [source, visible, html] of fixtures) {
  test(`inline model renders and maps ${JSON.stringify(source)}`, () => {
    const model = parseFountainInline(source);
    assert.equal(model.source, source, "parsing never rewrites authoritative source");
    assert.equal(model.text, visible);
    assert.equal(model.html, html);
    assert.equal(model.runs.map((run) => run.text).join(""), visible);
    const map = model.sourceMap;
    for (const edges of [map.startMap, map.endMap, map.caretMap]) {
      assert.equal(edges.length, visible.length + 1);
      for (let offset = 0; offset < edges.length; offset += 1) {
        assert.equal(map.toDisplay(edges[offset]), offset, `bidirectional offset ${offset}`);
        if (offset) assert.ok(edges[offset] >= edges[offset - 1], "source affinity is monotonic");
      }
    }
    assert.equal(map.sourceToDisplay.length, source.length + 1);
    for (let offset = 0; offset <= source.length; offset += 1) {
      assert.ok(map.toDisplay(offset) >= 0 && map.toDisplay(offset) <= visible.length);
      if (offset) assert.ok(map.toDisplay(offset) >= map.toDisplay(offset - 1));
    }
  });
}

test("nested active markers use the same spans as rendering and mapping", () => {
  const source = "**bold _under *all*_ end**";
  const model = parseFountainInline(source);
  assert.deepEqual(model.activeMarkersAt(source.indexOf("all") + 1), ["**", "_", "*"]);
  assert.deepEqual(model.activeMarkersAt(source.indexOf(" end") + 1), ["**"]);
  assert.deepEqual(parseFountainInline("***a***").activeMarkersAt(3), ["***"]);
  assert.deepEqual(parseFountainInline(String.raw`\*literal\*`).activeMarkersAt(3), []);
});

test("caret affinity exits completed styles and selection affinity preserves delimiters", () => {
  const model = parseFountainInline("**a** tail");
  assert.equal(model.sourceMap.caretMap[0], 0);
  assert.equal(model.sourceMap.startMap[0], 2);
  assert.equal(model.sourceMap.endMap[1], 3);
  assert.equal(model.sourceMap.caretMap[1], 5);
});

function replaceVisible(source, start, end, replacement) {
  const map = parseFountainInline(source).sourceMap;
  return replaceFountainRange(source, map.startMap[start], map.endMap[end], replacement);
}

test("deleting entire styled text removes only its affected empty wrappers", () => {
  for (const marker of ["*", "**", "***", "_"]) {
    const result = replaceVisible(`before ${marker}a${marker} after`, 7, 8, "");
    assert.equal(result.source, "before  after");
    assert.equal(result.caret, 7);
  }
  assert.equal(replaceVisible("**a *b* c**", 0, 5, "").source, "");
  assert.equal(replaceVisible("**a *b* c**", 0, 5, "X").source, "**X**");
});

test("partial selections preserve formatting of text on either side", () => {
  for (const [source, start, end, inserted, expected] of [
    ["**abc** tail", 1, 6, "X", "**aX**il"],
    ["head **abc**", 2, 6, "X", "heX**bc**"],
    ["**abc** _def_", 1, 5, "X", "**aX**_ef_"],
    ["**abc** _def_", 1, 5, "", "**a**_ef_"],
    [String.raw`\*literal\*`, 0, 1, "", String.raw`literal\*`],
  ]) {
    const result = replaceVisible(source, start, end, inserted);
    assert.equal(result.source, expected);
    const text = parseFountainInline(source).text;
    assert.equal(parseFountainInline(result.source).text, text.slice(0, start) + inserted + text.slice(end));
  }
});

test("no-op edits preserve the exact Fountain source", () => {
  for (const [source] of fixtures) {
    const model = parseFountainInline(source);
    for (const offset of model.sourceMap.caretMap) {
      assert.equal(replaceFountainRange(source, offset, offset, "").source, source);
    }
  }
});

test("deleting a word at a style edge does not expose markers or discard whitespace", () => {
  assert.equal(replaceVisible("**one two**", 0, 3, "").source, " **two**");
  assert.equal(replaceVisible("**one two**", 4, 7, "").source, "**one** ");
  assert.equal(replaceVisible("***one two***", 0, 3, "").source, " ***two***");
  assert.equal(replaceVisible("**one two**", 0, 7, " ").source, " ");
});

test("every selection in a nested/escaped corpus changes exactly the intended visible range", () => {
  for (const source of [
    "**one two**", "**one *two* three**", "_a **b c** d_",
    "head **abc** tail", "**abc** _def_", String.raw`**a \*literal\* b**`,
  ]) {
    const model = parseFountainInline(source);
    for (let start = 0; start < model.text.length; start += 1) {
      for (let end = start + 1; end <= model.text.length; end += 1) {
        for (const replacement of ["", "X", " "]) {
          const result = replaceVisible(source, start, end, replacement);
          assert.equal(parseFountainInline(result.source).text,
            model.text.slice(0, start) + replacement + model.text.slice(end),
            `${JSON.stringify(source)}: ${start}–${end}, ${JSON.stringify(replacement)}`);
          assert.ok(result.caret >= 0 && result.caret <= result.source.length);
          assert.equal(parseFountainInline(result.source).sourceMap.toDisplay(result.caret), start + replacement.length);
        }
      }
    }
  }
});

test("inline parsing remains bounded for long and delimiter-heavy lines", () => {
  const source = `${"**bold** _under_ ".repeat(12_000)}tail`;
  const model = parseFountainInline(source);
  assert.equal(model.text, `${"bold under ".repeat(12_000)}tail`);
  assert.equal(model.sourceMap.toDisplay(source.length), model.text.length);
  assert.equal(parseFountainInline("*".repeat(100_000)).text.length, 100_000);
});
